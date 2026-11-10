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
  // Each sign-in gets a number; one given up on (Back to sign in on the cover) can no longer start a session.
  const signInAttempt = useRef(0);
  const signInAbort = useRef<AbortController | null>(null);
  // Ends the waiting sign-in at once when the user goes back (the work behind it may still be finishing).
  const signInStop = useRef<(() => void) | null>(null);
  // The token of a session this sign-in has already started but not finished opening (account settings still loading).
  const signInStarted = useRef<string | null>(null);

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
  // A sign-in the user gave up on: the server may still answer, but no session may start from it, and a token it
  // returned is revoked so it does not linger on the server.
  const abandoned = (attempt: number, data?: SessionData) => {
    if (attempt === signInAttempt.current) return false;
    if (data?.access_token) void api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${data.access_token}` }, timeout: 9000 }).catch(() => {});
    return true;
  };
  const STOPPED = 'Signing in took longer than 10 seconds, so it was stopped. Check your connection and try again.';
  const TOO_SLOW = 'The server took too long to respond. Check your connection and try again.';
  /** Runs one sign-in step under the cover: a time-out or a Back to sign in ends as a plain error for the form. */
  const coveredSignIn = async <T,>(step: (signal: AbortSignal) => Promise<T>, finish: (value: T, attempt: number) => Promise<T>): Promise<T> => {
    const attempt = ++signInAttempt.current;
    const controller = new AbortController();
    signInAbort.current = controller;
    const stopped = new Promise<never>((_, reject) => { signInStop.current = () => reject(new Error(STOPPED)); });
    setSignInState('pending');
    const work = (async () => finish(await step(controller.signal), attempt))();
    work.catch(() => {});   // after a Back the form already has its answer; the late outcome of the work is not needed
    try {
      return await Promise.race([work, stopped]);
    } catch (error) {
      if (attempt === signInAttempt.current) setSignInState(null);
      const axiosError = error as { code?: string; response?: unknown };
      if (controller.signal.aborted || attempt !== signInAttempt.current) throw new Error(STOPPED, { cause: error });
      if (axiosError.code === 'ECONNABORTED' && !axiosError.response) throw new Error(TOO_SLOW, { cause: error });
      throw error;
    } finally {
      if (signInAbort.current === controller) { signInAbort.current = null; signInStop.current = null; }
    }
  };
  /** Back to sign in, after the cover waited 10 s: stop the request and return to the form, which shows why. */
  const cancelSignIn = () => {
    signInAttempt.current++;
    signInAbort.current?.abort();
    signInAbort.current = null;
    // A session already started (the server said yes, the settings are still loading) is ended here and on the server.
    const started = signInStarted.current;
    signInStarted.current = null;
    if (started) {
      performLogoutStateCleanup();
      void api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${started}` }, timeout: 9000 }).catch(() => {});
    }
    setSignInState(null);
    signInStop.current?.();
    signInStop.current = null;
  };
  const begin = async (data: SessionData, email: string, attempt: number) => {
    if (abandoned(attempt, data)) throw new Error(STOPPED);
    signInStarted.current = data.access_token;
    const session = await startSession(data, email);
    // Given up on while the account settings were loading: cancelSignIn has already ended this session.
    if (attempt !== signInAttempt.current) throw new Error(STOPPED);
    signInStarted.current = null;
    setSignInState('done');
    return session;
  };

  const login = (email: string, password: string, portal?: string): Promise<LoginResult> => coveredSignIn<LoginResult>(
    signal => apiService.login(email, password, portal, signal),
    async (data, attempt) => {
      if (abandoned(attempt)) throw new Error(STOPPED);
      if (data.requires_two_factor) {
        setSignInState(null);
        return { requires_two_factor: true, challenge_token: data.challenge_token, expires_in: data.expires_in };
      }
      return begin(data as SessionData, email, attempt);
    });

  const verifyLogin = (challenge: string, code: string, email: string) => coveredSignIn<SessionData>(
    async signal => (await api.post('/auth/login/verify', { challenge_token: challenge, code }, { timeout: 9000, signal })).data,
    (data, attempt) => begin(data, email, attempt));

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

    // Instantly clear API cache & sync fresh account theme from DB
    clearApiCache();
    await syncAccountPreferences(data.user_id);
    // Only now does the app take over from the sign-in page: until then the form (with what was typed) stays mounted
    // under the cover, so going back from a slow sign-in returns to it unchanged. A sign-in given up on meanwhile
    // has already cleared the stored session, and must not open the app.
    if (sessionStorage.getItem('auth_token') !== data.access_token) return data;
    setToken(data.access_token);
    // The settings load may have refreshed the stored user (a changed staff role); use that copy.
    const stored = sessionStorage.getItem('auth_user');
    setUser(stored ? JSON.parse(stored) as UserSession : sessionUser);
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
  const signOutAttempt = useRef(0);
  const signOut = async () => {
    if (signingOut.current) return;   // a second click while signing out does nothing
    signingOut.current = true;
    const attempt = ++signOutAttempt.current;
    const endingToken = sessionStorage.getItem('auth_token');
    closeSwal();
    setSignOutState('pending');
    performLogoutStateCleanup();      // before any network wait: a refresh or Back can no longer reach this account
    // 9 s: inside the cover's 10 s limit, so a slow server normally ends as "Signed out on this device".
    const revoked = !endingToken || await api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${endingToken}` }, timeout: 9000 })
      .then(() => true, error => error.response?.status === 401 || error.response?.status === 403);   // already ended on the server counts as ended
    if (attempt !== signOutAttempt.current) return;   // the user already went back to sign in; a late answer changes nothing
    setSignOutState(revoked ? 'done' : 'local');
  };
  const finishSignOut = () => { signOutAttempt.current++; setSignOutState(null); signingOut.current = false; };

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
      {signInState && <AuthTransitionOverlay action="in" state={signInState} onDone={() => setSignInState(null)} onCancel={cancelSignIn} />}
      {/* This device is already signed out before the server is asked, so going back is always safe. */}
      {signOutState && <SignOutOverlay state={signOutState} onDone={finishSignOut} onCancel={finishSignOut} />}
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
