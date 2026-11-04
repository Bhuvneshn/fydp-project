// express-session store backed by Postgres, so logins survive server restarts
// (the default MemoryStore is wiped every time `node --watch` reloads).
import session from 'express-session';
import { db } from './db.js';

const PRUNE_EVERY_MS = 60 * 60 * 1000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

const getSession = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?');
const upsertSession = db.prepare(`
  INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
  ON CONFLICT (sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires
`);
const touchSession = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
const deleteSession = db.prepare('DELETE FROM sessions WHERE sid = ?');
const pruneSessions = db.prepare('DELETE FROM sessions WHERE expires <= ?');

const expiryOf = (sess) => (sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + DEFAULT_TTL_MS);

const prune = () => pruneSessions.run(Date.now()).catch((err) => console.error('Session cleanup failed:', err.message));

export class PostgresSessionStore extends session.Store {
  constructor() {
    super();
    prune();
    setInterval(prune, PRUNE_EVERY_MS).unref();
  }

  get(sid, cb) {
    getSession.get(sid, Date.now()).then((row) => cb(null, row ? JSON.parse(row.sess) : null), cb);
  }

  set(sid, sess, cb) {
    upsertSession.run(sid, JSON.stringify(sess), expiryOf(sess)).then(() => cb?.(null), (err) => cb?.(err));
  }

  touch(sid, sess, cb) {
    touchSession.run(expiryOf(sess), sid).then(() => cb?.(null), (err) => cb?.(err));
  }

  destroy(sid, cb) {
    deleteSession.run(sid).then(() => cb?.(null), (err) => cb?.(err));
  }
}
