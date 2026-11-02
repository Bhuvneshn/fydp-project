import { Link, NavLink, Outlet, useMatch } from 'react-router';
import { useAuth } from '../auth.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  // The map page fills the screen instead of using the centered content column.
  const fullBleed = useMatch('/events');
  const linkClass = ({ isActive }) => (isActive ? 'link active' : 'link');

  return (
    <>
      <nav className="nav">
        <Link to="/" className="brand">FYDP<span className="brand-long"> Project</span></Link>
        <NavLink to="/dashboard" className={(s) => `${linkClass(s)} home`}>Home</NavLink>
        <NavLink to="/events" className={linkClass}>Events</NavLink>
        <NavLink to="/athletics" className={linkClass}>Athletics</NavLink>
        <NavLink to="/clubs" className={linkClass}>Clubs</NavLink>
        <span className="spacer" />
        <span className="who">{user.email}</span>
        <button type="button" className="secondary" onClick={logout}>Log out</button>
      </nav>
      <main className={fullBleed ? 'page full-bleed' : 'page'}>
        <Outlet />
      </main>
    </>
  );
}
