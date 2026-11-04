import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { isUWaterlooEmail, normalizeEmail, validatePassword } from './validation.js';
import {
  checkVerificationCode,
  issueVerificationCode,
  requireEmailVerification,
} from './email.js';

export const authRouter = Router();

const findUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const findUserById = db.prepare('SELECT * FROM users WHERE id = ?');

const EMAIL_TAKEN = 'An account with that email already exists.';

function publicUser(user) {
  return { id: user.id, email: user.email, emailVerified: Boolean(user.email_verified) };
}

export function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  next();
}

authRouter.post('/register', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!isUWaterlooEmail(email)) {
    return res.status(400).json({ error: 'Only @uwaterloo.ca email addresses can register.' });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }
  if (await findUserByEmail.get(email)) {
    return res.status(409).json({ error: EMAIL_TAKEN });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // Two sign-ups can pass the check above at once; the UNIQUE email decides which one wins.
  const user = await db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?) ON CONFLICT (email) DO NOTHING RETURNING *')
    .get(email, passwordHash);
  if (!user) return res.status(409).json({ error: EMAIL_TAKEN });

  await issueVerificationCode(user);

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error.' });
    req.session.userId = user.id;
    res.status(201).json({ user: publicUser(user), verificationRequired: requireEmailVerification });
  });
});

authRouter.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!isUWaterlooEmail(email)) {
    return res.status(400).json({ error: 'Only @uwaterloo.ca email addresses are allowed.' });
  }

  const user = await findUserByEmail.get(email);
  const ok = user && (await bcrypt.compare(String(password ?? ''), user.password_hash));
  if (!ok) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error.' });
    req.session.userId = user.id;
    res.json({
      user: publicUser(user),
      verificationRequired: requireEmailVerification && !user.email_verified,
    });
  });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ ok: true });
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await findUserById.get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not logged in.' });
  res.json({ user: publicUser(user), verificationRequired: requireEmailVerification });
});

authRouter.post('/verify', requireAuth, async (req, res) => {
  const error = await checkVerificationCode(req.session.userId, req.body.code);
  if (error) return res.status(400).json({ error });
  res.json({ user: publicUser(await findUserById.get(req.session.userId)) });
});

authRouter.post('/resend-code', requireAuth, async (req, res) => {
  const user = await findUserById.get(req.session.userId);
  if (user.email_verified) return res.status(400).json({ error: 'Email already verified.' });
  await issueVerificationCode(user);
  res.json({ ok: true });
});
