// Buddy pairing: students going to an event alone opt in, and are matched two at a time,
// first come first served. Matched buddies see each other's handle and email.
import { db } from '../db.js';

// Suggested meeting time, before the event starts.
export const MEET_MINUTES_BEFORE = 10;

const handleOf = (email) => email.split('@')[0];

const findRow = db.prepare('SELECT * FROM event_buddies WHERE event_id = ? AND user_id = ?');
const oldestWaiting = db.prepare(
  `SELECT user_id FROM event_buddies
   WHERE event_id = ? AND user_id != ? AND buddy_user_id IS NULL
   ORDER BY created_at, user_id LIMIT 1`
);
const setBuddy = db.prepare('UPDATE event_buddies SET buddy_user_id = ? WHERE event_id = ? AND user_id = ?');

const lockEvent = db.prepare('SELECT pg_advisory_xact_lock(hashtext(?))');

// Pairing runs one at a time per event, so two people can't be matched with the same person.
function inTransaction(eventId, fn) {
  return db.transaction(async () => {
    await lockEvent.get(eventId);
    await fn();
  });
}

// Pair this (unmatched) user with whoever has been waiting longest, if anyone.
async function match(eventId, userId) {
  const other = await oldestWaiting.get(eventId, userId);
  if (!other) return;
  await setBuddy.run(other.user_id, eventId, userId);
  await setBuddy.run(userId, eventId, other.user_id);
}

// The caller must already be going. Opting in again is a no-op.
export function optIn(eventId, userId) {
  return inTransaction(eventId, async () => {
    const { changes } = await db
      .prepare('INSERT INTO event_buddies (event_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
      .run(eventId, userId);
    if (changes) await match(eventId, userId);
  });
}

// Turning pairing off (or leaving the event) frees your buddy to be matched with someone else.
export function optOut(eventId, userId) {
  return inTransaction(eventId, async () => {
    const row = await findRow.get(eventId, userId);
    if (!row) return;
    await db.prepare('DELETE FROM event_buddies WHERE event_id = ? AND user_id = ?').run(eventId, userId);
    if (row.buddy_user_id != null) {
      await setBuddy.run(null, eventId, row.buddy_user_id);
      await match(eventId, row.buddy_user_id);
    }
  });
}

// What the event page shows: whether you're opted in, your buddy once matched,
// and how many others are waiting for one.
export async function buddyState(eventId, userId, startAt, allDay) {
  const row = await findRow.get(eventId, userId);
  const { n } = await db
    .prepare('SELECT COUNT(*) AS n FROM event_buddies WHERE event_id = ? AND user_id != ? AND buddy_user_id IS NULL')
    .get(eventId, userId);
  let buddy = null;
  if (row?.buddy_user_id != null) {
    const { email } = await db.prepare('SELECT email FROM users WHERE id = ?').get(row.buddy_user_id);
    buddy = { handle: handleOf(email), email };
  }
  return {
    optedIn: Boolean(row),
    buddy,
    waitingCount: n,
    meetAt: allDay ? null : new Date(new Date(startAt).getTime() - MEET_MINUTES_BEFORE * 60_000).toISOString(),
  };
}
