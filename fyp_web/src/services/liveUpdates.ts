import { api, clearApiCache } from './api';

type Listener = { topics: Set<string>; update: () => void };
const listeners = new Set<Listener>();
let connected = false;
export const isLiveConnected = () => connected;
export function subscribeLive(topics: string[], update: () => void) {
  const listener = { topics: new Set(topics), update };
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** One authenticated socket per tab; messages are invalidations, never records. */
export function startLiveUpdates(token: string) {
  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let batch: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let delay = 500;
  const pending = new Set<string>();
  const connect = () => {
    if (stopped || document.visibilityState === 'hidden') return;
    const url = new URL(`${String(api.defaults.baseURL).replace(/\/$/, '')}/live`, window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(url);
    const current = socket;
    current.onopen = () => {
      current.send(JSON.stringify({ token }));
      watchdog = setTimeout(() => current.close(), 45000);
    };
    current.onmessage = event => {
      if (socket !== current || stopped) return;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => current.close(), 45000);
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type !== 'ready' && message.type !== 'invalidate') return;
      connected = true;
      delay = 500;
      for (const topic of message.topics || []) pending.add(topic);
      if (batch) return;
      batch = setTimeout(() => {
        batch = undefined;
        clearApiCache();
        for (const listener of listeners) {
          if ([...listener.topics].some(topic => pending.has(topic))) listener.update();
        }
        pending.clear();
      }, 80);
    };
    current.onerror = () => current.close();
    current.onclose = () => {
      if (socket !== current) return;
      connected = false;
      clearTimeout(watchdog);
      if (!stopped && document.visibilityState !== 'hidden') {
        retry = setTimeout(connect, delay);
        delay = Math.min(30000, delay * 2);
      }
    };
  };
  const visibility = () => {
    clearTimeout(retry);
    socket?.close();
    socket = undefined;
    connected = false;
    if (document.visibilityState === 'visible') connect();
  };
  document.addEventListener('visibilitychange', visibility);
  connect();
  return () => {
    stopped = true;
    connected = false;
    clearTimeout(retry);
    clearTimeout(batch);
    clearTimeout(watchdog);
    pending.clear();
    document.removeEventListener('visibilitychange', visibility);
    socket?.close();
    socket = undefined;
  };
}
