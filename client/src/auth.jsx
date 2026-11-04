import { createContext, useContext, useEffect, useState } from 'react';
import { SESSION_EXPIRED, api } from './api.js';

const AuthContext = createContext(null);

// The last known session, so a reload shows you as logged in right away instead of waiting on
// the server (which may be mid-restart in development). It's only a hint: the server's session
// cookie is the source of truth, and every load re-checks it with /me. Whatever the server
// says (logged in, logged out, or broken), the cache follows within a few seconds, so it can't
// keep you stuck after a database switch, a secret change or a server error.
// Bump the version whenever the shape of /me changes; older caches are then ignored.
const CACHE_KEY = 'fydp.session.v2';
const OLD_CACHE_KEYS = ['fydp.session'];
const RETRY_MS = [500, 1000, 2000, 4000];

const isValidSession = (s) => s?.user?.id != null && typeof s.user.email === 'string';

function readCache() {
  try {
    OLD_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    return isValidSession(cached) ? cached : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(session) {
  try {
    if (session) localStorage.setItem(CACHE_KEY, JSON.stringify(session));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // Storage blocked (private mode); the app just won't remember between reloads.
  }
}

export function AuthProvider({ children }) {
  // undefined = still loading, null = logged out
  const [session, setSession] = useState(readCache);
  // Set when the server can't confirm the session after retrying; the app shows a retry screen.
  const [unavailable, setUnavailable] = useState(false);
  const [checkCount, setCheckCount] = useState(0);

  useEffect(() => {
    if (session !== undefined) writeCache(session);
  }, [session]);

  // Confirm the session with the server on every load. "Not logged in" logs you out right away.
  // Anything else (server restarting, server error) is retried while the cached session is shown;
  // if it keeps failing, the cache is dropped and the app says the server is unavailable.
  useEffect(() => {
    let cancelled = false;
    let timer;
    async function check(attempt = 0) {
      try {
        const me = await api('/me');
        if (cancelled) return;
        setSession(isValidSession(me) ? me : null);
        setUnavailable(false);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) {
          setSession(null);
          setUnavailable(false);
        } else if (attempt < RETRY_MS.length) {
          timer = setTimeout(() => check(attempt + 1), RETRY_MS[attempt]);
        } else {
          writeCache(null);
          setUnavailable(true);
        }
      }
    }
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [checkCount]);

  useEffect(() => {
    const expire = () => setSession(null);
    window.addEventListener(SESSION_EXPIRED, expire);
    return () => window.removeEventListener(SESSION_EXPIRED, expire);
  }, []);

  const value = {
    loading: session === undefined && !unavailable,
    unavailable,
    retry() {
      setUnavailable(false);
      setCheckCount((n) => n + 1);
    },
    user: session?.user ?? null,
    needsVerification: Boolean(session?.verificationRequired && !session.user.emailVerified),
    async login(email, password) {
      setSession(await api('/login', { email, password }));
    },
    async register(email, password) {
      setSession(await api('/register', { email, password }));
    },
    async verify(code) {
      const { user } = await api('/verify', { code });
      setSession((s) => ({ ...s, user }));
    },
    async logout() {
      // Log out locally even if the server can't be reached.
      await api('/logout', {}).catch(() => {});
      setSession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
