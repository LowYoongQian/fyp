import { useEffect, useRef, useState } from 'react';
import { apiService, type RecordKind, type RecordPage } from '../services/api';

const DEBOUNCE_MS = 250;

/**
 * One page of an Academic Manager record list from the server (ACADEMIC-UX-12). A new search waits a moment; a newer request cancels the
 * older one and a late answer is ignored. A quiet refresh (a new `version`) keeps the current rows on screen until the new page arrives.
 */
export function useRecordPage<T>(kind: RecordKind, search: string, page: number, perPage: number, version: number) {
  const [data, setData] = useState<RecordPage<T> | null>(null);
  const [asked, setAsked] = useState(0);   // the page `data` answers (the server may have shown another, e.g. the last page)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const run = useRef(0);
  const [retries, setRetries] = useState(0);
  const lastSearch = useRef(search);

  useEffect(() => {
    const id = ++run.current;
    const controller = new AbortController();
    const typing = lastSearch.current !== search;
    lastSearch.current = search;
    const timer = window.setTimeout(async () => {
      setStatus('loading');
      try {
        const next = await apiService.adminRecords<T>(kind, { search: search.trim() || undefined, page, per_page: perPage }, controller.signal);
        if (id !== run.current) return;
        // An answer of the wrong shape (an old server, a proxy page) is a failure to show, never something to draw.
        if (!next || !Array.isArray(next.items) || typeof next.total !== 'number') throw new Error('Unexpected record page');
        setData(next);
        setAsked(page);
        setStatus('ready');
      } catch {
        if (id === run.current && !controller.signal.aborted) setStatus('error');
      }
    }, typing ? DEBOUNCE_MS : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [kind, search, page, perPage, version, retries]);

  return { data, asked, status, retry: () => setRetries(count => count + 1) };
}
