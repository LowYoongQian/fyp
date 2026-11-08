import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { api, apiService, clearApiCache } from '../services/api';
import { clearAccountAvatars } from '../utils/accountAvatar';
import { applyThemePreference, getAccountThemePreference, isThemePreference, resetThemeOnLogout, saveThemePreference } from '../theme/themePreference';
import { setActiveLanguage } from '../i18n/i18n';
import { swalWarning } from '../utils/swal';
import { startLiveUpdates, subscribeLive } from '../services/liveUpdates';
import { syncRecoveryReminder } from '../utils/recoveryReminder';
import { broadcastAccountLogout } from '../utils/accountLogout';
import { beginPetHydration, failPetHydration, hydratePetPreferences, resetPetPreferences } from '../utils/petPreference';
import { closeSwal } from '../utils/swal';
import { AuthTransitionOverlay, SignOutOverlay, type SignOutState } from '../components/SignOutOverlay';

// Hard Maximum Session Duration: 60 Minutes (1 Hour = 3,600,000 ms) for all roles (Student, Staff, Admin)
const SESSION_MAX_AGE_MS = 60 * 60 * 1000;

interface UserSession {
  user_id: number | string;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
  staff_role?: string | null;
}

/** A finished sign-in (the server's session data), or the pending second step of an account with 2FA. */
export interface SessionData {
  access_token: string; user_id: number | string; email?: string; role: string; staff_role?: string | null;
  recovery_email_verified?: boolean; recovery_prompt_dismissed?: boolean;
}
export type LoginResult = { requires_two_factor: true; challenge_token: string; expires_in: number } | (SessionData & { requires_two_factor?: undefined });

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, portal?: string) => Promise<LoginResult>;
  verifyLogin: (challenge: string, code: string, email: string) => Promise<SessionData>;
  logout: () => void;
  /** The account menu's sign-out: ends this session here at once, asks the server to revoke it, and shows what actually happened. */
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  syncAccountPreferences: (userId: number | string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// After sign-in or sign-out the app sits at /login until it picks the right page; "/" is the public information page.
const resetNavigationUrl = () => {
  if (document.documentElement.dataset.surface !== 'app') return;   // a public page (an expired saved session found there) keeps its own address
  window.history.replaceState({}, '', '/login');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [signInState, setSignInState] = useState<'pending' | 'done' | null>(null);

  useEffect(() => token ? startLiveUpdates(token) : undefined, [token]);
  useEffect(() => user && token ? subscribeLive(['account'], () => { void syncAccountPreferences(user.user_id); }) : undefined, [token, user?.user_id]);

  const performLogoutStateCleanup = (broadcast = true) => {
    if (broadcast) broadcastAccountLogout();
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_session_expires_at');
    clearApiCache();
    clearAccountAvatars();
    resetPetPreferences();
    setToken(null);
    setUser(null);
    resetThemeOnLogout();
    setActiveLanguage('en');
    resetNavigationUrl();
  };

  useEffect(() => {
    try {
      const channel = new BroadcastChannel('sas-account-logout');
      channel.onmessage = event => {
        try {
          const stored = JSON.parse(sessionStorage.getItem('auth_user') || 'null');
          if (stored?.user_id != null && event.data?.userId === String(stored.user_id)) {
            const endingToken = sessionStorage.getItem('auth_token');
            performLogoutStateCleanup(false);
            if (endingToken) void api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${endingToken}` }, timeout: 12000 }).catch(() => {});
          }
        } catch { /* Invalid local session data cannot sign another account out. */ }
      };
      return () => channel.close();
    } catch { /* Unsupported browsers still clear this window on logout. */ }
    // The receiver reads the current session, not the initial React user value.
  }, []);

  const triggerSessionExpiredLogout = () => {
    performLogoutStateCleanup(false);
    swalWarning(
      'Session Expired',
      'Your session timed out. Please sign in again.'
    );
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  useEffect(() => {
    const ended = (event: Event) => {
      if ((event as CustomEvent).detail !== sessionStorage.getItem('auth_token')) return;
      performLogoutStateCleanup(false);
      void swalWarning('Session ended', 'Please sign in again. Your access has changed.');
    };
    window.addEventListener('sas-session-ended', ended);
    if (token) {
      // Also detect revocation while an idle page makes no requests.
      const timer = setInterval(() => { void api.get('/auth/me', { timeout: 10000 }).catch(() => {}); }, 30000);
      return () => { clearInterval(timer); window.removeEventListener('sas-session-ended', ended); };
    }
    return () => window.removeEventListener('sas-session-ended', ended);
  }, [token]);

  useEffect(() => {
    // Restore a saved session on load. It is trusted only once the server confirms it: nothing signed-in is shown from a browser record alone.
    const savedToken = sessionStorage.getItem('auth_token');
    const savedUser = sessionStorage.getItem('auth_user');
    const sessionExpiresAtStr = sessionStorage.getItem('auth_session_expires_at');
    const now = Date.now();

    if (!savedToken || !savedUser) {
      resetThemeOnLogout();
      setLoading(false);
      return;
    }
    if (sessionExpiresAtStr && now >= parseInt(sessionExpiresAtStr, 10)) {
      // Exceeded 60-minute limit
      triggerSessionExpiredLogout();
      setLoading(false);
      return;
    }
    // If timestamp is missing on an existing session, set it to now + 60 min
    if (!sessionExpiresAtStr) sessionStorage.setItem('auth_session_expires_at', String(now + SESSION_MAX_AGE_MS));

    let saved: UserSession | null = null;
    try { saved = JSON.parse(savedUser) as UserSession; } catch { /* Malformed: handled below. */ }
    if (!saved || saved.user_id == null || !['student', 'lecturer', 'admin'].includes(saved.role)) {
      performLogoutStateCleanup(false);
      setLoading(false);
      return;
    }
    const sessionUser = saved;

    const controller = new AbortController();
    api.get('/auth/me', { timeout: 15000, signal: controller.signal }).then(({ data: profile }) => {
      if (String(profile.user_id) !== String(sessionUser.user_id) || profile.role !== sessionUser.role) {
        performLogoutStateCleanup(false);   // the token belongs to someone else or another role
        setLoading(false);
        return;
      }
      const restored: UserSession = { user_id: sessionUser.user_id, email: profile.email || sessionUser.email, role: profile.role, staff_role: profile.staff_role ?? null };
      sessionStorage.setItem('auth_user', JSON.stringify(restored));
      setToken(savedToken);
      setUser(restored);
      setLoading(false);

      // Instantly apply the cached account theme for zero layout flash, then sync the real preferences.
      applyThemePreference(getAccountThemePreference(restored.user_id));
      setActiveLanguage(localStorage.getItem(`language_preference_${restored.user_id}`) || 'en');
      void syncAccountPreferences(restored.user_id);
    }).catch(error => {
      if (controller.signal.aborted) return;
      const status = error?.response?.status;
      // Expired or revoked: forget it. Network or server trouble: keep it, show sign-in, and a refresh can try again.
      if (status === 401 || status === 403) performLogoutStateCleanup(false);
      else resetThemeOnLogout();
      setLoading(false);
    });
    return () => controller.abort();
    // The session is restored once per page load; later changes go through login and logout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-Time Interval checking 60-minute (1 hour) session expiration
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      const sessionExpiresAtStr = sessionStorage.getItem('auth_session_expires_at');
      if (sessionExpiresAtStr && Date.now() >= parseInt(sessionExpiresAtStr, 10)) {
        clearInterval(interval);
        triggerSessionExpiredLogout();
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [token]);

  const syncAccountPreferences = async (userId: number | string) => {
    const requestToken = sessionStorage.getItem('auth_token');
    if (!requestToken) return;
    const petToken = beginPetHydration(userId);

    try {
      clearApiCache();
      const profile = await apiService.getUserProfile();
      const currentUserRaw = sessionStorage.getItem('auth_user');
      const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) as UserSession : null;
      const isStillCurrentAccount =
        sessionStorage.getItem('auth_token') === requestToken &&
        currentUser?.user_id === userId &&
        profile.user_id === userId;

      if (!isStillCurrentAccount) return;
      hydratePetPreferences(userId, petToken, profile);
      if (profile.role === 'student') syncRecoveryReminder(userId, profile.recovery_prompt_dismissed);
      if (currentUser && (currentUser.staff_role ?? null) !== (profile.staff_role ?? null)) {
        const updatedUser = { ...currentUser, staff_role: profile.staff_role ?? null };
        sessionStorage.setItem('auth_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      const accountTheme = isThemePreference(profile.theme_preference)
        ? profile.theme_preference
        : getAccountThemePreference(userId);
      saveThemePreference(accountTheme, userId);
      setActiveLanguage(profile.language_preference || localStorage.getItem(`language_preference_${userId}`) || 'en');
    } catch (e) {
      if (sessionStorage.getItem('auth_token') !== requestToken) return;
      failPetHydration(userId, petToken);
      const cachedAccountTheme = getAccountThemePreference(userId);
      applyThemePreference(cachedAccountTheme);
    }
  };

  // Keep the cover above route changes while preserving the form on failed sign-in.
  // An account with 2FA gets back only its pending challenge: nothing is stored and no session starts until verifyLogin succeeds.
  const login = async (email: string, password: string, portal?: string): Promise<LoginResult> => {
    setSignInState('pending');
    try {
      const data = await apiService.login(email, password, portal);
      if (data.requires_two_factor) {
        setSignInState(null);
        return { requires_two_factor: true, challenge_token: data.challenge_token, expires_in: data.expires_in };
      }
      const session = await startSession(data, email);
      setSignInState('done');
      return session;
    } catch (error) {
      setSignInState(null);
      throw error;
    }
  };

  const verifyLogin = async (challenge: string, code: string, email: string) => {
    setSignInState('pending');
    try {
      const session = await startSession((await api.post('/auth/login/verify', { challenge_token: challenge, code }, { timeout: 15000 })).data, email);
      setSignInState('done');
      return session;
    } catch (error) {
      setSignInState(null);
      throw error;
    }
  };

  const startSession = async (data: SessionData, email: string) => {
    const sessionUser: UserSession = {
      user_id: data.user_id,
      email: data.email || email,
      role: data.role as 'student' | 'lecturer' | 'admin',
      staff_role: data.staff_role ?? null,
    };

    const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
    sessionStorage.setItem('auth_token', data.access_token);
    sessionStorage.setItem('auth_user', JSON.stringify(sessionUser));
    sessionStorage.setItem('auth_session_expires_at', String(expiresAt));

    // A new authenticated session always starts from its role dashboard.
    // Remove any protected route left by a previous account or deep link.
    resetNavigationUrl();

    setToken(data.access_token);
    setUser(sessionUser);

    // Instantly clear API cache & sync fresh account theme from DB
    clearApiCache();
    await syncAccountPreferences(data.user_id);
    return data;
  };

  const logout = () => {
    const endingToken = sessionStorage.getItem('auth_token');
    performLogoutStateCleanup();
    if (endingToken) void api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${endingToken}` }, timeout: 12000 })
      .catch(error => { if (error.response?.status !== 401 && error.response?.status !== 403) void swalWarning('Signed out locally', 'The server could not confirm sign-out; this session will expire automatically.'); });
  };

  const [signOutState, setSignOutState] = useState<SignOutState | null>(null);
  const signingOut = useRef(false);
  const signOut = async () => {
    if (signingOut.current) return;   // a second click while signing out does nothing
    signingOut.current = true;
    const endingToken = sessionStorage.getItem('auth_token');
    closeSwal();
    setSignOutState('pending');
    performLogoutStateCleanup();      // before any network wait: a refresh or Back can no longer reach this account
    const revoked = !endingToken || await api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${endingToken}` }, timeout: 12000 })
      .then(() => true, error => error.response?.status === 401 || error.response?.status === 403);   // already ended on the server counts as ended
    setSignOutState(revoked ? 'done' : 'local');
  };
  const finishSignOut = () => { setSignOutState(null); signingOut.current = false; };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        verifyLogin,
        logout,
        signOut,
        isAuthenticated: !!token,
        syncAccountPreferences,
      }}
    >
      <div style={{ display: 'contents' }} inert={signInState !== null}>{children}</div>
      {signInState && <AuthTransitionOverlay action="in" state={signInState} onDone={() => setSignInState(null)} />}
      {signOutState && <SignOutOverlay state={signOutState} onDone={finishSignOut} />}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
