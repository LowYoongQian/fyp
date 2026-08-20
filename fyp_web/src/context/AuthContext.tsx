import React, { createContext, useState, useEffect, useContext } from 'react';
import { apiService, clearApiCache } from '../services/api';
import { applyThemePreference, getAccountThemePreference, isThemePreference, resetThemeOnLogout, saveThemePreference } from '../theme/themePreference';
import { setActiveLanguage } from '../i18n/i18n';
import { swalWarning } from '../utils/swal';

// Hard Maximum Session Duration: 60 Minutes (1 Hour = 3,600,000 ms) for all roles (Student, Staff, Admin)
const SESSION_MAX_AGE_MS = 60 * 60 * 1000;

interface UserSession {
  user_id: number | string;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
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
  window.history.replaceState({}, '', window.location.pathname);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const performLogoutStateCleanup = () => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_session_expires_at');
    clearApiCache();
    setToken(null);
    setUser(null);
    resetThemeOnLogout();
    setActiveLanguage('en');
    resetNavigationUrl();
  };

  const triggerSessionExpiredLogout = () => {
    performLogoutStateCleanup();
    swalWarning(
      'Session Expired',
      'Your 60-minute (1 hour) session limit has been reached. You have been automatically logged out for security.'
    );
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

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
      const data = await apiService.login(email, password, portal);
      const sessionUser: UserSession = {
        user_id: data.user_id,
        email: email,
        role: data.role as 'student' | 'lecturer' | 'admin',
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
    performLogoutStateCleanup();
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
