import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { api, setAccessToken, silentRefresh } from './api.js';

const AuthContext = createContext(null);

/** Session state for the whole admin site. The user object comes from the server, never from the client. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    silentRefresh().then(async (ok) => {
      if (cancelled) return;
      if (!ok) {
        setStatus('out');
        return;
      }
      try {
        const me = await api('/admin/session');
        if (!cancelled) {
          setUser(me);
          setStatus('in');
        }
      } catch {
        if (!cancelled) setStatus('out');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Called after any step that ends in a session (password, TOTP, or a session without TOTP). */
  const startSession = useCallback((session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('in');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('out');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, startSession, signOut }),
    [user, status, startSession, signOut]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** Route guard: signed-out visitors go to login; a role outside `roles` gets a plain 'not for you' page. */
export function RequireRole({ roles, children }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading')
    return <div className="p-2xl text-pw-body text-ink600">Checking your session…</div>;
  if (status === 'out' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-[480px] p-2xl text-center">
        <h1 className="text-pw-h1 font-[800] text-ink900">This area is not for your role</h1>
        <p className="mt-sm text-pw-body text-ink600">Ask a super admin if you need access.</p>
      </div>
    );
  }
  return children;
}
