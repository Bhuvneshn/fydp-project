// WUSA events (clubs, Bomber, Glow, Thrift, ...) via The Events Calendar REST API on wusa.ca.
import { decodeEntities, htmlToText } from '../text.js';

const API = 'https://wusa.ca/wp-json/tribe/events/v1/events';

export async function fetchWusaEvents({ from, to }) {
  const events = [];
  for (let page = 1; ; page++) {
    const url = `${API}?per_page=50&page=${page}&start_date=${from}&end_date=${to}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    // The API answers 404 once you page past the end.
    if (res.status === 404 && page > 1) break;
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const body = await res.json();
    events.push(...body.events.map(toEvent));
    if (page >= (body.total_pages ?? 1)) break;
  }
  return events;
}

function toEvent(e) {
  const venue = e.venue && !Array.isArray(e.venue) ? e.venue : null;
  const organizers = (e.organizer ?? []).map((o) => decodeEntities(o.organizer)).filter(Boolean);
  return {
    source: 'wusa',
    sourceId: String(e.id),
    feed: null,
    title: decodeEntities(e.title).trim(),
    description: htmlToText(e.description),
    startAt: new Date(e.utc_start_date.replace(' ', 'T') + 'Z').toISOString(),
    endAt: e.utc_end_date ? new Date(e.utc_end_date.replace(' ', 'T') + 'Z').toISOString() : null,
    allDay: Boolean(e.all_day),
    location: venue ? decodeEntities(venue.venue) : null,
    // Extra text the location resolver can use (venue address often names the building).
    locationHints: venue ? [venue.address, venue.city].map(decodeEntities) : [],
    url: e.url,
    imageUrl: e.image?.url ?? null,
    organizer: organizers.join(', ') || null,
    categories: (e.categories ?? []).map((c) => decodeEntities(c.name)),
    cost: e.cost ? decodeEntities(e.cost) : null,
    extra: { organizers, virtualUrl: e.virtual_url || null },
  };
}
