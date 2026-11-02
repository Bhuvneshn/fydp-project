import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'app.db'));

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT    NOT NULL UNIQUE,
    password_hash  TEXT    NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- One-time codes emailed during registration (see server/email.js).
  CREATE TABLE IF NOT EXISTS verification_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash  TEXT    NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0
  );

  -- Scraped from clubs.wusa.ca (see server/clubs/scrapeWusa.js).
  -- categories / socials / associated_clubs / gallery are JSON arrays.
  CREATE TABLE IF NOT EXISTS clubs (
    id                     INTEGER PRIMARY KEY, -- WUSA club id
    slug                   TEXT,
    name                   TEXT NOT NULL,
    acronym                TEXT,
    tagline                TEXT,
    description            TEXT,
    year_started           INTEGER,
    member_count           INTEGER,
    executive_count        INTEGER,
    logo_url               TEXT,
    email                  TEXT,
    wusa_active_this_term  INTEGER NOT NULL DEFAULT 0,
    current_term_name      TEXT,
    membership_and_meeting TEXT,
    activities             TEXT,
    other                  TEXT,
    categories             TEXT NOT NULL DEFAULT '[]',
    socials                TEXT NOT NULL DEFAULT '[]',
    associated_clubs       TEXT NOT NULL DEFAULT '[]',
    gallery                TEXT NOT NULL DEFAULT '[]',
    wusa_last_updated      TEXT,
    scraped_at             TEXT NOT NULL,
    -- Instagram activity (see server/clubs/instagram.js)
    instagram_handle       TEXT,
    ig_last_post_at        TEXT,
    ig_checked_at          TEXT,
    ig_check_error         TEXT
  );
`);
