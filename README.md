# FYDP Project

Basic website with account registration and login restricted to **@uwaterloo.ca** email addresses.

## Stack

- **Frontend** (`client/`): React 19 + React Router, built with Vite
- **Backend** (`server/`): Node.js 22.13+ with Express 5, `express-session` cookie sessions, `bcryptjs` password hashing, and the built-in `node:sqlite` module (no native deps)

```
client/            React app
  src/pages/       Login, Register, Verify, Dashboard
  src/auth.jsx     Auth context (current user, login/register/verify/logout)
  src/App.jsx      Routes + redirect guards
server/            Express API
  auth.js          /api/auth routes
  email.js         One-time code scaffolding
  validation.js    @uwaterloo.ca check
  clubs/
    scrapeWusa.js  Imports clubs from clubs.wusa.ca
    instagram.js   Checks each club's latest Instagram post
    routes.js      /api/clubs
```

## Getting started

```bash
npm install            # also installs client/ deps
cp .env.example .env   # optional for local dev
npm run dev            # API on :3000, React (Vite) on :5173
```

Then import the clubs (takes ~15 seconds):

```bash
npm run scrape:clubs
```

Open http://localhost:5173. Vite proxies `/api` to the Express server.

For production: `npm run build && npm start`, then Express serves the built React app and the API together on http://localhost:3000.

## Clubs directory

`/clubs` lists every club from the [WUSA clubs directory](https://clubs.wusa.ca/find-a-club), with search, filters (category, WUSA ratification this term, member count, year founded, which links a club has, meeting info) and sorting. Filters live in the URL, so filtered views can be shared. `/clubs/:id` shows a club's full profile.

### Data source

`npm run scrape:clubs` uses the public JSON API behind clubs.wusa.ca (`POST /api/v1/clubs_listing/{active,inactive}` + `GET /api/v1/clubs/:id/profile`) and upserts into the `clubs` table. Re-run it whenever you want fresh data; clubs removed from WUSA are deleted. Executive names are not stored, only the count.

### Active / Inactive

Clubs are classified by Instagram activity (computed at request time, so the window is always relative to today):

| Tab          | Rule                                                                               |
|--------------|------------------------------------------------------------------------------------|
| Active       | Instagram linked on WUSA **and** latest post within the last 30 days              |
| Inactive     | No Instagram linked, **or** latest post older than 30 days, **or** no posts       |
| Not checked  | Instagram linked but we couldn't read it (not checked yet, personal/private account) |

Instagram blocks anonymous scraping, so `npm run check:instagram` uses the official **Instagram Graph API Business Discovery** endpoint. Setup:

1. Convert an Instagram account you control to a **Business or Creator** account and link it to a Facebook Page.
2. Create a Meta app at developers.facebook.com and add the Instagram Graph API product.
3. Generate a long-lived access token with `instagram_basic` and `pages_show_list` (plus `business_management` if needed).
4. Put `IG_ACCESS_TOKEN` and `IG_BUSINESS_ACCOUNT_ID` (your Instagram account's user id) in `.env`.
5. Run `npm run check:instagram`. It throttles to about 200 calls/hour (`IG_REQUEST_DELAY_MS`), skips accounts checked in the last 24h (`-- --force` to recheck all), and stops cleanly on rate limits so you can re-run it.

Business Discovery can only see Business/Creator accounts; clubs using personal accounts show up under **Not checked**.

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
| GET    | `/api/clubs`             | All clubs with Instagram status (login required) |
| GET    | `/api/clubs/:id`         | Full club profile (login required)           |

## Email verification (scaffolding)

On registration a 6-digit one-time code is generated, hashed, and stored with a 10-minute expiry and a 5-attempt limit (`server/email.js`).
**No email is actually sent yet** — `sendVerificationEmail()` just prints the code to the server console.

To turn it on:

1. Implement `sendVerificationEmail()` in `server/email.js` with a provider (Resend, SES, SendGrid, or SMTP via nodemailer).
2. Set `REQUIRE_EMAIL_VERIFICATION=true`. New users are then sent to `/verify` after registering/logging in.
3. When you add protected API routes, also check `email_verified` server-side (the frontend redirect alone isn't enforcement).
