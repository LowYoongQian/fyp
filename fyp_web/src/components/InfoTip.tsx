import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';

/**
 * A small (i) beside a label that shows its details in a bubble: on hover, on keyboard focus, or on a tap (touch screens). The bubble is
 * drawn above everything (it is not clipped by a card or a dialog) and stays while the pointer moves onto it, so it can be read; Escape
 * or a click elsewhere closes it. Screen readers get the details as the button's description.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const closing = useRef<number>(undefined);
  const show = () => { window.clearTimeout(closing.current); setOpen(true); };
  // A short delay lets the pointer cross the gap from the (i) to the bubble without it vanishing.
  const hide = () => { window.clearTimeout(closing.current); closing.current = window.setTimeout(() => setOpen(false), 140); };
  useEffect(() => () => window.clearTimeout(closing.current), []);
  return (
    <span className="relative inline-flex align-middle" onMouseEnter={show} onMouseLeave={hide}>
      <button type="button" aria-label={label} aria-describedby={open ? id : undefined} aria-expanded={open}
        onFocus={show} onBlur={hide} onClick={() => setOpen(current => !current)}
        onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); } }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-brand-blue focus:outline-none focus-visible:text-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/40 dark:text-slate-500 dark:hover:text-blue-400">
        <Info aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {open && (
        <FloatingPanel id={id} role="tooltip" animateEntrance={false} onDismiss={() => setOpen(false)} onMouseEnter={show} onMouseLeave={hide}
          className="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-normal leading-relaxed text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {children}
        </FloatingPanel>
      )}
    </span>
  );
}
