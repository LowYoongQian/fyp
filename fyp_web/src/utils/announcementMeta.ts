import type { Announcement } from '../services/api';

export type NoticeState = 'draft' | 'scheduled' | 'live' | 'expired';

/** Where a notice stands right now. Students and staff are only ever sent live ones; an administrator sees all four. */
export function noticeState(notice: Pick<Announcement, 'is_draft' | 'publish_start' | 'publish_end'>, now = Date.now()): NoticeState {
  if (notice.is_draft) return 'draft';
  if (notice.publish_start && new Date(notice.publish_start).getTime() > now) return 'scheduled';
  if (notice.publish_end && new Date(notice.publish_end).getTime() <= now) return 'expired';
  return 'live';
}

type Audience = Pick<Announcement, 'target_role' | 'target_scope' | 'target_programme_code' | 'target_course_code' | 'target_group'>;

/** Who a notice is for, in words: "Students · CS101 · Group G1", "Staff · All", "Everyone · BSE". */
export function audienceLabel(notice: Audience): string {
  const who = notice.target_role === 'students' ? 'Students' : notice.target_role === 'staff' ? 'Staff' : 'Everyone';
  if (notice.target_scope === 'programme') return `${who} · ${notice.target_programme_code || '—'}`;
  if (notice.target_scope === 'course') {
    const group = !notice.target_group || notice.target_group.toLowerCase() === 'all' ? 'All groups' : notice.target_group;
    return `${who} · ${notice.target_course_code || '—'} · ${group}`;
  }
  return `${who} · All`;
}

/** "340 KB", "1.2 MB": a size a person can read at a glance. */
export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
/** "3 days ago", "yesterday", "in 2 hours". Under a minute is "just now"; an unreadable date is an empty string. */
export function relativeTime(value: string | Date | null | undefined, now = Date.now()): string {
  const time = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time)) return '';
  const seconds = Math.round((time - now) / 1000);
  if (Math.abs(seconds) < 60) return 'just now';
  const [unit, size] = STEPS.find(([, size]) => Math.abs(seconds) >= size) ?? STEPS[STEPS.length - 1];
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.trunc(seconds / size), unit);
}

/** A web address that is safe to put in a link, or null. Only http and https are ever linked; "javascript:" and the rest never are. */
export function safeHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

export type TextPart = { type: 'text' | 'link'; value: string };
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING = /[.,;:!?)\]}]+$/;
/** Cuts a message into plain text and web links, so a pasted address can be opened without ever being trusted as markup. */
export function linkifyParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trimmed = raw.replace(TRAILING, '');
    if (!safeHttpUrl(trimmed)) continue;
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) });
    parts.push({ type: 'link', value: trimmed });
    last = start + trimmed.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

/** Only a real image data address is drawn; anything else stored in the picture field is ignored. */
export const noticeImage = (value?: string | null): string | null => (typeof value === 'string' && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value) ? value : null);

/** "Nov 2, 2026, 07:44 PM GMT+8": the same date, time and zone the tickets use. An unreadable date is a dash. */
export function formatNoticeTime(value?: string | null): string {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' });
}
