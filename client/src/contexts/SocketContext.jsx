import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, logout } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [wordViolation, setWordViolation] = useState(null); // { matched, violationCount, threshold, remaining }

  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';
    const socket = io(url, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (token) socket.emit('authenticate', token);
    });

    socket.on('authenticated', () => setIsAuthenticated(true));

    // Bad/expired token or blocked → clear session
    socket.on('auth-error', (msg) => {
      console.warn('Auth error from server:', msg);
      setIsAuthenticated(false);
      logout();
    });

    // Admin blocked this account mid-session or auto-blocked by word filter
    socket.on('account-blocked', ({ reason }) => {
      setIsAuthenticated(false);
      alert(`🚫 ${reason}\n\nYou have been signed out.`);
      logout();
    });

    // Word filter warning (message blocked but account not yet blocked)
    socket.on('word-violation', (data) => {
      setWordViolation(data);
      // Auto-clear after 8 seconds
      setTimeout(() => setWordViolation(null), 8000);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setIsAuthenticated(false);
    });

    socket.on('online-count', setOnlineCount);

    return () => { socket.disconnect(); };
  }, [token]);

  const clearWordViolation = () => setWordViolation(null);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connected,
      isAuthenticated,
      onlineCount,
      wordViolation,
      clearWordViolation,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
