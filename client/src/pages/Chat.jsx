import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import PrivateChat from '../components/Chat/PrivateChat';
import IncomingCallModal from '../components/Call/IncomingCallModal';
import VideoCall from '../components/Call/VideoCall';
import { COUNTRIES } from '../data/countries';
import { getStates } from '../data/countryStates';
import ThemeSelector from '../components/ThemeSelector';

const GLOBAL_ROOM = 1;
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

export default function Chat() {
  const { user, logout } = useAuth();
  const { socket, connected, isAuthenticated, onlineCount } = useSocket();

  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unread, setUnread] = useState({});
  const [callState, setCallState] = useState(null);

  // Filters
  const [filterGender, setFilterGender] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState(18);
  const [filterAgeMax, setFilterAgeMax] = useState(99);

  const filterStates = getStates(filterCountry);

  // Socket events
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

  // Join the global room only after the server has confirmed authentication.
  // Previously join-room was fired immediately, racing against the async DB
  // lookup in the authenticate handler — users appeared online but never
  // entered the room so no one could see each other.
  useEffect(() => {
    if (!socket || !isAuthenticated) return;
    socket.emit('join-room', GLOBAL_ROOM);
    return () => socket.emit('leave-room', GLOBAL_ROOM);
  }, [socket, isAuthenticated]);

  const filteredUsers = useMemo(() => {
    return allUsers
      .filter((u) => u.id !== user?.id)
      .filter((u) => !filterGender || u.gender === filterGender)
      .filter((u) => !filterCountry || u.country === filterCountry)
      .filter((u) => !filterState || u.state === filterState)
      .filter((u) => u.age >= filterAgeMin && u.age <= filterAgeMax);
  }, [allUsers, user, filterGender, filterCountry, filterState, filterAgeMin, filterAgeMax]);

  const resetFilters = () => {
    setFilterGender(''); setFilterCountry(''); setFilterState('');
    setFilterAgeMin(18); setFilterAgeMax(99);
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
    <div className={`chat-layout ${selectedUser ? 'chat-open' : ''}`}>

      {/* Top header */}
      <header className="chat-header">
        <div className="lobby-brand">
          <span className="brand-logo">🔥</span>
          <span className="brand-name">RaunchyChat</span>
        </div>
        <div className="chat-header-center">
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
          <span className="text-muted text-sm">{onlineCount} online</span>
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
        <div className="lobby-header-right">
          <div className="user-chip">
            <span className="user-avatar">{user?.username?.[0]?.toUpperCase()}</span>
            <span className="user-name">{user?.username}</span>
            {user?.isGuest && <span className="guest-badge">Guest</span>}
          </div>
          <ThemeSelector />
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      {/* Filter sidebar */}
      <aside className="filter-sidebar">
        <div className="filter-title">
          Filters
          {hasFilters && (
            <button className="link-btn filter-reset" onClick={resetFilters}>Reset</button>
          )}
        </div>

        <div className="filter-section">
          <div className="filter-label">Gender</div>
          <div className="filter-chips">
            <button
              className={`chip ${!filterGender ? 'active' : ''}`}
              onClick={() => setFilterGender('')}
            >All</button>
            {GENDERS.map((g) => (
              <button
                key={g}
                className={`chip ${filterGender === g ? 'active' : ''}`}
                onClick={() => setFilterGender(g === filterGender ? '' : g)}
              >{g}</button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-label">Country</div>
          <select
            className="filter-select"
            value={filterCountry}
            onChange={(e) => { setFilterCountry(e.target.value); setFilterState(''); }}
          >
            <option value="">Any country</option>
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {filterCountry && (
          <div className="filter-section">
            <div className="filter-label">State / Province</div>
            {filterStates ? (
              <select
                className="filter-select"
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
              >
                <option value="">Any state</option>
                {filterStates.map((s) => <option key={s}>{s}</option>)}
              </select>
            ) : (
              <input
                className="filter-input"
                placeholder="Any state"
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
              />
            )}
          </div>
        )}

        <div className="filter-section">
          <div className="filter-label">Age Range</div>
          <div className="age-range">
            <input
              type="number" className="filter-input age-input"
              value={filterAgeMin} min={18} max={filterAgeMax}
              onChange={(e) => setFilterAgeMin(Number(e.target.value))}
            />
            <span className="text-muted">–</span>
            <input
              type="number" className="filter-input age-input"
              value={filterAgeMax} min={filterAgeMin} max={99}
              onChange={(e) => setFilterAgeMax(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="filter-count">
          {filteredUsers.length} of {others.length} shown
        </div>
      </aside>

      {/* Main user grid */}
      <main className="chat-main">
        {filteredUsers.length === 0 ? (
          <div className="room-empty">
            <div className="room-empty-icon">{others.length === 0 ? '🌙' : '🔍'}</div>
            <p>{others.length === 0 ? 'No one else is online yet.' : 'No users match your filters.'}</p>
            {others.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={resetFilters}>Clear filters</button>
            )}
          </div>
        ) : (
          <div className="who-is-here">
            {filteredUsers.map((u) => {
              const unreadCount = unread[u.id] || 0;
              const isSelected = selectedUser?.id === u.id;
              return (
                <div
                  key={u.id}
                  className={`user-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => openChat(u)}
                >
                  <div className="uc-avatar-wrap">
                    <div className="uc-avatar">{u.username[0].toUpperCase()}</div>
                    {unreadCount > 0 && <span className="uc-badge">{unreadCount}</span>}
                  </div>
                  <div className="uc-name">{u.username}</div>
                  <div className="uc-meta">{u.age} · {u.gender}</div>
                  <div className="uc-state">{u.state}, {u.country}</div>
                  <div className="uc-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="uc-btn chat" title="Private chat" onClick={() => openChat(u)}>💬</button>
                    <button className="uc-btn voice" title="Voice call" disabled={!!callState} onClick={() => initiateCall(u, 'voice')}>📞</button>
                    <button className="uc-btn video" title="Video call" disabled={!!callState} onClick={() => initiateCall(u, 'video')}>📹</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Private chat panel */}
      {selectedUser && (
        <aside className="private-chat-panel">
          <PrivateChat
            peer={selectedUser}
            socket={socket}
            currentUser={user}
            onClose={() => setSelectedUser(null)}
          />
        </aside>
      )}

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
