import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Check, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { hour24, localMinute, monthDays } from '../utils/submissionTime';
import { FloatingPanel } from './FloatingPanel';

type Props = { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void };

/** Shared viewport-aware layer keeps date filters visible above cards and dialogs. */
export function SubmissionDateTimePicker({ label, value, min, max, onChange }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [month, setMonth] = useState('');
  const [timePart, setTimePart] = useState<'hour' | 'minute' | null>(null);
  const hourButton = useRef<HTMLButtonElement>(null);
  const minuteButton = useRef<HTMLButtonElement>(null);
  const datePart = draft.slice(0, 10);
  const [hour = '', minute = ''] = (draft.split('T')[1] || '').split(':');
  const displayHour = Number(hour) % 12 || 12;
  const period = Number(hour) >= 12 ? 'PM' : 'AM';
  const invalid = !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft) || Boolean(min && draft < min) || Boolean(max && draft > max);
  const selectedDate = value ? new Date(value) : null;
  const close = () => { setOpen(false); setTimePart(null); trigger.current?.focus(); };
  const toggle = () => {
    if (open) return close();
    let next = value || `${localMinute(new Date()).slice(0, 10)}T${label === 'From' ? '00:00' : '23:59'}`;
    if (min && next < min) next = min;
    if (max && next > max) next = max;
    setDraft(next); setMonth(next.slice(0, 7)); setOpen(true);
  };
  const moveMonth = (offset: number) => {
    const next = new Date(`${month}-01T12:00:00`);
    next.setMonth(next.getMonth() + offset);
    setMonth(localMinute(next).slice(0, 7));
  };
  const chooseTime = (part: 'hour' | 'minute', number: number) => {
    const text = String(part === 'hour' ? hour24(number, period) : number).padStart(2, '0');
    setDraft(`${datePart}T${part === 'hour' ? text : hour}:${part === 'minute' ? text : minute}`);
    setTimePart(null);
    (part === 'hour' ? hourButton : minuteButton).current?.focus();
  };
  const timeClass = 'flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-lg font-semibold tabular-nums text-slate-900 hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

  return <div className="min-w-0">
    <span id={`${id}-label`} className="mb-1.5 block text-xs text-slate-500 dark:text-slate-400">{label}</span>
    <button ref={trigger} type="button" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-panel`} onClick={toggle} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 ${open ? 'border-brand-blue bg-blue-50/50 dark:bg-blue-500/10' : 'border-slate-200 bg-slate-50 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800'}`}>
      <CalendarDays className="h-4 w-4 shrink-0 text-brand-blue" />
      <span id={`${id}-value`} className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">{selectedDate ? selectedDate.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Choose date & time'}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <FloatingPanel animateEntrance={false} onDismiss={close} id={`${id}-panel`} role="group" aria-label={`${label} date and time picker`} className="w-[360px] rounded-2xl border border-blue-100 bg-white p-3 shadow-lg shadow-blue-950/5 dark:border-slate-700 dark:bg-slate-900 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
        <span aria-live="polite" className="text-sm font-semibold text-slate-800 dark:text-slate-100">{new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 dark:hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day} className="py-2">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {monthDays(month).map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const date = `${month}-${String(day).padStart(2, '0')}`;
          const selected = date === datePart;
          const unavailable = Boolean(min && date < min.slice(0, 10)) || Boolean(max && date > max.slice(0, 10));
          return <button key={date} type="button" aria-label={new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'full' })} aria-pressed={selected} disabled={unavailable} onClick={() => setDraft(`${date}T${hour}:${minute}`)} className={`min-h-9 rounded-xl text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${selected ? 'bg-brand-blue text-white shadow-sm' : date === localMinute(new Date()).slice(0, 10) ? 'bg-blue-50 text-brand-blue ring-1 ring-inset ring-blue-200 dark:bg-blue-500/10' : 'text-slate-700 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{day}</button>;
        })}
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"><Clock3 className="h-3.5 w-3.5 text-brand-blue" />Local time <span className="ml-auto text-[10px]">Tap to choose</span></div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div className="text-center text-[10px] text-slate-400"><button ref={hourButton} type="button" aria-label={`${label} hour: ${displayHour}`} aria-expanded={timePart === 'hour'} aria-controls={`${id}-hours`} onClick={() => setTimePart(timePart === 'hour' ? null : 'hour')} className={timeClass}>{String(displayHour).padStart(2, '0')}<ChevronDown className="h-3.5 w-3.5 text-slate-400" /></button><span className="mt-1 block">Hour</span></div>
          <span className="pt-3 text-xl text-slate-400">:</span>
          <div className="text-center text-[10px] text-slate-400"><button ref={minuteButton} type="button" aria-label={`${label} minute: ${minute}`} aria-expanded={timePart === 'minute'} aria-controls={`${id}-minutes`} onClick={() => setTimePart(timePart === 'minute' ? null : 'minute')} className={timeClass}>{minute}<ChevronDown className="h-3.5 w-3.5 text-slate-400" /></button><span className="mt-1 block">Minute</span></div>
        </div>
        <div role="group" aria-label={`${label} AM or PM`} className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          {(['AM', 'PM'] as const).map(option => <button key={option} type="button" aria-pressed={period === option} onClick={() => setDraft(`${datePart}T${String(hour24(displayHour, option)).padStart(2, '0')}:${minute}`)} className={`min-h-10 rounded-lg text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand-blue/30 ${period === option ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-500 hover:bg-blue-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}>{option}</button>)}
        </div>
        {timePart && <TimeOptions key={timePart} id={`${id}-${timePart === 'hour' ? 'hours' : 'minutes'}`} label={timePart === 'hour' ? 'Choose hour' : 'Choose minute'} values={Array.from({ length: timePart === 'hour' ? 12 : 60 }, (_, index) => timePart === 'hour' ? index + 1 : index)} selected={timePart === 'hour' ? displayHour : Number(minute)} onSelect={number => chooseTime(timePart, number)} />}
        <div className="mt-3 flex flex-wrap gap-2">
          {[['Start of day', '00:00'], ['Current time', localMinute(new Date()).slice(11)], ['End of day', '23:59']].map(([text, time]) => {
            const next = `${datePart}T${time}`;
            const unavailable = Boolean(min && next < min) || Boolean(max && next > max);
            return <button key={text} type="button" disabled={unavailable} onClick={() => { setDraft(`${datePart}T${text === 'Current time' ? localMinute(new Date()).slice(11) : time}`); setTimePart(null); }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:text-brand-blue disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{text}</button>;
          })}
        </div>
        <p aria-live="polite" className="mt-3 text-center text-xs font-medium text-brand-blue dark:text-blue-400">Selected: {displayHour}:{minute} {period}</p>
      </div>
      {invalid && <p role="alert" className="mt-2 text-xs text-rose-600">Choose a time within the From/To range.</p>}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button type="button" onClick={() => { onChange(''); close(); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-3 w-3" />Clear</button>
        <button type="button" disabled={invalid} onClick={() => { onChange(draft); close(); }} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"><Check className="h-3.5 w-3.5" />Apply</button>
      </div>
    </FloatingPanel>}
  </div>;
}

function TimeOptions({ id, label, values, selected, onSelect }: { id: string; label: string; values: number[]; selected: number; onSelect: (number: number) => void }) {
  return <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
    <p className="px-1 pb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
    {values.length === 60 && <div role="group" aria-label="Quick minutes" className="mb-2 grid grid-cols-4 gap-1 border-b border-slate-100 pb-2 dark:border-slate-800">
      {[0, 15, 30, 45].map(number => <button key={number} type="button" onClick={() => onSelect(number)} className="min-h-10 rounded-lg bg-blue-50 text-xs font-semibold text-brand-blue hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400">:{String(number).padStart(2, '0')}</button>)}
    </div>}
    <div id={id} role="group" aria-label={label} className="grid max-h-48 grid-cols-4 gap-1 overflow-y-auto sm:grid-cols-6" onKeyDown={event => {
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      const columns = getComputedStyle(event.currentTarget).gridTemplateColumns.split(' ').length;
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? columns : event.key === 'ArrowUp' ? -columns : null;
      if (index >= 0 && step !== null) { event.preventDefault(); buttons[(index + step + buttons.length) % buttons.length]?.focus(); }
    }}>
      {values.map(number => <button key={number} type="button" autoFocus={number === selected} aria-pressed={number === selected} onClick={() => onSelect(number)} className={`min-h-10 rounded-lg text-xs font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-blue ${number === selected ? 'bg-brand-blue text-white' : 'text-slate-600 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{String(number).padStart(2, '0')}</button>)}
    </div>
  </div>;
}
