import { useEffect, useRef, useState } from 'react';
import { Shield, KeyRound, Monitor, Copy, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ModalLayer } from './ModalLayer';
import { TextInput } from './LimitedTextField';
import { ShimmerText } from './Shimmer';

type Setup = { secret: string; qr_data_url: string };
type Session = { id: string; device_label: string; created_at: string; current: boolean };
const button = 'uipro-button uipro-button-primary';
const secondaryButton = 'uipro-button uipro-button-secondary';
const input = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm';

export function AccountSecurityPanel({ enabled: initialEnabled }: { enabled: boolean }) {
  const { token, logout } = useAuth();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [action, setAction] = useState<'setup' | 'disable' | 'recovery-codes' | 'logout-all' | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const current = () => token === sessionStorage.getItem('auth_token');
  useEffect(() => {
    let live = true;
    api.get('/auth/sessions', { timeout: 15000 }).then(response => { if (live) setSessions(response.data); })
      .catch(() => { if (live) setSessionError('Could not load devices. Reopen Settings to retry.'); });
    return () => { live = false; };
  }, [token]);
  function open(next: typeof action) { trigger.current = document.activeElement as HTMLElement; setAction(next); setError(''); }
  function close() { if (!busy) { setAction(null); setSetup(null); setCodes([]); setPassword(''); setCode(''); setError(''); setCopied(false); queueMicrotask(() => trigger.current?.focus()); } }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const path = action === 'logout-all' ? '/auth/logout-all' : `/auth/2fa/${setup ? 'enable' : action}`;
      const response = await api.post(path, { current_password: password, code }, { timeout: 15000 });
      if (!current()) return;
      if (action === 'setup' && !setup) { setSetup(response.data); setPassword(''); }
      else if (action === 'disable' || action === 'logout-all') logout();
      else { setCodes(response.data.recovery_codes); setSetup(null); setCode(''); setPassword(''); setEnabled(true); setSessions(null); setSessionError('');
        api.get('/auth/sessions', { timeout: 15000 }).then(result => { if (current()) setSessions(result.data); })
          .catch(() => { if (current()) setSessionError('Could not refresh devices. Reopen Settings to retry.'); }); }
    } catch (failure: unknown) {
      if (current()) setError((failure as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Could not complete this action; please try again.');
    } finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
    <div className="flex items-center justify-between gap-3"><h4 className="flex items-center gap-2 font-bold text-sm"><Shield size={18} className="text-blue-600" />Security & Authentication</h4>
      <span className={`rounded-full px-3 py-1 text-xs ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{enabled ? '2FA Enabled' : '2FA Disabled'}</span></div>
    <p className="text-xs text-slate-500">Use an authenticator code as well as your password when signing in.</p>
    <div className="flex flex-wrap gap-2">{!enabled ? <button type="button" className={button} onClick={() => open('setup')}>Set up 2FA</button> : <>
      <button type="button" className={button} onClick={() => open('recovery-codes')}>Replace recovery codes</button>
      <button type="button" className={secondaryButton} onClick={() => open('disable')}>Disable 2FA</button></>}</div>
    <div className="border-t border-slate-200 pt-4 space-y-3"><h5 className="text-xs font-bold flex gap-2"><Monitor size={16} />Signed-in devices</h5>
      {sessionError ? <p role="alert" className="text-xs text-red-600">{sessionError}</p> : sessions === null ? <div role="status" aria-label="Checking your devices" aria-busy="true" className="space-y-2"><ShimmerText height="h-8" /><ShimmerText height="h-8" /></div> : sessions.map(session => <div key={session.id} className="flex justify-between gap-3 rounded-xl border bg-white p-3 text-xs">
        <span>{session.device_label}<span className="block mt-1 text-slate-500">{new Date(session.created_at).toLocaleString()}</span></span>{session.current && <span className="text-blue-600">This device</span>}</div>)}
      <button type="button" className={secondaryButton} onClick={() => open('logout-all')}>Sign out all devices</button></div>
    {!action && error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    {action && <ModalLayer className="fixed inset-0 flex items-center justify-center bg-slate-900/50 p-4">
      <form role="dialog" aria-modal="true" aria-labelledby="security-title" onSubmit={submit} onKeyDown={event => {
        if (event.key === 'Escape' && !busy && !codes.length) { event.preventDefault(); close(); }
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }} className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white border p-6 space-y-4 shadow-xl">
        <div className="flex justify-between gap-4"><h3 id="security-title" className="font-bold flex gap-2"><KeyRound className="text-blue-600" size={20} />{codes.length ? 'Save your recovery codes' : action === 'logout-all' ? 'Sign out all devices' : action === 'setup' ? 'Set up your authenticator' : action === 'disable' ? 'Disable 2FA' : 'Replace recovery codes'}</h3>
          {!codes.length && <button type="button" aria-label="Close security dialog" disabled={busy} onClick={close}><X size={18} /></button>}</div>
        {codes.length ? <><p className="text-sm text-slate-500">Shown only once; each code works once in place of an authenticator code; keep them somewhere safe outside this browser.</p>
          <div className="grid gap-2 rounded-xl bg-slate-50 p-4 font-mono text-xs select-all">{codes.map(item => <span key={item}>{item}</span>)}</div>
          <button type="button" className={`${secondaryButton} gap-2`} onClick={async () => { try { await navigator.clipboard.writeText(codes.join('\n')); setCopied(true); } catch { setError('Select and copy the codes manually.'); } }}><Copy size={16} />{copied ? 'Copied' : 'Copy codes'}</button>
          <button type="button" className={button} onClick={close}>I have saved my codes</button></> : <>
          <p className="text-sm text-slate-500">{action === 'logout-all' || action === 'disable' ? 'This will end all sessions, including this one.' : 'Security changes are saved only after verification.'}</p>
          {setup ? <><img className="mx-auto w-44 h-44 bg-white" src={setup.qr_data_url} alt="Scan with your authenticator app" />
            <p className="text-xs text-slate-500">Scan this QR code or enter this setup key in your authenticator app:</p><code className="block break-all bg-slate-50 rounded-xl p-3 text-xs select-all">{setup.secret}</code></> : <label className="block text-xs font-semibold">Current password<TextInput autoFocus disabled={busy} showCounter={false} className={`${input} mt-2`} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>}
          {(setup || action === 'disable' || action === 'recovery-codes') && <label className="block text-xs font-semibold">{setup ? '6-digit authenticator code' : 'Authenticator or recovery code'}<TextInput autoFocus={!!setup} disabled={busy} showCounter={false} className={`${input} mt-2`} maxLength={32} autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} required /></label>}
          <div className="flex gap-3 pt-2"><button type="button" disabled={busy} onClick={close} className={secondaryButton}>Cancel</button><button disabled={busy} className={`${button} flex-1`}>{busy ? 'Verifying…' : setup ? 'Verify & enable' : 'Continue'}</button></div></>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    </ModalLayer>}
  </section>;
}
