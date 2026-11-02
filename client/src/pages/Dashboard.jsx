import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { request } from '../api.js';
import EventCard, { DateBlock } from '../components/EventCard.jsx';
import { PlusIcon } from '../components/Icons.jsx';
import { formatCardWhen, formatLongDate } from '../eventTime.js';

const SHORTCUTS = [
  { to: '/intramurals', title: 'Intramurals', text: 'Find a team, or players for yours', tone: 'athletics' },
  { to: '/clubs', title: 'Clubs', text: 'Every club in the WUSA directory', tone: 'campus' },
  { to: '/events/new', title: 'Host an event', text: 'A study session, a game night, anything', tone: 'student' },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    request('/api/events').then(setData).catch((err) => setError(err.message));
  }, []);

  const now = useMemo(() => new Date(), [data]);
  const events = data?.events ?? [];
  const going = events.filter((e) => e.going);
  // The next few things on campus, skipping repeats of the same event.
  const upcoming = [];
  const seen = new Set();
  for (const e of events) {
    if (e.going || seen.has(e.title) || new Date(e.endAt ?? e.startAt) < now) continue;
    seen.add(e.title);
    upcoming.push(e);
    if (upcoming.length === 6) break;
  }

  return (
    <div className="home">
      <div className="home-greeting">
        <span className="muted">{formatLongDate(now)}</span>
        <h1>Welcome back</h1>
      </div>

      <div className="home-layout">
        <section className="home-main" aria-labelledby="coming-up">
          <div className="section-head">
            <h2 id="coming-up">Coming up on campus</h2>
            <Link to="/events" className="text-link">See all events</Link>
          </div>
          {error && <p className="error">{error}</p>}
          {!data && !error && <p className="empty">Loading events…</p>}
          {data && upcoming.length === 0 && <p className="empty">Nothing coming up. Check back after the next import.</p>}
          <div className="card-grid">
            {upcoming.map((e) => <EventCard key={e.id} event={e} now={now} />)}
          </div>
        </section>

        <aside className="home-aside">
          <section className="panel">
            <h2>You're going</h2>
            {data && going.length === 0 && (
              <p className="muted small-text">Nothing yet. Join an event and it shows up here.</p>
            )}
            <ul className="going-list">
              {going.map((e) => (
                <li key={e.id}>
                  <Link to={`/events/${encodeURIComponent(e.id)}`}>
                    <DateBlock date={e.startAt} size="sm" going />
                    <span>
                      <span className="small-strong">{formatCardWhen(e)}</span>
                      <span className="going-title">{e.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <nav className="shortcuts" aria-label="Shortcuts">
            {SHORTCUTS.map((s) => (
              <Link key={s.to} to={s.to} className="shortcut">
                <span className={`shortcut-icon ${s.tone}`} aria-hidden="true">
                  {s.to === '/events/new' ? <PlusIcon size={18} /> : s.title.slice(0, 1)}
                </span>
                <span>
                  <strong>{s.title}</strong>
                  <span className="muted">{s.text}</span>
                </span>
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}
