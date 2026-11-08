import { useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import sasLogo from '../assets/saslogo.webp';

export type SignOutState = 'pending' | 'done' | 'local';

/**
 * Covers the screen while this device signs out. It says only what is true: "Signing out…" until the server has answered (or failed to),
 * then "Signed out" and fades away onto the sign-in page. If the server could not confirm, it says so and waits for Continue.
 */
export function SignOutOverlay({ state, onDone }: { state: SignOutState; onDone: () => void }) {
  return <AuthTransitionOverlay action="out" state={state} onDone={onDone} />;
}

export function AuthTransitionOverlay({ action, state, onDone }: {
  action: 'in' | 'out'; state: SignOutState; onDone: () => void;
}) {
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (state === 'local') continueButton.current?.focus(); }, [state]);
  const leaving = state === 'done';
  return (
    <div
      data-sign-out={action === 'out' ? state : undefined}
      data-sign-in={action === 'in' ? state : undefined}
      className={`sign-out-overlay ${action === 'in' ? 'sign-out-overlay-fade' : ''} ${leaving ? 'sign-out-overlay-leave' : ''}`}
      onAnimationEnd={event => { if (leaving && event.target === event.currentTarget) onDone(); }}
    >
      <div className="sign-out-glow" aria-hidden="true" />
      <div role={state === 'local' ? 'alertdialog' : 'status'} aria-live="polite" aria-labelledby="sign-out-title" aria-describedby={state === 'local' ? 'sign-out-detail' : undefined}
        className="relative flex w-full max-w-xs flex-col items-center gap-4 px-6 text-center">
        <img src={sasLogo} alt="" className="h-20 w-auto object-contain drop-shadow-md sm:h-24" />
        <div className="space-y-1.5">
          <h3 id="sign-out-title" className="flex items-center justify-center gap-1.5 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            {state === 'pending' ? (action === 'in' ? 'Signing in…' : 'Signing out…') : <><CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-500" />{action === 'in' ? 'Signed in' : state === 'done' ? 'Signed out' : 'Signed out on this device'}</>}
          </h3>
          {state === 'local' && <p id="sign-out-detail" className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">The server could not confirm it, so this session will end on its own when it expires.</p>}
        </div>
        {state === 'local'
          ? <button ref={continueButton} type="button" onClick={onDone} className="uipro-button uipro-button-primary w-full">Continue</button>
          : <span aria-hidden="true" className="sign-out-bar"><span /></span>}
      </div>
    </div>
  );
}
