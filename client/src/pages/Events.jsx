import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { request } from '../api.js';
import CampusMap from '../components/CampusMap.jsx';
import EventCard from '../components/EventCard.jsx';
import { CloseIcon, LocateIcon, SearchIcon } from '../components/Icons.jsx';
import { dateKey, eventStatus, formatLongDate } from '../eventTime.js';

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

// Pins: one per building, with its event count, coloured by the building's most common layer.
// A blue ring marks buildings where you're going.
function mainLayer(events) {
  const counts = {};
  for (const e of events) counts[e.layer] = (counts[e.layer] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function buildingGroups(events) {
  const groups = new Map();
  for (const event of events) {
    if (!event.building) continue;
    const key = event.building.code;
    if (!groups.has(key)) groups.set(key, { key, building: event.building, events: [] });
    groups.get(key).events.push(event);
  }
  return [...groups.values()];
}

// List: anything happening right now first, then events by day. All-day events already under way count as today.
const NOW_KEY = 'now';
function dayGroups(rows, now, userPos) {
  const today = dateKey(now);
  const tomorrow = dateKey(now.getTime() + 864e5);
  const days = new Map();
  for (const row of rows) {
    const live = !row.event.allDay && eventStatus(row.event, now) === 'live';
    const key = live ? NOW_KEY : new Date(row.event.startAt) < now ? today : dateKey(row.event.startAt);
    if (!days.has(key)) days.set(key, { key, rows: [] });
    days.get(key).rows.push(row);
  }
  const ordered = [...days.values()].sort((a, b) => (a.key === NOW_KEY ? -1 : b.key === NOW_KEY ? 1 : a.key.localeCompare(b.key)));
  return ordered.map((d) => {
    if (d.key === NOW_KEY) return { ...d, label: 'Happening now', lead: true };
    // Noon keeps the long date on the right day whatever the viewer's time zone.
    const long = formatLongDate(`${d.key}T12:00:00`);
    const label = d.key === today ? `Today · ${long}` : d.key === tomorrow ? `Tomorrow · ${long}` : long;
    if (userPos) {
      d.rows.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }
    return { ...d, label, lead: d.key === today };
  });
}

export default function Events() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [locating, setLocating] = useState(false);
  const [params, setParams] = useSearchParams();

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
  const groups = buildingGroups(visible);
  const selectedGroup = groups.find((g) => g.key === selected);
  const markers = useMemo(
    () =>
      groups.map((g) => ({
        id: g.key,
        lng: g.building.lng,
        lat: g.building.lat,
        text: String(g.events.length),
        tone: mainLayer(g.events),
        going: g.events.some((e) => e.going),
        label: `${g.key}, ${g.events.length} event${g.events.length === 1 ? '' : 's'}${g.events.some((e) => e.going) ? ", you're going to one" : ''}`,
      })),
    // groups is rebuilt every render; key on its contents instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(groups.map((g) => [g.key, g.events.length, mainLayer(g.events), g.events.some((e) => e.going)]))]
  );

  const listed = selectedGroup ? selectedGroup.events : visible;
  const rows = collapseRepeats(listed).map((r) => ({
    ...r,
    distance: r.event.building && userPos ? distanceKm(userPos, r.event.building) : null,
  }));
  const days = dayGroups(rows, now, userPos);

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
      <div className="page-head">
        <div>
          <h1>Events</h1>
          <p>{data ? `${visible.length} upcoming on and around campus` : 'Loading…'}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-pill" aria-pressed={Boolean(userPos)} onClick={locate} disabled={locating}>
          <LocateIcon size={16} />
          {locating ? 'Locating…' : userPos ? 'Sorted by distance' : 'Near me'}
        </button>
      </div>

      <label className="search events-search">
        <SearchIcon size={20} />
        <span className="sr-only">Search events, clubs and places</span>
        <input
          type="search"
          placeholder="Search events, clubs and places"
          value={filters.q}
          onChange={(e) => setParam('q', e.target.value)}
        />
      </label>

      <div className="filter-bar">
        <div className="chip-row" role="group" aria-label="When">
          {WHEN.map((w) => (
            <button
              key={w.value}
              type="button"
              className="chip"
              aria-pressed={filters.when === w.value}
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
            const soon = l.value === 'clubs' && count === 0;
            return (
              <button
                key={l.value}
                type="button"
                aria-pressed={on && !soon}
                disabled={soon}
                className="chip outline"
                onClick={() => setParam('hide', on ? [...filters.hidden, l.value] : filters.hidden.filter((v) => v !== l.value))}
              >
                <span className={`dot ${l.value}`} aria-hidden="true" />
                {l.label}
                <span className="count">{soon ? 'soon' : count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="events-layout">
        <section className="events-map" aria-label="Campus map">
          <CampusMap
            markers={markers}
            selectedId={selected}
            onSelect={(key) => setSelected((cur) => (cur === key ? null : key))}
            userPos={userPos}
          />
          {selectedGroup && (
            <div className="map-card">
              <span>
                <strong>{selectedGroup.building.name}</strong>
                <span className="muted">{selectedGroup.key} · {selectedGroup.events.length} event{selectedGroup.events.length === 1 ? '' : 's'}</span>
              </span>
              <button type="button" className="btn-icon" aria-label="Show all buildings" onClick={() => setSelected(null)}>
                <CloseIcon size={18} />
              </button>
            </div>
          )}
        </section>

        <section className="events-list" aria-label="Events">
          {selectedGroup && (
            <p className="list-filter">
              Showing {selectedGroup.key} · {selectedGroup.building.name}
              <button type="button" className="link-btn" onClick={() => setSelected(null)}>Show all</button>
            </p>
          )}
          {!data && <p className="empty">Loading events…</p>}
          {data && events.length === 0 && (
            <p className="empty">No events yet. Host one to get things started.</p>
          )}
          {data && events.length > 0 && rows.length === 0 && <p className="empty">No events match these filters.</p>}
          {days.map((d) => (
            <section key={d.key} className="day-group" aria-label={d.label}>
              <h2 className={d.lead ? 'day-heading lead' : 'day-heading'}>
                {d.key === 'now' && <span className="live-dot" aria-hidden="true" />}
                {d.label}
                <span className="day-count">{d.rows.length}</span>
              </h2>
              {d.rows.map(({ event, moreDates, distance }) => (
                <EventCard key={event.id} event={event} now={now} moreDates={moreDates} distance={distance} />
              ))}
            </section>
          ))}
        </section>
      </div>
    </div>
  );
}
