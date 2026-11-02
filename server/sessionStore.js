// express-session store backed by SQLite, so logins survive server restarts
// (the default MemoryStore is wiped every time `node --watch` reloads).
import session from 'express-session';
import { db } from './db.js';

const PRUNE_EVERY_MS = 60 * 60 * 1000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid     TEXT    PRIMARY KEY,
    sess    TEXT    NOT NULL,
    expires INTEGER NOT NULL -- ms since epoch
  );
`);

const getSession = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?');
const upsertSession = db.prepare(`
  INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
  ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires
`);
const touchSession = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
const deleteSession = db.prepare('DELETE FROM sessions WHERE sid = ?');
const pruneSessions = db.prepare('DELETE FROM sessions WHERE expires <= ?');

const expiryOf = (sess) => (sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + DEFAULT_TTL_MS);

export class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    pruneSessions.run(Date.now());
    setInterval(() => pruneSessions.run(Date.now()), PRUNE_EVERY_MS).unref();
  }

  get(sid, cb) {
    try {
      const row = getSession.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      upsertSession.run(sid, JSON.stringify(sess), expiryOf(sess));
      cb?.(null);
    } catch (err) {
      cb?.(err);
    }
  }

  touch(sid, sess, cb) {
    try {
      touchSession.run(expiryOf(sess), sid);
      cb?.(null);
    } catch (err) {
      cb?.(err);
    }
  }

  destroy(sid, cb) {
    try {
      deleteSession.run(sid);
      cb?.(null);
    } catch (err) {
      cb?.(err);
    }
  }
}
