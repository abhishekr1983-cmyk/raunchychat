import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useSiteSettings } from '../contexts/SiteSettingsContext';
import PrivateChat from '../components/Chat/PrivateChat';
import IncomingCallModal from '../components/Call/IncomingCallModal';
import VideoCall from '../components/Call/VideoCall';
import ProfileModal from '../components/Profile/ProfileModal';
import { getFlag } from '../utils/flags';
import { getAvatarStyle, getInitial } from '../utils/avatar';
import { useNavigate } from 'react-router-dom';

export default function Chat() {
  const { user, logout } = useAuth();
  const { socket, connected, onlineCount } = useSocket();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();

  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unread, setUnread] = useState({});
  const [callState, setCallState] = useState(null);
  const [showConfJoin, setShowConfJoin] = useState(false);
  const [confCode, setConfCode] = useState('');
  const [confErr, setConfErr] = useState('');
  const [profileModal, setProfileModal] = useState(null); // null | {mode:'edit'} | {mode:'view',userId}
  const [search, setSearch] = useState('');
  const [genderTab, setGenderTab] = useState('All'); // 'All' | 'Male' | 'Female'
  const [leftTab, setLeftTab] = useState('people');  // 'people' | 'messages'
  const [recentChats, setRecentChats] = useState([]);
  const [recentlyJoined, setRecentlyJoined] = useState(new Set());
  const recentTimers = useRef({});
  // Stable per-session shuffle: map userId → random sort key assigned on first sight
  const userOrderMap = useRef(new Map());

  // Socket events — handlers
  useEffect(() => {
    if (!socket) return;

    const handleRoomUsers = (users) => {
      if (!Array.isArray(users)) return;
      users.forEach((u) => { if (!userOrderMap.current.has(u.id)) userOrderMap.current.set(u.id, Math.random()); });
      setAllUsers(users);
    };
    const handleUserJoined = (u) => {
      if (!userOrderMap.current.has(u.id)) userOrderMap.current.set(u.id, Math.random());
      setAllUsers((prev) => prev.find((p) => p.id === u.id) ? prev : [...prev, u]);
      // Highlight the newly joined user for 4 seconds
      setRecentlyJoined((prev) => new Set([...prev, u.id]));
      if (recentTimers.current[u.id]) clearTimeout(recentTimers.current[u.id]);
      recentTimers.current[u.id] = setTimeout(() => {
        setRecentlyJoined((prev) => { const s = new Set(prev); s.delete(u.id); return s; });
        delete recentTimers.current[u.id];
      }, 4000);
    };
    const handleUserLeft = (u) => {
      setAllUsers((prev) => prev.filter((p) => p.id !== u.id));
      setSelectedUser((sel) => sel?.id === u.id ? null : sel);
    };
    const handleNewPrivateMessage = (msg) => {
      if (msg.sender_id !== user?.id) {
        setSelectedUser((sel) => {
          if (sel?.id !== msg.sender_id) {
            setUnread((prev) => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }));
          }
          return sel;
        });
      }
    };
    const handleIncomingCall = ({ callerId, callerName, callerGender, callType }) => {
      if (callState?.type === 'active') { socket.emit('call-rejected', { callerId }); return; }
      setCallState({ type: 'incoming', caller: { id: callerId, username: callerName, gender: callerGender, callType } });
    };
    const handleCallAccepted = ({ accepterId, accepterName, callType }) =>
      setCallState({ type: 'active', peer: { id: accepterId, username: accepterName }, callType, isInitiator: true });
    const handleCallRejected = ({ name }) => { setCallState(null); alert(`${name} declined the call.`); };
    const handleCallEnded = () => setCallState(null);
    const handleCallError = (msg) => { setCallState(null); alert(msg); };

    socket.on('room-users', handleRoomUsers);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('new-private-message', handleNewPrivateMessage);
    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-error', handleCallError);
    socket.on('conference-created', ({ code }) => {
      window.open(`/conference/${code}`, '_blank');
    });
    socket.on('conf-error', (msg) => setConfErr(typeof msg === 'string' ? msg : msg?.message || 'Error'));

    return () => {
      socket.off('room-users', handleRoomUsers);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('new-private-message', handleNewPrivateMessage);
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-error', handleCallError);
      socket.off('conference-created');
      socket.off('conf-error');
    };
  }, [socket]);

  // ── Recent chats (Messages tab) ─────────────────────────────
  const fetchRecentChats = useCallback(() => {
    if (socket) socket.emit('get-recent-chats');
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    socket.on('recent-chats', setRecentChats);
    socket.on('refresh-recent-chats', fetchRecentChats);
    return () => {
      socket.off('recent-chats', setRecentChats);
      socket.off('refresh-recent-chats', fetchRecentChats);
    };
  }, [socket, fetchRecentChats]);

  // Fetch when switching to messages tab
  useEffect(() => {
    if (leftTab === 'messages') fetchRecentChats();
  }, [leftTab, fetchRecentChats]);

  // Room join is now handled server-side inside the authenticate handler —
  // no client-side join-room emission needed, which eliminates the race condition.

  const filteredUsers = useMemo(() => {
    return allUsers
      .filter((u) => u.id !== user?.id)
      .filter((u) => !search || u.username.toLowerCase().includes(search.toLowerCase()))
      .filter((u) => genderTab === 'All' || u.gender === genderTab)
      .sort((a, b) => (userOrderMap.current.get(a.id) ?? 0) - (userOrderMap.current.get(b.id) ?? 0));
  }, [allUsers, user, search, genderTab]);

  const openChat = useCallback((u) => {
    setSelectedUser(u);
    setUnread((prev) => ({ ...prev, [u.id]: 0 }));
  }, []);

  const initiateCall = useCallback((targetUser, callType) => {
    if (!socket) return;
    setCallState({ type: 'outgoing', peer: targetUser, callType });
    socket.emit('call-request', { targetUserId: targetUser.id, callType });
  }, [socket]);

  const acceptCall = useCallback(() => {
    if (!socket || callState?.type !== 'incoming') return;
    const { caller } = callState;
    socket.emit('call-accepted', { callerId: caller.id, callType: caller.callType });
    setCallState({ type: 'active', peer: { id: caller.id, username: caller.username }, callType: caller.callType, isInitiator: false });
  }, [socket, callState]);

  const rejectCall = useCallback(() => {
    if (!socket || callState?.type !== 'incoming') return;
    socket.emit('call-rejected', { callerId: callState.caller.id });
    setCallState(null);
  }, [socket, callState]);

  const createConference = useCallback(() => {
    if (!socket) return;
    socket.emit('create-conference', { name: `${user?.username}'s Room` });
  }, [socket, user]);

  const joinConference = useCallback(() => {
    const c = confCode.trim().toUpperCase();
    if (!c || c.length < 4) { setConfErr('Please enter a valid room code'); return; }
    window.open(`/conference/${c}`, '_blank');
    setShowConfJoin(false);
    setConfCode('');
    setConfErr('');
  }, [confCode]);

  const others = allUsers.filter((u) => u.id !== user?.id);

  return (
    <div className={`chat-layout${selectedUser ? ' chat-open' : ''}`}>

      {/* ── Top header ── */}
      <header className="chat-header">
        <div className="ch-brand">
          <span className="brand-logo">{settings.site_logo}</span>
          <span className="brand-name">{settings.site_name}</span>
        </div>

        <div className="ch-center">
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
          <span className="ch-online">{onlineCount} online</span>
          {callState?.type === 'outgoing' && (
            <div className="calling-banner">
              📞 Calling {callState.peer.username}…
              <button className="btn btn-danger btn-sm" onClick={() => {
                socket.emit('call-ended', { peerId: callState.peer.id });
                setCallState(null);
              }}>Cancel</button>
            </div>
          )}
        </div>

        <div className="ch-right">
          <button className="user-chip user-chip-btn" onClick={() => setProfileModal({ mode: 'edit' })} title="Edit your profile">
            <div className="user-avatar" style={getAvatarStyle(user?.username || '?')}>
              {user?.avatarEmoji || getInitial(user?.username || '?')}
            </div>
            <span className="user-name">{user?.username}</span>
            {user?.isGuest && <span className="guest-badge">Guest</span>}
            <span className="user-chip-edit">✎</span>
          </button>
          <button className="btn btn-sm conf-create-btn" onClick={createConference} title="Create conference room">
            📹 Create Room
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setShowConfJoin(true); setConfErr(''); setConfCode(''); }} title="Join conference room">
            🔗 Join Room
          </button>
          {user?.isAdmin && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')} title="Admin Panel">⚙ Admin</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      {/* ── Left: User list panel ── */}
      <aside className="user-list-panel">

        {/* Top-level tabs: People | Messages */}
        <div className="ulp-main-tabs">
          <button className={`ulp-main-tab ${leftTab === 'people' ? 'active' : ''}`} onClick={() => setLeftTab('people')}>
            People
          </button>
          <button className={`ulp-main-tab ${leftTab === 'messages' ? 'active' : ''}`} onClick={() => { setLeftTab('messages'); fetchRecentChats(); }}>
            Messages
          </button>
        </div>

        {leftTab === 'people' ? (
          <>
            {/* Search box */}
            <div className="ulp-search-row">
              <input className="ulp-search" placeholder="🔍  Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {/* Gender filter tabs */}
            <div className="ulp-gender-tabs">
              {['All', 'Male', 'Female'].map((tab) => (
                <button key={tab} className={`ulp-gender-tab ${genderTab === tab ? 'active' : ''}`} onClick={() => setGenderTab(tab)}>
                  {tab === 'Male' ? '♂ Men' : tab === 'Female' ? '♀ Women' : 'All'}
                </button>
              ))}
            </div>

            {/* Online count */}
            <div className="ulp-count">
              <span className="ulp-count-dot" />
              ONLINE {onlineCount}
              <span className="ulp-shown">· showing {filteredUsers.length}</span>
            </div>

            {/* User list */}
            <div className="ulp-list">
              {filteredUsers.length === 0 ? (
                <div className="ulp-empty">{others.length === 0 ? '🌙 No one online yet' : '🔍 No matches'}</div>
              ) : (
                filteredUsers.map((u) => {
                  const unreadCount = unread[u.id] || 0;
                  const isActive = selectedUser?.id === u.id;
                  const isNew = recentlyJoined.has(u.id) && u.id > 0;
                  return (
                    <div
                      key={u.id}
                      className={`ulp-item gender-${(u.gender || 'other').toLowerCase()} ${isActive ? 'active' : ''} ${isNew ? 'new-join' : ''}`}
                      onClick={() => openChat(u)}
                    >
                      <div className="ulp-avatar" style={getAvatarStyle(u.username)}>
                        {u.avatarEmoji || getInitial(u.username)}
                        <span className="ulp-online-ring" />
                      </div>
                      <div className="ulp-info">
                        <div className="ulp-name">
                          {u.isAdmin && <span className="ulp-crown" title="Admin">👑</span>}
                          {u.username}
                          {unreadCount > 0 && <span className="ulp-badge">{unreadCount}</span>}
                        </div>
                        <div className="ulp-meta">{u.age} · {u.state}, {u.country} {getFlag(u.country)}</div>
                      </div>
                      <button
                        className="ulp-profile-btn"
                        title={`View ${u.username}'s profile`}
                        onClick={(e) => { e.stopPropagation(); setProfileModal({ mode: 'view', userId: u.id }); }}
                      >ⓘ</button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* ── Messages tab: recent conversations ── */
          <div className="ulp-list">
            {recentChats.length === 0 ? (
              <div className="ulp-empty">💬 No conversations yet.<br />Start chatting with someone!</div>
            ) : (
              recentChats.map((chat) => {
                const u = chat.user;
                const isActive = selectedUser?.id === u.id;
                const unreadCount = unread[u.id] || 0;
                return (
                  <div
                    key={u.id}
                    className={`ulp-item gender-${(u.gender || 'other').toLowerCase()} ${isActive ? 'active' : ''}`}
                    onClick={() => openChat(u)}
                  >
                    <div className="ulp-avatar" style={getAvatarStyle(u.username)}>
                      {getInitial(u.username)}
                    </div>
                    <div className="ulp-info">
                      <div className="ulp-name">
                        {u.username}
                        {unreadCount > 0 && <span className="ulp-badge">{unreadCount}</span>}
                      </div>
                      <div className="ulp-meta ulp-last-msg">
                        {chat.isOwn && <span className="ulp-you">You: </span>}
                        {chat.lastMessage?.slice(0, 35)}{chat.lastMessage?.length > 35 ? '…' : ''}
                      </div>
                    </div>
                    <div className="ulp-msg-time">
                      {new Date(chat.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </aside>

      {/* ── Right: Chat main ── */}
      <main className="chat-main">
        {selectedUser ? (
          <PrivateChat
            peer={selectedUser}
            socket={socket}
            currentUser={user}
            onClose={() => setSelectedUser(null)}
            onBack={() => setSelectedUser(null)}
            onCall={initiateCall}
            onViewProfile={(id) => setProfileModal({ mode: 'view', userId: id })}
            callState={callState}
          />
        ) : (
          <div className="chat-welcome">
            <div className="cw-icon">💬</div>
            <h2 className="cw-title">Start a Conversation</h2>
            <p className="cw-sub">
              {others.length === 0
                ? 'Waiting for others to join…'
                : `${others.length} ${others.length === 1 ? 'person' : 'people'} online — pick someone to chat with`}
            </p>
          </div>
        )}
      </main>

      {/* ── Profile modal (edit own / view others) ── */}
      {profileModal && (
        <ProfileModal
          mode={profileModal.mode}
          viewUserId={profileModal.userId}
          onClose={() => setProfileModal(null)}
          onMessage={profileModal.mode === 'view' ? (peer) => openChat(peer) : undefined}
        />
      )}

      {/* ── Modals / overlays ── */}
      {callState?.type === 'incoming' && (
        <IncomingCallModal caller={callState.caller} onAccept={acceptCall} onReject={rejectCall} />
      )}
      {callState?.type === 'active' && (
        <VideoCall
          peer={callState.peer}
          callType={callState.callType}
          isInitiator={callState.isInitiator}
          socket={socket}
          onEnd={() => setCallState(null)}
        />
      )}

      {/* Join Room modal */}
      {showConfJoin && (
        <div className="modal-overlay" onClick={() => setShowConfJoin(false)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowConfJoin(false)}>✕</button>
            <h2 style={{ marginBottom: 16, fontSize: '1.2rem' }}>Join a Conference Room</h2>
            {confErr && <div className="form-error" style={{ marginBottom: 12 }}>{confErr}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="cb-input"
                placeholder="Enter 6-character room code…"
                value={confCode}
                onChange={e => setConfCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && joinConference()}
                style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '1.1rem', textAlign: 'center' }}
              />
              <button className="btn btn-primary" onClick={joinConference} disabled={confCode.trim().length < 6}>
                Join Room →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
