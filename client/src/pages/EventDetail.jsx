import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { request, send } from '../api.js';
import CampusMap from '../components/CampusMap.jsx';
import { DateBlock, LayerTag } from '../components/EventCard.jsx';
import { BackIcon, CheckIcon, ExternalIcon, ShareIcon } from '../components/Icons.jsx';
import { dateKey, eventStatus, formatEventWhen, formatLongDate, formatTimeRange } from '../eventTime.js';

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
  const source = `${event.sourceLabel}${event.feed && event.feed !== 'University' ? ` · ${event.feed}` : ''}`;
  const lastDay = event.endAt ? new Date(new Date(event.endAt).getTime() - (event.allDay ? 60_000 : 0)) : null;
  const multiDay = lastDay && dateKey(event.startAt) !== dateKey(lastDay);

  return (
    <article className="event-detail">
      <div className="detail-toolbar">
        <Link to="/events" className="back"><BackIcon />Events</Link>
        <ShareButton title={event.title} />
      </div>

      <header className="detail-title">
        <div className="tag-row">
          <LayerTag layer={event.layer} />
          {status === 'live' && <span className="tag now">Now</span>}
          {status === 'today' && <span className="tag">Today</span>}
          <span className="tag">From {source}</span>
          {event.categories.map((c) => <span key={c} className="tag">{c}</span>)}
        </div>
        <h1>{event.title}</h1>
        {(event.host || event.organizer) && (
          <p className="hosted">Hosted by <strong>{event.host ?? event.organizer}</strong></p>
        )}
      </header>

      <div className="detail-columns">
        <aside className="detail-aside">
          <section className="panel when-card">
            <div className="when-row">
              <DateBlock date={event.startAt} going={event.going} tone={event.layer} />
              <span>
                <strong>{multiDay ? formatEventWhen(event) : formatLongDate(event.startAt)}</strong>
                {!multiDay && <span className="muted">{formatTimeRange(event)}</span>}
              </span>
            </div>
            <div className="when-facts">
              <span className="strong">{event.cost ?? 'Price not listed'}</span>
              <span className="muted">
                {event.capacity != null
                  ? `${Math.max(event.capacity - event.goingCount, 0)} of ${event.capacity} spots left`
                  : 'No capacity limit'}
              </span>
            </div>
            <Rsvp event={event} onChange={setEvent} />
            <div className="source-links">
              {event.url && (
                <a className="text-link" href={event.url} target="_blank" rel="noreferrer">
                  Original listing on {event.sourceLabel}<ExternalIcon size={14} />
                </a>
              )}
              {event.extra.tickets && <a className="text-link" href={event.extra.tickets} target="_blank" rel="noreferrer">Tickets<ExternalIcon size={14} /></a>}
              {event.extra.video && <a className="text-link" href={event.extra.video} target="_blank" rel="noreferrer">Watch live<ExternalIcon size={14} /></a>}
              {event.extra.virtualUrl && <a className="text-link" href={event.extra.virtualUrl} target="_blank" rel="noreferrer">Join online<ExternalIcon size={14} /></a>}
            </div>
          </section>
        </aside>

        <div className="detail-main">
          {event.imageUrl && <img className="event-cover" src={event.imageUrl} alt="" />}

          {event.description && (
            <section className="detail-section">
              <h2>About</h2>
              <p className="prose">{event.description}</p>
            </section>
          )}

          <section className="detail-section">
            <h2>Location</h2>
            <div className="location-card">
              {b && (
                <div className="location-map">
                  <CampusMap
                    markers={[{ id: b.code, lng: b.lng, lat: b.lat, text: b.code, going: event.going, tone: event.layer, label: b.name }]}
                    center={[b.lng, b.lat]}
                    zoom={16.3}
                    pitch={45}
                    interactive={false}
                  />
                </div>
              )}
              <div className="location-row">
                <span>
                  <strong>{event.location ?? 'Location TBA'}</strong>
                  <span className="muted">{b ? `${b.code} · ${b.name}` : 'Not on the campus map'}</span>
                </span>
                {b && (
                  <a className="text-link" href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                )}
              </div>
            </div>
          </section>

          <section className="detail-section">
            <h2>Who's going</h2>
            <div className="guests">
              {event.attendees.length > 0 && <Avatars handles={event.attendees} />}
              <span>
                <strong>{event.goingCount} going</strong>
                <span className="muted">
                  {event.goingCount === 0 ? 'Be the first to join.' : event.going && event.goingCount === 1 ? "You're the first. Share it with friends." : ''}
                </span>
              </span>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}

function ShareButton({ title }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet closed, or the clipboard isn't available.
    }
  }

  return (
    <button type="button" className="btn btn-secondary btn-pill" onClick={share}>
      <ShareIcon size={16} />
      <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span>
    </button>
  );
}

export function Avatars({ handles, max = 8 }) {
  return (
    <span className="avatars">
      {handles.slice(0, max).map((h) => (
        <span key={h} className="avatar" title={h}>{h.slice(0, 1).toUpperCase()}</span>
      ))}
      {handles.length > max && <span className="avatar more">+{handles.length - max}</span>}
    </span>
  );
}

// Join / leave / cancel, inside the date card.
function Rsvp({ event, onChange }) {
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
    <>
      {event.isHost ? (
        <>
          <span className="btn btn-going btn-lg btn-block" role="status"><CheckIcon size={18} />You're hosting</span>
          <button type="button" className="btn btn-danger btn-block" disabled={busy} onClick={cancelEvent}>Cancel event</button>
        </>
      ) : event.going ? (
        <button
          type="button"
          className="btn btn-going btn-lg btn-block"
          disabled={busy || ended}
          onClick={() => act('DELETE')}
          aria-label={ended ? "You went" : "You're going. Select to leave"}
        >
          <CheckIcon size={18} />{ended ? 'You went' : "You're going"}
        </button>
      ) : ended ? (
        <p className="muted center">This event has ended.</p>
      ) : full ? (
        <button type="button" className="btn btn-secondary btn-lg btn-block" disabled>Full</button>
      ) : (
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => act('POST')}>Join</button>
      )}
      {event.going && !event.isHost && !ended && <p className="muted center small">Select again if you can't make it.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
