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

  useEffect(() => {
    const url = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';
    const socket = io(url, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (token) socket.emit('authenticate', token);
    });

    // Server confirmed auth — now safe to join rooms
    socket.on('authenticated', () => setIsAuthenticated(true));

    // Bad/expired token → clear session so user is sent back to login
    socket.on('auth-error', (msg) => {
      console.warn('Auth error from server:', msg);
      setIsAuthenticated(false);
      logout(); // clears localStorage + sessionStorage, triggers redirect to /
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setIsAuthenticated(false);
    });

    socket.on('online-count', setOnlineCount);

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, isAuthenticated, onlineCount }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
