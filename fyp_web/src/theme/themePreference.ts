import { lookAt } from '../pages/security/loginLighting';

/** 'cycle' is Day/Night: light by day and dark at night by campus time, turning when the sign-in sky does (same as the mobile app). */
export type ThemePreference = 'light' | 'dark' | 'system' | 'cycle';

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'dark' || value === 'light' || value === 'system' || value === 'cycle';

export const campusHour = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  return part('hour') + part('minute') / 60;
};

/** True when the Day/Night theme is dark right now: the sign-in sky is darker than half way. */
export const cycleIsDark = (hour = campusHour()) => lookAt(hour).darkness > 0.5;

let cycleTimer: number | undefined;

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
  window.clearInterval(cycleTimer);
  // While Day/Night is chosen, look again every minute so the page turns at dusk and dawn without a reload.
  if (preference === 'cycle') cycleTimer = window.setInterval(() => applyThemePreference('cycle'), 60_000);
  const isDark = preference === 'dark' || (preference === 'cycle' && cycleIsDark()) || (
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
  window.clearInterval(cycleTimer);
  // Remove the legacy shared values left by older versions of the app.
  localStorage.removeItem('theme_preference');
  localStorage.removeItem('theme');

  const root = document.documentElement;
  root.classList.remove('dark');
  root.dataset.theme = 'light';
};
