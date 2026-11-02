import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Verify from './pages/Verify.jsx';
import Dashboard from './pages/Dashboard.jsx';

// Redirects based on login + verification state. `need` is what the route requires.
function Guard({ need, children }) {
  const { loading, user, needsVerification } = useAuth();
  if (loading) return null;

  if (need === 'guest') return user ? <Navigate to="/dashboard" replace /> : children;
  if (!user) return <Navigate to="/login" replace />;
  if (need === 'unverified') return needsVerification ? children : <Navigate to="/dashboard" replace />;
  return needsVerification ? <Navigate to="/verify" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Guard need="guest"><Login /></Guard>} />
      <Route path="/register" element={<Guard need="guest"><Register /></Guard>} />
      <Route path="/verify" element={<Guard need="unverified"><Verify /></Guard>} />
      <Route path="/dashboard" element={<Guard need="user"><Dashboard /></Guard>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
