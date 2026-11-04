import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { db, lockUser } from '../db.js';
import { requireAuth } from '../auth.js';
import { HOSTED_CATEGORIES, MAX_UPCOMING_HOSTED, validateHostedEvent } from './hosted.js';
import { buddyState, optIn, optOut } from './buddies.js';

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

export const SOURCE_LABELS = {
  wusa: 'WUSA',
  uwaterloo: 'UWaterloo',
  athletics: 'Warriors Athletics',
  club: 'Club',
  student: 'Student-run',
};
// Map layers the user can toggle; each source belongs to one.
export const SOURCE_LAYERS = { wusa: 'campus', uwaterloo: 'campus', athletics: 'athletics', club: 'clubs', student: 'student' };

const handleOf = (email) => email.split('@')[0];

// :me is the signed-in user, for "am I going".
const SELECT = `
  SELECT e.*, b.name AS building_name, b.lat, b.lng, h.email AS host_email,
         (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id) AS going_count,
         EXISTS (SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = :me) AS going
  FROM events e
  LEFT JOIN buildings b ON b.code = e.building_code
  LEFT JOIN users h ON h.id = e.host_user_id
`;

export function toEvent(row, { full = false, userId } = {}) {
  const event = {
    id: row.id,
    source: row.source,
    sourceLabel: SOURCE_LABELS[row.source] ?? row.source,
    layer: SOURCE_LAYERS[row.source] ?? 'campus',
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
    host: row.host_email ? handleOf(row.host_email) : null,
    isHost: row.host_user_id != null && row.host_user_id === userId,
    capacity: row.capacity,
    goingCount: row.going_count,
    going: Boolean(row.going),
  };
  if (full) event.description = row.description;
  return event;
}

function findEvent(id, userId) {
  return db.prepare(`${SELECT} WHERE e.id = :id`).get({ id, me: userId });
}

// Upcoming events (including ones in progress). ?days= limits how far ahead (default 60).
// Off-campus varsity games are left out; the map only shows what's on or near campus.
eventsRouter.get('/', async (req, res) => {
  const days = Math.min(Number(req.query.days) || 60, 365);
  const now = new Date();
  const until = new Date(now.getTime() + days * 864e5).toISOString();
  const rows = await db
    .prepare(
      `${SELECT} WHERE COALESCE(e.end_at, e.start_at) >= :now AND e.start_at <= :until
         AND NOT (e.source = 'athletics' AND e.building_code IS NULL)
       ORDER BY e.start_at`
    )
    .all({ now: now.toISOString(), until, me: req.session.userId });
  const { t: lastImportedAt } = await db.prepare("SELECT MAX(imported_at) AS t FROM events WHERE source != 'student'").get();
  res.json({ events: rows.map((r) => toEvent(r, { userId: req.session.userId })), lastImportedAt });
});

// Choices for the host-an-event form.
eventsRouter.get('/host-options', async (req, res) => {
  res.json({
    categories: HOSTED_CATEGORIES,
    buildings: await db.prepare('SELECT code, name, lat, lng FROM buildings ORDER BY code').all(),
  });
});

// Host a student-run event. The host is automatically going.
eventsRouter.post('/', async (req, res) => {
  const userId = req.session.userId;
  const [values, error] = await validateHostedEvent(req.body);
  if (error) return res.status(400).json({ error });

  const { email } = await db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  const id = `student:${randomBytes(6).toString('base64url')}`;
  const atLimit = await db.transaction(async () => {
    await lockUser(userId);
    const { n } = await db
      .prepare('SELECT COUNT(*) AS n FROM events WHERE host_user_id = ? AND start_at >= ?')
      .get(userId, new Date().toISOString());
    if (n >= MAX_UPCOMING_HOSTED) return true;

    await db.prepare(
      `INSERT INTO events (id, source, title, description, start_at, end_at, location, building_code,
                           organizer, categories, imported_at, host_user_id, capacity)
       VALUES (:id, 'student', :title, :description, :start_at, :end_at, :location, :building_code,
               :organizer, :categories, :created_at, :host_user_id, :capacity)`
    ).run({ ...values, id, organizer: handleOf(email), created_at: new Date().toISOString(), host_user_id: userId });
    await db.prepare('INSERT INTO event_rsvps (event_id, user_id) VALUES (?, ?)').run(id, userId);
    return false;
  });
  if (atLimit) return res.status(400).json({ error: `You can host at most ${MAX_UPCOMING_HOSTED} upcoming events.` });
  res.status(201).json({ event: toEvent(await findEvent(id, userId), { full: true, userId }) });
});

eventsRouter.get('/:id', async (req, res) => {
  const userId = req.session.userId;
  const row = await findEvent(req.params.id, userId);
  if (!row) return res.status(404).json({ error: 'Event not found.' });
  const rsvps = await db
    .prepare(
      `SELECT u.email FROM event_rsvps r JOIN users u ON u.id = r.user_id
       WHERE r.event_id = ? ORDER BY r.created_at`
    )
    .all(row.id);
  const attendees = rsvps.map((a) => handleOf(a.email));
  const pairing = await buddyState(row.id, userId, row.start_at, row.all_day);
  res.json({ event: { ...toEvent(row, { full: true, userId }), attendees, pairing } });
});

// Hosts cancel their own events.
eventsRouter.delete('/:id', async (req, res) => {
  const { changes } = await db
    .prepare('DELETE FROM events WHERE id = ? AND host_user_id = ?')
    .run(req.params.id, req.session.userId);
  if (changes === 0) return res.status(404).json({ error: 'Event not found.' });
  res.json({ ok: true });
});

// Returns [status, error] if the user can't join this event, else null.
function joinError(row) {
  if (new Date(row.end_at ?? row.start_at) < new Date()) return [400, 'This event has ended.'];
  if (!row.going && row.capacity != null && row.going_count >= row.capacity) return [409, 'This event is full.'];
  return null;
}

const addRsvp = db.prepare('INSERT INTO event_rsvps (event_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING');
const lockEvent = db.prepare('SELECT id FROM events WHERE id = ? FOR UPDATE');

// Join an event. Full and finished events can't be joined.
eventsRouter.post('/:id/rsvp', async (req, res) => {
  const userId = req.session.userId;
  // Locking the event stops two people taking the last spot at once.
  const err = await db.transaction(async () => {
    await lockEvent.get(req.params.id);
    const row = await findEvent(req.params.id, userId);
    if (!row) return [404, 'Event not found.'];
    const error = joinError(row);
    if (!error) await addRsvp.run(row.id, userId);
    return error;
  });
  if (err) return res.status(err[0]).json({ error: err[1] });
  res.json({ event: toEvent(await findEvent(req.params.id, userId), { userId }) });
});

// Leaving also turns off buddy pairing, which frees your buddy for someone else.
eventsRouter.delete('/:id/rsvp', async (req, res) => {
  const userId = req.session.userId;
  const row = await findEvent(req.params.id, userId);
  if (!row) return res.status(404).json({ error: 'Event not found.' });
  if (row.host_user_id === userId) return res.status(400).json({ error: "You're hosting this one. Cancel the event instead." });
  await optOut(row.id, userId);
  await db.prepare('DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?').run(row.id, userId);
  res.json({ event: toEvent(await findEvent(row.id, userId), { userId }) });
});

// Ask to be paired with someone else going alone. You have to join the event first.
eventsRouter.post('/:id/buddy', async (req, res) => {
  const userId = req.session.userId;
  const row = await findEvent(req.params.id, userId);
  if (!row) return res.status(404).json({ error: 'Event not found.' });
  if (row.host_user_id === userId) return res.status(400).json({ error: "You're hosting this one, so you won't be going alone." });
  if (new Date(row.end_at ?? row.start_at) < new Date()) return res.status(400).json({ error: 'This event has ended.' });
  if (!row.going) return res.status(400).json({ error: 'Join the event first, then turn on pairing.' });
  await optIn(row.id, userId);
  res.json({ pairing: await buddyState(row.id, userId, row.start_at, row.all_day) });
});

eventsRouter.delete('/:id/buddy', async (req, res) => {
  const userId = req.session.userId;
  const row = await findEvent(req.params.id, userId);
  if (!row) return res.status(404).json({ error: 'Event not found.' });
  await optOut(row.id, userId);
  res.json({ pairing: await buddyState(row.id, userId, row.start_at, row.all_day) });
});
