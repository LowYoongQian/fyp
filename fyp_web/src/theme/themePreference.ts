export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'theme_preference';

export const getThemePreference = (): ThemePreference => {
  const value = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('theme');
  return value === 'dark' || value === 'system' ? value : 'light';
};

export const applyThemePreference = (preference = getThemePreference()) => {
  const isDark = preference === 'dark' || (
    preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.dataset.theme = isDark ? 'dark' : 'light';
};

export const saveThemePreference = (preference: ThemePreference) => {
  localStorage.setItem(THEME_STORAGE_KEY, preference);
  // Keep the legacy key so existing accounts retain their preference.
  localStorage.setItem('theme', preference);
  applyThemePreference(preference);
};
