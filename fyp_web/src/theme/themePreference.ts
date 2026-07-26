export type ThemePreference = 'light' | 'dark' | 'system';

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'dark' || value === 'light' || value === 'system';

export const getAccountThemePreference = (userId?: number | string): ThemePreference => {
  if (userId) {
    const value = localStorage.getItem(`theme_preference_${userId}`);
    if (isThemePreference(value)) {
      return value;
    }
    // A user's preference must never inherit another user's old global value.
    return 'light';
  }

  return 'light';
};

export const getThemePreference = (): ThemePreference => {
  return 'light';
};

export const applyThemePreference = (preference = getThemePreference()) => {
  const isDark = preference === 'dark' || (
    preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.dataset.theme = isDark ? 'dark' : 'light';
};

export const saveThemePreference = (preference: ThemePreference, userId?: number | string) => {
  if (userId) {
    localStorage.setItem(`theme_preference_${userId}`, preference);
  }

  // Do not write shared keys here. They cause one account's setting to leak
  // into the next account that signs in on this browser.
  applyThemePreference(preference);
};

export const resetThemeOnLogout = () => {
  // Remove the legacy shared values left by older versions of the app.
  localStorage.removeItem('theme_preference');
  localStorage.removeItem('theme');

  const root = document.documentElement;
  root.classList.remove('dark');
  root.dataset.theme = 'light';
};
