import { NavLink, Outlet } from 'react-router';

// Shell for the athletics section: varsity schedule + intramural team finder.
export default function Athletics() {
  const tabClass = ({ isActive }) => (isActive ? 'selected' : '');
  return (
    <div className="athletics">
      <header className="section-head">
        <h1>Athletics</h1>
        <p className="muted">Warriors varsity games, and intramural teammates.</p>
      </header>
      <nav className="tabs">
        <NavLink to="/athletics" end className={tabClass}>Varsity schedule</NavLink>
        <NavLink to="/athletics/teams" className={tabClass}>Intramural team finder</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
