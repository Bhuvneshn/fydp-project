// Scrapes every club from the WUSA clubs directory into the `clubs` table.
// Usage: npm run scrape:clubs
//
// Uses the same public JSON API the clubs.wusa.ca site uses:
//   POST /api/v1/clubs_listing/{active|inactive}  -> paginated club ids
//   GET  /api/v1/clubs/:id/profile                -> full profile
import { db } from '../db.js';

const WUSA = 'https://clubs.wusa.ca';
const API = `${WUSA}/api/v1`;
const PAGE_SIZE = 100; // server caps rows at 100
const CONCURRENCY = 4;

const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };

async function getJson(url, init) {
  const res = await fetch(url, { headers, ...init });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const body = await res.json();
  if (!body.success) throw new Error(`Unsuccessful response from ${url}`);
  return body.data;
}

async function listClubIds(kind) {
  const ids = [];
  for (let page = 1; ; page++) {
    const { clubs, total_records } = await getJson(`${API}/clubs_listing/${kind}`, {
      method: 'POST',
      body: JSON.stringify({ page, rows: PAGE_SIZE }),
    });
    ids.push(...clubs.map((c) => c.id));
    if (clubs.length === 0 || ids.length >= total_records) return ids;
  }
}

const absoluteUrl = (url) => (url && url.startsWith('/') ? WUSA + url : url || null);

function toRow(p) {
  const socials = p.socials.map((s) => ({
    type: s.key,
    name: s.friendly_name,
    url: s.url,
    handle: s.handle,
  }));

  return {
    id: p.id,
    slug: p.slug,
    name: p.name.trim(),
    acronym: p.acronym || null,
    tagline: p.tagline || null,
    description: p.description || null,
    year_started: p.year_started ?? null,
    member_count: p.number_of_active_members ?? null,
    // Store only the count; we don't republish student names.
    executive_count: p.executives?.length ?? 0,
    logo_url: absoluteUrl(p.profile_picture_url),
    email: p.email || null,
    wusa_active_this_term: p.is_active_for_current_term ? 1 : 0,
    current_term_name: p.current_term_name || null,
    membership_and_meeting: p.membership_and_meeting || null,
    activities: p.activities || null,
    other: p.other || null,
    categories: JSON.stringify(p.categories.map((c) => c.name)),
    socials: JSON.stringify(socials),
    associated_clubs: JSON.stringify(p.associated_clubs.map((c) => ({ id: c.id, name: c.name }))),
    gallery: JSON.stringify(p.gallery.map((g) => absoluteUrl(g.url))),
    wusa_last_updated: p.last_updated || null,
    scraped_at: new Date().toISOString(),
  };
}

const COLUMNS = Object.keys(toRow({ socials: [], categories: [], associated_clubs: [], gallery: [], name: '' }));
const upsert = db.prepare(`
  INSERT INTO clubs (${COLUMNS.join(', ')})
  VALUES (${COLUMNS.map((c) => `:${c}`).join(', ')})
  ON CONFLICT(id) DO UPDATE SET
    ${COLUMNS.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(',\n    ')}
`);

async function mapConcurrent(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: limit }, worker));
}

async function main() {
  const ids = [...new Set([...(await listClubIds('active')), ...(await listClubIds('inactive'))])];
  console.log(`Found ${ids.length} clubs. Fetching profiles...`);

  let done = 0;
  const failed = [];
  await mapConcurrent(ids, CONCURRENCY, async (id) => {
    try {
      upsert.run(toRow(await getJson(`${API}/clubs/${id}/profile`)));
    } catch (err) {
      failed.push(`${id}: ${err.message}`);
    }
    if (++done % 50 === 0) console.log(`  ${done}/${ids.length}`);
  });

  // Drop clubs that no longer appear in the directory.
  const placeholders = ids.map(() => '?').join(',');
  const { changes } = db.prepare(`DELETE FROM clubs WHERE id NOT IN (${placeholders})`).run(...ids);

  console.log(`Saved ${ids.length - failed.length} clubs, removed ${changes} stale.`);
  if (failed.length) console.warn(`Failed (${failed.length}):\n  ${failed.join('\n  ')}`);
}

await main();
