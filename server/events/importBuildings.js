// Imports campus building codes + coordinates into the `buildings` table.
// Usage: npm run import:buildings
//
// Source: the API behind UW's official campus map (no key needed). It returns
// ~200 GeoJSON point features with building codes like SLC, MC, E2, DC.
import { db } from '../db.js';

const BUILDINGS_URL = 'https://portalapi2.uwaterloo.ca/v2/map/Buildings';

export async function importBuildings() {
  const res = await fetch(BUILDINGS_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${BUILDINGS_URL}`);
  const features = (await res.json()).data?.features ?? [];

  const upsert = db.prepare(`
    INSERT INTO buildings (code, name, alt_names, lat, lng, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (code) DO UPDATE SET
      name = excluded.name, alt_names = excluded.alt_names,
      lat = excluded.lat, lng = excluded.lng, updated_at = excluded.updated_at
  `);

  const now = new Date().toISOString();
  let saved = 0;
  for (const { properties: p, geometry } of features) {
    if (!p?.buildingCode || geometry?.type !== 'Point') continue;
    const [lng, lat] = geometry.coordinates;
    const altNames = String(p.alternateBuildingNames ?? '')
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    await upsert.run(p.buildingCode.toUpperCase(), p.buildingName.trim(), JSON.stringify(altNames), lat, lng, now);
    saved++;
  }
  return saved;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Saved ${await importBuildings()} buildings.`);
}
