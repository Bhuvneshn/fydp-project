import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { authRouter } from './auth.js';
import { clubsRouter } from './clubs/routes.js';
import { eventsRouter } from './events/routes.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production.');
}

app.use(express.json());
app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET ?? 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use('/api/auth', authRouter);
app.use('/api/clubs', clubsRouter);
app.use('/api/events', eventsRouter);

// Serve the built React app (client/dist). In development Vite serves it instead.
const clientDist = path.resolve(import.meta.dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('/{*splat}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));

app.listen(port, () => {
  console.log(`FYDP site running at http://localhost:${port}`);
});
