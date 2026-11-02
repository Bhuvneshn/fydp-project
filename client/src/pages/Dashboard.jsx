import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { request } from '../api.js';
import EventCard, { DateBlock, LAYER_LABEL } from '../components/EventCard.jsx';
import { CheckIcon } from '../components/Icons.jsx';
import { eventStatus, formatCardWhen, formatLongDate, formatRelativeStart } from '../eventTime.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// Hide every layer except one, so a tile opens the map filtered to its type.
const onlyLayer = (layer) => `/events?${['campus', 'athletics', 'student', 'clubs'].filter((l) => l !== layer).map((l) => `hide=${l}`).join('&')}`;

// One tile per section, in that section's colour.
function sectionTiles(events, clubCount, teamPosts) {
  const count = (layer) => events.filter((e) => e.layer === layer).length;
  const student = count('student');
  return [
    { tone: 'campus', title: 'Campus', stat: plural(count('campus'), 'event'), text: 'Talks, socials and WUSA events', to: onlyLayer('campus') },
    { tone: 'athletics', title: 'Sports', stat: plural(count('athletics'), 'Warriors game'), text: teamPosts ? `Plus ${plural(teamPosts, 'intramural team')} looking for players` : 'Home games on and near campus', to: onlyLayer('athletics') },
    { tone: 'student', title: 'Student-run', stat: student ? plural(student, 'event') : 'Host the first one', text: 'Study sessions, game nights, anything', to: student ? onlyLayer('student') : '/events/new' },
    { tone: 'clubs', title: 'Clubs', stat: clubCount == null ? 'WUSA directory' : plural(clubCount, 'club'), text: 'Every club in the WUSA directory', to: '/clubs' },
  ];
}

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
    <section className={`spotlight ${event.layer}`} aria-labelledby="spotlight-title">
      <div className="spotlight-top">
        <span className="spotlight-label">
          {event.going && <CheckIcon size={14} />}
          {label}
        </span>
        <span className="spotlight-type">{LAYER_LABEL[event.layer]}</span>
      </div>
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
  const [clubCount, setClubCount] = useState(null);
  const [teamPosts, setTeamPosts] = useState(0);

  useEffect(() => {
    request('/api/events').then(setData).catch((err) => setError(err.message));
    // Counts for the section tiles; the page works without them.
    request('/api/clubs').then((d) => setClubCount(d.clubs.length)).catch(() => {});
    request('/api/teams').then((d) => setTeamPosts(d.posts.filter((p) => p.kind === 'team').length)).catch(() => {});
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

      <nav className="section-tiles" aria-label="Browse by type">
        {sectionTiles(events, clubCount, teamPosts).map((t) => (
          <Link key={t.title} to={t.to} className={`section-tile ${t.tone}`}>
            <span className="section-tile-title">{t.title}</span>
            <span className="section-tile-stat">{data ? t.stat : '…'}</span>
            <span className="section-tile-text">{t.text}</span>
          </Link>
        ))}
      </nav>

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

        </aside>
      </div>
    </div>
  );
}
