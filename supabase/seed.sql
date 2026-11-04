-- The three student-run events and the buildings they need. Run after schema.sql, or use
-- `npm run db:setup`. Safe to run twice.

INSERT INTO buildings (code, name, lat, lng) VALUES
  ('MC', 'Mathematics and Computer Building', 43.4723, -80.5438),
  ('SLC', 'Student Life Centre', 43.4717, -80.5454),
  ('E7', 'Engineering 7', 43.4729, -80.5404)
ON CONFLICT (code) DO NOTHING;

INSERT INTO events (id, source, title, description, start_at, location, building_code) VALUES
  ('demo-001', 'student', 'UW Hackathon', $event$We’re a group of first-years who wanted a hackathon where it’s okay if you’ve never been to one before, so we decided to run our own.

Find a team or come solo and we’ll help you meet people. Pick an idea, build something, and show it off at the end. It doesn’t need to be polished or even fully work. We’ll have snacks, mentors to help when you get stuck, and a demo session to wrap things up. All programs and skill levels are welcome, and you definitely don’t have to be in CS.

📍 Mathematics and Computer Building | 📅 Saturday, November 14 | 🕙 10 AM

Bring your laptop, charger, and whatever half-baked idea has been sitting in your notes app. 💻$event$, '2026-11-14T15:00:00.000Z', 'Mathematics and Computer Building', 'MC'),
  ('demo-002', 'student', 'Student Tech Networking', $event$Networking doesn’t have to be stiff or awkward, so we’re making it a relaxed morning where students can just talk to each other about tech.

Grab a coffee, meet people from other programs and years, and swap stories about co-op, side projects, and what you’re trying to figure out. We’ll have conversation starters and small groups, so you won’t be left standing alone. This event was started by first-years who are figuring it all out too, so there’s no need to bring a polished pitch or a resume.

📍 Student Life Centre | 📅 Saturday, November 7 | 🕛 12 PM

Come by yourself or bring a friend. You’ll leave knowing a few more people on campus. ☕$event$, '2026-11-07T17:00:00.000Z', 'Student Life Centre', 'SLC'),
  ('demo-003', 'student', 'Engineering Project Showcase', $event$Some of the coolest projects on campus never leave a dorm room or a design team bay, so we’re giving them a spot to be seen.

Student builders will be showing what they’ve been working on, from course projects to personal builds and prototypes that are still very much in progress. Walk around, ask questions, try things out, and talk to the people who made them. You don’t have to be in engineering to come. If you’re a first-year, it’s also a great way to see what you could be building a few years from now.

📍 Engineering 7 | 📅 Sunday, November 15 | 🕐 1 PM

Stop by on your way to class and see what your classmates have been making. 🛠️$event$, '2026-11-15T18:00:00.000Z', 'Engineering 7', 'E7')
ON CONFLICT (id) DO NOTHING;
