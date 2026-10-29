import { useCallback, useRef, useState } from 'react';
import { useLiveResource } from './useLiveResource';
import { getNotificationInbox, readNotificationInbox, type InboxNotice, type InboxRead } from '../services/notificationInbox';
import { apiErrorMessage } from '../utils/apiError';

/** One source for the bell/sidebar; writes are ordered and never delay navigation. */
export function useNotificationInbox(userId: string, token: string) {
  const writes = useRef<Promise<void>>(Promise.resolve());
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
  const scope = `${userId}:${token}`;
  const load = useCallback(async (signal: AbortSignal) => {
    // A background GET must not resurrect badges while a read save is pending.
    await writes.current;
    return getNotificationInbox(token, signal);
  }, [token]);
  const resource = useLiveResource(load, `inbox:${scope}`, ['notifications', 'notices', 'account']);
  const markRead = (body: InboxRead, counts: Record<string, number>, ids: Set<string> = new Set()) => {
    const through = 'through' in body ? body.through : null;
    resource.setData(previous => {
      if (!previous) throw new Error('Load the notification inbox before marking it read.');
      const byTab = { ...previous.by_tab };
      let removed = 0;
      for (const [tab, count] of Object.entries(counts)) {
        const acknowledged = Math.min(byTab[tab] || 0, count);
        removed += acknowledged;
        byTab[tab] = Math.max(0, (byTab[tab] || 0) - acknowledged);
      }
      return { ...previous, by_tab: byTab, unread_count: Math.max(0, previous.unread_count - removed),
        items: previous.items.map(item => ids.has(item.id) || ('tab' in body && item.target_tab === body.tab && Date.parse(item.created_at) <= Date.parse(through!))
          ? { ...item, is_read: true } : item) };
    });
    setFailure(null);
    const task = writes.current.then(async () => {
      if (sessionStorage.getItem('auth_token') !== token) return;
      try { await readNotificationInbox(token, body); }
      catch (error) { setFailure({ scope, message: apiErrorMessage(error, 'Could not save read status. Refresh and retry.') }); }
    });
    writes.current = task.catch(() => {});
    void task.finally(() => { void resource.refresh(); }).catch(() => {});
  };
  const readShown = (items: InboxNotice[]) => {
    if (!resource.data) return;
    const unread = items.filter(item => !item.is_read);
    if (!unread.length) return;
    const counts: Record<string, number> = {};
    for (const item of unread) counts[item.target_tab] = (counts[item.target_tab] || 0) + 1;
    markRead({ ids: unread.map(item => item.id) }, counts, new Set(unread.map(item => item.id)));
  };
  const readTab = (tab: string) => {
    if (tab === 'admin_reports') tab = 'admin_reports_feedback';
    const inbox = resource.data;
    if (!inbox || !(inbox.by_tab[tab] > 0)) return;
    markRead({ tab, through: inbox.snapshot_at }, { [tab]: inbox.by_tab[tab] });
  };
  return { ...resource, readShown, readTab, token,
    error: failure?.scope === scope ? failure.message : resource.error };
}
