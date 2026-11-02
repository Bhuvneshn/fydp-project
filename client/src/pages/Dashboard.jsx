import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { request } from '../api.js';
import EventCard, { DateBlock } from '../components/EventCard.jsx';
import { CheckIcon, PlusIcon, SearchIcon, UserIcon } from '../components/Icons.jsx';
import { eventStatus, formatCardWhen, formatLongDate, formatRelativeStart } from '../eventTime.js';

const SHORTCUTS = [
  { to: '/intramurals', title: 'Intramurals', text: 'Find a team, or players for yours', Icon: UserIcon },
  { to: '/clubs', title: 'Clubs', text: 'Every club in the WUSA directory', Icon: SearchIcon },
  { to: '/events/new', title: 'Host an event', text: 'A study session, a game night, anything', Icon: PlusIcon },
];

// The one thing worth looking at first: your next event, else what's on right now, else what's next today.
function pickSpotlight(events, going, now) {
  if (going.length > 0) return { event: going[0], label: 'Up next for you' };
  const live = events.find((e) => !e.allDay && eventStatus(e, now) === 'live');
  if (live) return { event: live, label: 'Happening now on campus' };
  const today = events.find((e) => !e.allDay && new Date(e.startAt) > now && eventStatus(e, now) === 'today');
  if (today) return { event: today, label: 'Later today on campus' };
  const next = events.find((e) => !e.allDay && new Date(e.startAt) > now) ?? events.find((e) => new Date(e.startAt) > now);
  return next ? { event: next, label: 'Coming up next' } : null;
}

function Spotlight({ event, label, now }) {
  const b = event.building;
  const link = `/events/${encodeURIComponent(event.id)}`;
  return (
    <section className="spotlight" aria-labelledby="spotlight-title">
      <span className="spotlight-label">
        {event.going && <CheckIcon size={14} />}
        {label}
      </span>
      <h2 id="spotlight-title"><Link to={link}>{event.title}</Link></h2>
      <p className="spotlight-when">{formatRelativeStart(event, now)}</p>
      <p className="spotlight-place">
        {[event.location ?? 'Location TBA', event.host ? `Hosted by ${event.host}` : event.organizer].filter(Boolean).join(' · ')}
      </p>
      <div className="spotlight-actions">
        <Link to={link} className="btn btn-lg btn-inverse">{event.going ? 'View details' : 'See event'}</Link>
        {b && (
          <a className="btn btn-lg btn-inverse-outline" href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`} target="_blank" rel="noreferrer">
            Directions
          </a>
        )}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    request('/api/events').then(setData).catch((err) => setError(err.message));
  }, []);

  const now = useMemo(() => new Date(), [data]);
  const events = data?.events ?? [];
  const going = events.filter((e) => e.going && new Date(e.endAt ?? e.startAt) >= now);
  const spotlight = pickSpotlight(events, going, now);
  // The next few things on campus, skipping repeats of the same event.
  const upcoming = [];
  const seen = new Set();
  for (const e of events) {
    if (e.going || e.title === spotlight?.event.title || seen.has(e.title) || new Date(e.endAt ?? e.startAt) < now) continue;
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

      {spotlight && <Spotlight {...spotlight} now={now} />}

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
                <span className="shortcut-icon" aria-hidden="true"><s.Icon size={18} /></span>
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
