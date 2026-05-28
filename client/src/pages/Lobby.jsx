import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const ROOM_ICONS = {
  'Hot Chat': '🔥', 'Flirty Lounge': '💋', 'Dating Talk': '💘',
  'Spicy Stories': '🌶️', 'Roleplay': '🎭', 'Couples Corner': '💑',
  'Late Night': '🌙', 'Global Desires': '🌍',
};

export default function Lobby() {
  const { user, logout } = useAuth();
  const { connected, onlineCount } = useSocket();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('chat_token');
    fetch('/api/rooms', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRooms(data);
      })
      .catch(() => setError('Could not load rooms'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="lobby-layout">
      <header className="lobby-header">
        <div className="lobby-brand">
          <span className="brand-logo">🔥</span>
          <span className="brand-name">RaunchyChat</span>
        </div>
        <div className="lobby-header-right">
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
          <span className="online-count">{onlineCount} online</span>
          <div className="user-chip">
            <span className="user-avatar">{user?.username?.[0]?.toUpperCase()}</span>
            <span className="user-name">{user?.username}</span>
            {user?.isGuest && <span className="guest-badge">Guest</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <main className="lobby-main">
        <div className="lobby-welcome">
          <h2>Welcome back, {user?.username}!</h2>
          <p>
            {user?.age} · {user?.gender} · {user?.state}, {user?.country}
          </p>
        </div>

        <h3 className="section-title">Choose a Room</h3>

        {loading && <div className="loader">Loading rooms…</div>}
        {error && <div className="error-banner">{error}</div>}

        <div className="rooms-grid">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="room-card"
              onClick={() => navigate(`/room/${room.id}`)}
            >
              <span className="room-icon">{ROOM_ICONS[room.name] || '💬'}</span>
              <div className="room-info">
                <h4>{room.name}</h4>
                <p>{room.description}</p>
              </div>
              <span className="room-arrow">→</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
