// Student-run events: anyone signed in can host one on the map, and others can join.
import { db } from '../db.js';
import { torontoToUtc } from './time.js';

export const HOSTED_CATEGORIES = ['Study session', 'Social', 'Sports & games', 'Food', 'Arts & culture', 'Tech', 'Other'];
export const MAX_UPCOMING_HOSTED = 10;
const MAX_DAYS_AHEAD = 180;
const MAX_LENGTH_MS = 12 * 60 * 60 * 1000;

const cleanText = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

// Returns [row values, error]. Dates and times are Waterloo wall-clock ("2026-11-05", "19:00").
export async function validateHostedEvent(body, now = new Date()) {
  const title = cleanText(body.title, 100);
  if (!title) return [null, 'Give your event a name.'];
  if (!HOSTED_CATEGORIES.includes(body.category)) return [null, 'Choose a category.'];

  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(body.date ?? '');
  const start = /^(\d{2}):(\d{2})$/.exec(body.startTime ?? '');
  const end = /^(\d{2}):(\d{2})$/.exec(body.endTime ?? '');
  if (!date || !start || !end) return [null, 'Pick a date, start time and end time.'];
  const [y, mo, d] = date.slice(1).map(Number);
  const startAt = torontoToUtc(y, mo, d, Number(start[1]), Number(start[2]));
  let endAt = torontoToUtc(y, mo, d, Number(end[1]), Number(end[2]));
  // An end time before the start (22:00 to 01:00) runs past midnight.
  if (endAt <= startAt) endAt = torontoToUtc(y, mo, d + 1, Number(end[1]), Number(end[2]));
  if (Number.isNaN(startAt.getTime())) return [null, 'That date is not valid.'];
  if (startAt < now) return [null, 'The start time has already passed.'];
  if (startAt - now > MAX_DAYS_AHEAD * 864e5) return [null, `Events can be at most ${MAX_DAYS_AHEAD} days out.`];
  if (endAt - startAt > MAX_LENGTH_MS) return [null, 'Events can be at most 12 hours long.'];

  let buildingCode = null;
  let location;
  if (body.buildingCode) {
    const building = await db.prepare('SELECT code, name FROM buildings WHERE code = ?').get(String(body.buildingCode));
    if (!building) return [null, 'Choose a campus building.'];
    buildingCode = building.code;
    const room = cleanText(body.room, 40);
    location = room ? `${building.code} ${room}` : building.name;
  } else {
    location = cleanText(body.location, 120);
    if (!location) return [null, 'Choose a building, or say where it is.'];
  }

  let capacity = null;
  if (body.capacity !== '' && body.capacity != null) {
    capacity = Number.parseInt(body.capacity, 10);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 500) return [null, 'Capacity must be between 2 and 500.'];
  }

  return [
    {
      title,
      description: cleanText(body.description, 2000),
      categories: JSON.stringify([body.category]),
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      building_code: buildingCode,
      location,
      capacity,
    },
    null,
  ];
}
