import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still loading, null = logged out
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    api('/me').then(setSession).catch(() => setSession(null));
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
