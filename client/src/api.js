export const ALLOWED_DOMAIN = 'uwaterloo.ca';

export function isUWaterlooEmail(email) {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export const SESSION_EXPIRED = 'session-expired';

// GET when body is undefined, otherwise POST JSON. Throws with the server's error message.
export function request(url, body) {
  return send(url, body === undefined ? 'GET' : 'POST', body);
}

export async function send(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The session expired or was revoked; let AuthProvider send the user to login.
    if (res.status === 401 && !url.startsWith('/api/auth/')) window.dispatchEvent(new Event(SESSION_EXPIRED));
    const err = new Error(data.error ?? 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = (path, body) => request(`/api/auth${path}`, body);
