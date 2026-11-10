import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import sasLogo from '../assets/saslogo.webp';

export type SignOutState = 'pending' | 'done' | 'local';

/** How long the cover waits for the server before it says so and offers Back to sign in. */
export const AUTH_COVER_LIMIT_MS = 10_000;

/**
 * Covers the screen while this device signs out. It says only what is true: "Signing out…" until the server has answered (or failed to),
 * then "Signed out" and fades away onto the sign-in page. If the server could not confirm, it says so and waits for Continue.
 */
export function SignOutOverlay({ state, onDone, onCancel }: { state: SignOutState; onDone: () => void; onCancel?: () => void }) {
  return <AuthTransitionOverlay action="out" state={state} onDone={onDone} onCancel={onCancel} />;
}

export function AuthTransitionOverlay({ action, state, onDone, onCancel }: {
  action: 'in' | 'out'; state: SignOutState; onDone: () => void; onCancel?: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  // Still waiting after the limit: the bar stops and Back to sign in appears. The cover is unmounted between attempts,
  // so each wait starts a fresh limit.
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  useEffect(() => {
    if (state !== 'pending' || !onCancel) return;
    const timer = window.setTimeout(() => setWaitedTooLong(true), AUTH_COVER_LIMIT_MS);
    return () => window.clearTimeout(timer);
  }, [state, onCancel]);
  const slow = state === 'pending' && waitedTooLong;
  useEffect(() => { if (state === 'local' || slow) button.current?.focus(); }, [state, slow]);
  const leaving = state === 'done';
  const title = slow ? 'Taking longer than expected'
    : state === 'pending' ? (action === 'in' ? 'Signing in…' : 'Signing out…')
    : action === 'in' ? 'Signed in' : state === 'done' ? 'Signed out' : 'Signed out on this device';
  const detail = slow ? (action === 'in'
      ? 'Signing in has not finished after 10 seconds. Go back and try again; what you typed is kept.'
      : 'Signing out has not finished after 10 seconds. This device is already signed out; go back to sign in.')
    : state === 'local' ? 'The server could not confirm it, so this session will end on its own when it expires.' : '';
  return (
    <div
      data-sign-out={action === 'out' ? state : undefined}
      data-sign-in={action === 'in' ? state : undefined}
      data-slow={slow || undefined}
      className={`sign-out-overlay ${action === 'in' ? 'sign-out-overlay-fade' : ''} ${leaving ? 'sign-out-overlay-leave' : ''}`}
      onAnimationEnd={event => { if (leaving && event.target === event.currentTarget) onDone(); }}
    >
      <div className="sign-out-glow" aria-hidden="true" />
      <div role={detail ? 'alertdialog' : 'status'} aria-live="polite" aria-labelledby="sign-out-title" aria-describedby={detail ? 'sign-out-detail' : undefined}
        className="relative flex w-full max-w-xs flex-col items-center gap-4 px-6 text-center">
        <img src={sasLogo} alt="" className="h-20 w-auto object-contain drop-shadow-md sm:h-24" />
        <div className="space-y-1.5">
          <h3 id="sign-out-title" className="flex items-center justify-center gap-1.5 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            {slow ? <Clock aria-hidden="true" className="h-5 w-5 text-amber-500" /> : state !== 'pending' && <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-500" />}
            {title}
          </h3>
          {detail && <p id="sign-out-detail" className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{detail}</p>}
        </div>
        {slow
          ? <button ref={button} type="button" onClick={onCancel} className="uipro-button uipro-button-primary inline-flex w-full items-center justify-center gap-2"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to sign in</button>
          : state === 'local'
          ? <button ref={button} type="button" onClick={onDone} className="uipro-button uipro-button-primary w-full">Continue</button>
          : <span aria-hidden="true" className="sign-out-bar"><span /></span>}
      </div>
    </div>
  );
}
