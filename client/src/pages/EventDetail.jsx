import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { request } from '../api.js';
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
            <span className="chip">{event.sourceLabel}{event.feed && event.feed !== 'University' ? ` · ${event.feed}` : ''}</span>
            {event.categories.map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
          <h1>{event.title}</h1>
          {event.organizer && <p className="muted">Hosted by {event.organizer}</p>}

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
