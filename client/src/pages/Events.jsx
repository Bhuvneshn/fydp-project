import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { request } from '../api.js';
import CampusMap, { MapLegend } from '../components/CampusMap.jsx';
import { STATUS_LABEL, STATUS_RANK, dateKey, eventStatus, formatDay, formatTime } from '../eventTime.js';

const WHEN = [
  { value: 'all', label: 'All upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Next 7 days' },
];
// Map layers, matching SOURCE_LAYERS on the server. All are on by default; ?hide= turns them off.
const LAYERS = [
  { value: 'campus', label: 'Campus' },
  { value: 'athletics', label: 'Athletics' },
  { value: 'student', label: 'Student-run' },
  { value: 'clubs', label: 'Clubs' },
];
const OFF_CAMPUS = 'off-campus';

function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function matches(event, { when, hidden, q }, now) {
  if (hidden.includes(event.layer)) return false;
  if (when === 'today' && eventStatus(event, now) === 'upcoming') return false;
  if (when === 'week' && new Date(event.startAt) - now > 7 * 864e5) return false;
  const needle = q.trim().toLowerCase();
  if (needle && ![event.title, event.organizer, event.host, event.location, ...event.categories].some((s) => s?.toLowerCase().includes(needle))) {
    return false;
  }
  return true;
}

// Groups events by building, like Spots groups rooms by building.
function groupByBuilding(events, now, userPos) {
  const groups = new Map();
  for (const event of events) {
    const key = event.building?.code ?? OFF_CAMPUS;
    if (!groups.has(key)) groups.set(key, { key, building: event.building, events: [] });
    groups.get(key).events.push({ ...event, status: eventStatus(event, now) });
  }
  const list = [...groups.values()].map((g) => ({
    ...g,
    status: g.events.reduce((best, e) => (STATUS_RANK[e.status] < STATUS_RANK[best] ? e.status : best), 'upcoming'),
    distance: g.building && userPos ? distanceKm(userPos, g.building) : null,
  }));
  return list.sort((a, b) => {
    if ((a.key === OFF_CAMPUS) !== (b.key === OFF_CAMPUS)) return a.key === OFF_CAMPUS ? 1 : -1;
    if (userPos && a.distance != null && b.distance != null) return a.distance - b.distance;
    return STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.events[0].startAt.localeCompare(b.events[0].startAt);
  });
}

export default function Events() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [locating, setLocating] = useState(false);
  const [params, setParams] = useSearchParams();
  const listRef = useRef(null);

  const filters = {
    when: params.get('when') ?? 'all',
    hidden: params.getAll('hide'),
    q: params.get('q') ?? '',
  };

  useEffect(() => {
    request('/api/events').then(setData).catch((err) => setError(err.message));
  }, []);

  const now = useMemo(() => new Date(), [data]);
  const events = data?.events ?? [];
  const layerCounts = useMemo(() => {
    const counts = {};
    for (const e of events) counts[e.layer] = (counts[e.layer] ?? 0) + 1;
    return counts;
  }, [events]);
  const visible = events.filter((e) => matches(e, filters, now));
  const groups = groupByBuilding(visible, now, userPos);
  const markers = useMemo(
    () =>
      groups
        .filter((g) => g.building)
        .map((g) => ({
          id: g.key,
          lng: g.building.lng,
          lat: g.building.lat,
          status: g.status,
          label: `${g.key} · ${g.events.length} event${g.events.length === 1 ? '' : 's'}`,
        })),
    // groups is rebuilt every render; key on its contents instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(groups.map((g) => [g.key, g.status, g.events.length]))]
  );

  function setParam(key, value) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(key);
        [].concat(value).filter(Boolean).forEach((v) => next.append(key, v));
        return next;
      },
      { replace: true }
    );
  }

  function selectBuilding(key, { scroll = false } = {}) {
    setSelected((cur) => (cur === key && !scroll ? null : key));
    if (scroll) {
      // Wait for the accordion to open before scrolling to it.
      setTimeout(() => listRef.current?.querySelector(`[data-group="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10_000 }
    );
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <div className="events-page">
      <section className="events-panel">
        <header className="events-head">
          <div>
            <h1>Events</h1>
            <p className="muted">
              {data ? `${visible.length} events on and around campus` : 'Loading…'}
            </p>
          </div>
          <div className="events-head-actions">
            <button type="button" className={userPos ? 'chip-btn on' : 'chip-btn'} onClick={locate} disabled={locating}>
              {locating ? 'Locating…' : userPos ? 'Sorted by distance' : 'Near me'}
            </button>
            <Link to="/events/new" className="btn-primary small">+ Host</Link>
          </div>
        </header>

        <div className="events-filters">
          <input
            type="search"
            placeholder="Search events, clubs, places…"
            value={filters.q}
            onChange={(e) => setParam('q', e.target.value)}
          />
          <div className="chip-row">
            {WHEN.map((w) => (
              <button
                key={w.value}
                type="button"
                className={filters.when === w.value ? 'chip-btn on' : 'chip-btn'}
                onClick={() => setParam('when', w.value === 'all' ? '' : w.value)}
              >
                {w.label}
              </button>
            ))}
          </div>
          <div className="chip-row" role="group" aria-label="Map layers">
            {LAYERS.map((l) => {
              const on = !filters.hidden.includes(l.value);
              const count = layerCounts[l.value] ?? 0;
              return (
                <button
                  key={l.value}
                  type="button"
                  aria-pressed={on}
                  className={on ? 'chip-btn layer on' : 'chip-btn layer'}
                  onClick={() => setParam('hide', on ? [...filters.hidden, l.value] : filters.hidden.filter((v) => v !== l.value))}
                >
                  <span className="check" aria-hidden="true">{on ? '✓' : ''}</span>
                  {l.label}
                  <span className="layer-count">{l.value === 'clubs' && count === 0 ? 'soon' : count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="building-list" ref={listRef}>
          {data && events.length > 0 && groups.length === 0 && <p className="empty">No events match these filters.</p>}
          {!data && !error && <p className="empty">Loading events…</p>}
          {data && events.length === 0 && (
            <p className="empty">No events yet. Run <code>npm run import:events</code>, or host one.</p>
          )}
          {groups.map((g) => (
            <BuildingGroup
              key={g.key}
              group={g}
              open={selected === g.key}
              onToggle={() => selectBuilding(g.key)}
            />
          ))}
        </div>
      </section>

      <section className="events-map">
        <CampusMap markers={markers} selectedId={selected} onSelect={(key) => selectBuilding(key, { scroll: true })} userPos={userPos} />
        <MapLegend />
      </section>
    </div>
  );
}

// Daily repeats ("World Cities Week" Mon–Fri) show once, at their next date.
function collapseRepeats(events) {
  const byTitle = new Map();
  for (const event of events) {
    const row = byTitle.get(event.title);
    if (row) row.moreDates++;
    else byTitle.set(event.title, { event, moreDates: 0 });
  }
  return [...byTitle.values()];
}

function BuildingGroup({ group, open, onToggle }) {
  const title = group.building ? `${group.key} – ${group.building.name}` : 'Off campus & TBA';
  return (
    <div className={open ? 'building open' : 'building'} data-group={group.key}>
      <button type="button" className="building-head" onClick={onToggle} aria-expanded={open}>
        <span className="building-name">{title}</span>
        <span className="building-meta">
          {group.distance != null && <span className="muted">{group.distance < 1 ? `${Math.round(group.distance * 1000)} m` : `${group.distance.toFixed(1)} km`}</span>}
          <span className={`pill ${group.status}`}>{group.events.length} · {STATUS_LABEL[group.status]}</span>
        </span>
      </button>
      {open && (
        <ul className="building-events">
          {collapseRepeats(group.events).map(({ event: e, moreDates }) => (
            <li key={e.id}>
              <Link to={`/events/${encodeURIComponent(e.id)}`} className="event-row">
                <span className="event-time">
                  <span className={`map-dot ${e.status} static`} />
                  {dateKey(e.startAt) === dateKey(new Date()) ? 'Today' : formatDay(e.startAt)}
                  <br />
                  {e.allDay ? 'All day' : formatTime(e.startAt)}
                </span>
                <span className="event-title">
                  {e.title}
                  <span className="muted">
                    {[
                      e.location,
                      e.host ? `Hosted by ${e.host}` : e.organizer,
                      e.goingCount > 0 && `${e.goingCount} going`,
                      moreDates && `+${moreDates} more date${moreDates === 1 ? '' : 's'}`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                  {(e.going || e.layer === 'student') && (
                    <span className="row-tags">
                      {e.layer === 'student' && <span className="tag student">Student-run</span>}
                      {e.going && <span className="tag going">{e.isHost ? 'Hosting' : 'Going'}</span>}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
