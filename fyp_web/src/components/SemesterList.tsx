import { AlertTriangle, CalendarRange, Eye, Lock, RefreshCw } from 'lucide-react';
import type { TimetableSemester } from '../services/api';
import { semesterWeeks } from '../utils/campusCalendar';
import { LoadingRegion, ShimmerSemesterRows } from './Shimmer';

const day = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const LABEL = { current: 'Current', upcoming: 'Upcoming', ended: 'Previous' } as const;
const badge = { current: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  upcoming: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900',
  ended: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' } as const;
const COLUMNS = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_11rem]';

/** Why a row's action is unavailable, or '' when the timetable can be opened. Only the current semester opens. */
function accessNote(semester: TimetableSemester) {
  if (!semester.can_view) return semester.block_reason || 'This timetable cannot be opened.';
  if (!semester.course_count) return 'You have no courses in this semester yet.';
  if (!semester.class_count) return 'No classes are scheduled yet.';
  return '';
}

/** The first screen of Timetable: the caller's own semesters, from the semester records. Opening is by the action button only. */
export function SemesterList({ semesters, loading, failed, role, notice, emptyText, onRetry, onOpen }: {
  semesters: TimetableSemester[] | undefined; loading: boolean; failed: boolean; role?: string; notice?: string; emptyText?: string;
  onRetry: () => void; onOpen: (semester: TimetableSemester) => void;
}) {
  return <section aria-label="Semester timetables" className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 sm:p-6">
    <div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-5 dark:border-slate-800">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-brand-blue dark:border-blue-900 dark:bg-blue-950/70"><CalendarRange className="h-5 w-5" /></div>
      <div className="min-w-0"><h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Semester timetables</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Open the current semester&apos;s timetable.</p></div>
    </div>
    {notice && <p role="status" className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">{notice}</p>}
    {failed ? <div role="alert" className="space-y-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Your semesters could not be loaded.</p>
                <button type="button" onClick={onRetry} className="uipro-button uipro-button-secondary inline-flex items-center gap-2"><RefreshCw className="h-4 w-4" />Retry</button></div>
      : loading || !semesters ? <LoadingRegion label="Loading semesters…"><ShimmerSemesterRows /></LoadingRegion>
      : !semesters.length ? <p className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          {emptyText ? emptyText : role === 'admin' ? 'No semesters yet. Add one in Academics → Semesters.'
            : 'No semesters are assigned to you yet.'}</p>
      : <>
        <div aria-hidden="true" className={`hidden gap-3 border-b border-slate-200 px-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:border-slate-800 md:grid ${COLUMNS}`}>
          <span>Semester</span><span>Programme</span><span>Start</span><span>End</span><span>Weeks</span><span>Status</span><span className="text-right">Timetable</span>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {semesters.map(row => {
            const note = accessNote(row), openable = !note;
            return <li key={row.id} data-semester={row.id} data-state={row.state} className={`grid grid-cols-2 items-start gap-3 px-3 py-4 text-xs ${COLUMNS}`}>
              <div className="col-span-2 min-w-0 md:col-span-1"><span className="block break-words text-sm font-bold text-slate-900 dark:text-white">{row.name}</span>
                <span className="text-[11px] text-slate-500">{row.course_count} course{row.course_count === 1 ? '' : 's'} · {row.class_count} class{row.class_count === 1 ? '' : 'es'}</span></div>
              <Cell label="Programme">{row.programme ? `${row.programme.code} · ${row.programme.name}` : 'Not recorded'}</Cell>
              <Cell label="Start">{day(row.start_date)}</Cell>
              <Cell label="End">{day(row.end_date)}</Cell>
              <Cell label="Weeks">{semesterWeeks(row.start_date, row.end_date)}</Cell>
              <Cell label="Status"><span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ring-inset ${badge[row.state]}`}>{LABEL[row.state]}</span></Cell>
              <div className="col-span-2 md:col-span-1 md:text-right">
                <button type="button" disabled={!openable} onClick={() => openable && onOpen(row)} aria-describedby={note ? `access-${row.id}` : undefined}
                  aria-label={openable ? `View timetable for ${row.name}` : `${row.can_view ? 'Timetable not ready' : 'Blocked from viewing'}: ${row.name}`}
                  className={`inline-flex w-full items-center justify-center gap-2 px-4 py-2 md:w-auto ${openable ? 'uipro-button uipro-button-primary' : 'cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'}`}>
                  {openable ? <Eye className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{openable ? 'View timetable' : row.can_view ? 'Timetable not ready' : 'Blocked from viewing'}</button>
                {note && <p id={`access-${row.id}`} className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{note}</p>}
              </div>
            </li>;
          })}
        </ul>
      </>}
  </section>;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 md:sr-only">{label}</span><span className="break-words font-medium text-slate-700 dark:text-slate-200">{children}</span></div>;
}
