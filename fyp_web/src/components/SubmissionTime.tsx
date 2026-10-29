import { CalendarDays } from 'lucide-react';
import { useId } from 'react';
import { recentSubmissionRange, submissionDate, type SubmissionRange } from '../utils/submissionTime';
import { SubmissionDateTimePicker } from './SubmissionDateTimePicker';

export function SubmissionTime({ value }: { value: string }) {
  const date = submissionDate(value);
  if (!Number.isFinite(date.getTime())) return <span>Date unavailable</span>;
  return <time dateTime={date.toISOString()} className="inline-flex flex-col gap-1 text-xs" title={date.toLocaleString()}>
    <span className="font-medium text-slate-700 dark:text-slate-200">{date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
    <span className="text-slate-500 dark:text-slate-400">{date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' })}</span>
  </time>;
}

export function SubmissionTimeFilter({ value, onChange }: { value: SubmissionRange; onChange: (range: SubmissionRange) => void }) {
  const id = useId();
  const invalid = Boolean(value.from && value.to && value.from > value.to);
  return <section aria-label="Filter by submission date and time" className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><CalendarDays className="h-4 w-4 text-brand-blue" />Submission date & time</div>
      <div className="flex flex-wrap gap-2">
        {[1, 7, 30].map(days => <button key={days} type="button" onClick={() => onChange(recentSubmissionRange(days))} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-brand-blue dark:bg-blue-500/10 dark:text-blue-400">{days === 1 ? 'Today' : `Last ${days} days`}</button>)}
        <button type="button" onClick={() => onChange({ from: '', to: '' })} disabled={!value.from && !value.to} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800">All time</button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <SubmissionDateTimePicker key={`from-${value.from}-${value.to}`} label="From" value={value.from} max={value.to || undefined} onChange={from => onChange({ ...value, from })} />
      <SubmissionDateTimePicker key={`to-${value.from}-${value.to}`} label="To" value={value.to} min={value.from || undefined} onChange={to => onChange({ ...value, to })} />
    </div>
    <p id={`${id}-hint`} role={invalid ? 'alert' : undefined} className={`mt-2 text-xs ${invalid ? 'text-rose-600' : 'text-slate-400'}`}>{invalid ? 'To must be at or after From.' : `Times use your local timezone (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`}</p>
  </section>;
}
