import type { ElementType, ReactNode } from 'react';

/**
 * One clearly grouped "nothing here yet" panel (STUDENT-EMPTY-11): a quiet icon, a short title and one helpful sentence, with an optional
 * action. It replaces small grey text inside large empty chart boxes. Use it only for a real empty result, never for a failed load.
 */
export function EmptyState({ icon: Icon, title, text, action, tone = 'neutral', className = '' }: {
  icon: ElementType; title: string; text: string; action?: ReactNode; tone?: 'neutral' | 'warning'; className?: string;
}) {
  const look = tone === 'warning'
    ? 'border-amber-200 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/10'
    : 'border-slate-200 bg-slate-50/80 dark:border-slate-700/70 dark:bg-slate-800/40';
  const tile = tone === 'warning'
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
    : 'bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20';
  return (
    <div data-empty-state className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center ${look} ${className}`}>
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tile}`}><Icon aria-hidden="true" className="h-5 w-5" /></span>
      <div className="max-w-sm space-y-1">
        <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{title}</h4>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
      </div>
      {action}
    </div>
  );
}
