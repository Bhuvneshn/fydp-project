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
```

## Getting started

```bash
npm install            # also installs client/ deps
cp .env.example .env   # optional for local dev
npm run dev            # API on :3000, React (Vite) on :5173
```

Open http://localhost:5173. Vite proxies `/api` to the Express server.

For production: `npm run build && npm start`, then Express serves the built React app and the API together on http://localhost:3000.

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

## Email verification (scaffolding)

On registration a 6-digit one-time code is generated, hashed, and stored with a 10-minute expiry and a 5-attempt limit (`server/email.js`).
**No email is actually sent yet** — `sendVerificationEmail()` just prints the code to the server console.

To turn it on:

1. Implement `sendVerificationEmail()` in `server/email.js` with a provider (Resend, SES, SendGrid, or SMTP via nodemailer).
2. Set `REQUIRE_EMAIL_VERIFICATION=true`. New users are then sent to `/verify` after registering/logging in.
3. When you add protected API routes, also check `email_verified` server-side (the frontend redirect alone isn't enforcement).
