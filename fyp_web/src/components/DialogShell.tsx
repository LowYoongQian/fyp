import { useCallback, type KeyboardEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ModalLayer } from './ModalLayer';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one frame for a details dialog: a dimmed backdrop and a card that rises in on a soft spring (shown at once with reduced motion).
 * Focus starts inside and Tab or Shift+Tab stay inside; Escape or a click outside leaves. A picture viewer opened from inside handles its own
 * keys, so Escape closes only that. Render it inside AnimatePresence to get the exit animation.
 */
export function DialogShell({ labelledBy, onClose, widthClass = 'max-w-lg', children }: { labelledBy: string; onClose: () => void; widthClass?: string; children: ReactNode }) {
  const reduce = !!useReducedMotion();
  const focusOnMount = useCallback((node: HTMLDivElement | null) => node?.focus(), []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.target as Node)) return;   // the image viewer is a React child but its own dialog
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(item => item.getClientRects().length);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1], active = document.activeElement;
    if (event.shiftKey && (active === first || active === event.currentTarget)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  };
  return (
    // The page has a global fade for every modal (index.css, ui-dialog-in); this frame animates itself, so it opts out of that one.
    <ModalLayer className="fixed inset-0 flex items-center justify-center p-4" style={{ animation: 'none' }}>
      <motion.div aria-hidden="true" className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }} />
      <motion.div role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={focusOnMount} onKeyDown={onKeyDown} style={{ animation: 'none' }}
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        transition={reduce ? { duration: 0 } : { opacity: { duration: 0.18, ease: 'easeOut' }, default: { type: 'spring', stiffness: 380, damping: 32 } }}
        className={`relative flex max-h-[92vh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none dark:border-slate-800 dark:bg-slate-900`}>
        {children}
      </motion.div>
    </ModalLayer>
  );
}

/** A section of a dialog that fades and slides in a moment after the one before it. */
export function Reveal({ index = 0, className, children }: { index?: number; className?: string; children: ReactNode }) {
  const reduce = !!useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.08 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
