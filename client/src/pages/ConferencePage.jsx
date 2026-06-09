import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Conference from '../components/Conference';

/**
 * Standalone conference room page — opens in its own browser tab.
 * Creates an independent socket connection so it doesn't share state
 * with the main chat tab.
 */
export default function ConferencePage() {
  const { code } = useParams();
  const upperCode = code?.toUpperCase();

  const [status, setStatus] = useState('connecting'); // connecting | joining | active | error
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [confData, setConfData] = useState(null);
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Read token from whichever storage has it
    const token = sessionStorage.getItem('chat_token') || localStorage.getItem('chat_token');
    if (!token) {
      setError('You must be signed in to join a conference. Please sign in from the main tab first.');
      setStatus('error');
      return;
    }

    const url = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_URL
      ? import.meta.env.VITE_SOCKET_URL
      : window.location.origin;

    const sock = io(url, { transports: ['websocket'] });
    socketRef.current = sock;
    setSocket(sock);

    sock.on('connect', () => {
      sock.emit('authenticate', token);
    });

    sock.on('authenticated', (u) => {
      setUser(u);
      setStatus('joining');
      sock.emit('join-conference', { code: upperCode });
    });

    sock.on('auth-error', () => {
      setError('Session expired. Please sign in again from the main tab.');
      setStatus('error');
    });

    sock.on('account-blocked', ({ reason }) => {
      setError(reason || 'Your account has been blocked.');
      setStatus('error');
    });

    sock.on('conference-joined', ({ code: c, name, members }) => {
      setConfData({ code: c, name, members });
      setStatus('active');
    });

    sock.on('conf-error', (msg) => {
      setError(typeof msg === 'string' ? msg : msg?.message || 'Could not join the room.');
      setStatus('error');
    });

    sock.on('disconnect', () => {
      if (status === 'active') setStatus('error');
    });

    return () => { sock.disconnect(); };
  }, [upperCode]);

  const handleLeave = () => {
    socketRef.current?.disconnect();
    window.close();
    // fallback if window.close() is blocked
    setTimeout(() => { window.location.href = '/chat'; }, 300);
  };

  /* ── Loading / error states ── */
  if (status === 'error') {
    return (
      <div className="conf-page-state">
        <div className="conf-page-card">
          <div className="conf-page-icon">📹</div>
          <h2>Cannot Join Room</h2>
          <p className="conf-page-msg">{error}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
            <button className="btn btn-primary" onClick={() => window.location.href = '/chat'}>
              Go to Chat
            </button>
            <button className="btn btn-ghost" onClick={() => window.close()}>Close Tab</button>
          </div>
        </div>
      </div>
    );
  }

  if (status !== 'active' || !confData || !socket || !user) {
    return (
      <div className="conf-page-state">
        <div className="conf-page-card">
          <div className="conf-spinner" />
          <p className="conf-page-msg">
            {status === 'connecting' ? 'Connecting…' : `Joining room ${upperCode}…`}
          </p>
        </div>
      </div>
    );
  }

  /* ── Active conference ── */
  return (
    <Conference
      socket={socket}
      currentUser={user}
      initialCode={confData.code}
      initialName={confData.name}
      initialMembers={confData.members}
      onLeave={handleLeave}
    />
  );
}
