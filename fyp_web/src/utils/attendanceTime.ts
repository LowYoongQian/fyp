import { submissionDate } from './submissionTime.ts';
import { CAMPUS_TIMEZONE } from './campusCalendar.ts';

export function attendanceDateTime(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = submissionDate(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', { timeZone: CAMPUS_TIMEZONE, year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(date);
}

export function attendanceSource(status: string, method?: string | null) {
  if (status === 'unmarked') return 'No attendance record';
  if (method?.startsWith('admin_override:')) return 'Admin update';
  if (method?.startsWith('staff_override:')) return 'Staff update';
  if (status === 'absent') return 'Absence recorded';
  if (status === 'leave' || status.startsWith('mc_')) return 'Medical / leave record';
  return method === 'face+wifi' && status === 'present' ? 'Student check-in' : 'Attendance record';
}
