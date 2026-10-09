import type { StudentAttendanceSession } from '../../services/api';

// The API already limits these sessions to completed classes assigned to this student.
export function dashboardAttendance(sessions: StudentAttendanceSession[]) {
  const weeks = new Map<string, { hours: number; attended: number }>();
  const counts = { present: 0, leave: 0, absent: 0 };
  let hours = 0;
  let attended = 0;
  for (const session of sessions) {
    const weight = session.contact_hours;
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
      throw new Error('Attendance contact hours unavailable');
    }
    const credit = session.status === 'present' || session.status === 'leave';
    hours += weight;
    attended += credit ? weight : 0;
    counts[session.status === 'present' ? 'present' : session.status === 'leave' ? 'leave' : 'absent']++;
    const date = new Date(session.scheduled_start || session.opened_at || '');
    if (!Number.isFinite(date.getTime())) throw new Error('Attendance date unavailable');
    // Calendar weeks in campus time, labelled by Monday rather than an invented semester.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const part = (name: string) => parts.find(p => p.type === name)!.value;
    const monday = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const key = monday.toISOString().slice(0, 10);
    const week = weeks.get(key) || { hours: 0, attended: 0 };
    week.hours += weight;
    week.attended += credit ? weight : 0;
    weeks.set(key, week);
  }
  return {
    overall: hours ? Math.round(attended / hours * 1000) / 10 : null,
    weekly: [...weeks].sort(([a], [b]) => a.localeCompare(b)).map(([week, value]) => ({
      week, rate: Math.round(value.attended / value.hours * 1000) / 10,
    })),
    breakdown: [
      { name: 'Present', value: counts.present, color: '#10B981' },
      { name: 'Excused (MC)', value: counts.leave, color: '#3B82F6' },
      { name: 'Absent', value: counts.absent, color: '#EF4444' },
    ],
  };
}
