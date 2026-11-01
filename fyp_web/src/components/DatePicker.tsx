import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { keyboardTarget, shiftMonth } from '../utils/dateGrid';
import { monthDays } from '../utils/submissionTime';
import { FloatingPanel } from './FloatingPanel';

type Props = {
  label: string; value: string; today: string; onChange: (value: string) => void;
  /** Dates before `min` or after `max` are greyed out and cannot be chosen by click or keyboard. */
  min?: string; max?: string; invalid?: boolean; describedBy?: string; disabled?: boolean; className?: string;
};

const readable = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Date-only calendar in the system's card style. It never shows a time field and never decides what "today" is: the caller passes the Malaysia date. */
export function DatePicker({ label, value, today, onChange, min, max, invalid, describedBy, disabled, className = '' }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState('');
  const [focusDate, setFocusDate] = useState('');
  const outside = (date: string) => Boolean(min && date < min) || Boolean(max && date > max);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const toggle = () => {
    if (open) return close();
    const start = value || (min && today < min ? min : today);
    setMonth(start.slice(0, 7));
    setFocusDate(!outside(value) && value ? value : !outside(today) ? today : min || '');
    setOpen(true);
  };
  const canMove = (offset: number) => !(offset < 0 && min && shiftMonth(month, offset) < min.slice(0, 7)) && !(offset > 0 && max && shiftMonth(month, offset) > max.slice(0, 7));
  const choose = (date: string) => { if (outside(date)) return; onChange(date); close(); };

  // Move keyboard focus onto the requested day once its month is rendered.
  useEffect(() => {
    if (open && focusDate) grid.current?.querySelector<HTMLElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [open, month, focusDate]);

  const onGridKey = (event: React.KeyboardEvent) => {
    const current = (event.target as HTMLElement).getAttribute('data-date');
    const target = current ? keyboardTarget(current, event.key, min, max) : undefined;
    if (!current || !target) return;
    event.preventDefault();
    if (target === current) return; // Already at the edge of the allowed range.
    setMonth(target.slice(0, 7)); setFocusDate(target);
  };

  return <div className="min-w-0">
    <button ref={trigger} type="button" disabled={disabled} aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-panel`}
      aria-invalid={invalid || undefined} aria-describedby={describedBy} onClick={toggle}
      className={`flex w-full items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 disabled:opacity-50 dark:bg-slate-800 ${invalid ? 'border-rose-300 dark:border-rose-500/60' : open ? 'border-brand-blue' : 'border-slate-200 hover:border-blue-300 dark:border-slate-700'} ${className}`}>
      <CalendarDays className="h-4 w-4 shrink-0 text-brand-blue" />
      <span data-date-value className={`min-w-0 flex-1 truncate font-medium ${value ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>{value ? readable(value) : 'Choose date'}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <FloatingPanel animateEntrance={false} onDismiss={close} id={`${id}-panel`} role="dialog" aria-label={`${label} calendar`}
      className="w-[320px] rounded-2xl border border-blue-100 bg-white p-3 shadow-lg shadow-blue-950/5 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-1">
        <div className="flex">
          <button type="button" aria-label="Previous year" disabled={!canMove(-12)} onClick={() => setMonth(shiftMonth(month, -12))} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronsLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Previous month" disabled={!canMove(-1)} onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
        </div>
        <span aria-live="polite" className="text-sm font-semibold text-slate-800 dark:text-slate-100">{new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <div className="flex">
          <button type="button" aria-label="Next month" disabled={!canMove(1)} onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
          <button type="button" aria-label="Next year" disabled={!canMove(12)} onClick={() => setMonth(shiftMonth(month, 12))} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronsRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day} className="py-2">{day}</span>)}</div>
      <div ref={grid} role="group" aria-label={`${label} days`} onKeyDown={onGridKey} className="grid grid-cols-7 gap-1">
        {monthDays(month).map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const date = `${month}-${String(day).padStart(2, '0')}`;
          const selected = date === value, blocked = outside(date);
          return <button key={date} type="button" data-date={date} data-today={date === today || undefined} disabled={blocked} aria-pressed={selected}
            aria-label={new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { dateStyle: 'full' }) + (date === today ? ', today' : '')}
            onClick={() => choose(date)}
            className={`min-h-9 rounded-xl text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 ${
              selected ? 'bg-brand-blue text-white shadow-sm' : blocked ? 'cursor-not-allowed text-slate-400 opacity-40'
              : date === today ? 'bg-blue-50 text-brand-blue ring-1 ring-inset ring-blue-200 hover:bg-blue-100 dark:bg-blue-500/10 dark:ring-blue-500/40'
              : 'text-slate-700 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{day}</button>;
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-800">
        <span className="text-slate-400">Greyed dates are not available · Malaysia time</span>
        <button type="button" disabled={outside(today)} onClick={() => choose(today)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-600 hover:border-blue-300 hover:text-brand-blue disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Today</button>
      </div>
    </FloatingPanel>}
  </div>;
}
