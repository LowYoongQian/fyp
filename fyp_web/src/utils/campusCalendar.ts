export const CAMPUS_TIMEZONE = 'Asia/Kuala_Lumpur';
let clockSample: { epoch: number; monotonic: number } | null = null;

export function setCampusClock(iso: string) {
  if (!/(Z|[+-]\d\d:\d\d)$/.test(iso)) return false;
  const epoch = Date.parse(iso);
  if (!Number.isFinite(epoch)) return false;
  clockSample = { epoch, monotonic: performance.now() };
  return true;
}

// Wall-calendar Date for existing timetable arithmetic, never a storage timestamp.
export function getMalaysiaDate(instant = new Date(clockSample ? clockSample.epoch + performance.now() - clockSample.monotonic : Date.now())) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: CAMPUS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const part = (type: string) => Number(parts.find(value => value.type === type)?.value);
  return new Date(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
}

export function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function weekMonday(date: Date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return monday;
}

const calendarOrdinal = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
export function semesterWeeks(start: string, end: string) {
  return Math.floor((calendarOrdinal(new Date(`${end}T00:00:00`)) - calendarOrdinal(weekMonday(new Date(`${start}T00:00:00`)))) / 7) + 1;
}
export function semesterWeek(day: string, start: string, end: string) {
  if (day < start || day > end) return null;
  return Math.floor((calendarOrdinal(new Date(`${day}T00:00:00`)) - calendarOrdinal(weekMonday(new Date(`${start}T00:00:00`)))) / 7) + 1;
}
