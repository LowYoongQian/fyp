import React, { createContext, useState, useEffect, useContext } from 'react';
import { api, apiService, clearApiCache } from '../services/api';
import { clearAccountAvatars } from '../utils/accountAvatar';
import { verifySecondFactor } from '../utils/secondFactor';
import { applyThemePreference, getAccountThemePreference, isThemePreference, resetThemeOnLogout, saveThemePreference } from '../theme/themePreference';
import { setActiveLanguage } from '../i18n/i18n';
import { swalWarning } from '../utils/swal';
import { startLiveUpdates, subscribeLive } from '../services/liveUpdates';
import { syncRecoveryReminder } from '../utils/recoveryReminder';
import { broadcastAccountLogout } from '../utils/accountLogout';

// Hard Maximum Session Duration: 60 Minutes (1 Hour = 3,600,000 ms) for all roles (Student, Staff, Admin)
const SESSION_MAX_AGE_MS = 60 * 60 * 1000;

interface UserSession {
  user_id: number | string;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
  staff_role?: string | null;
}

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, portal?: string) => Promise<any>;
  logout: () => void;
  isAuthenticated: boolean;
  syncAccountPreferences: (userId: number | string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const resetNavigationUrl = () => {
  window.history.replaceState({}, '', '/');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => token ? startLiveUpdates(token) : undefined, [token]);
  useEffect(() => user && token ? subscribeLive(['account'], () => { void syncAccountPreferences(user.user_id); }) : undefined, [token, user?.user_id]);

  const performLogoutStateCleanup = (broadcast = true) => {
    if (broadcast) broadcastAccountLogout();
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_session_expires_at');
    clearApiCache();
    clearAccountAvatars();
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
      'Your 60-minute (1 hour) session limit has been reached. You have been automatically logged out for security.'
    );
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  useEffect(() => {
    const ended = (event: Event) => {
      if ((event as CustomEvent).detail !== sessionStorage.getItem('auth_token')) return;
      performLogoutStateCleanup(false);
      void swalWarning('Session ended', 'Please sign in again; your account or session access has changed.');
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
    // Restore session on mount & check 60-minute expiration limit
    const savedToken = sessionStorage.getItem('auth_token');
    const savedUser = sessionStorage.getItem('auth_user');
    const sessionExpiresAtStr = sessionStorage.getItem('auth_session_expires_at');
    const now = Date.now();

    if (savedToken && savedUser) {
      if (sessionExpiresAtStr && now >= parseInt(sessionExpiresAtStr, 10)) {
        // Exceeded 60-minute limit
        triggerSessionExpiredLogout();
        setLoading(false);
        return;
      }

      // If timestamp is missing on an existing session, set it to now + 60 min
      if (!sessionExpiresAtStr) {
        sessionStorage.setItem('auth_session_expires_at', String(now + SESSION_MAX_AGE_MS));
      }

      try {
        const parsedUser: UserSession = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);

        // 1. Instantly apply cached account theme for zero layout flash
        const localTheme = getAccountThemePreference(parsedUser.user_id);
        applyThemePreference(localTheme);
        setActiveLanguage(localStorage.getItem(`language_preference_${parsedUser.user_id}`) || 'en');

        // 2. Fetch fresh user profile from DB to sync theme
        syncAccountPreferences(parsedUser.user_id);
      } catch (e) {
        console.error("Failed to parse saved auth user:", e);
      }
    } else {
      resetThemeOnLogout();
    }
    setLoading(false);
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
      if (profile.role === 'student') syncRecoveryReminder(userId, profile.recovery_prompt_dismissed);
      if (currentUser && (currentUser.staff_role ?? null) !== (profile.staff_role ?? null)) {
        const updatedUser = { ...currentUser, staff_role: profile.staff_role ?? null };
        sessionStorage.setItem('auth_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      const accountTheme = isThemePreference(profile.theme_preference)
        ? profile.theme_preference
        : getAccountThemePreference(userId);
      saveThemePreference(accountTheme as 'light' | 'dark' | 'system', userId);
      setActiveLanguage(profile.language_preference || localStorage.getItem(`language_preference_${userId}`) || 'en');
    } catch (e) {
      if (sessionStorage.getItem('auth_token') !== requestToken) return;
      const cachedAccountTheme = getAccountThemePreference(userId);
      applyThemePreference(cachedAccountTheme);
    }
  };

  const login = async (email: string, password: string, portal?: string) => {
    setLoading(true);
    try {
      let data = await apiService.login(email, password, portal);
      if (data.requires_two_factor) data = await verifySecondFactor(data.challenge_token);
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

      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    const endingToken = sessionStorage.getItem('auth_token');
    performLogoutStateCleanup();
    if (endingToken) void api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${endingToken}` }, timeout: 12000 })
      .catch(error => { if (error.response?.status !== 401 && error.response?.status !== 403) void swalWarning('Signed out locally', 'The server could not confirm sign-out; this session will expire automatically.'); });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!token,
        syncAccountPreferences,
      }}
    >
      {children}
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
