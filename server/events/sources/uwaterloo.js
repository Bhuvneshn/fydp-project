// Official University of Waterloo events from uwaterloo.ca iCal feeds:
// the central events calendar plus each faculty / department site.
import ical from 'node-ical';
import { decodeEntities, htmlToText } from '../text.js';

export const UW_FEEDS = [
  { feed: 'University', url: 'https://uwaterloo.ca/events/events/ical' },
  { feed: 'Engineering', url: 'https://uwaterloo.ca/engineering/events/ical' },
  { feed: 'Math', url: 'https://uwaterloo.ca/math/events/ical' },
  { feed: 'Science', url: 'https://uwaterloo.ca/science/events/ical' },
  { feed: 'Arts', url: 'https://uwaterloo.ca/arts/events/ical' },
  { feed: 'Environment', url: 'https://uwaterloo.ca/environment/events/ical' },
  { feed: 'Health', url: 'https://uwaterloo.ca/health/events/ical' },
  { feed: 'Career Development', url: 'https://uwaterloo.ca/career-development/events/ical' },
];

// Returns { events, failures }. One broken feed shouldn't block the others.
export async function fetchUWaterlooEvents({ from, to }) {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to) + 24 * 60 * 60 * 1000;
  const seen = new Set();
  const events = [];
  const failures = [];

  for (const { feed, url } of UW_FEEDS) {
    let data;
    try {
      data = await ical.async.fromURL(url);
    } catch (err) {
      failures.push(`${feed}: ${err.message}`);
      continue;
    }
    for (const e of Object.values(data)) {
      if (e.type !== 'VEVENT' || !e.start) continue;
      const allDay = e.datetype === 'date';
      const start = allDay ? torontoMidnight(e.start) : e.start;
      const end = e.end ? (allDay ? torontoMidnight(e.end) : e.end) : null;
      if ((end ?? start).getTime() < fromMs || start.getTime() > toMs) continue;

      // Events promoted from a faculty site also appear on the central calendar.
      const title = String(e.summary ?? '').replace(/\s+/g, ' ').trim();
      const dedupeKey = `${title.toLowerCase()}|${start.toISOString()}`;
      if (!title || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      events.push({
        source: 'uwaterloo',
        sourceId: String(e.uid),
        feed,
        title,
        description: htmlToText(e.description),
        startAt: start.toISOString(),
        endAt: end ? end.toISOString() : null,
        allDay,
        location: cleanLocation(e.location ?? '') || null,
        locationHints: [],
        url: typeof e.url === 'object' ? e.url.val : e.url ?? null,
        imageUrl: null,
        organizer: feed === 'University' ? 'University of Waterloo' : `Faculty of ${feed}`.replace('Faculty of Career Development', 'Centre for Career Development'),
        categories: [].concat(e.categories ?? []).filter(Boolean),
        cost: null,
        extra: {},
      });
    }
  }
  return { events, failures };
}

// node-ical builds all-day dates at midnight in the *server's* time zone; re-anchor that
// calendar date to midnight in Toronto so it doesn't drift when the server runs elsewhere.
function torontoMidnight(date) {
  const utcGuess = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 5); // 00:00 EST
  const torontoHour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', hour: 'numeric', hourCycle: 'h23' }).format(utcGuess)
  );
  return new Date(utcGuess - torontoHour * 3600e3); // shifts back an hour during EDT
}

// "E2 - Engineering 2- Room 2350 200 University Avenue West Waterloo ON N2L 3G1" -> "E2 - Engineering 2- Room 2350"
function cleanLocation(location) {
  return decodeEntities(location)
    .replace(/\s+/g, ' ')
    .replace(/\s+\d+ [A-Z][\w.]*( [A-Z][\w.]*)* (Ave|Avenue|St|Street|Rd|Road)\b.*$/, '')
    .replace(/\s+Waterloo,? ON\b.*$/i, '')
    .trim();
}
