import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { TimetableSemester } from '../services/api';
import { SemesterList } from './SemesterList';
import { ProgrammeCoursePicker } from './ProgrammeCoursePicker';
import { cancelled, useProgrammeCourse } from '../hooks/useProgrammeCourse';
import type { Loaded } from '../hooks/useProgrammeCourse';
import { LoadingRegion, ShimmerSemesterList, ShimmerTimetablePicker } from './Shimmer';
import { chooseTimetableScope, openSemester } from '../utils/semesterRoute';
import type { TimetableRoute } from '../utils/semesterRoute';
import { setCampusClock } from '../utils/campusCalendar';

/**
 * The admin's first screen: choose a programme, then one of ITS courses, and only then is that course's semester loaded. Nothing is requested
 * for the whole system. Every list is keyed by the choice it was asked for, so an answer for an older choice is never shown for a newer one.
 */
export function AdminTimetableList({ route, today }: { route: TimetableRoute; today: string }) {
  const { programme, course } = route;
  const scope = useProgrammeCourse(programme, course, chooseTimetableScope);
  const { programmes, courseList, chosen } = scope;
  const [rows, setRows] = useState<Loaded<TimetableSemester>>({ key: '', status: 'loading', items: [] });
  const [rowsTry, setRowsTry] = useState(0);

  const key = chosen ? `${programme}|${course}` : '';
  const hasSemester = !!chosen?.semester_id;
  useEffect(() => {
    if (!key || !hasSemester) return;
    const controller = new AbortController();
    apiService.getTimetableSemesters({ programmeId: programme, courseId: course }, controller.signal)
      .then(items => { if (controller.signal.aborted) return; if (items[0]?.server_time) setCampusClock(items[0].server_time); setRows({ key, status: 'ready', items }); })
      .catch(error => { if (!cancelled(error) && !controller.signal.aborted) setRows({ key, status: 'failed', items: [] }); });
    return () => controller.abort();
    // Re-asked when the Malaysia date changes, so a status that has rolled over is never shown as it was.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hasSemester, today, rowsTry]);

  const rowState = rows.key === key ? rows : { key, status: 'loading' as const, items: [] as TimetableSemester[] };
  // Nothing is known yet (the programmes are on their way): the whole first screen is a placeholder of its real shape. A restored programme and
  // course in the address also holds a place for the list that will follow; it never fetches anything for the placeholder.
  if (programmes.status === 'loading') return <LoadingRegion label="Loading programmes…" className="space-y-5"><ShimmerTimetablePicker />{programme && course && <ShimmerSemesterList />}</LoadingRegion>;

  return <div className="space-y-5">
    <ProgrammeCoursePicker scope={scope} title="Timetable" />
    {programme && course && !chosen && courseList.status === 'loading' && <div aria-hidden="true"><ShimmerSemesterList /></div>}
    {chosen && (hasSemester
      ? <SemesterList semesters={rowState.items} loading={rowState.status === 'loading'} failed={rowState.status === 'failed'} role="admin"
          emptyText="No matching semester." onRetry={() => { setRows({ key: '', status: 'loading', items: [] }); setRowsTry(count => count + 1); }}
          onOpen={semester => openSemester(semester.id)} />
      : <section aria-label="Semester timetables" className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6"><p role="status" className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">This course is not in a semester yet.</p></section>)}
  </div>;
}
