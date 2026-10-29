import { useState } from 'react';
import { Moon } from 'lucide-react';
import { api } from '../services/api';

const time = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
export function PushQuietHours({ profile }: { profile: { push_quiet_enabled?: boolean; push_quiet_start?: number; push_quiet_end?: number; push_timezone?: string } }) {
  const [enabled, setEnabled] = useState(profile.push_quiet_enabled ?? false);
  const [start, setStart] = useState(time(profile.push_quiet_start ?? 1320));
  const [end, setEnd] = useState(time(profile.push_quiet_end ?? 420));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <section className="border rounded-2xl bg-slate-50 p-5 space-y-3">
    <h4 className="flex gap-2 text-sm font-bold"><Moon size={18} className="text-blue-600" />Mobile push quiet hours</h4>
    <p className="text-xs text-slate-500">Pause phone alerts during quiet hours; expired class reminders will not be delivered late; in-app updates remain available.</p>
    <label className="flex gap-2 items-center text-sm"><input className="accent-blue-600" type="checkbox" disabled={busy} checked={enabled} onChange={event => setEnabled(event.target.checked)} />Enable quiet hours</label>
    <div className="flex flex-wrap gap-4"><label className="text-xs">From<input className="block mt-1 rounded-xl border bg-white p-2" type="time" disabled={!enabled || busy} value={start} onChange={event => setStart(event.target.value)} /></label>
      <label className="text-xs">Until<input className="block mt-1 rounded-xl border bg-white p-2" type="time" disabled={!enabled || busy} value={end} onChange={event => setEnd(event.target.value)} /></label></div>
    <p className="text-xs text-slate-500">Timezone: {profile.push_timezone || 'Asia/Kuala_Lumpur'}</p>
    <button type="button" disabled={busy || !start || !end || (enabled && start === end)} className="text-xs font-semibold text-blue-600 disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage(''); const owner = sessionStorage.getItem('auth_token');
      try { await api.put('/auth/me/settings', { push_quiet_enabled: enabled, push_quiet_start: minutes(start), push_quiet_end: minutes(end) }, { timeout: 15000 });
        if (owner === sessionStorage.getItem('auth_token')) setMessage('Quiet hours saved.'); }
      catch { setMessage('Could not save quiet hours; please retry.'); } finally { setBusy(false); }
    }}>{busy ? 'Saving…' : 'Save quiet hours'}</button>
    {enabled && start === end && <p className="text-xs text-red-600">Choose different start and end times.</p>}
    {message && <p role="status" className="text-xs">{message}</p>}
  </section>;
}
