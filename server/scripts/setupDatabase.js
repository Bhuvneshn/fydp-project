// Creates or updates the tables, then adds the demo events. Safe to run more than once.
// Usage: npm run db:setup
import { readFileSync } from 'node:fs';
import { db } from '../db.js';

for (const file of ['schema.sql', 'seed.sql']) {
  await db.exec(readFileSync(new URL(`../../supabase/${file}`, import.meta.url), 'utf8'));
  console.log(`Ran ${file}.`);
}
