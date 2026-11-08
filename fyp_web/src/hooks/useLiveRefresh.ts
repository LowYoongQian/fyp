import { useEffect, useRef } from 'react';
import { isLiveConnected, subscribeLive, type LiveEvent, type LiveKind } from '../services/liveUpdates';
import { clearApiCache } from '../services/api';

const RANK: Record<LiveKind, number> = { poll: 0, resume: 1, change: 2 };
/** A resume or poll right after a load adds nothing (the first `ready` of a new socket, a quick hide and show): it is skipped. */
const QUIET_GAP_MS = 3000;

/**
 * Silent, serialised refreshes with reconnect fallback; initial UI is owned by callers. `load` is told why it runs: only a `change` is a known
 * change, while `resume` and `poll` are quiet revalidations that must not look like one. A real change is always followed up.
 */
export function useLiveRefresh(load: (event: LiveEvent) => Promise<unknown>, topics: string[], scope: string) {
  const current = useRef(load);
  useEffect(() => { current.current = load; }, [load]);
  const key = [...topics].sort().join(',');
  useEffect(() => {
    let disposed = false;
    let running = false;
    let dirty: LiveEvent | null = null;   // what waits to run (hidden tab, or a load in flight); the strongest reason wins
    let last = Date.now();
    const update = async (event: LiveEvent) => {
      if (disposed || (event.kind !== 'change' && !dirty && Date.now() - last < QUIET_GAP_MS)) return;
      dirty = dirty ? { kind: RANK[dirty.kind] >= RANK[event.kind] ? dirty.kind : event.kind, topics: [...new Set([...dirty.topics, ...event.topics])] } : event;
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        while (dirty && !disposed) {
          const next: LiveEvent = dirty;
          dirty = null;
          last = Date.now();
          // Polling fallback must not keep returning a previously cached snapshot.
          clearApiCache();
          try { await current.current(next); } catch { /* Preserve data; retry via fallback. */ }
        }
      } finally { running = false; }
    };
    const unsubscribe = subscribeLive(key.split(','), event => { void update(event); });
    const timer = window.setInterval(() => {
      if (dirty || Date.now() - last >= (isLiveConnected() ? 60000 : 5000)) void update(dirty ?? { kind: 'poll', topics: [] });
    }, 1000);
    return () => { disposed = true; unsubscribe(); window.clearInterval(timer); };
  }, [key, scope]);
}
