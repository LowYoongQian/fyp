import React, { createContext, useState, useEffect, useContext } from 'react';
import { apiService, clearApiCache } from '../services/api';
import { applyThemePreference, getAccountThemePreference, isThemePreference, resetThemeOnLogout, saveThemePreference } from '../theme/themePreference';
import { setActiveLanguage } from '../i18n/i18n';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Restore session on mount
    const savedToken = sessionStorage.getItem('auth_token');
    const savedUser = sessionStorage.getItem('auth_user');

    if (savedToken && savedUser) {
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

  const syncAccountPreferences = async (userId: number | string) => {
    // Capture the session that started this request. A response from an account
    // that has since logged out must never update the currently visible theme.
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

      sessionStorage.setItem('auth_token', data.access_token);
      sessionStorage.setItem('auth_user', JSON.stringify(sessionUser));

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
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    clearApiCache();
    setToken(null);
    setUser(null);
    resetThemeOnLogout();
    setActiveLanguage('en');
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
