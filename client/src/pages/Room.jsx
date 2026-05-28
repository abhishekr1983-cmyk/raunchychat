import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import PrivateChat from '../components/Chat/PrivateChat';
import IncomingCallModal from '../components/Call/IncomingCallModal';
import VideoCall from '../components/Call/VideoCall';

const GENDER_ICON = { Male: '♂', Female: '♀', 'Non-binary': '⚧', 'Prefer not to say': '?' };

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { socket, connected, onlineCount } = useSocket();

  const [roomName, setRoomName] = useState('');
  const [roomUsers, setRoomUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unread, setUnread] = useState({});   // userId -> count
  const [callState, setCallState] = useState(null);

  // Fetch room name
  useEffect(() => {
    const token = localStorage.getItem('chat_token');
    fetch('/api/rooms', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((rooms) => {
        const found = rooms.find((r) => String(r.id) === String(roomId));
        if (found) setRoomName(found.name);
      })
      .catch(() => {});
  }, [roomId]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const handleRoomUsers = (users) => setRoomUsers(Array.isArray(users) ? users : []);

    const handleUserJoined = (u) => {
      setRoomUsers((prev) => prev.find((p) => p.id === u.id) ? prev : [...prev, u]);
    };

    const handleUserLeft = (u) => {
      setRoomUsers((prev) => prev.filter((p) => p.id !== u.id));
      setSelectedUser((sel) => (sel?.id === u.id ? null : sel));
    };

    const handleNewPrivateMessage = (msg) => {
      // Track unread for messages from others when their chat isn't open
      if (msg.sender_id !== user.id) {
        setSelectedUser((sel) => {
          if (sel?.id !== msg.sender_id) {
            setUnread((prev) => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }));
          }
          return sel;
        });
      }
    };

    const handleIncomingCall = ({ callerId, callerName, callerGender, callType }) => {
      if (callState?.type === 'active') {
        socket.emit('call-rejected', { callerId });
        return;
      }
      setCallState({ type: 'incoming', caller: { id: callerId, username: callerName, gender: callerGender, callType } });
    };

    const handleCallAccepted = ({ accepterId, accepterName, callType }) => {
      setCallState({ type: 'active', peer: { id: accepterId, username: accepterName }, callType, isInitiator: true });
    };

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

    socket.emit('join-room', Number(roomId));

    return () => {
      socket.emit('leave-room', Number(roomId));
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
  }, [socket, roomId]);

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

  const cancelOutgoing = useCallback(() => {
    if (!socket || callState?.type !== 'outgoing') return;
    socket.emit('call-ended', { peerId: callState.peer.id });
    setCallState(null);
  }, [socket, callState]);

  const others = roomUsers.filter((u) => u.id !== user?.id);
  const me = roomUsers.find((u) => u.id === user?.id);

  return (
    <div className={`room-layout ${selectedUser ? 'chat-open' : ''}`}>

      {/* Sidebar */}
      <aside className="room-sidebar">
        <div className="sidebar-header">
          <button className="btn btn-ghost btn-sm back-btn" onClick={() => navigate('/lobby')}>← Lobby</button>
          <div className="room-title">#{roomName || `Room ${roomId}`}</div>
        </div>
        <div className="sidebar-user">
          <span className="user-avatar sm">{user?.username?.[0]?.toUpperCase()}</span>
          <div>
            <div className="fw-600">{user?.username}</div>
            <div className="text-muted text-sm">{user?.isGuest ? 'Guest' : 'Member'}</div>
          </div>
        </div>
        <div className="sidebar-stats">
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
          <span className="text-muted text-sm">{onlineCount} online globally</span>
        </div>
        <button className="btn btn-ghost btn-sm signout-btn" onClick={logout}>Sign Out</button>
      </aside>

      {/* Who's here */}
      <main className="room-main">
        <div className="room-header">
          <div>
            <h2>#{roomName || `Room ${roomId}`}</h2>
            <span className="text-muted text-sm">{others.length} {others.length === 1 ? 'person' : 'people'} here — click anyone to chat privately</span>
          </div>
          {callState?.type === 'outgoing' && (
            <div className="calling-banner">
              📞 Calling {callState.peer.username}…
              <button className="btn btn-danger btn-sm" onClick={cancelOutgoing}>Cancel</button>
            </div>
          )}
        </div>

        {others.length === 0 ? (
          <div className="room-empty">
            <div className="room-empty-icon">🌙</div>
            <p>No one else is here yet.</p>
            <p className="text-muted text-sm">Share the room link and get the party started.</p>
          </div>
        ) : (
          <div className="who-is-here">
            {others.map((u) => {
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
                  <div className="uc-meta">
                    {GENDER_ICON[u.gender] || ''} {u.age} · {u.country}
                  </div>
                  <div className="uc-state">{u.state}</div>
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
