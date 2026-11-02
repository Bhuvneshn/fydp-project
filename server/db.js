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

  -- Campus buildings from UW's map API (see server/events/importBuildings.js).
  CREATE TABLE IF NOT EXISTS buildings (
    code       TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    alt_names  TEXT NOT NULL DEFAULT '[]',
    lat        REAL NOT NULL,
    lng        REAL NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Imported events (see server/events/importEvents.js). id is "<source>:<source id>".
  CREATE TABLE IF NOT EXISTS events (
    id            TEXT PRIMARY KEY,
    source        TEXT NOT NULL,      -- wusa | uwaterloo | athletics
    feed          TEXT,               -- sub-feed, e.g. "Engineering"
    title         TEXT NOT NULL,
    description   TEXT,
    start_at      TEXT NOT NULL,      -- ISO 8601 UTC
    end_at        TEXT,
    all_day       INTEGER NOT NULL DEFAULT 0,
    location      TEXT,               -- raw location text from the source
    building_code TEXT REFERENCES buildings(code),
    url           TEXT,
    image_url     TEXT,
    organizer     TEXT,
    categories    TEXT NOT NULL DEFAULT '[]',
    cost          TEXT,
    extra         TEXT NOT NULL DEFAULT '{}', -- source-specific fields
    imported_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_start_at ON events(start_at);

  -- Intramural team finder (see server/athletics/teams.js).
  -- kind 'team': a team with players_have of team_size looking for more.
  -- kind 'player': a free agent looking for a team.
  CREATE TABLE IF NOT EXISTS team_posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         TEXT    NOT NULL CHECK (kind IN ('team', 'player')),
    sport        TEXT    NOT NULL,
    division     TEXT,
    skill        TEXT,
    team_name    TEXT,
    players_have INTEGER,
    team_size    INTEGER,
    note         TEXT,
    status       TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'closed')),
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- "I'm in" requests on a post; the poster accepts or declines.
  CREATE TABLE IF NOT EXISTS team_responses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL REFERENCES team_posts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message    TEXT,
    status     TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (post_id, user_id)
  );
`);
