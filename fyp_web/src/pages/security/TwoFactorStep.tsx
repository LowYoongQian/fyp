import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth, type SessionData } from '../../context/AuthContext';
import { OtpInput, OTP_LENGTH } from '../../components/OtpInput';

export type PendingChallenge = { token: string; email: string; expiresAt: number };
type Failure = { response?: { status?: number; data?: { detail?: string } } };

/**
 * The second sign-in step, on its own page (/login/verify) inside the sign-in card. Six digits submit themselves once; a failed code stays
 * editable and is never resent on its own. A recovery code is a separate mode. No session exists until the server accepts the code.
 */
export function TwoFactorStep({ challenge, onVerified, onCancel }: {
  challenge: PendingChallenge; onVerified: (data: SessionData) => void; onCancel: (message?: string) => void;
}) {
  const { verifyLogin } = useAuth();
  const [mode, setMode] = useState<'code' | 'recovery'>('code');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(() => Date.now() >= challenge.expiresAt);
  const busyRef = useRef(false);
  const lastTried = useRef('');
  const codeInput = useRef<HTMLInputElement>(null);
  const recoveryInput = useRef<HTMLInputElement>(null);

  // The server's challenge lasts five minutes; after that the page says so instead of letting a code fail.
  useEffect(() => {
    const left = challenge.expiresAt - Date.now();
    if (left <= 0) return;
    const timer = window.setTimeout(() => setExpired(true), left);
    return () => window.clearTimeout(timer);
  }, [challenge.expiresAt]);

  // After a refused code the field takes the focus back with the code selected, ready to retype. This runs after the render that unlocks
  // the field: focusing it any earlier silently fails while it is still disabled.
  const [refused, setRefused] = useState(0);
  useEffect(() => {
    if (!refused) return;
    if (mode === 'code') { codeInput.current?.focus(); codeInput.current?.setSelectionRange(0, OTP_LENGTH); } else recoveryInput.current?.select();
  }, [refused, mode]);

  const submit = async (value: string) => {
    if (busyRef.current || expired || !value) return;   // one request at a time
    busyRef.current = true;
    lastTried.current = value;
    setBusy(true);
    setError('');
    try {
      onVerified(await verifyLogin(challenge.token, value, challenge.email));
    } catch (failure) {
      const { status, data } = (failure as Failure).response ?? {};
      if (status === 401) setExpired(true);
      setError(data?.detail || 'Could not verify. Check your connection and try again.');
      busyRef.current = false;
      setBusy(false);
      if (status !== 401) setRefused(count => count + 1);
      return;
    }
    busyRef.current = false;
  };

  const typeCode = (next: string) => {
    setCode(next);
    if (next !== lastTried.current) setError('');
    // Exactly six digits submit once; the same failed code is not sent again until it is changed (or Verify is pressed).
    if (next.length === OTP_LENGTH && next !== lastTried.current) void submit(next);
  };

  const switchMode = () => {
    setMode(mode === 'code' ? 'recovery' : 'code');
    setError('');
    lastTried.current = '';
    requestAnimationFrame(() => (mode === 'code' ? recoveryInput : codeInput).current?.focus());
  };

  const entry = mode === 'code' ? code : recovery.trim();
  return (
    <div className="login-step-enter space-y-5" data-two-factor-step>
      <div className="space-y-1.5 text-center">
        <h3 className="flex items-center justify-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          {mode === 'code' ? <ShieldCheck aria-hidden="true" className="h-5 w-5 text-brand-blue dark:text-blue-400" /> : <KeyRound aria-hidden="true" className="h-5 w-5 text-brand-blue dark:text-blue-400" />}
          Verify your sign-in
        </h3>
        <p id="two-factor-help" className="text-xs text-slate-600 dark:text-slate-300">
          {mode === 'code' ? 'Enter the 6-digit code from your authenticator app.' : 'Enter one of your saved recovery codes. Each code works once.'}
        </p>
      </div>

      <form noValidate className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(entry); }}>
        {mode === 'code' ? (
          <OtpInput value={code} onChange={typeCode} label="6-digit authenticator code" describedBy="two-factor-help" inputRef={codeInput}
            autoFocus disabled={busy || expired} invalid={!!error && !busy} />
        ) : (
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Recovery code</span>
            <input ref={recoveryInput} autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={32}
              disabled={busy || expired} value={recovery} onChange={event => { setRecovery(event.target.value); setError(''); }}
              aria-describedby="two-factor-help" aria-invalid={!!error || undefined} className="uipro-input w-full font-mono tracking-wider" />
          </label>
        )}

        <p role="status" aria-live="polite" className="sr-only">{busy ? 'Verifying…' : ''}</p>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span>{expired && !error.toLowerCase().includes('sign in again') ? `${error} Sign in again.` : error}</span>
          </p>
        )}
        {expired && !error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span>This sign-in step has expired. Sign in again.</span>
          </p>
        )}

        {expired ? (
          <button type="button" onClick={() => onCancel()} className="uipro-button uipro-button-primary min-h-[44px] w-full">Sign in again</button>
        ) : (
          <button type="submit" disabled={busy || (mode === 'code' ? code.length !== OTP_LENGTH : !entry)} aria-busy={busy}
            className="uipro-button uipro-button-primary min-h-[44px] w-full">
            {busy ? <><span aria-hidden="true" className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Verifying…</> : 'Verify and sign in'}
          </button>
        )}
      </form>

      <div className="flex flex-col items-center gap-3 border-t border-slate-200/70 pt-4 text-xs dark:border-slate-700/70 sm:flex-row sm:justify-between">
        <button type="button" disabled={busy} onClick={() => onCancel()} className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white">
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />Back to sign in
        </button>
        {!expired && (
          <button type="button" disabled={busy} onClick={switchMode} className="font-semibold text-blue-700 hover:underline disabled:opacity-50 dark:text-blue-400">
            {mode === 'code' ? 'Use a recovery code' : 'Use the authenticator code'}
          </button>
        )}
      </div>
    </div>
  );
}
