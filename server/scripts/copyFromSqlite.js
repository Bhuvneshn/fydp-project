// One-time copy of the old SQLite database (data/app.db) into Postgres. Run after db:setup.
// Usage: npm run db:copy-sqlite
//        npm run db:copy-sqlite -- --with-users    also copies accounts, RSVPs, buddies and teams
//
// Accounts are left out by default because the local ones are test accounts. Logins aren't
// copied either way, so everyone signs in again.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { db } from '../db.js';

const withUsers = process.argv.includes('--with-users');
const sqlite = new DatabaseSync(path.resolve(process.env.DATA_DIR ?? 'data', 'app.db'), { readOnly: true });

// In foreign key order. `update` means a rerun refreshes the row instead of skipping it.
const SHARED = [
  { table: 'clubs', key: 'id', update: true },
  { table: 'buildings', key: 'code', update: true },
];
const ACCOUNTS = [{ table: 'users', key: 'id', identity: true }];
const EVENTS = { table: 'events', key: 'id', update: true, where: withUsers ? '' : 'WHERE host_user_id IS NULL' };
const ACCOUNT_DATA = [
  { table: 'event_rsvps', key: 'event_id, user_id' },
  { table: 'event_buddies', key: 'event_id, user_id' },
  { table: 'team_posts', key: 'id', identity: true },
  { table: 'team_responses', key: 'id', identity: true },
];
const TABLES = withUsers ? [...SHARED, ...ACCOUNTS, EVENTS, ...ACCOUNT_DATA] : [...SHARED, EVENTS];

async function copyTable({ table, key, update, identity, where = '' }) {
  const rows = sqlite.prepare(`SELECT * FROM ${table} ${where}`).all();
  if (rows.length === 0) return console.log(`${table}: nothing to copy.`);

  const columns = Object.keys(rows[0]);
  const keys = key.split(', ');
  const changes = columns.filter((c) => !keys.includes(c)).map((c) => `${c} = excluded.${c}`);
  const insert = db.prepare(`
    INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((c) => `:${c}`).join(', ')})
    ON CONFLICT (${key}) DO ${update ? `UPDATE SET ${changes.join(', ')}` : 'NOTHING'}
  `);
  for (const row of rows) await insert.run(row);

  // Ids were copied as they were, so new rows have to start after them.
  if (identity) {
    await db.exec(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT MAX(id) FROM ${table}))`);
  }
  console.log(`${table}: ${rows.length} rows.`);
}

await db.transaction(async () => {
  for (const table of TABLES) await copyTable(table);
});
