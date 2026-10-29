import { api } from './api';

export interface InboxNotice {
  id: string; kind: string; title: string; body: string; target_tab: string;
  is_read: boolean; created_at: string; payload: Record<string, unknown>;
}
export interface InboxCursor { before: string; before_id: string }
export interface NotificationInbox {
  items: InboxNotice[]; unread_count: number; by_tab: Record<string, number>;
  snapshot_at: string; next_cursor: InboxCursor | null;
}
export type InboxRead = { ids: string[] } | { tab: string; through: string };

export async function getNotificationInbox(token: string, signal?: AbortSignal, cursor?: InboxCursor) {
  const response = await api.get<NotificationInbox>('/notifications/inbox', {
    headers: { Authorization: `Bearer ${token}` }, signal, params: cursor, timeout: 12000,
  });
  if (!Array.isArray(response.data.items) || typeof response.data.unread_count !== 'number') {
    throw new Error('Notification status could not be read. Please retry.');
  }
  return response.data;
}
export async function readNotificationInbox(token: string, body: InboxRead) {
  await api.patch('/notifications/read', body, { headers: { Authorization: `Bearer ${token}` }, timeout: 12000 });
}
