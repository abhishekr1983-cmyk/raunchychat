import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Guests use sessionStorage (cleared when tab/browser closes).
  // Registered users use localStorage (persists across sessions).
  const [token, setToken] = useState(() =>
    sessionStorage.getItem('chat_token') || localStorage.getItem('chat_token')
  );
  const [user, setUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem('chat_user') || localStorage.getItem('chat_user');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const login = useCallback((newToken, newUser) => {
    if (newUser.isGuest) {
      sessionStorage.setItem('chat_token', newToken);
      sessionStorage.setItem('chat_user', JSON.stringify(newUser));
    } else {
      localStorage.setItem('chat_token', newToken);
      localStorage.setItem('chat_user', JSON.stringify(newUser));
    }
    setToken(newToken);
    setUser(newUser);
  }, []);

  // Merge updated fields into the stored user (after a profile save)
  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      const store = next.isGuest ? sessionStorage : localStorage;
      store.setItem('chat_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    sessionStorage.removeItem('chat_token');
    sessionStorage.removeItem('chat_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
