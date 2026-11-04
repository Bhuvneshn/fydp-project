-- Demo data for the Events page. Run after schema.sql. Safe to run twice.

INSERT INTO buildings (code, name, lat, lng) VALUES
  ('MC', 'Mathematics and Computer Building', 43.4723, -80.5438),
  ('SLC', 'Student Life Centre', 43.4717, -80.5454),
  ('E7', 'Engineering 7', 43.4729, -80.5404)
ON CONFLICT (code) DO NOTHING;

INSERT INTO events (id, source, title, description, start_at, location, building_code) VALUES
  ('demo-001', 'demo', 'UW Hackathon', 'Sample hackathon event for testing.', '2026-11-06T17:00:00.000Z', 'Mathematics and Computer Building', 'MC'),
  ('demo-002', 'demo', 'Student Tech Networking', 'Sample student networking event for testing.', '2026-11-07T14:00:00.000Z', 'Student Life Centre', 'SLC'),
  ('demo-003', 'demo', 'Engineering Project Showcase', 'Sample project showcase event for testing.', '2026-11-09T12:00:00.000Z', 'Engineering 7', 'E7')
ON CONFLICT (id) DO NOTHING;
