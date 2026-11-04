# FYDP Project

Campus life app for UWaterloo students: an events map where students can also host and join events, intramural team matching, and a clubs directory. Accounts are restricted to **@uwaterloo.ca** emails.

## Stack

- **Frontend** (`client/`): React 19 + React Router, built with Vite
- **Backend** (`server/`): Node.js 22.13+ with Express 5, `express-session` cookie sessions, `bcryptjs` password hashing, and Postgres through `pg`, hosted on Supabase

```
client/            React app
  src/pages/       Login, Register, Verify, Events, EventDetail, HostEvent, Intramurals, Clubs, ...
  src/components/  CampusMap (MapLibre), Layout, ...
  src/auth.jsx     Auth context (current user, login/register/verify/logout)
  src/App.jsx      Routes + redirect guards
server/            Express API
  auth.js          /api/auth routes
  email.js         One-time code scaffolding
  validation.js    @uwaterloo.ca check
  clubs/
    scrapeWusa.js  Imports clubs from clubs.wusa.ca
    routes.js      /api/clubs
  events/
    importBuildings.js  Campus building codes + coordinates (UW map API)
    importEvents.js     Runs every event source below
    sources/            wusa.js, uwaterloo.js, athletics.js, clubs.js (scaffolding)
    locate.js           Matches venue text ("The Bomber", "MC 4060") to a building
    hosted.js           Validation for student-run events
    routes.js           /api/events (list, detail, host, join)
  athletics/
    teams.js            /api/teams (intramural team finder)
    intramurals.js      List of intramural sports (update each term)
```

## Getting started

```bash
npm install            # also installs client/ deps
cp .env.example .env   # set DATABASE_URL, then run npm run db:setup
npm run dev            # API on :3000, React (Vite) on :5173
```

Then import the data (clubs, buildings, events, varsity schedule; about 30 seconds):

```bash
npm run import:all     # = scrape:clubs + import:events
```

Re-run `npm run import:events` daily (e.g. cron) to keep events fresh.

Open http://localhost:5173. Vite proxies `/api` to the Express server.

All data lives in Postgres. Set `DATABASE_URL` in `.env`, then run `npm run db:setup` to create the tables and add the demo events (`supabase/schema.sql` and `supabase/seed.sql`). It's safe to run again. Only the server talks to the database, so the client needs no Supabase keys.

For production: `npm run build && npm start`, then Express serves the built React app and the API together on http://localhost:3000.

## Clubs directory

`/clubs` lists every club from the [WUSA clubs directory](https://clubs.wusa.ca/find-a-club), with search, filters (category, member count, year founded, which links a club has, meeting info) and sorting. Filters live in the URL, so filtered views can be shared. `/clubs/:id` shows a club's full profile.

### Data source

`npm run scrape:clubs` uses the public JSON API behind clubs.wusa.ca (`POST /api/v1/clubs_listing/{active,inactive}` + `GET /api/v1/clubs/:id/profile`) and upserts into the `clubs` table. Re-run it whenever you want fresh data; clubs removed from WUSA are deleted. Executive names are not stored, only the count.

### Active / Inactive

A club is **Active** if WUSA lists it as active for the current term (the same split as the Active/Inactive lists on clubs.wusa.ca), and **Inactive** otherwise. Re-run `npm run scrape:clubs` at the start of each term to pick up changes.

## Events map

`/events` lists upcoming events by day beside a 3D campus map (map camera adapted from [Spots](https://github.com/notAkki/spots), MIT; see `THIRD_PARTY_NOTICES.md`). Each building with events gets a pin showing how many; a blue ring marks buildings where you're going, and selecting a pin narrows the list to that building. Filters: today / next 7 days, search, and "Near me" sorts each day by distance. The map uses OpenFreeMap's light or dark style to match the app's theme.

**Layers** toggle what's on the map:

| Layer | What |
|---|---|
| Campus | WUSA and uwaterloo.ca events |
| Athletics | Varsity home and on-campus neutral-site games (away games aren't shown) |
| Student-run | Events students host in the app |
| Clubs | Scaffolding only: `server/events/sources/clubs.js` returns nothing yet and lists options for sourcing club events |

**Hosting and joining.** Anyone signed in can host an event (`/events/new`): name, category, date and time (Waterloo time; an end before the start runs past midnight), a campus building plus room, or "somewhere else" with free-text location (listed without a pin), optional capacity and description. Any event, imported or student-run, can be joined; the event page shows who's going and how many spots are left. Hosts are automatically going and can cancel their event. Limits: 10 upcoming hosted events per person, 12 hours long, 180 days out.

The map uses MapLibre GL with OpenFreeMap's free styles, so no Mapbox token is needed.

### Sources (`npm run import:events`)

| Source | What | How |
|---|---|---|
| WUSA | Clubs, Bomber, Glow, Thrift, ICSN… | `wusa.ca/wp-json/tribe/events/v1/events` (The Events Calendar REST API) |
| uwaterloo.ca | Official university + faculty events | iCal feeds: `uwaterloo.ca/{events/events,engineering/events,math/events,…}/ical` |
| Warriors Athletics | Varsity games with results, tickets, streams | `athletics.uwaterloo.ca/services/responsive-calendar.ashx` (month JSON) |
| Buildings | ~200 building codes + coordinates | `portalapi2.uwaterloo.ca/v2/map/Buildings` (UW campus map API) |

Venues are matched to buildings by leading code ("MC 4060", "E2 - …"), aliases ("The Bomber" → SLC, "Carl Totzke Court" → PAC) and building names. Off-campus events stay in the list without a pin. Upcoming events a source stops listing are removed on the next import; past events are kept for 30 days.

## Intramurals

`/intramurals` is team matching: captains post "we have 4 of 6, need 2 more"; free agents post that they're looking for a team. Others tap **I'm in** (or **Invite to my team**) with an optional note; the poster accepts or declines under **My activity**. Accepting a player fills a spot, and the post is marked filled when the roster is full. The poster sees requesters' emails; requesters see the poster's email once accepted.

Intramural registration itself stays on warrior.uwaterloo.ca (its robots.txt disallows scraping), so the sport list in `server/athletics/intramurals.js` is maintained by hand.

## Sessions

Logins last 30 days from your last visit. Sessions are stored in the `sessions` table in Postgres (`server/sessionStore.js`), so restarting the server, including `node --watch` reloads in development, doesn't log anyone out. The browser also keeps the signed-in user in localStorage so pages render immediately; the server's cookie is still the source of truth, and the app returns to the login page only when the API says the session is gone, not when the server is briefly unreachable. Set `SESSION_SECRET` in production; changing it logs everyone out.

## How the email restriction works

`server/validation.js` → `isUWaterlooEmail()` only accepts addresses whose domain is exactly `uwaterloo.ca`.
It is enforced server-side on both `/api/auth/register` and `/api/auth/login`; the frontend checks too, but only for nicer UX.

## API

| Method | Path                     | Description                                  |
|--------|--------------------------|----------------------------------------------|
| POST   | `/api/auth/register`     | `{ email, password }` — create account        |
| POST   | `/api/auth/login`        | `{ email, password }` — start session         |
| POST   | `/api/auth/logout`       | End session                                  |
| GET    | `/api/auth/me`           | Current user                                 |
| POST   | `/api/auth/verify`       | `{ code }` — confirm the emailed one-time code |
| POST   | `/api/auth/resend-code`  | Issue a new one-time code                    |
| GET    | `/api/clubs`             | All clubs with active/inactive status (login required) |
| GET    | `/api/clubs/:id`         | Full club profile (login required)           |
| GET    | `/api/events`            | Upcoming on-campus events with building coordinates (`?days=60`) |
| GET    | `/api/events/:id`        | Event detail with guest list                 |
| GET    | `/api/events/host-options` | Categories and buildings for hosting       |
| POST   | `/api/events`            | Host a student-run event                     |
| DELETE | `/api/events/:id`        | Host: cancel event                           |
| POST/DELETE | `/api/events/:id/rsvp` | Join / leave an event                     |
| GET    | `/api/teams`             | Open team-finder posts (`?kind=team\|player&sport=`) |
| GET    | `/api/teams/mine`        | My posts (with requests) and my requests     |
| POST   | `/api/teams`             | Create a post                                |
| PATCH/DELETE | `/api/teams/:id`   | Owner: update status / roster count, or delete |
| POST/DELETE | `/api/teams/:id/responses` | Request to join / withdraw            |
| PATCH  | `/api/teams/:id/responses/:rid` | Owner: accept or decline            |

## Email verification (scaffolding)

On registration a 6-digit one-time code is generated, hashed, and stored with a 10-minute expiry and a 5-attempt limit (`server/email.js`).
**No email is actually sent yet** — `sendVerificationEmail()` just prints the code to the server console.

To turn it on:

1. Implement `sendVerificationEmail()` in `server/email.js` with a provider (Resend, SES, SendGrid, or SMTP via nodemailer).
2. Set `REQUIRE_EMAIL_VERIFICATION=true`. New users are then sent to `/verify` after registering/logging in.
3. When you add protected API routes, also check `email_verified` server-side (the frontend redirect alone isn't enforcement).
