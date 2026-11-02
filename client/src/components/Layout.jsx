import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const linkClass = ({ isActive }) => (isActive ? 'link active' : 'link');

  return (
    <>
      <nav className="nav">
        <Link to="/" className="brand">FYDP Project</Link>
        <NavLink to="/dashboard" className={linkClass}>Home</NavLink>
        <NavLink to="/clubs" className={linkClass}>Clubs</NavLink>
        <span className="spacer" />
        <span className="who">{user.email}</span>
        <button type="button" className="secondary" onClick={logout}>Log out</button>
      </nav>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
