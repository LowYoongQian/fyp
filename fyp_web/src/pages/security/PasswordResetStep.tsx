import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Mail, MailCheck } from 'lucide-react';
import { apiService } from '../../services/api';

type Stage = 'request' | 'sent' | 'checking' | 'invalid' | 'choose' | 'done';
type Failure = { response?: { status?: number; data?: { detail?: string } } };

const STUDENT_DOMAIN = 'student.school.edu';
const FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;   // the server's rule for a new password

/** Format only, never an account lookup: a personal address or a staff address is told where it belongs before anything is sent. */
function schoolEmailProblem(value: string): string | null {
  const address = value.trim().toLowerCase();
  if (!FORMAT.test(address)) return 'Enter your school email, for example name@student.school.edu.';
  if (address.endsWith('@staff.school.edu') || address.endsWith('@school.edu')) return 'Staff passwords are reset by the administrator. Please contact the admin office.';
  if (!address.endsWith(`@${STUDENT_DOMAIN}`)) return 'Use your school email (name@student.school.edu), not a personal email.';
  return null;
}

/**
 * Password recovery on its own page (/login/reset) inside the sign-in card: ask with the school email, a neutral "sent" note, then, from the
 * emailed link (/login/reset?token=…), a check of the link, the new password and a confirmation. Nothing here shows whether an account exists
 * or which address a link went to.
 */
export function PasswordResetStep({ token, initialEmail, onBack, onRequestNew }: {
  token: string | null; initialEmail: string; onBack: (message?: string) => void; onRequestNew: () => void;
}) {
  const [stage, setStage] = useState<Stage>(token ? 'checking' : 'request');
  const [email, setEmail] = useState(() => initialEmail.trim().toLowerCase().endsWith(`@${STUDENT_DOMAIN}`) ? initialEmail.trim() : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busyRef = useRef(false);
  const field = useRef<HTMLInputElement>(null);

  // A link from the email: check it first, so a used or expired link says so before a new password is typed.
  useEffect(() => {
    if (!token) return;
    let live = true;
    apiService.checkResetToken(token)
      .then(() => { if (live) setStage('choose'); })
      .catch((failure: Failure) => {
        if (!live) return;
        if (failure.response?.status === 400) setStage('invalid');
        else { setProblem('Could not check this link. Check your connection and try again.'); setStage('invalid'); }
      });
    return () => { live = false; };
  }, [token, attempt]);

  useEffect(() => { if (stage === 'request' || stage === 'choose') requestAnimationFrame(() => field.current?.focus()); }, [stage]);

  const run = async (work: () => Promise<void>) => {
    if (busyRef.current) return;   // one request at a time, however fast the clicks
    busyRef.current = true;
    setBusy(true);
    try { await work(); } finally { busyRef.current = false; setBusy(false); }
  };

  const request = (event: React.FormEvent) => {
    event.preventDefault();
    const wrong = schoolEmailProblem(email);
    setProblem(wrong ?? '');
    if (wrong) { field.current?.focus(); return; }
    void run(async () => {
      try { await apiService.forgotPassword(email.trim()); setStage('sent'); }
      catch (failure) {
        const { status, data } = (failure as Failure).response ?? {};
        setProblem(status === 429 ? (data?.detail || 'Too many requests. Please wait a moment and try again.') : 'Could not send the request. Check your connection and try again.');
      }
    });
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const wrong = password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : password !== confirm ? 'The two passwords do not match.' : '';
    setProblem(wrong);
    if (wrong || !token) return;
    void run(async () => {
      try { await apiService.resetPassword(token, password); setPassword(''); setConfirm(''); setStage('done'); }
      catch (failure) {
        const { status, data } = (failure as Failure).response ?? {};
        if (status === 400 && /link/i.test(data?.detail || '')) { setPassword(''); setConfirm(''); setProblem(''); setStage('invalid'); }
        else setProblem(data?.detail || 'Could not save the new password. Check your connection and try again.');
      }
    });
  };

  const alert = problem && (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span>{problem}</span>
    </p>
  );
  const heading = (icon: React.ReactNode, title: string, text: string) => (
    <div className="space-y-1.5 text-center">
      <h3 className="flex items-center justify-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-slate-100">{icon}{title}</h3>
      <p id="reset-help" className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
    </div>
  );
  const iconClass = 'h-5 w-5 text-brand-blue dark:text-blue-400';
  const back = (
    <button type="button" disabled={busy} onClick={() => onBack()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white">
      <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />Back to sign in
    </button>
  );
  const spinner = <span aria-hidden="true" className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;

  return (
    <div key={stage} className="login-step-enter space-y-5" data-reset-stage={stage}>
      <p role="status" aria-live="polite" className="sr-only">{busy ? 'Please wait…' : stage === 'checking' ? 'Checking your reset link…' : ''}</p>

      {stage === 'request' && <>
        {heading(<KeyRound aria-hidden="true" className={iconClass} />, 'Reset your password', 'Enter your school email. We will send a reset link to the verified recovery email linked to it.')}
        <form noValidate onSubmit={request} className="space-y-4">
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>School email</span>
            <span className="relative block">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input ref={field} type="email" autoComplete="username" maxLength={255} disabled={busy} value={email} placeholder="name@student.school.edu"
                aria-describedby="reset-help" aria-invalid={!!problem || undefined}
                onChange={event => { setEmail(event.target.value); setProblem(''); }}
                className={`uipro-input w-full !pl-11 ${problem ? '!border-rose-500 ring-2 ring-rose-500/20' : ''}`} />
            </span>
          </label>
          {alert}
          <button type="submit" disabled={busy || !email.trim()} aria-busy={busy} className="uipro-button uipro-button-primary min-h-[44px] w-full">
            {busy ? <>{spinner}Sending…</> : 'Send reset link'}
          </button>
        </form>
        <div className="flex justify-center border-t border-slate-200/70 pt-4 dark:border-slate-700/70">{back}</div>
      </>}

      {stage === 'sent' && <>
        {heading(<MailCheck aria-hidden="true" className={iconClass} />, 'Check your recovery email',
          'If this school email has a verified recovery email, a reset link is on its way to it. The link works once and expires in 20 minutes.')}
        <p className="rounded-xl border border-slate-200/80 bg-white/60 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
          No email after a few minutes? Check your spam folder. If you never added a recovery email, please contact the admin office to reset your password.
        </p>
        <button type="button" onClick={() => onBack()} className="uipro-button uipro-button-primary min-h-[44px] w-full">Back to sign in</button>
      </>}

      {stage === 'checking' && <div className="flex flex-col items-center gap-3 py-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <span aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500/25 border-t-blue-600" />Checking your reset link…
      </div>}

      {stage === 'invalid' && <>
        {heading(<AlertCircle aria-hidden="true" className="h-5 w-5 text-amber-600" />, problem ? 'Link not checked' : 'This link cannot be used',
          problem || 'This reset link is invalid, expired or already used. You can ask for a new one.')}
        {problem
          ? <button type="button" onClick={() => { setProblem(''); setStage('checking'); setAttempt(count => count + 1); }} className="uipro-button uipro-button-primary min-h-[44px] w-full">Try again</button>
          : <button type="button" onClick={onRequestNew} className="uipro-button uipro-button-primary min-h-[44px] w-full">Request a new link</button>}
        <div className="flex justify-center">{back}</div>
      </>}

      {stage === 'choose' && <>
        {heading(<KeyRound aria-hidden="true" className={iconClass} />, 'Set a new password', `Use at least ${MIN_PASSWORD} characters. Saving it signs you out on every device.`)}
        <form noValidate onSubmit={save} className="space-y-4">
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>New password</span>
            <input ref={field} type="password" autoComplete="new-password" maxLength={128} disabled={busy} value={password}
              aria-describedby="reset-help" onChange={event => { setPassword(event.target.value); setProblem(''); }} className="uipro-input w-full" />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Confirm new password</span>
            <input type="password" autoComplete="new-password" maxLength={128} disabled={busy} value={confirm}
              onChange={event => { setConfirm(event.target.value); setProblem(''); }} className="uipro-input w-full" />
          </label>
          {alert}
          <button type="submit" disabled={busy || !password || !confirm} aria-busy={busy} className="uipro-button uipro-button-primary min-h-[44px] w-full">
            {busy ? <>{spinner}Saving…</> : 'Save new password'}
          </button>
        </form>
        <div className="flex justify-center border-t border-slate-200/70 pt-4 dark:border-slate-700/70">{back}</div>
      </>}

      {stage === 'done' && <>
        {heading(<CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-500" />, 'Password updated', 'You can now sign in with your new password.')}
        <button type="button" onClick={() => onBack('Password updated. Sign in with your new password.')} className="uipro-button uipro-button-primary min-h-[44px] w-full">Sign in</button>
      </>}
    </div>
  );
}
