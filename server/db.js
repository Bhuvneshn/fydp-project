import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL must be set. See .env.example.');

// BIGINT columns and COUNT(*) all fit in a JS number (row counts, ms since epoch).
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const pool = new pg.Pool({
  connectionString: url,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
  // Supabase's pooler uses its own certificate chain.
  ssl: isLocal ? false : { rejectUnauthorized: false },
  // Lets the import scripts exit when they finish.
  allowExitOnIdle: true,
});
pool.on('error', (err) => console.error('Database connection error:', err.message));

// The client for the current transaction, so statements inside one join it automatically.
const transactions = new AsyncLocalStorage();
const conn = () => transactions.getStore() ?? pool;

// Turns ? and :name placeholders into $1, $2... String literals and :: casts are left alone.
function compile(sql) {
  const keys = [];
  let positional = 0;
  const text = sql.replace(/'[^']*'|::|\?|:([a-zA-Z_]\w*)/g, (match, name) => {
    if (match === '?') return `$${keys.push(positional++)}`;
    if (!name) return match;
    const seen = keys.indexOf(name);
    return `$${seen === -1 ? keys.push(name) : seen + 1}`;
  });
  return { text, keys, named: positional === 0 && keys.length > 0 };
}

export const db = {
  prepare(sql) {
    const { text, keys, named } = compile(sql);
    const query = (args) => {
      const source = named ? args[0] : args;
      return conn().query(text, keys.map((key) => source[key]));
    };
    return {
      get: async (...args) => (await query(args)).rows[0],
      all: async (...args) => (await query(args)).rows,
      run: async (...args) => ({ changes: (await query(args)).rowCount }),
    };
  },

  exec: (sql) => conn().query(sql),

  // Rolls back if fn throws. Calling this inside another transaction just joins it.
  async transaction(fn) {
    if (transactions.getStore()) return fn();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await transactions.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
};

// A URL id as an INTEGER. Anything else becomes 0, which matches no row.
export function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id <= 2_147_483_647 ? id : 0;
}
