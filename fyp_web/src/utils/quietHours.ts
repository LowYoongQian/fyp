export const timeOf = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export const minutesOf = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
/** Overnight ranges (start later than end) are valid; only an empty/invalid time or an enabled zero-length range is not. */
export function quietHoursError(enabled: boolean, start: string, end: string) {
  if (!enabled) return '';
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return 'Choose both a start and an end time.';
  return start === end ? 'Choose different start and end times.' : '';
}
