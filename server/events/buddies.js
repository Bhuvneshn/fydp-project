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

function inTransaction(fn) {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Pair this (unmatched) user with whoever has been waiting longest, if anyone.
function match(eventId, userId) {
  const other = oldestWaiting.get(eventId, userId);
  if (!other) return;
  setBuddy.run(other.user_id, eventId, userId);
  setBuddy.run(userId, eventId, other.user_id);
}

// The caller must already be going. Opting in again is a no-op.
export function optIn(eventId, userId) {
  inTransaction(() => {
    const { changes } = db
      .prepare('INSERT INTO event_buddies (event_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
      .run(eventId, userId);
    if (changes) match(eventId, userId);
  });
}

// Turning pairing off (or leaving the event) frees your buddy to be matched with someone else.
export function optOut(eventId, userId) {
  inTransaction(() => {
    const row = findRow.get(eventId, userId);
    if (!row) return;
    db.prepare('DELETE FROM event_buddies WHERE event_id = ? AND user_id = ?').run(eventId, userId);
    if (row.buddy_user_id != null) {
      setBuddy.run(null, eventId, row.buddy_user_id);
      match(eventId, row.buddy_user_id);
    }
  });
}

// What the event page shows: whether you're opted in, your buddy once matched,
// and how many others are waiting for one.
export function buddyState(eventId, userId, startAt, allDay) {
  const row = findRow.get(eventId, userId);
  const { n } = db
    .prepare('SELECT COUNT(*) AS n FROM event_buddies WHERE event_id = ? AND user_id != ? AND buddy_user_id IS NULL')
    .get(eventId, userId);
  let buddy = null;
  if (row?.buddy_user_id != null) {
    const { email } = db.prepare('SELECT email FROM users WHERE id = ?').get(row.buddy_user_id);
    buddy = { handle: handleOf(email), email };
  }
  return {
    optedIn: Boolean(row),
    buddy,
    waitingCount: n,
    meetAt: allDay ? null : new Date(new Date(startAt).getTime() - MEET_MINUTES_BEFORE * 60_000).toISOString(),
  };
}
