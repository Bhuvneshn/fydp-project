// Imports upcoming events from all sources into the `events` table.
// Usage: npm run import:events
import { db } from '../db.js';
import { importBuildings } from './importBuildings.js';
import { resolveBuilding } from './locate.js';
import { fetchWusaEvents } from './sources/wusa.js';
import { fetchUWaterlooEvents } from './sources/uwaterloo.js';
import { fetchAthleticsEvents } from './sources/athletics.js';
import { fetchClubEvents } from './sources/clubs.js';

const DAYS_AHEAD = 120;
const KEEP_PAST_DAYS = 30;

const SOURCES = {
  wusa: async (range) => ({ events: await fetchWusaEvents(range), failures: [] }),
  uwaterloo: fetchUWaterlooEvents,
  athletics: async () => ({ events: await fetchAthleticsEvents(), failures: [] }),
  club: fetchClubEvents,
};
// Student-run events (source 'student') are created in the app, not imported.

const upsert = db.prepare(`
  INSERT INTO events (id, source, feed, title, description, start_at, end_at, all_day, location,
                      building_code, url, image_url, organizer, categories, cost, extra, imported_at)
  VALUES (:id, :source, :feed, :title, :description, :start_at, :end_at, :all_day, :location,
          :building_code, :url, :image_url, :organizer, :categories, :cost, :extra, :imported_at)
  ON CONFLICT(id) DO UPDATE SET
    feed = excluded.feed, title = excluded.title, description = excluded.description,
    start_at = excluded.start_at, end_at = excluded.end_at, all_day = excluded.all_day,
    location = excluded.location, building_code = excluded.building_code, url = excluded.url,
    image_url = excluded.image_url, organizer = excluded.organizer, categories = excluded.categories,
    cost = excluded.cost, extra = excluded.extra, imported_at = excluded.imported_at
`);

function toRow(e, importedAt) {
  return {
    id: `${e.source}:${e.sourceId}`,
    source: e.source,
    feed: e.feed,
    title: e.title,
    description: e.description,
    start_at: e.startAt,
    end_at: e.endAt,
    all_day: e.allDay ? 1 : 0,
    location: e.location,
    // Sources can pin buildingCode (null = known off campus); otherwise resolve from text.
    building_code: e.buildingCode === undefined ? resolveBuilding(e.location, ...e.locationHints) : e.buildingCode,
    url: e.url,
    image_url: e.imageUrl,
    organizer: e.organizer,
    categories: JSON.stringify(e.categories),
    cost: e.cost,
    extra: JSON.stringify(e.extra),
    imported_at: importedAt,
  };
}

export async function importEvents(sourceNames = Object.keys(SOURCES)) {
  if (db.prepare('SELECT COUNT(*) AS n FROM buildings').get().n === 0) {
    console.log(`Imported ${await importBuildings()} buildings.`);
  }

  const today = new Date();
  const range = {
    from: today.toISOString().slice(0, 10),
    to: new Date(today.getTime() + DAYS_AHEAD * 864e5).toISOString().slice(0, 10),
  };

  for (const name of sourceNames) {
    const importedAt = new Date().toISOString();
    let result;
    try {
      result = await SOURCES[name](range);
    } catch (err) {
      console.error(`${name}: failed (${err.message}); keeping existing events.`);
      continue;
    }

    const rows = result.events.map((e) => toRow(e, importedAt));
    rows.forEach((r) => upsert.run(r));

    // Drop upcoming events this source no longer lists (cancelled / moved), unless a sub-feed failed.
    let removed = 0;
    if (result.failures.length === 0) {
      ({ changes: removed } = db
        .prepare('DELETE FROM events WHERE source = ? AND start_at >= ? AND imported_at < ?')
        .run(name, importedAt, importedAt));
    }

    const mapped = rows.filter((r) => r.building_code).length;
    console.log(`${name}: ${rows.length} events (${mapped} on campus map), ${removed} removed.`);
    result.failures.forEach((f) => console.warn(`  feed failed: ${f}`));
  }

  const cutoff = new Date(Date.now() - KEEP_PAST_DAYS * 864e5).toISOString();
  db.prepare('DELETE FROM events WHERE COALESCE(end_at, start_at) < ?').run(cutoff);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2);
  await importEvents(only.length ? only : undefined);
}
