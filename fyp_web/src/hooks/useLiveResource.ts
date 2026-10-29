import { useCallback, useEffect, useRef, useState } from 'react';
import { apiErrorMessage } from '../utils/apiError';
import { isLiveConnected, subscribeLive } from '../services/liveUpdates';

/** Fresh authenticated reads; background refresh never hides the last good data. */
export function useLiveResource<T>(load: (signal: AbortSignal) => Promise<T>, scope: string, topics: string[] = []) {
  const topicKey = [...topics].sort().join(',');
  const [state, setState] = useState<{ scope: string; data?: T; loading: boolean; error: string }>({ scope, loading: true, error: '' });
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const activeScope = useRef<string | null>(null);
  const invalidate = useCallback(() => { generation.current++; }, []);

  const refresh = useCallback(async () => {
    if (activeScope.current !== scope) return;
    const version = ++generation.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setState(previous => previous.scope === scope
      ? { ...previous, loading: previous.data === undefined, error: previous.data === undefined ? '' : previous.error }
      : { scope, loading: true, error: '' });
    try {
      const data = await load(controller.signal);
      if (version === generation.current) setState({ scope, data, loading: false, error: '' });
    } catch (error) {
      if (!controller.signal.aborted && version === generation.current) {
        setState(previous => ({ ...previous, loading: false, error: apiErrorMessage(error, 'Unable to refresh records. Please try again.') }));
      }
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, [load, scope]);

  useEffect(() => {
    activeScope.current = scope;
    void refresh();
    let dirty = false;
    let lastRefresh = Date.now();
    const updateFromEvent = () => {
      dirty = true;
      update();
    };
    const update = () => {
      if (document.visibilityState === 'visible' && !pending.current) {
        dirty = false;
        lastRefresh = Date.now();
        void refresh();
      }
    };
    const unsubscribe = subscribeLive(topicKey.split(',').filter(Boolean), updateFromEvent);
    // A queued event during a slow GET must be replayed, not discarded.
    const timer = window.setInterval(() => {
      const interval = isLiveConnected() && topicKey ? 60000 : 5000;
      if (dirty || Date.now() - lastRefresh >= interval) update();
    }, 250);
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      activeScope.current = null;
      invalidate();
      pending.current?.abort();
      pending.current = null;
      window.clearInterval(timer);
      unsubscribe();
      window.removeEventListener('focus', update);
      window.removeEventListener('online', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh, scope, invalidate, topicKey]);

  const setData = useCallback((update: (previous: T | undefined) => T) => {
    if (activeScope.current !== scope) return;
    // A GET started before a confirmed save must not overwrite the new record.
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    setState(previous => ({ scope, data: update(previous.scope === scope ? previous.data : undefined), loading: false, error: '' }));
  }, [scope]);

  return { data: state.scope === scope ? state.data : undefined,
    loading: state.scope !== scope || state.loading,
    error: state.scope === scope ? state.error : '', refresh, setData };
}
