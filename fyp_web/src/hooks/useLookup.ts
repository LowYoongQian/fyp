import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService, type LookupKind } from '../services/api';

const PAGE = 20;
const DEBOUNCE_MS = 250;

/**
 * Server-side search for one open picker (ACADEMIC-SEARCH-11): typing waits a moment, then asks for one small page; a newer question cancels
 * the older one, and an answer that arrives late is ignored, so the list always matches what is typed. Load more asks for the next page.
 * Use it in a picker that mounts when it opens: closing unmounts it, which cancels any request still on its way, and nothing is
 * cached between openings, so another account, programme or student never sees an old list.
 */
export function useLookup<T>(kind: LookupKind, params: Record<string, string | undefined>) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const run = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const key = JSON.stringify(params);

  const fetchPage = useCallback(async (skip: number) => {
    const id = ++run.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStatus('loading');
    try {
      const page = await apiService.adminLookup<T>(kind, { ...JSON.parse(key), search: query.trim() || undefined, skip, limit: PAGE }, controller.signal);
      if (id !== run.current) return;   // a newer search has started: this answer is out of date
      setItems(previous => (skip ? [...previous, ...page.items] : page.items));
      setHasMore(page.has_more);
      setStatus('ready');
    } catch {
      if (id === run.current && !controller.signal.aborted) setStatus('error');
    }
  }, [kind, key, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchPage(0); }, query ? DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [fetchPage, query]);

  useEffect(() => () => { run.current += 1; abort.current?.abort(); }, []);   // a closed (unmounted) picker stops its request


  return { query, setQuery, items, hasMore, status, loadMore: () => fetchPage(items.length), retry: () => fetchPage(0) };
}
