import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { request, send } from '../api.js';
import CampusMap from '../components/CampusMap.jsx';
import { STATUS_LABEL, eventStatus, formatEventWhen } from '../eventTime.js';

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setEvent(null);
    request(`/api/events/${encodeURIComponent(id)}`).then((d) => setEvent(d.event)).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!event) return <p className="empty">Loading…</p>;

  const status = eventStatus(event);
  const b = event.building;

  return (
    <article className="event-detail">
      <Link to="/events" className="back">← All events</Link>

      <div className="event-hero">
        {event.imageUrl ? (
          <img className="event-cover" src={event.imageUrl} alt="" />
        ) : (
          <div className="event-cover placeholder" aria-hidden="true">{event.title.slice(0, 1)}</div>
        )}
        <div className="event-hero-text">
          <div className="chips">
            <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>
            <span className={event.layer === 'student' ? 'chip student' : 'chip'}>{event.sourceLabel}{event.feed && event.feed !== 'University' ? ` · ${event.feed}` : ''}</span>
            {event.categories.map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
          <h1>{event.title}</h1>
          {event.organizer && <p className="muted">Hosted by {event.organizer}</p>}

          <RsvpPanel event={event} onChange={setEvent} />

          <dl className="event-facts">
            <div><dt>When</dt><dd>{formatEventWhen(event)}</dd></div>
            <div>
              <dt>Where</dt>
              <dd>
                {event.location ?? 'Location TBA'}
                {b && !event.location?.startsWith(b.code) && <span className="muted"> · {b.code} – {b.name}</span>}
              </dd>
            </div>
            {event.cost && <div><dt>Cost</dt><dd>{event.cost}</dd></div>}
          </dl>

          <div className="event-actions">
            {event.url && <a className="btn-primary" href={event.url} target="_blank" rel="noreferrer">View on {event.sourceLabel}</a>}
            {event.extra.virtualUrl && <a className="btn-secondary" href={event.extra.virtualUrl} target="_blank" rel="noreferrer">Join online</a>}
            {event.extra.tickets && <a className="btn-secondary" href={event.extra.tickets} target="_blank" rel="noreferrer">Tickets</a>}
            {event.extra.video && <a className="btn-secondary" href={event.extra.video} target="_blank" rel="noreferrer">Watch live</a>}
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div>
          {event.description && (
            <section className="panel">
              <h2>About</h2>
              <p>{event.description}</p>
            </section>
          )}
        </div>
        {b && (
          <aside className="panel event-mini-map">
            <h2>{b.code} – {b.name}</h2>
            <CampusMap
              markers={[{ id: b.code, lng: b.lng, lat: b.lat, status, label: b.name }]}
              center={[b.lng, b.lat]}
              zoom={16.3}
              pitch={45}
              interactive={false}
            />
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`} target="_blank" rel="noreferrer">Directions</a>
          </aside>
        )}
      </div>
    </article>
  );
}

// Stable colour per handle for the guest avatars.
function avatarHue(handle) {
  let h = 0;
  for (const ch of handle) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Avatars({ handles, max = 8 }) {
  return (
    <span className="avatars">
      {handles.slice(0, max).map((h) => (
        <span key={h} className="avatar" title={h} style={{ '--hue': avatarHue(h) }}>{h.slice(0, 1).toUpperCase()}</span>
      ))}
      {handles.length > max && <span className="avatar more">+{handles.length - max}</span>}
    </span>
  );
}

// Luma-style RSVP card: who's going, and join / leave / cancel.
function RsvpPanel({ event, onChange }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ended = new Date(event.endAt ?? event.startAt) < new Date();
  const full = event.capacity != null && event.goingCount >= event.capacity;

  async function act(method) {
    setBusy(true);
    setError('');
    try {
      await send(`/api/events/${encodeURIComponent(event.id)}/rsvp`, method);
      // Reload for the updated guest list.
      onChange((await request(`/api/events/${encodeURIComponent(event.id)}`)).event);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelEvent() {
    if (!confirm('Cancel this event? It will be removed from the map for everyone.')) return;
    setBusy(true);
    try {
      await send(`/api/events/${encodeURIComponent(event.id)}`, 'DELETE');
      navigate('/events', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="rsvp">
      <div className="rsvp-guests">
        {event.attendees.length > 0 && <Avatars handles={event.attendees} />}
        <span>
          <strong>{event.goingCount} going</strong>
          {event.capacity != null && <span className="muted"> · {Math.max(event.capacity - event.goingCount, 0)} of {event.capacity} spots left</span>}
        </span>
      </div>
      <div className="rsvp-actions">
        {event.isHost ? (
          <>
            <span className="tag going">You're hosting</span>
            <button type="button" className="link-btn danger" disabled={busy} onClick={cancelEvent}>Cancel event</button>
          </>
        ) : event.going ? (
          <>
            <span className="tag going">✓ You're going</span>
            {!ended && <button type="button" className="link-btn" disabled={busy} onClick={() => act('DELETE')}>Can't make it</button>}
          </>
        ) : ended ? (
          <span className="muted">This event has ended.</span>
        ) : full ? (
          <span className="muted">This event is full.</span>
        ) : (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => act('POST')}>Join event</button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
