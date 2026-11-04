import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { authRouter } from './auth.js';
import { PostgresSessionStore } from './sessionStore.js';
import { clubsRouter } from './clubs/routes.js';
import { eventsRouter } from './events/routes.js';
import { teamsRouter } from './athletics/teams.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === 'production';

// An empty SESSION_SECRET= line (as copied from .env.example) counts as unset.
const sessionSecret = process.env.SESSION_SECRET || (isProd ? null : 'dev-only-secret-change-me');
if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set in production.');
}

app.use(express.json());
// Sessions only matter for the API; static files shouldn't touch the session table.
app.use(
  '/api',
  session({
    name: 'sid',
    store: new PostgresSessionStore(),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    // Stay logged in while active: each request pushes expiry another 30 days out.
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use('/api/auth', authRouter);
app.use('/api/clubs', clubsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/teams', teamsRouter);

// API errors are JSON, never the SPA's HTML or an HTML stack trace, so the client can show them.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use('/api', (err, req, res, next) => {
  console.error(`${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(err.status ?? 500).json({ error: 'Something went wrong on the server. Try again in a moment.' });
});

// Serve the built React app (client/dist). In development Vite serves it instead.
const clientDist = path.resolve(import.meta.dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('/{*splat}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));

app.listen(port, () => {
  console.log(`FYDP site running at http://localhost:${port}`);
});
