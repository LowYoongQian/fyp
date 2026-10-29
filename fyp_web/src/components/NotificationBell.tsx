import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { getNotificationInbox, type NotificationInbox } from '../services/notificationInbox';
import type { useNotificationInbox } from '../hooks/useNotificationInbox';
import { apiErrorMessage } from '../utils/apiError';

type Inbox = ReturnType<typeof useNotificationInbox>;

export function UnreadIndicator({ show, collapsed = false }: { show: boolean; collapsed?: boolean }) {
  return show ? <span aria-hidden="true" data-unread-indicator className={`notification-nav-dot ${collapsed ? 'notification-nav-dot-collapsed' : ''}`} /> : null;
}

export function NotificationBell({ inbox, navigate, labels }: {
  inbox: Inbox; navigate: (tab: string) => void; labels: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [older, setOlder] = useState<NotificationInbox | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState('');
  const seen = useRef(new Set<string>());
  const olderRequest = useRef<AbortController | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const bellButton = useRef<HTMLButtonElement>(null);
  const shown = older || inbox.data;
  const { readShown } = inbox;
  const items = shown?.items;
  const unread = inbox.data?.unread_count || 0;
  useEffect(() => () => olderRequest.current?.abort(), []);
  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open || !items) return;
    const unseen = items.filter(item => !item.is_read && !seen.current.has(item.id));
    for (const item of unseen) seen.current.add(item.id);
    if (unseen.length) readShown(unseen);
  }, [open, items, readShown]);
  const close = () => {
    setOpen(false); setOlder(null); setOlderError(''); seen.current.clear();
    olderRequest.current?.abort(); setLoadingOlder(false);
    bellButton.current?.focus();
  };
  const loadOlder = async () => {
    if (!shown?.next_cursor || loadingOlder) return;
    olderRequest.current?.abort();
    const controller = new AbortController();
    olderRequest.current = controller;
    setLoadingOlder(true); setOlderError('');
    try {
      const page = await getNotificationInbox(inbox.token, controller.signal, shown.next_cursor);
      if (!controller.signal.aborted) setOlder(page);
    } catch (error) {
      if (!controller.signal.aborted) setOlderError(apiErrorMessage(error, 'Could not load older notices. Please retry.'));
    } finally { if (!controller.signal.aborted) setLoadingOlder(false); }
  };
  return <div className="relative shrink-0">
    <button ref={bellButton} type="button" className="notification-bell" data-notification-bell
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { if (open) close(); else { setOpen(true); void inbox.refresh(); } }}>
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unread > 0 && <span aria-hidden="true" data-notification-count className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      {inbox.error && <span className="sr-only">Notification status needs attention</span>}
    </button>
    {open && <FloatingPanel role="dialog" aria-label="Notifications" onDismiss={close} className="notification-panel right-0 w-[24rem]">
      <header className="notification-panel-header">
        <div><h2 className="font-display text-sm font-bold">Notifications</h2>
          <p className="text-[11px] mt-1 opacity-70">{!inbox.data ? inbox.loading ? 'Loading updates…' : 'Notification status unavailable'
            : unread ? `${unread} unread updates` : 'You’re all caught up'}</p></div>
        <button ref={closeButton} type="button" className="notification-icon-button" aria-label="Close notifications" onClick={close}><X className="h-4 w-4" /></button>
      </header>
      <div className="notification-panel-toolbar">
        <span className="text-[11px] opacity-70">Opening notices marks them as read</span>
        <button type="button" className="notification-icon-button" aria-label="Refresh notifications" onClick={() => { seen.current.clear(); setOlder(null); void inbox.refresh(); }}><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>
      {(inbox.error || olderError) && <div role="alert" className="notification-error">
        <p>{olderError || inbox.error}</p>
        <button type="button" onClick={() => { seen.current.clear(); if (olderError) void loadOlder(); else void inbox.refresh(); }} className="mt-2 font-semibold underline">Retry notifications</button>
      </div>}
      {inbox.loading && !items ? <div role="status" aria-label="Loading notifications" className="p-4 space-y-4">
        {[0, 1, 2].map(index => <div key={index} className="space-y-2"><div className="shimmer-placeholder h-3 w-2/3 rounded" /><div className="shimmer-placeholder h-2.5 w-full rounded" /></div>)}
      </div> : items?.length ? <ul className="notification-list">
        {items.map(item => <li key={item.id}><button type="button" className="notification-item" onClick={() => { if (labels[item.target_tab]) navigate(item.target_tab); close(); }}>
          <span className="notification-item-icon"><Bell className="h-4 w-4" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold leading-relaxed break-words">{item.title}</span>
            <span className="block text-[11px] leading-relaxed opacity-75 break-words mt-1">{item.body}</span>
            <span className="block text-[10px] opacity-60 mt-2">{labels[item.target_tab] || 'Dashboard'} · {new Date(item.created_at).toLocaleString()}</span></span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
        </button></li>)}
      </ul> : !inbox.error && <div className="notification-empty"><CheckCheck className="h-8 w-8 opacity-50 mx-auto mb-3" /><p className="text-xs font-semibold">No notifications yet</p><p className="text-[11px] opacity-70 mt-1">Your account updates will appear here.</p></div>}
      <footer className="notification-panel-footer">
        {older ? <button type="button" className="notification-text-button" onClick={() => { olderRequest.current?.abort(); setLoadingOlder(false); setOlder(null); setOlderError(''); }}><ChevronLeft className="h-3.5 w-3.5" /> Latest notices</button> : <span className="text-[10px] opacity-60">Only notices for your account</span>}
        {shown?.next_cursor && <button type="button" disabled={loadingOlder} className="notification-text-button" onClick={() => void loadOlder()}>{loadingOlder ? 'Loading…' : 'Older notices'}<ChevronRight className="h-3.5 w-3.5" /></button>}
      </footer>
    </FloatingPanel>}
  </div>;
}
