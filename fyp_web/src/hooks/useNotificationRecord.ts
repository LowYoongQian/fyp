import { useEffect, useState } from 'react';
import { useNotificationTarget } from '../context/NotificationTargetContext';
import { revealNotificationRecord, type NotificationTarget } from '../utils/notificationTarget';

/**
 * Open the exact record a notice points to on a server-paged list page:
 * 1. ask the server which page holds the record (scoped to this account, no scanning of visible rows),
 * 2. let the page clear its filters and jump to that page,
 * 3. once the row (marked data-notice-record="<id>") is rendered, scroll to it, focus it and outline it.
 * A record that does not exist, or that this account may not see, resolves to "missing"; a failed request to "error".
 */
export function useNotificationRecord({ tab, kinds, locate, apply, ready, dataVersion }: {
  tab: string;
  kinds: NotificationTarget['kind'][];
  locate: (id: string, signal: AbortSignal) => Promise<{ found: boolean; page: number }>;
  apply: (page: number) => void;
  ready: boolean;
  dataVersion: unknown;
}) {
  const { pending, resolve } = useNotificationTarget(tab);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);

  useEffect(() => {
    if (!pending || !kinds.includes(pending.target.kind)) return;
    const { id } = pending.target as { id: string };
    const { nonce } = pending;
    const controller = new AbortController();
    void locate(id, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (!result.found) return resolve?.(nonce, 'missing');
      apply(result.page);
      setFocus({ id, nonce });
    }).catch(() => { if (!controller.signal.aborted) resolve?.(nonce, 'error'); });
    return () => controller.abort();
  // The locate/apply closures are recreated every render; a new pending notice is the only trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.nonce]);

  useRevealWhenReady(focus, setFocus, ready, dataVersion, resolve);
}

/** Reveal the focused row once it is rendered; give up honestly if it never appears. */
function useRevealWhenReady(focus: { id: string; nonce: number } | null, setFocus: (value: null) => void, ready: boolean, dataVersion: unknown,
  resolve: ((nonce: number, status: 'opened' | 'missing') => void) | undefined) {
  useEffect(() => {
    if (!focus || !ready) return;
    if (revealNotificationRecord(`[data-notice-record="${focus.id}"]`)) { resolve?.(focus.nonce, 'opened'); setFocus(null); return; }
    // The page may still be swapping in the located page; give up honestly rather than waiting forever.
    const timer = window.setTimeout(() => { resolve?.(focus.nonce, 'missing'); setFocus(null); }, 8000);
    return () => window.clearTimeout(timer);
  }, [focus, ready, dataVersion, resolve, setFocus]);
}

/**
 * Same outcome for pages that already hold the complete list in memory (announcements): the record must be in that list,
 * the page may first reveal it (`prepare`, e.g. expand a collapsed list), then it is outlined. Not in the list = missing.
 */
export function useNotificationListRecord({ tab, kinds, ids, prepare, ready, dataVersion }: {
  tab: string; kinds: NotificationTarget['kind'][]; ids: string[]; prepare?: (id: string) => void; ready: boolean; dataVersion: unknown;
}) {
  const { pending, resolve } = useNotificationTarget(tab);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);
  useEffect(() => {
    if (!pending || !ready || !kinds.includes(pending.target.kind)) return;
    const { id } = pending.target as { id: string };
    if (!ids.includes(id)) return resolve?.(pending.nonce, 'missing');
    prepare?.(id);
    const nonce = pending.nonce;
    queueMicrotask(() => setFocus({ id, nonce }));
  // Re-evaluated when the list arrives (ready) or a new notice is pending; closures change every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.nonce, ready]);
  useRevealWhenReady(focus, setFocus, ready, dataVersion, resolve);
}
