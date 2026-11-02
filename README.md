# FYDP Project

Basic website with account registration and login restricted to **@uwaterloo.ca** email addresses.

## Stack

- Node.js 22.13+ (uses the built-in `node:sqlite` module — no native deps)
- Express 5 + `express-session` (cookie sessions)
- `bcryptjs` for password hashing
- Plain HTML/CSS/JS frontend in `public/`

## Getting started

```bash
npm install
cp .env.example .env   # optional for local dev
npm run dev
```

Open http://localhost:3000.

## How the email restriction works

`src/validation.js` → `isUWaterlooEmail()` only accepts addresses whose domain is exactly `uwaterloo.ca`.
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

On registration a 6-digit one-time code is generated, hashed, and stored with a 10-minute expiry and a 5-attempt limit (`src/email.js`).
**No email is actually sent yet** — `sendVerificationEmail()` just prints the code to the server console.

To turn it on:

1. Implement `sendVerificationEmail()` in `src/email.js` with a provider (Resend, SES, SendGrid, or SMTP via nodemailer).
2. Set `REQUIRE_EMAIL_VERIFICATION=true`. New users are then sent to `/verify` after registering/logging in.
3. When you add protected API routes, also check `email_verified` server-side (the frontend redirect alone isn't enforcement).
