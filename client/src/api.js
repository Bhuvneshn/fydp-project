export const ALLOWED_DOMAIN = 'uwaterloo.ca';

export function isUWaterlooEmail(email) {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export async function api(path, body) {
  const res = await fetch(`/api/auth${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
}
