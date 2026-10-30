import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { getNoticeDetail, type NoticeDetail } from '../services/notificationInbox';
import { attendanceDateTime } from '../utils/attendanceTime';
import { ModalLayer } from './ModalLayer';

const NA = 'Not available';
const when = (value: string | null) => (value ? attendanceDateTime(value) : NA);
const label = (value: string) => value.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{name}</dt>
    <dd className="mt-0.5 break-words whitespace-pre-wrap text-xs font-medium text-slate-800">{children || NA}</dd></div>;
}

/** Read-only view of the class or request a notice refers to. It changes no status and offers no workflow action. */
export function NotificationDetailDialog({ token, noticeId, onClose }: { token: string; noticeId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<NoticeDetail | null>(null);
  const [error, setError] = useState<{ text: string; retry: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const retry = useCallback(() => { setDetail(null); setError(null); setAttempt(n => n + 1); }, []);

  // One request per notice and attempt; closing, switching notices or signing out aborts it so nothing stale renders.
  useEffect(() => {
    const controller = new AbortController();
    getNoticeDetail(token, noticeId, controller.signal).then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch((failure: { response?: { status?: number; data?: { detail?: string } } }) => {
        if (controller.signal.aborted) return;
        const status = failure?.response?.status;
        if (status === 404 || status === 403) setError({ text: failure.response?.data?.detail || (status === 403 ? 'You no longer have access to this item.' : 'This item is no longer available.'), retry: false });
        else setError({ text: 'Could not load this item right now.', retry: true });
      });
    return () => controller.abort();
  }, [token, noticeId, attempt]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('[data-dialog-heading]')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const targets = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [data-dialog-heading]') || []);
      const first = targets[0], last = targets.at(-1);
      if (!dialogRef.current?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [onClose]);

  const title = !detail ? (error ? 'Notification' : 'Opening notification') : detail.kind === 'session' ? (detail.item.is_replacement ? 'Replacement class' : detail.item.status === 'cancelled' ? 'Cancelled class' : 'Class') : label(detail.item.request_type) + ' request';
  return <ModalLayer className="fixed inset-0 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="notice-detail-title" data-notification-detail
      className="uipro-card notification-target relative w-full max-w-lg max-h-[90dvh] flex flex-col gap-4 overflow-hidden bg-white !p-6">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div><h2 id="notice-detail-title" data-dialog-heading tabIndex={-1} className="font-display text-lg font-bold text-slate-900 outline-none">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">Opened from notification · read-only</p></div>
        <button type="button" aria-label="Close details" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {error ? <div role="alert" className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800"><p>{error.text}</p>
          {error.retry && <button type="button" onClick={retry} className="uipro-button uipro-button-secondary"><RefreshCw className="mr-2 h-4 w-4" />Retry</button>}</div>
        : !detail ? <div role="status" aria-label="Loading details" className="space-y-2"><div className="shimmer-placeholder h-4 w-2/3 rounded" /><div className="shimmer-placeholder h-4 w-full rounded" /><div className="shimmer-placeholder h-4 w-1/2 rounded" /></div>
        : detail.kind === 'session' ? <dl className="grid gap-3 sm:grid-cols-2">
          <Row name="Course">{detail.item.course_code} · {detail.item.course_name}</Row>
          <Row name="Group">{detail.item.class_group}</Row>
          <Row name="Status">{label(detail.item.status)}</Row>
          <Row name="Room">{detail.item.room}</Row>
          <Row name="Starts">{when(detail.item.scheduled_start)}</Row>
          <Row name="Ends">{when(detail.item.scheduled_end)}</Row>
          <Row name="Lecturer">{detail.item.lecturer_name}</Row>
          {detail.item.cancelled_at && <Row name="Cancelled">{when(detail.item.cancelled_at)}</Row>}
          {detail.item.cancel_reason && <div className="sm:col-span-2"><Row name="Reason">{detail.item.cancel_reason}</Row></div>}
          {detail.item.replaces && <div className="sm:col-span-2"><Row name="Replaces the class of">{when(detail.item.replaces.scheduled_start)}</Row></div>}
        </dl> : <dl className="grid gap-3 sm:grid-cols-2">
          {detail.item.student_name && <Row name="Student">{detail.item.student_name} · {detail.item.student_code}</Row>}
          <Row name="Course">{detail.item.course_code} · {detail.item.course_name}</Row>
          <Row name="Type">{label(detail.item.request_type)}</Row>
          <Row name="Status">{label(detail.item.status)}</Row>
          <Row name="Submitted">{when(detail.item.created_at)}</Row>
          <Row name="Reviewed">{when(detail.item.reviewed_at)}</Row>
          {detail.item.start_date && <Row name="From">{detail.item.start_date}</Row>}
          {detail.item.end_date && <Row name="To">{detail.item.end_date}</Row>}
          <div className="sm:col-span-2"><Row name="Reason">{detail.item.reason}</Row></div>
          {detail.item.reviewer_note && <div className="sm:col-span-2"><Row name="Reviewer note">{detail.item.reviewer_note}</Row></div>}
          {detail.item.has_proof && <Row name="Supporting file">{detail.item.proof_file_name || 'Attached'}</Row>}
        </dl>}
      </div>
      <footer className="flex shrink-0 justify-end border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="uipro-button uipro-button-secondary">Close</button></footer>
    </section>
  </ModalLayer>;
}
