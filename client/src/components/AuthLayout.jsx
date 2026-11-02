import { Link } from 'react-router';
import { CheckIcon } from './Icons.jsx';
import { ThemeToggle } from './Layout.jsx';

const BENEFITS = [
  'Campus, WUSA and Warriors events on one map',
  'Find an intramural team, or players for yours',
  'Browse every club in the WUSA directory',
];

// Sign-in pages: a simple header, the form, and a short pitch beside it.
export default function AuthLayout({ children }) {
  return (
    <>
      <header className="site-header simple">
        <div className="site-header-inner">
          <Link to="/" className="wordmark">UWClubs</Link>
          <div className="header-actions">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="auth-page">
        <section className="auth-form-col">{children}</section>
        <section className="auth-pitch" aria-label="About UWClubs">
          <h2>Find your people at Waterloo</h2>
          <ul>
            {BENEFITS.map((b) => (
              <li key={b}><CheckIcon size={20} strokeWidth={2.4} />{b}</li>
            ))}
          </ul>
          <p className="muted">Only @uwaterloo.ca accounts can join, so everyone here is a fellow student.</p>
        </section>
      </main>
    </>
  );
}
