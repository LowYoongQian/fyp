// Audit filters are Asia/Kuala_Lumpur wall-clock times chosen as 'YYYY-MM-DDTHH:mm'. Malaysia has no daylight saving, so the offset is fixed.
const OFFSET = '+08:00';
const WALL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export type AuditRange = { from: string; until: string };

/** Until is inclusive to the end of its minute (a date-only Until arrives as 23:59, i.e. the whole day), so the API receives the following minute as an exclusive bound. */
export function auditRangeParams({ from, until }: AuditRange): { created_from?: string; created_to?: string } {
  const params: { created_from?: string; created_to?: string } = {};
  if (from) params.created_from = `${from}:00${OFFSET}`;
  if (until) {
    const [date, time] = until.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day, hour, minute + 1)); // UTC arithmetic: the device time zone never enters.
    const pad = (value: number) => String(value).padStart(2, '0');
    params.created_to = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T${pad(next.getUTCHours())}:${pad(next.getUTCMinutes())}:00${OFFSET}`;
  }
  return params;
}

/** Returns a message when the range cannot be applied. Open bounds and a single-minute range are valid. */
export function auditRangeError({ from, until }: AuditRange) {
  if ((from && !WALL_TIME.test(from)) || (until && !WALL_TIME.test(until))) return 'Choose a valid date and time.';
  if (from && until && until < from) return 'Until must not be before From.';
  return '';
}
