import { Link } from 'react-router';
import { dayOfMonth, eventStatus, formatCardWhen, monthAbbr } from '../eventTime.js';
import { CheckIcon } from './Icons.jsx';

export const LAYER_LABEL = { campus: 'Campus', athletics: 'Athletics', student: 'Student-run', clubs: 'Clubs' };

export function DateBlock({ date, size = 'md', going = false }) {
  return (
    <span className={`date-block ${size}${going ? ' going' : ''}`} aria-hidden="true">
      <span className="date-block-month">{monthAbbr(date)}</span>
      <span className="date-block-day">{dayOfMonth(date)}</span>
    </span>
  );
}

export function LayerTag({ layer }) {
  return <span className={`tag ${layer}`}>{LAYER_LABEL[layer] ?? layer}</span>;
}

export function GoingTag({ hosting = false }) {
  return (
    <span className="tag going">
      <CheckIcon size={12} />
      {hosting ? "You're hosting" : "You're going"}
    </span>
  );
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}

// The standard event card: date block, time, title, place and host, then tags and status.
export default function EventCard({ event, now, distance, moreDates = 0 }) {
  const live = eventStatus(event, now) === 'live';
  const host = event.host ? `Hosted by ${event.host}` : event.organizer;
  const status = event.going ? (
    <GoingTag hosting={event.isHost} />
  ) : live ? (
    <span className="tag now">Now</span>
  ) : event.goingCount > 0 ? (
    <span className="card-meta">{event.goingCount} going</span>
  ) : null;

  return (
    <Link to={`/events/${encodeURIComponent(event.id)}`} className="event-card">
      <DateBlock date={event.startAt} />
      <span className="event-card-body">
        <span className="event-card-when">{formatCardWhen(event)}</span>
        <span className="event-card-title">{event.title}</span>
        <span className="event-card-place">
          {[event.location ?? 'Location TBA', host].filter(Boolean).join(' · ')}
        </span>
        <span className="event-card-foot">
          <span className="event-card-tags">
            <LayerTag layer={event.layer} />
            {event.cost && <span className="tag">{event.cost}</span>}
            {moreDates > 0 && <span className="tag">+{moreDates} more {moreDates === 1 ? 'date' : 'dates'}</span>}
          </span>
          {status}
        </span>
        {distance != null && <span className="card-meta">{formatDistance(distance)}</span>}
      </span>
    </Link>
  );
}
