import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Course, Programme } from '../services/api';

export type Loaded<T> = { key: string; status: 'loading' | 'failed' | 'ready'; items: T[] };
export const cancelled = (error: unknown) => (error as { code?: string })?.code === 'ERR_CANCELED';

/** Records an admin page needs only once a programme and one of its courses are chosen (Timetable, Attendance). */
export type ProgrammeCourse = ReturnType<typeof useProgrammeCourse>;

/**
 * The real, dependent options behind a Programme then Course choice. Every list is keyed by the choice it was asked for and older requests
 * are cancelled, so a slow answer is never shown for a newer choice. A programme or course that is not real is dropped through `choose`,
 * never guessed at. `choose(programme, course, replace)` writes the choice wherever the page keeps it.
 */
export function useProgrammeCourse(programme: string, course: string, choose: (programme: string, course: string, replace?: boolean) => void) {
  const [programmes, setProgrammes] = useState<Loaded<Programme>>({ key: '', status: 'loading', items: [] });
  const [courses, setCourses] = useState<Loaded<Course>>({ key: '', status: 'loading', items: [] });
  const [programmeTry, setProgrammeTry] = useState(0);
  const [courseTry, setCourseTry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiService.getTimetableProgrammes(controller.signal)
      .then(items => { if (!controller.signal.aborted) setProgrammes({ key: 'all', status: 'ready', items }); })
      .catch(error => { if (!cancelled(error) && !controller.signal.aborted) setProgrammes({ key: 'all', status: 'failed', items: [] }); });
    return () => controller.abort();
  }, [programmeTry]);

  const knownProgramme = programmes.status === 'ready' && programmes.items.some(item => String(item.id) === programme);
  useEffect(() => {
    if (programmes.status === 'ready' && programme && !knownProgramme) choose('', '', true);
    // `choose` is the page's own setter and changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmes.status, programme, knownProgramme]);

  useEffect(() => {
    if (!programme || (programmes.status === 'ready' && !knownProgramme)) return;
    const controller = new AbortController();
    apiService.getTimetableCourses(programme, controller.signal)
      .then(items => { if (!controller.signal.aborted) setCourses({ key: programme, status: 'ready', items }); })
      .catch(error => { if (!cancelled(error) && !controller.signal.aborted) setCourses({ key: programme, status: 'failed', items: [] }); });
    return () => controller.abort();
    // The option list belongs to the chosen programme; whether it is known is checked separately above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programme, courseTry]);

  const courseList = courses.key === programme ? courses : { key: programme, status: 'loading' as const, items: [] as Course[] };
  const chosen = courseList.status === 'ready' ? courseList.items.find(item => String(item.id) === course) : undefined;
  // A course that is not one of this programme's courses is dropped too, but only once the programme itself is confirmed, so this never
  // undoes the effect above that drops an unknown programme.
  const programmeSettled = knownProgramme || programmes.status === 'failed';
  useEffect(() => {
    if (programme && course && programmeSettled && courseList.status === 'ready' && !chosen) choose(programme, '', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programme, course, programmeSettled, courseList.status, chosen]);

  return {
    programme, course, programmes, courseList, chosen,
    retryProgrammes: () => { setProgrammes({ key: '', status: 'loading', items: [] }); setProgrammeTry(count => count + 1); },
    retryCourses: () => { setCourses({ key: '', status: 'loading', items: [] }); setCourseTry(count => count + 1); },
    choose,
  };
}
