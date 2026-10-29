import { useEffect, useRef } from 'react';
import { isLiveConnected, subscribeLive } from '../services/liveUpdates';
import { clearApiCache } from '../services/api';

/** Silent, serialised refreshes with reconnect fallback; initial UI is owned by callers. */
export function useLiveRefresh(load: () => Promise<unknown>, topics: string[], scope: string) {
  const current = useRef(load);
  useEffect(() => { current.current = load; }, [load]);
  const key = [...topics].sort().join(',');
  useEffect(() => {
    let disposed = false;
    let running = false;
    let dirty = false;
    let last = Date.now();
    const update = async () => {
      dirty = true;
      if (running || disposed || document.visibilityState === 'hidden') return;
      running = true;
      try {
        while (dirty && !disposed) {
          dirty = false;
          last = Date.now();
          // Polling fallback must not keep returning a previously cached snapshot.
          clearApiCache();
          try { await current.current(); } catch { /* Preserve data; retry via fallback. */ }
        }
      } finally { running = false; }
    };
    const unsubscribe = subscribeLive(key.split(','), () => { void update(); });
    const timer = window.setInterval(() => {
      if (dirty || Date.now() - last >= (isLiveConnected() ? 60000 : 5000)) void update();
    }, 1000);
    return () => { disposed = true; unsubscribe(); window.clearInterval(timer); };
  }, [key, scope]);
}
