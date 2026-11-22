import React, { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronRight, Sparkles } from 'lucide-react';
import { TextShimmer } from './text-shimmer';

/**
 * A collapsible "Thinking ›" line (the pattern used by Codex, ChatGPT and AI SDK Elements' Reasoning / Chain of Thought).
 * Steps are only ever the ones the server reported for this answer, so nothing here is invented. While the answer is pending
 * the last step is the one in progress; afterwards the line reads "Thought for 1.2s" and still opens to show what was done.
 */
export const ThinkingTrace: React.FC<{ steps: string[]; active?: boolean; seconds?: number }> = ({ steps, active = false, seconds }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const reduce = useReducedMotion();
  const took = seconds === undefined ? '' : seconds < 10 ? `${Math.max(seconds, 0.1).toFixed(1)}s` : `${Math.round(seconds)}s`;
  const shown = active && !steps.length ? ['Waiting for the server to start'] : steps;
  const trace = (
    <div data-thinking={active ? 'active' : 'done'} className="text-left">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(value => !value)}
        className="group inline-flex items-center gap-1.5 rounded-lg py-1 pr-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <Sparkles aria-hidden="true" className={`h-3.5 w-3.5 text-brand-blue ${active ? 'motion-safe:animate-pulse' : 'opacity-70'}`} />
        {active ? <TextShimmer className="text-xs font-semibold">Thinking</TextShimmer> : <span>Thought for {took}</span>}
        {!active && steps.length > 0 && <span className="font-medium text-slate-400 dark:text-slate-500">· {steps.length} step{steps.length === 1 ? '' : 's'}</span>}
        <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol
            id={listId}
            key="steps"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-1 overflow-hidden"
          >
            {shown.map((step, index) => {
              const running = active && index === shown.length - 1;
              const last = index === shown.length - 1;
              return (
                <motion.li
                  key={`${index}-${step}`}
                  initial={reduce ? false : { opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="relative flex gap-2.5 pb-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400"
                >
                  {/* Icon column centred under the sparkle; a thin line joins each step to the next. */}
                  <span aria-hidden="true" className="relative flex w-3.5 shrink-0 justify-center pt-[3px]">
                    {!last && <span className="absolute left-1/2 top-[19px] -bottom-[3px] w-px -translate-x-1/2 bg-slate-200 dark:bg-slate-700" />}
                    {running
                      ? <span className="relative mt-[2px] flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-brand-blue/50 motion-safe:animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-brand-blue" /></span>
                      : <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:ring-emerald-800"><Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} /></span>}
                  </span>
                  <span className={`min-w-0 ${running ? 'font-medium text-slate-700 dark:text-slate-200' : ''}`}>{step}</span>
                  {running && <span className="sr-only"> (in progress)</span>}
                </motion.li>
              );
            })}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
  // While pending, one polite status names it "Thinking"; opened steps inside it are read as they arrive.
  return active ? <div role="status" aria-label="Thinking">{trace}</div> : trace;
};
