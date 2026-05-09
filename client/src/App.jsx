import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell      from './components/layout/AppShell';
import Dashboard     from './pages/Dashboard';
import Applications  from './pages/Applications';
import Discarded     from './pages/Discarded';
import Settings      from './pages/Settings';
import Login         from './pages/Login';
import Register      from './pages/Register';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-bg">
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"    element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index                    element={<Dashboard />}    />
            <Route path="applications"      element={<Applications />} />
            <Route path="discarded"         element={<Discarded />}    />
            <Route path="settings"          element={<Settings />}     />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
