import { Moon } from 'lucide-react';
import { CustomSwitch } from './CustomSwitch';

/** Controlled by the settings draft; it never saves on its own. */
export function PushQuietHours({ enabled, start, end, timezone, disabled, error, onEnabledChange, onStartChange, onEndChange }: {
  enabled: boolean; start: string; end: string; timezone: string; disabled?: boolean; error: string;
  onEnabledChange: (value: boolean) => void; onStartChange: (value: string) => void; onEndChange: (value: string) => void;
}) {
  const field = 'uipro-input w-full sm:w-40 disabled:opacity-50';
  return <section className="border border-slate-200 bg-slate-50/80 rounded-2xl p-5 space-y-4">
    <h4 className="flex items-center gap-2 text-xs font-bold text-slate-900"><Moon className="h-4 w-4 text-[#2563eb]" />Mobile push quiet hours</h4>
    <p className="text-[11px] leading-relaxed text-slate-500">Pause phone alerts during quiet hours; expired class reminders will not be delivered late; in-app updates remain available.</p>
    <div className="flex items-center justify-between gap-3 p-3 border border-slate-200 bg-white rounded-xl">
      <span id="quiet-hours-label" className="font-medium text-xs text-slate-900">Enable quiet hours</span>
      <CustomSwitch checked={enabled} disabled={disabled} onChange={onEnabledChange} ariaLabel="Enable quiet hours" />
    </div>
    <div className="flex flex-wrap gap-4">
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">From
        <input className={field} type="time" disabled={!enabled || disabled} value={start} aria-invalid={!!error} onChange={event => onStartChange(event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Until
        <input className={field} type="time" disabled={!enabled || disabled} value={end} aria-invalid={!!error} onChange={event => onEndChange(event.target.value)} /></label>
    </div>
    <p className="text-[11px] text-slate-500">Timezone: {timezone}. Saved with Save Preferences below.</p>
    {error && <p role="alert" className="text-[11px] font-semibold text-red-600">{error}</p>}
  </section>;
}
