import { AlertTriangle, RefreshCw } from 'lucide-react';
import { CustomDropdown } from './CustomDropdown';
import { ShimmerSelect } from './Shimmer';
import type { ProgrammeCourse } from '../hooks/useProgrammeCourse';

/** The two dependent selectors in a card, with distinct loading, failure (Retry), no-programmes and no-courses states. */
export function ProgrammeCoursePicker({ scope, title, help = 'Choose a programme and course.' }: { scope: ProgrammeCourse; title: string; help?: string }) {
  const { programme, course, programmes, courseList, choose } = scope;
  const ready = programmes.status === 'ready';
  const programmeOptions = [{ value: '', label: 'Select programme' }, ...programmes.items.map(item => ({ value: String(item.id), label: `${item.code} · ${item.name}` }))];
  const courseOptions = [{ value: '', label: programme ? 'Select course' : 'Select a programme first' },
    ...(courseList.status === 'ready' ? courseList.items.map(item => ({ value: String(item.id), label: `${item.course_code} · ${item.course_name}` })) : [])];
  const failure = (message: string, onRetry: () => void) => <div role="alert" className="space-y-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
    <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />{message}</p>
    <button type="button" onClick={onRetry} className="uipro-button uipro-button-secondary inline-flex items-center gap-2"><RefreshCw className="h-4 w-4" />Retry</button></div>;
  const note = (message: string) => <p role="status" className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">{message}</p>;
  return <section aria-label="Choose a course" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 sm:p-6">
    <div><h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{title}</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">{help}</p></div>
    {programmes.status === 'failed' ? failure('Programmes could not be loaded.', scope.retryProgrammes)
      : ready && !programmes.items.length ? note('No programmes yet.')
      : <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><span className="block text-xs font-bold text-slate-600 dark:text-slate-300">Programme</span>
            <CustomDropdown fullWidth searchable className="w-full" ariaLabel="Programme" disabled={!ready} value={programme} options={programmeOptions}
              onChange={value => choose(value, '')} /></div>
          {programme && courseList.status === 'loading' ? <ShimmerSelect label="Loading courses…" />
            : <div className="space-y-1.5"><span className="block text-xs font-bold text-slate-600 dark:text-slate-300">Course</span>
              <CustomDropdown fullWidth searchable className="w-full" ariaLabel="Course" disabled={!programme || courseList.status !== 'ready' || !courseList.items.length} value={course} options={courseOptions}
                onChange={value => choose(programme, value)} /></div>}
        </div>}
    {programme && courseList.status === 'failed' && failure('Courses could not be loaded.', scope.retryCourses)}
    {programme && courseList.status === 'ready' && !courseList.items.length && note('This programme has no courses yet.')}
  </section>;
}
