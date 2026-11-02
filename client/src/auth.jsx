import { createContext, useContext, useEffect, useState } from 'react';
import { SESSION_EXPIRED, api } from './api.js';

const AuthContext = createContext(null);

// The last known session, so a reload shows you as logged in right away instead of waiting on
// the server (which may be mid-restart in development). The server's session cookie stays the
// source of truth: a 401 from /me clears this.
const CACHE_KEY = 'fydp.session';
const RETRY_MS = [500, 1000, 2000, 4000];

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? undefined;
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

  useEffect(() => {
    if (session !== undefined) writeCache(session);
  }, [session]);

  // Confirm the cached session with the server. Only "not logged in" logs you out; if the server
  // is unreachable, keep the cached session and try again.
  useEffect(() => {
    let cancelled = false;
    let timer;
    async function check(attempt = 0) {
      try {
        const me = await api('/me');
        if (!cancelled) setSession(me);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 401) setSession(null);
        else if (attempt < RETRY_MS.length) timer = setTimeout(() => check(attempt + 1), RETRY_MS[attempt]);
        else setSession((s) => s ?? null);
      }
    }
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const expire = () => setSession(null);
    window.addEventListener(SESSION_EXPIRED, expire);
    return () => window.removeEventListener(SESSION_EXPIRED, expire);
  }, []);

  const value = {
    loading: session === undefined,
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
      await api('/logout', {});
      setSession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
