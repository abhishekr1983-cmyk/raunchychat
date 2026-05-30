import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import PrivateChat from '../components/Chat/PrivateChat';
import IncomingCallModal from '../components/Call/IncomingCallModal';
import VideoCall from '../components/Call/VideoCall';
import { COUNTRIES } from '../data/countries';
import { getStates } from '../data/countryStates';
import { getFlag } from '../utils/flags';
import ThemeSelector from '../components/ThemeSelector';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

function getAvatarColor(gender) {
  if (gender === 'Female') return 'var(--avatar-female, #e91e8c)';
  if (gender === 'Male') return 'var(--avatar-male, #1e88e5)';
  return 'var(--accent)';
}

export default function Chat() {
  const { user, logout } = useAuth();
  const { socket, connected, onlineCount } = useSocket();

  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unread, setUnread] = useState({});
  const [callState, setCallState] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');

  // Filters
  const [filterGender, setFilterGender] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState(18);
  const [filterAgeMax, setFilterAgeMax] = useState(99);
  const filterStates = getStates(filterCountry);

  // Socket events — handlers
  useEffect(() => {
    if (!socket) return;

    const handleRoomUsers = (users) => setAllUsers(Array.isArray(users) ? users : []);
    const handleUserJoined = (u) =>
      setAllUsers((prev) => prev.find((p) => p.id === u.id) ? prev : [...prev, u]);
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
    };
  }, [socket]);

  // Room join is now handled server-side inside the authenticate handler —
  // no client-side join-room emission needed, which eliminates the race condition.

  const filteredUsers = useMemo(() => {
    return allUsers
      .filter((u) => u.id !== user?.id)
      .filter((u) => !search || u.username.toLowerCase().includes(search.toLowerCase()))
      .filter((u) => !filterGender || u.gender === filterGender)
      .filter((u) => !filterCountry || u.country === filterCountry)
      .filter((u) => !filterState || u.state === filterState)
      .filter((u) => u.age >= filterAgeMin && u.age <= filterAgeMax);
  }, [allUsers, user, search, filterGender, filterCountry, filterState, filterAgeMin, filterAgeMax]);

  const resetFilters = () => {
    setFilterGender(''); setFilterCountry(''); setFilterState('');
    setFilterAgeMin(18); setFilterAgeMax(99); setSearch('');
  };

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

  const hasFilters = filterGender || filterCountry || filterState || filterAgeMin !== 18 || filterAgeMax !== 99;
  const others = allUsers.filter((u) => u.id !== user?.id);

  return (
    <div className="chat-layout">

      {/* ── Top header ── */}
      <header className="chat-header">
        <div className="ch-brand">
          <span className="brand-logo">🔥</span>
          <span className="brand-name">RaunchyChat</span>
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
          <div className="user-chip">
            <div className="user-avatar" style={{ background: getAvatarColor(user?.gender) }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <span className="user-name">{user?.username}</span>
            {user?.isGuest && <span className="guest-badge">Guest</span>}
          </div>
          <ThemeSelector />
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      {/* ── Left: User list panel ── */}
      <aside className="user-list-panel">
        {/* Search + filter toggle */}
        <div className="ulp-search-row">
          <input
            className="ulp-search"
            placeholder="🔍  Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className={`ulp-filter-btn ${showFilters ? 'active' : ''} ${hasFilters ? 'has-dot' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
            title="Filters"
          >
            ⚙
          </button>
        </div>

        {/* Collapsible filter panel */}
        {showFilters && (
          <div className="ulp-filters">
            <div className="ulf-row">
              <label className="ulf-label">Gender</label>
              <select className="ulf-select" value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}>
                <option value="">Any</option>
                {GENDERS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="ulf-row">
              <label className="ulf-label">Country</label>
              <select className="ulf-select" value={filterCountry}
                onChange={(e) => { setFilterCountry(e.target.value); setFilterState(''); }}>
                <option value="">Any</option>
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {filterCountry && (
              <div className="ulf-row">
                <label className="ulf-label">State</label>
                {filterStates ? (
                  <select className="ulf-select" value={filterState}
                    onChange={(e) => setFilterState(e.target.value)}>
                    <option value="">Any</option>
                    {filterStates.map((s) => <option key={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className="ulf-select" placeholder="Any"
                    value={filterState} onChange={(e) => setFilterState(e.target.value)} />
                )}
              </div>
            )}
            <div className="ulf-row">
              <label className="ulf-label">Age</label>
              <div className="ulf-age">
                <input type="number" className="ulf-age-input" value={filterAgeMin}
                  min={18} max={filterAgeMax}
                  onChange={(e) => setFilterAgeMin(Number(e.target.value))} />
                <span>–</span>
                <input type="number" className="ulf-age-input" value={filterAgeMax}
                  min={filterAgeMin} max={99}
                  onChange={(e) => setFilterAgeMax(Number(e.target.value))} />
              </div>
            </div>
            {hasFilters && (
              <button className="ulf-reset" onClick={resetFilters}>Reset filters</button>
            )}
          </div>
        )}

        {/* Online count bar */}
        <div className="ulp-count">
          <span className="ulp-count-dot" />
          ONLINE {onlineCount}
          <span className="ulp-shown">· showing {filteredUsers.length}</span>
        </div>

        {/* User list */}
        <div className="ulp-list">
          {filteredUsers.length === 0 ? (
            <div className="ulp-empty">
              {others.length === 0 ? '🌙 No one online yet' : '🔍 No matches'}
            </div>
          ) : (
            filteredUsers.map((u) => {
              const unreadCount = unread[u.id] || 0;
              const isActive = selectedUser?.id === u.id;
              return (
                <div
                  key={u.id}
                  className={`ulp-item ${isActive ? 'active' : ''}`}
                  onClick={() => openChat(u)}
                >
                  <div
                    className="ulp-avatar"
                    style={{ background: getAvatarColor(u.gender) }}
                  >
                    {u.username[0].toUpperCase()}
                    <span className="ulp-online-ring" />
                  </div>
                  <div className="ulp-info">
                    <div className="ulp-name">
                      {u.username}
                      {unreadCount > 0 && <span className="ulp-badge">{unreadCount}</span>}
                    </div>
                    <div className="ulp-meta">{u.age} Yrs, {u.state}, {u.country}</div>
                  </div>
                  <span className="ulp-flag">{getFlag(u.country)}</span>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Right: Chat main ── */}
      <main className="chat-main">
        {selectedUser ? (
          <PrivateChat
            peer={selectedUser}
            socket={socket}
            currentUser={user}
            onClose={() => setSelectedUser(null)}
            onCall={initiateCall}
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
    </div>
  );
}
