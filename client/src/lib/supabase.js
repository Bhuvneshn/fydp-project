import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Null without keys, so the app still runs locally on our own API.
export const supabase = url && key ? createClient(url, key) : null;

function parseJson(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

// Everything in Supabase is student-run for now; the imported events come from our API.
// RSVPs and buddy pairing need an event in our own database, so these are view-only.
export function toEvent(row) {
  return {
    ...row,
    source: 'student',
    sourceLabel: 'Student-run',
    layer: 'student',
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: Boolean(row.all_day),
    categories: parseJson(row.categories, []),
    extra: parseJson(row.extra, {}),
    building: row.buildings ?? null,
    host: row.organizer ?? null,
    imageUrl: row.image_url,
    going: false,
    goingCount: 0,
    attendees: [],
    viewOnly: true,
  };
}

export async function fetchEvent(id) {
  if (!supabase) return null;
  const { data } = await supabase.from('events').select('*, buildings(*)').eq('id', id).maybeSingle();
  return data ? toEvent(data) : null;
}
