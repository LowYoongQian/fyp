import { AlertCircle } from 'lucide-react';
import { ShimmerCircle, ShimmerText } from './Shimmer';

export function RecordsStatus({ loading, error, retry, layout = 'cards' }: { loading: boolean; error: string; retry: () => void; layout?: 'table' | 'cards' }) {
  if (!loading && !error) return null;
  if (loading && !error) return <div role="status" aria-label="Loading records" aria-busy="true">
    <div aria-hidden="true" className={layout === 'table' ? 'overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900' : 'space-y-4'}>
      {layout === 'table' && <div className="hidden grid-cols-6 gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:grid dark:border-slate-800 dark:bg-slate-800/50">
        {Array.from({ length: 6 }, (_, index) => <ShimmerText key={index} width="w-20" height="h-3" />)}
      </div>}
      {Array.from({ length: 3 }, (_, index) => layout === 'table'
        ? <div key={index} className="grid grid-cols-2 gap-4 border-b border-slate-100 p-4 last:border-0 sm:grid-cols-6 dark:border-slate-800">
          {Array.from({ length: 6 }, (_, cell) => <div key={cell} className="min-w-0 space-y-2">
            <ShimmerText width="w-4/5" height="h-3.5" /><ShimmerText width="w-1/2" height="h-2.5" />
          </div>)}
        </div>
        : <div key={index} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-3"><ShimmerCircle size="w-10 h-10 shrink-0" /><div className="min-w-0 flex-1 space-y-2"><ShimmerText width="w-1/2" height="h-4" /><ShimmerText width="w-1/3" height="h-2.5" /></div><ShimmerText width="w-16" height="h-6" className="rounded-full" /></div>
          <ShimmerText width="w-4/5" height="h-3" />
          <div className="flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800"><ShimmerText width="w-24" height="h-3" /><ShimmerText width="w-20" height="h-6" className="rounded-lg" /></div>
        </div>)}
    </div>
  </div>;
  return <div role="alert" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
    <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
    <span className="flex-1">{error}</span>
    <button type="button" onClick={retry} className="rounded-lg px-3 py-2 font-semibold text-brand-blue hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950">Retry</button>
  </div>;
}
