// Resolves free-text event locations ("SLC Lower Atrium", "E2 - Engineering 2- Room 2350",
// "The Bomber", "Carl Totzke Court (PAC)") to a campus building code.
import { db } from '../db.js';

// Venues that aren't named after their building. Keys are matched case-insensitively.
const ALIASES = {
  'the bomber': 'SLC',
  'glow centre': 'SLC',
  "women's centre": 'SLC',
  'mates': 'SLC',
  'grad house': 'GH',
  'dana porter': 'LIB',
  'carl totzke': 'PAC',
  'cif arena': 'CIF',
  'columbia icefield': 'CIF',
  'hagey hall': 'HH',
  'davis centre': 'DC',
  'fed hall': 'FED',
  'warrior football field': 'WF',
  'tatham centre': 'TC',
  'mathematics 3': 'M3',
  'math 3': 'M3',
};

let cache;
// Run this once before resolveBuilding.
export async function loadBuildings() {
  const rows = await db.prepare('SELECT code, name, alt_names FROM buildings').all();
  const codes = new Set(rows.map((r) => r.code));
  // Longest names first so "Engineering 7" wins over "Engineering".
  const names = rows
    .flatMap((r) => [r.name, ...JSON.parse(r.alt_names)].map((n) => [n.toLowerCase(), r.code]))
    .filter(([n]) => n.length >= 6)
    .sort((a, b) => b[0].length - a[0].length);
  cache = { codes, names };
}

// Returns a building code, or null for off-campus / unknown locations.
export function resolveBuilding(...texts) {
  const { codes, names } = cache;
  const parts = texts.filter(Boolean).map(String);
  if (!parts.length) return null;

  for (const text of parts) {
    // Leading code: "MC 4060", "E2 - Engineering 2", "SLC Lower Atrium", "STJ-AC ..."
    const lead = /^\s*([A-Z][A-Z0-9]{0,4}(?:-[A-Z]+)?)(?=[\s,\-:(]|$)/.exec(text)?.[1];
    if (lead && codes.has(lead)) return lead;
    // Code followed by a room number anywhere: "Room MC 4060"
    for (const [, code] of text.matchAll(/\b([A-Z][A-Z0-9]{1,4})\s+\d{3,4}\b/g)) {
      if (codes.has(code)) return code;
    }
    // Parenthesised code: "Carl Totzke Court (PAC)"
    for (const [, code] of text.matchAll(/\(([A-Z][A-Z0-9]{1,4})\)/g)) {
      if (codes.has(code)) return code;
    }
  }

  const haystack = parts.join(' | ').toLowerCase();
  for (const [alias, code] of Object.entries(ALIASES)) {
    if (haystack.includes(alias) && codes.has(code)) return code;
  }
  for (const [name, code] of names) {
    if (haystack.includes(name)) return code;
  }
  return null;
}
