const ALLOWED_DOMAIN = 'uwaterloo.ca';

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function isUWaterlooEmail(email) {
  const match = /^[^\s@]+@([^\s@]+)$/.exec(normalizeEmail(email));
  return match !== null && match[1] === ALLOWED_DOMAIN;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 128) {
    return 'Password must be at most 128 characters.';
  }
  return null;
}
