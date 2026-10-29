export type SubmissionRange = { from: string; to: string };

/** API boundaries are explicit UTC instants; the selected end minute stays inclusive. */
export function submissionFilterParams(range: SubmissionRange) {
  return {
    ...(range.from ? { submitted_from: new Date(range.from).toISOString() } : {}),
    ...(range.to ? { submitted_to: new Date(new Date(range.to).getTime() + 60000).toISOString() } : {}),
  };
}

export function hour24(hour12: number, period: 'AM' | 'PM') {
  return hour12 % 12 + (period === 'PM' ? 12 : 0);
}

export function monthDays(month: string): (number | null)[] {
  const [year, index] = month.split('-').map(Number);
  return [...Array(new Date(year, index - 1, 1).getDay()).fill(null),
    ...Array.from({ length: new Date(year, index, 0).getDate() }, (_, day) => day + 1)];
}

// Existing backend datetime columns are UTC, including legacy offset-free values.
export function submissionDate(value: string) {
  return new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
}

export function matchesSubmissionRange(value: string, range: SubmissionRange) {
  if (!range.from && !range.to) return true;
  const timestamp = submissionDate(value).getTime();
  const from = range.from ? new Date(range.from).getTime() : -Infinity;
  // Include the whole selected end minute, not just its first second.
  const to = range.to ? new Date(range.to).getTime() + 60000 : Infinity;
  return Number.isFinite(timestamp) && timestamp >= from && timestamp < to;
}

export function localMinute(date: Date) {
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function recentSubmissionRange(days: number, now = new Date()): SubmissionRange {
  const from = new Date(now);
  from.setDate(from.getDate() - days + 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 0, 0);
  return { from: localMinute(from), to: localMinute(to) };
}
