import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

// One-time verification codes sent during registration.
//
// SCAFFOLDING: codes are generated, stored (hashed) and checked, but
// sendVerificationEmail() only logs to the console. To go live:
//   1. Pick a provider (SES, Resend, SendGrid, or SMTP via nodemailer).
//   2. Implement sendVerificationEmail() below.
//   3. Set REQUIRE_EMAIL_VERIFICATION=true so unverified users can't log in.

const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

export const requireEmailVerification =
  process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

function generateCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function issueVerificationCode(user) {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);

  db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(user.id);
  db.prepare(
    'INSERT INTO verification_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)'
  ).run(user.id, codeHash, Date.now() + CODE_TTL_MS);

  await sendVerificationEmail(user.email, code);
}

// Returns null on success, or an error message.
export async function checkVerificationCode(userId, code) {
  const row = db
    .prepare('SELECT * FROM verification_codes WHERE user_id = ?')
    .get(userId);

  if (!row) return 'No active code. Request a new one.';
  if (Date.now() > row.expires_at) return 'Code expired. Request a new one.';
  if (row.attempts >= MAX_ATTEMPTS) return 'Too many attempts. Request a new one.';

  db.prepare('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);

  if (!(await bcrypt.compare(String(code ?? ''), row.code_hash))) {
    return 'Incorrect code.';
  }

  db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(userId);
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
  return null;
}

// TODO: replace with a real email provider.
async function sendVerificationEmail(to, code) {
  console.log(`[email stub] Verification code for ${to}: ${code}`);
}
