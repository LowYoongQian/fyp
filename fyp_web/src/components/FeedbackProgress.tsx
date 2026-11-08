import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, CheckCircle2, Clock, Eye } from 'lucide-react';
import { STUDENT_STATUS, type FeedbackStatus } from '../utils/feedbackStatus';

const STEPS: { status: FeedbackStatus; hint: string; Icon: typeof Clock }[] = [
  { status: 'Pending', hint: 'We have your ticket', Icon: Clock },
  { status: 'In Progress', hint: 'An admin is on it', Icon: Eye },
  { status: 'Resolved', hint: 'Closed', Icon: CheckCircle2 },
];
const SUMMARY: Record<FeedbackStatus, string> = {
  'Pending': 'Your ticket is waiting for an administrator.',
  'In Progress': 'An administrator is reviewing your ticket.',
  'Resolved': 'This ticket has been resolved.',
};
const EASE = [0.22, 1, 0.36, 1] as const;

type StepState = 'done' | 'current' | 'upcoming';

/**
 * The three stages of a ticket as the student sees them (Pending, In Review, Resolved). The blue line fills up to the current stage, each
 * finished stage turns into a check as the line reaches it, and the current stage has a soft pulse. When the status changes while this is
 * on screen the line carries on from where it was. With reduced motion everything is shown at once.
 */
export function FeedbackProgress({ status }: { status: FeedbackStatus }) {
  const reduce = !!useReducedMotion();
  const current = Math.max(0, STEPS.findIndex(step => step.status === status));
  const resolved = status === 'Resolved';
  const fraction = current / (STEPS.length - 1);
  const fill = (duration: number) => (reduce ? { duration: 0 } : { duration, ease: EASE });

  return (
    <div className="space-y-4">
      <ol aria-label="Ticket progress" className="relative grid grid-cols-3">
        {/* The track runs from the middle of the first stage to the middle of the last one. */}
        <div aria-hidden="true" className="absolute left-[16.667%] right-[16.667%] top-5 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <motion.div data-progress-fill className="h-full origin-left rounded-full" initial={reduce ? false : { scaleX: 0, backgroundColor: '#3b82f6' }}
            animate={{ scaleX: fraction, backgroundColor: resolved ? '#10b981' : '#3b82f6' }} transition={{ scaleX: fill(0.9), backgroundColor: fill(0.5) }} />
        </div>
        {STEPS.map(({ status: stepStatus, hint, Icon }, index) => {
          const state: StepState = resolved || index < current ? 'done' : index === current ? 'current' : 'upcoming';
          const reachedAt = reduce ? 0 : 0.15 + (index / (STEPS.length - 1)) * 0.7;   // a stage lights up about when the line reaches it
          const look = state === 'done'
            ? resolved ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-blue-600 bg-blue-600 text-white'
            : state === 'current' ? 'border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/20' : 'border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500';
          return (
            <li key={stepStatus} data-step-state={state} aria-current={state === 'current' ? 'step' : undefined} className="relative flex flex-col items-center px-1 text-center">
              <motion.span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-500 ${look}`}
                initial={reduce ? false : { scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 22, delay: index * 0.1 }}>
                {state === 'current' && !reduce && (
                  <motion.span aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-blue-400" initial={{ scale: 1, opacity: 0.55 }}
                    animate={{ scale: 1.55, opacity: 0 }} transition={{ duration: 1.7, repeat: Infinity, ease: 'easeOut' }} />
                )}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={state === 'done' ? 'check' : 'icon'} className="flex" initial={reduce ? false : { scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
                    exit={reduce ? { opacity: 0 } : { scale: 0, rotate: 90 }} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 18, delay: state === 'done' ? reachedAt : 0 }}>
                    {state === 'done' ? <Check className="h-5 w-5" strokeWidth={3} /> : <Icon className="h-5 w-5" />}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
              <span className={`mt-2 text-sm font-semibold transition-colors duration-500 ${state === 'upcoming' ? 'text-slate-400 dark:text-slate-500' : state === 'done' && resolved ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {STUDENT_STATUS[stepStatus]}
              </span>
              <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</span>
              <span className="sr-only">{state === 'done' ? 'Done' : state === 'current' ? 'Current stage' : 'Not reached yet'}</span>
            </li>
          );
        })}
      </ol>
      <div className="min-h-9">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={status} role="status" data-progress-summary initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
            className={`rounded-xl px-3.5 py-2 text-center text-sm font-medium ${resolved ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300'}`}>
            {SUMMARY[status]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
