import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../theme.jsx';
import { MoonIcon, PlusIcon, SunIcon } from './Icons.jsx';

const LINKS = [
  { to: '/dashboard', label: 'Home' },
  { to: '/events', label: 'Events' },
  { to: '/intramurals', label: 'Intramurals' },
  { to: '/clubs', label: 'Clubs' },
];

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" className="btn-icon" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="avatar-btn"
        aria-label="Your account"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {user.email.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className="account-menu">
          <p className="account-email">{user.email}</p>
          <button type="button" className="btn btn-secondary btn-block" onClick={logout}>Log out</button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="wordmark">UWClubs</Link>
          <nav aria-label="Main" className="site-nav">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="nav-link">{l.label}</NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            <Link to="/events/new" className="btn btn-primary btn-pill">
              <PlusIcon size={16} />
              <span>Host event</span>
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>
      <main id="main" className="page">
        <Outlet />
      </main>
    </>
  );
}
