// Waterloo Warriors varsity schedule from athletics.uwaterloo.ca (Sidearm Sports).
// The month-view JSON behind the site's calendar includes facility, opponent, results and links.
import { torontoToUtc } from '../time.js';

const SITE = 'https://athletics.uwaterloo.ca';
const MONTHS_BACK = 1; // keep last month's results around
const MONTHS_AHEAD = 4;
const GAME_LENGTH_MS = 2 * 60 * 60 * 1000;

async function fetchMonth(year, month) {
  const url = `${SITE}/services/responsive-calendar.ashx?type=month&sport=0&location=all&date=${month}/1/${year}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()).flatMap((day) => day.events ?? []);
}

export async function fetchAthleticsEvents() {
  const now = new Date();
  const games = new Map();
  for (let i = -MONTHS_BACK; i <= MONTHS_AHEAD; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    for (const g of await fetchMonth(d.getFullYear(), d.getMonth() + 1)) {
      // Multi-day meets are repeated on every day they span; remember the last day.
      const day = g.date.slice(0, 10);
      const seen = games.get(g.id);
      if (seen) seen.lastDay = day > seen.lastDay ? day : seen.lastDay;
      else games.set(g.id, { ...g, lastDay: day });
    }
  }
  return [...games.values()].map(toEvent);
}

// "7:00 PM" -> [19, 0]; "" / "TBA" / "All Day" -> null
function parseTime(time) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(time).trim());
  if (!m) return null;
  return [(Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0), Number(m[2])];
}

function toEvent(g) {
  const [y, mo, d] = g.date.slice(0, 10).split('-').map(Number);
  const time = parseTime(g.time);
  const allDay = !time;
  const start = time ? torontoToUtc(y, mo, d, ...time) : torontoToUtc(y, mo, d);
  const [ly, lm, ld] = g.lastDay.split('-').map(Number);
  const end = allDay ? torontoToUtc(ly, lm, ld + 1) : new Date(start.getTime() + GAME_LENGTH_MS);

  const opponent = g.opponent?.title ?? null;
  const title = opponent ? `${g.sport.title} ${g.at_vs ?? 'vs'} ${opponent}` : g.sport.title;
  const link = (l) => (l?.url ? new URL(l.url, SITE).href : null);
  const result = g.result?.status
    ? { outcome: g.result.status, us: g.result.team_score, them: g.result.opponent_score, boxScore: link(g.result.boxscore) }
    : null;

  return {
    source: 'athletics',
    sourceId: String(g.id),
    feed: g.sport.title,
    title,
    description: null,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    allDay,
    location: g.facility?.title?.trim() || g.location || null,
    // Home and neutral-site games (e.g. championships hosted at Warrior Field) may be on campus;
    // away venues never are, even when their names collide with campus aliases.
    locationHints: [],
    buildingCode: g.location_indicator === 'A' ? null : undefined,
    url: `${SITE}/calendar.aspx?game_id=${g.id}`,
    imageUrl: g.opponent?.image ? `${SITE}${g.opponent.image.path}/${g.opponent.image.filename}` : null,
    organizer: 'Waterloo Warriors',
    categories: [g.sport.title],
    cost: null,
    extra: {
      sport: g.sport.title,
      opponent,
      homeAway: { H: 'home', A: 'away', N: 'neutral' }[g.location_indicator] ?? null,
      city: g.location || null,
      gameType: { R: 'Regular season', S: 'Exhibition', P: 'Playoffs' }[g.type] ?? null,
      tournament: g.tournament?.title ?? null,
      cancelled: g.status === 'C',
      result,
      tickets: link(g.media?.tickets),
      video: link(g.media?.video),
      stats: link(g.media?.stats),
    },
  };
}
