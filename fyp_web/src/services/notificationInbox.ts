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

export interface NoticeSessionDetail {
  id: string; course_code: string; course_name: string; class_group: string | null; status: string; room: string | null;
  scheduled_start: string | null; scheduled_end: string | null; opened_at: string | null; closed_at: string | null;
  cancelled_at: string | null; cancel_reason: string | null; is_replacement: boolean; lecturer_name: string | null;
  replaces: { scheduled_start: string | null; scheduled_end: string | null; status: string } | null;
}
export interface NoticeRequestDetail {
  id: string; request_type: string; status: string; course_code: string; course_name: string; student_name: string | null;
  student_code: string | null; reason: string; reviewer_note: string | null; created_at: string | null; reviewed_at: string | null;
  session_id: string | null; start_date: string | null; end_date: string | null; has_proof: boolean; proof_file_name: string | null;
}
export type NoticeDetail = { kind: 'session'; item: NoticeSessionDetail } | { kind: 'request'; item: NoticeRequestDetail };

/** Read-only detail of the record a notice refers to; the server rechecks the caller's current access. */
export async function getNoticeDetail(token: string, noticeId: string, signal?: AbortSignal) {
  return (await api.get<NoticeDetail>(`/notifications/${encodeURIComponent(noticeId)}/detail`, {
    headers: { Authorization: `Bearer ${token}` }, signal, timeout: 12000,
  })).data;
}
