import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Verify from './pages/Verify.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clubs from './pages/Clubs.jsx';
import ClubDetail from './pages/ClubDetail.jsx';
// Map pages pull in MapLibre (~1 MB), so load them on demand.
const Events = lazy(() => import('./pages/Events.jsx'));
const EventDetail = lazy(() => import('./pages/EventDetail.jsx'));
const HostEvent = lazy(() => import('./pages/HostEvent.jsx'));
import Intramurals from './pages/Intramurals.jsx';

const HOME = '/events';

// Redirects based on login + verification state. `need` is what the route requires.
function Guard({ need, children }) {
  const { loading, user, needsVerification } = useAuth();
  if (loading) return null;

  if (need === 'guest') return user ? <Navigate to={HOME} replace /> : children;
  if (!user) return <Navigate to="/login" replace />;
  if (need === 'unverified') return needsVerification ? children : <Navigate to={HOME} replace />;
  return needsVerification ? <Navigate to="/verify" replace /> : children;
}

const centered = (page) => <div className="centered">{page}</div>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Guard need="guest">{centered(<Login />)}</Guard>} />
      <Route path="/register" element={<Guard need="guest">{centered(<Register />)}</Guard>} />
      <Route path="/verify" element={<Guard need="unverified">{centered(<Verify />)}</Guard>} />
      <Route element={<Guard need="user"><Layout /></Guard>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clubs" element={<Clubs />} />
        <Route path="/clubs/:id" element={<ClubDetail />} />
        <Route path="/events" element={<Suspense fallback={null}><Events /></Suspense>} />
        <Route path="/events/new" element={<Suspense fallback={null}><HostEvent /></Suspense>} />
        <Route path="/events/:id" element={<Suspense fallback={null}><EventDetail /></Suspense>} />
        <Route path="/intramurals" element={<Intramurals />} />
        {/* Varsity games now live on the events map's Athletics layer. */}
        <Route path="/athletics/*" element={<Navigate to="/intramurals" replace />} />
      </Route>
      <Route path="*" element={<Navigate to={HOME} replace />} />
    </Routes>
  );
}
