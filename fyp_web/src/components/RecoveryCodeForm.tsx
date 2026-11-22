import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Mail } from 'lucide-react';
import { apiService } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import { OtpInput, OTP_LENGTH } from './OtpInput';

const RESEND_SECONDS = 60;   // the server's pause between codes (RECOVERY_RESEND_SECONDS)
type Failure = { response?: { status?: number } };

/**
 * Step 2 of adding a recovery email: six code boxes that verify themselves once all six digits are in. One request at a time, whether the
 * code was finished by typing, pasting, Enter or the button; a code the server refused is not sent again until it is changed. Used by the
 * sign-in dialog and the Profile page, with the same endpoints, expiry and limits as before.
 */
export function RecoveryCodeForm({ address, onVerified, onChangeEmail, onLater }: {
  address: string; onVerified: () => void; onChangeEmail?: () => void; onLater?: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [waitUntil, setWaitUntil] = useState(() => Date.now() + RESEND_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);
  const [refused, setRefused] = useState('');   // the last code the server rejected; changing any digit allows it again
  const input = useRef<HTMLInputElement>(null);
  const left = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  useEffect(() => {
    if (!left) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [left]);

  const submit = async (value: string) => {
    if (busyRef.current || value.length !== OTP_LENGTH || value === refused) return;
    busyRef.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiService.verifyRecoveryEmail(value);
      onVerified();
    } catch (failure) {
      const status = (failure as Failure).response?.status;
      if (status && status < 500) setRefused(value);   // a wrong or expired code; a network or server failure can be retried as is
      setError(apiErrorMessage(failure, 'That code did not work. Please try again.'));
      busyRef.current = false;
      setBusy(false);
      requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(0, OTP_LENGTH); });
    }
  };

  const type = (next: string) => {
    setCode(next);
    if (next !== refused) setError('');
    if (next.length === OTP_LENGTH) void submit(next);
  };

  const resend = async () => {
    if (sending || left || busyRef.current) return;
    setSending(true); setError(''); setNotice('');
    try {
      await apiService.requestRecoveryEmail(address);
      setCode(''); setRefused('');
      setNotice(`A new code is on its way to ${address}. The previous code no longer works.`);
      setWaitUntil(Date.now() + RESEND_SECONDS * 1000); setNow(Date.now());
      requestAnimationFrame(() => input.current?.focus());
    } catch (failure) {
      if ((failure as Failure).response?.status === 429) { setWaitUntil(Date.now() + RESEND_SECONDS * 1000); setNow(Date.now()); }
      setError(apiErrorMessage(failure, 'The code could not be sent. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const stuck = code.length === OTP_LENGTH && code === refused;
  return (
    <form noValidate data-recovery-code className="space-y-4 text-center" onSubmit={event => { event.preventDefault(); void submit(code); }}>
      <div className="flex flex-col items-center gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-brand-blue ring-8 ring-blue-50/50 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/5">
          <Mail aria-hidden="true" className="h-5 w-5" />
        </span>
        <h3 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-100">Check your email</h3>
        <p id="recovery-code-help" className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          We sent a 6-digit code to <strong className="inline-block max-w-full break-all font-semibold text-slate-900 dark:text-white">{address}</strong>. It expires in 10 minutes.
        </p>
      </div>

      <OtpInput value={code} onChange={type} label="Verification code" describedBy="recovery-code-help" inputRef={input}
        autoFocus disabled={busy} invalid={!!error && !busy && stuck} />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Didn't get it?{' '}
        <button type="button" onClick={resend} disabled={sending || !!left || busy}
          className="font-semibold text-brand-blue hover:underline disabled:cursor-not-allowed disabled:font-medium disabled:text-slate-400 disabled:no-underline dark:text-blue-400 dark:disabled:text-slate-500">
          {sending ? 'Sending…' : left ? `Resend code in ${left}s` : 'Resend code'}
        </button>
      </p>

      <p role="status" aria-live="polite" className={notice ? 'rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'sr-only'}>
        {busy ? 'Verifying…' : notice}
      </p>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-left text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}{stuck ? `${/[.!?]$/.test(error) ? '' : '.'} Change the code or send a new one.` : ''}</span>
        </p>
      )}

      <button type="submit" disabled={busy || code.length !== OTP_LENGTH || stuck} aria-busy={busy}
        className="uipro-button uipro-button-primary min-h-[44px] w-full">
        {busy ? <><span aria-hidden="true" className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Verifying…</> : 'Verify email'}
      </button>

      {(onChangeEmail || onLater) && (
        <div className="flex items-center justify-center gap-5 text-xs">
          {onChangeEmail && <button type="button" disabled={busy} onClick={onChangeEmail} className="font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white">Change email</button>}
          {onLater && <button type="button" disabled={busy} onClick={onLater} className="font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white">Later</button>}
        </div>
      )}
    </form>
  );
}
