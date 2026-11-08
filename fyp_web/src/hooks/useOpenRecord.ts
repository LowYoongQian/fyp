import { useCallback, useRef, useState } from 'react';

/**
 * Which record's details are open, for a list that refreshes by itself. The open record follows the list, so an edit shows up without closing
 * it; if it leaves the list (removed, expired, or no longer addressed to this person) the latest copy seen stays on screen and `gone` is true, so the
 * dialog can say so instead of silently showing something that may no longer exist. Closing returns focus to the control that opened it.
 */
export function useOpenRecord<T extends { id: string | number }>(list: readonly T[]) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<T | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const live = openId === null ? undefined : list.find(item => String(item.id) === openId);
  if (live && live !== lastSeen) setLastSeen(live);   // remember the latest copy, so what stays on screen after a removal is what was last true
  const record = live ?? (openId !== null && lastSeen && String(lastSeen.id) === openId ? lastSeen : null);
  const show = useCallback((item: T, from: HTMLElement) => { opener.current = from; setLastSeen(item); setOpenId(String(item.id)); }, []);
  const close = useCallback((returnFocus = true) => {
    setOpenId(null);
    if (returnFocus) window.requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus(); });   // not when another form takes over
  }, []);
  return { record, gone: record !== null && live === undefined, show, close };
}
