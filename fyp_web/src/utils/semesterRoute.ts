import { useMemo, useSyncExternalStore } from 'react';

// What the timetable page is showing lives in the address (?programme=<id>&course=<id>&semester=<id>), like the other page-level state in
// this app, so refresh, copied links and the browser's Back/Forward all agree. Only an admin has programme and course (chosen first);
// no semester in the address means the semester list.
export const TIMETABLE_PARAMS = ['programme', 'course', 'semester'] as const;
const EVENT = 'sas-semester-route';

export type TimetableRoute = { programme: string; course: string; semester: string };

const params = () => new URLSearchParams(window.location.search);
export const readSemesterId = () => params().get('semester') || '';
export const hasTimetableParams = () => TIMETABLE_PARAMS.some(key => params().has(key));

function write(next: Partial<TimetableRoute>, replace: boolean) {
  const query = params();
  for (const [key, value] of Object.entries(next)) if (value) query.set(key, value); else query.delete(key);
  const search = query.toString();
  window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
  window.dispatchEvent(new Event(EVENT));
}

/** Open a semester's timetable. The programme and course in the address stay, so Back returns to the same filtered list. */
export const openSemester = (id: string, replace = false) => write({ semester: id }, replace);
/** Back to the semester list, keeping the admin's programme and course. */
export const openSemesterList = (replace = false) => write({ semester: '' }, replace);
/** An admin chose (or cleared) a programme and course: any open semester no longer applies. */
export const chooseTimetableScope = (programme: string, course: string, replace = false) => write({ programme, course, semester: '' }, replace);
/** Open a semester together with the programme and course it was reached from (a notice, or a link). */
export const openTimetableAt = (route: TimetableRoute, replace = false) => write(route, replace);
/** The sidebar's Timetable: start again from the beginning. */
export const resetTimetableRoute = (replace = false) => write({ programme: '', course: '', semester: '' }, replace);

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(EVENT, onChange);
  return () => { window.removeEventListener('popstate', onChange); window.removeEventListener(EVENT, onChange); };
}

const snapshot = () => TIMETABLE_PARAMS.map(key => params().get(key) || '').join('\n');

/** The programme, course and semester in the address ('' for none). Re-renders on Back/Forward and on programmatic navigation. */
export function useTimetableRoute(): TimetableRoute {
  const key = useSyncExternalStore(subscribe, snapshot, () => '\n\n');
  return useMemo(() => { const [programme, course, semester] = key.split('\n'); return { programme, course, semester }; }, [key]);
}
