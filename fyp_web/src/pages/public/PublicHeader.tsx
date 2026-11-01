import { ArrowRight } from 'lucide-react';
import { goTo } from '../../utils/publicRoute';
import { Mark } from './Mark';

/**
 * The public pages' bar: the project logo and name on the left, Open Portal always reachable on the right. Frosted glass: only what is behind the
 * bar is blurred (backdrop-filter); the logo, words and button are drawn on top, sharp. Without backdrop-filter the bar is nearly solid white.
 */
export function PublicHeader({ action = true }: { action?: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/50 bg-white/95 shadow-[0_1px_24px_rgba(15,23,42,0.08)] supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <button type="button" onClick={() => goTo('/')} className="flex min-w-0 items-center gap-2.5 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40">
          <Mark height={38} />
          <span className="min-w-0">
            <span className="block font-display text-sm font-extrabold tracking-wide text-slate-900">USAS</span>
            <span className="block truncate text-[10px] font-semibold text-slate-700">University Smart Attendance System</span>
          </span>
        </button>
        {action && (
          <button type="button" onClick={() => goTo('/portal')} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2">
            Open Portal<ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}
