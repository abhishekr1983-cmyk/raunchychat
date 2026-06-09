import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { SiteSettingsProvider } from './contexts/SiteSettingsContext';
import Landing from './pages/Landing';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import ConferencePage from './pages/ConferencePage';

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  if (user && !user.isAdmin) return <Navigate to="/chat" replace />;
  return children;
}

export default function App() {
  const { token } = useAuth();

  return (
    <SiteSettingsProvider>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/chat" replace /> : <Landing />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <SocketProvider>
                <Chat />
              </SocketProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <SocketProvider>
                <Admin />
              </SocketProvider>
            </AdminRoute>
          }
        />
        {/* Conference room — standalone tab, no SocketProvider needed (creates its own) */}
        <Route path="/conference/:code" element={<ConferencePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SiteSettingsProvider>
  );
}
