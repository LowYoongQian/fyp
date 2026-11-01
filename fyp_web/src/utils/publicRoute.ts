/** Which top-level surface a URL belongs to: the public information page, the portal choice, the app (sign-in included) or not found. */
export type Surface = 'public' | 'portal' | 'app' | 'error' | 'notfound';

export const ROUTE_EVENT = 'sas-route';

/** `appRoutes` are the signed-in app's own paths (without slashes); `login` is added here. Old `/#/...` bookmarks still open the app. */
export function surfaceFor(pathname: string, hash: string, appRoutes: Record<string, unknown>): Surface {
  const route = pathname.replace(/^\/+|\/+$/g, '');
  if (!route) return hash.replace(/^#\/?/, '') ? 'app' : 'public';
  if (route === 'portal') return 'portal';
  if (/^error\/\d{3}$/.test(route)) return 'error';   // /error/500 and the like: an error page the hosting or the app can send people to
  if (route === 'login' || route in appRoutes) return 'app';
  return 'notfound';
}

/** Moves to another top-level page in this tab (no reload) and tells the shell to switch surface. */
export function goTo(path: string, replace = false) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
  window.dispatchEvent(new Event(ROUTE_EVENT));
  window.scrollTo(0, 0);
}

/** Opens the existing sign-in for the chosen portal; the sign-in page reads this choice when it opens. */
export function openPortal(portal: 'student' | 'staff') {
  try { sessionStorage.setItem('active_portal_mode', portal); } catch { /* storage can be unavailable; the sign-in page then starts on Student */ }
  goTo('/login');
}

/** The public GitHub release page of the Android app (the newest published release). */
export const APP_DOWNLOAD_URL = 'https://github.com/LowYoongQian/fyp/releases/latest';
