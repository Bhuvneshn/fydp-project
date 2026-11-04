-- Tables the Events page reads from Supabase. They mirror server/db.js, so columns
-- stay TEXT here too: start_at is ISO 8601 UTC, categories and extra are JSON strings.

CREATE TABLE IF NOT EXISTS buildings (
  code       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  alt_names  TEXT NOT NULL DEFAULT '[]',
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  updated_at TEXT NOT NULL DEFAULT now()::text
);

CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL,
  feed          TEXT,
  title         TEXT NOT NULL,
  description   TEXT,
  start_at      TEXT NOT NULL,
  end_at        TEXT,
  all_day       INTEGER NOT NULL DEFAULT 0,
  location      TEXT,
  building_code TEXT REFERENCES buildings(code),
  url           TEXT,
  image_url     TEXT,
  organizer     TEXT,
  categories    TEXT NOT NULL DEFAULT '[]',
  cost          TEXT,
  extra         TEXT NOT NULL DEFAULT '{}',
  imported_at   TEXT NOT NULL DEFAULT now()::text,
  host_user_id  INTEGER,
  capacity      INTEGER
);
CREATE INDEX IF NOT EXISTS events_start_at ON events(start_at);

-- The client uses the publishable key, so it can read these tables and nothing else.
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read buildings" ON buildings;
CREATE POLICY "Anyone can read buildings" ON buildings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read events" ON events;
CREATE POLICY "Anyone can read events" ON events FOR SELECT TO anon, authenticated USING (true);
