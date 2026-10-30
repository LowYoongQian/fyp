/** Typed, internal destination of a notice. Built only from the notice's own opaque IDs, never from a URL. */
export type NotificationTarget =
  | { kind: 'class'; classId: string; courseId?: string }
  | { kind: 'request'; id: string }
  | { kind: 'feedback'; id: string }
  | { kind: 'attendance_record'; id: string }
  | { kind: 'meeting'; id: string }
  | { kind: 'session'; id: string }
  | { kind: 'announcement'; id: string }
  | { kind: 'none'; reason: 'no-id' | 'not-linkable' };

const id = (value: unknown) => (typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : null);

/**
 * Payload inventory (producer -> fields): class_needs_attention / class_attention_escalated {class_id, course_id};
 * attendance_request, medical_submission, request_decision {request_id} (legacy MC decisions {attendance_record_id});
 * feedback_submission / feedback_response {feedback_id}; class_reminder {meeting_id}; face_registration_reset {student_id}
 * (the student's own account, nothing to open); timetable_change {meeting_id, course_id}; class_cancelled /
 * replacement_class {class_id, course_id}; course_announcement / general_announcement {announcement_id}.
 */
export function notificationTarget(kind: string, payload: Record<string, unknown> | undefined): NotificationTarget {
  const data = payload ?? {};
  switch (kind) {
    case 'class_needs_attention':
    case 'class_attention_escalated': {
      const classId = id(data.class_id);
      return classId ? { kind: 'class', classId, courseId: id(data.course_id) ?? undefined } : { kind: 'none', reason: 'no-id' };
    }
    case 'attendance_request':
    case 'medical_submission':
    case 'request_decision': {
      const requestId = id(data.request_id);
      if (requestId) return { kind: 'request', id: requestId };
      const recordId = id(data.attendance_record_id);
      return recordId ? { kind: 'attendance_record', id: recordId } : { kind: 'none', reason: 'no-id' };
    }
    case 'feedback_submission':
    case 'feedback_response': {
      const feedbackId = id(data.feedback_id);
      return feedbackId ? { kind: 'feedback', id: feedbackId } : { kind: 'none', reason: 'no-id' };
    }
    case 'class_cancelled':
    case 'replacement_class': {
      const sessionId = id(data.class_id);
      return sessionId ? { kind: 'session', id: sessionId } : { kind: 'none', reason: 'no-id' };
    }
    case 'timetable_change':
    case 'class_reminder': {
      const meetingId = id(data.meeting_id);
      return meetingId ? { kind: 'meeting', id: meetingId } : { kind: 'none', reason: 'no-id' };
    }
    case 'course_announcement':
    case 'general_announcement': {
      const announcementId = id(data.announcement_id);
      return announcementId ? { kind: 'announcement', id: announcementId } : { kind: 'none', reason: 'no-id' };
    }
    default:
      return { kind: 'none', reason: 'not-linkable' };
  }
}

/** Destinations (tab -> target kinds) that can open the exact record today. Everything else gets an honest banner. */
export const EXACT_TARGETS: Record<string, NotificationTarget['kind'][]> = {
  admin_attendance: ['class'],
  admin_reports_feedback: ['feedback'],
  admin_reports_mc: ['request', 'attendance_record'],
  admin_announcements: ['announcement'],
  admin_timetable: ['meeting'],
  student_contact: ['feedback'],
  student_mc: ['request'],
  student_dashboard: ['announcement'],
  student_timetable: ['meeting'],
  dashboard: ['announcement'],
  timetable: ['meeting'],
  course_announcements: ['announcement'],
};

/** A reminder about a meeting belongs to the timetable, where that slot is shown; every other notice keeps its tab. */
export function destinationTab(kind: string, tab: string, role: string | undefined) {
  if (kind !== 'class_reminder') return tab;
  return role === 'student' ? 'student_timetable' : role === 'lecturer' ? 'timetable' : tab;
}

/**
 * Targets the page has no view of open a read-only detail dialog instead (served by GET /notifications/{id}/detail, which
 * rechecks access): any dated class session, a class under review for staff, and attendance/correction requests.
 */
export function opensDetail(target: NotificationTarget, tab: string, role: string | undefined) {
  if (target.kind === 'session') return true;
  if (target.kind === 'class') return role !== 'admin';
  return target.kind === 'request' && !EXACT_TARGETS[tab]?.includes('request');
}

/** Why a page-only fallback was shown, in words a user can act on. */
export function unsupportedReason(target: NotificationTarget) {
  if (target.kind === 'attendance_record') return 'This older medical-leave notice refers to a record that is no longer listed, so only the page was opened.';
  return 'This notification type opens the page but does not point to a specific item yet.';
}

/** Scroll to, focus and briefly outline a notification target; no looping animation, reduced motion respected. */
export function revealNotificationTarget(element: HTMLElement) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  element.classList.add('notification-target');
  window.setTimeout(() => element.classList.remove('notification-target'), 6000);
}

/** Find the rendered record and reveal it; false until its row exists (data may still be arriving). */
export function revealNotificationRecord(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return false;
  revealNotificationTarget(element);
  return true;
}
