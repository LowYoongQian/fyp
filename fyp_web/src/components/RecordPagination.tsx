import { ChevronLeft, ChevronRight } from 'lucide-react';

export function RecordPagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav aria-label="Record pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
    <span>{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total} records</span>
    <div className="flex items-center gap-3">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-xl border border-slate-200 p-2 hover:bg-blue-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
      <span>Page {page} of {pages}</span>
      <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-xl border border-slate-200 p-2 hover:bg-blue-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
    </div>
  </nav>;
}
