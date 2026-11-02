import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

export const SOURCE_LABELS = { wusa: 'WUSA', uwaterloo: 'UWaterloo', athletics: 'Warriors Athletics' };

const SELECT = `
  SELECT e.*, b.name AS building_name, b.lat, b.lng
  FROM events e LEFT JOIN buildings b ON b.code = e.building_code
`;

export function toEvent(row, { full = false } = {}) {
  const event = {
    id: row.id,
    source: row.source,
    sourceLabel: SOURCE_LABELS[row.source] ?? row.source,
    feed: row.feed,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: Boolean(row.all_day),
    location: row.location,
    building: row.building_code
      ? { code: row.building_code, name: row.building_name, lat: row.lat, lng: row.lng }
      : null,
    imageUrl: row.image_url,
    organizer: row.organizer,
    categories: JSON.parse(row.categories),
    cost: row.cost,
    url: row.url,
    extra: JSON.parse(row.extra),
  };
  if (full) event.description = row.description;
  return event;
}

// Upcoming events (including ones in progress). ?days= limits how far ahead (default 60).
eventsRouter.get('/', (req, res) => {
  const days = Math.min(Number(req.query.days) || 60, 365);
  const now = new Date();
  const until = new Date(now.getTime() + days * 864e5).toISOString();
  const rows = db
    .prepare(`${SELECT} WHERE COALESCE(e.end_at, e.start_at) >= ? AND e.start_at <= ? ORDER BY e.start_at`)
    .all(now.toISOString(), until);
  const lastImportedAt = db.prepare('SELECT MAX(imported_at) AS t FROM events').get().t;
  res.json({ events: rows.map((r) => toEvent(r)), lastImportedAt });
});

eventsRouter.get('/:id', (req, res) => {
  const row = db.prepare(`${SELECT} WHERE e.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event: toEvent(row, { full: true }) });
});
