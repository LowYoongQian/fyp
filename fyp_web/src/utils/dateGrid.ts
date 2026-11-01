// Calendar-grid date arithmetic on 'YYYY-MM-DD' / 'YYYY-MM' strings. Noon avoids every daylight-saving edge.
const pad = (value: number) => String(value).padStart(2, '0');

export const shiftMonth = (month: string, offset: number) => {
  const next = new Date(`${month}-01T12:00:00`); // Day 1 always exists, so setMonth cannot overflow.
  next.setMonth(next.getMonth() + offset);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
};

export const shiftDay = (date: string, offset: number) => {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + offset);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
};

export const lastDayOfMonth = (month: string) => {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index, 0).getDate();
};

/** The same day number in the month `offset` away, clamped to that month's real last day (31 March back one month is 28 February, not 3 March). */
export const sameDayInMonth = (date: string, offset: number) => {
  const month = shiftMonth(date.slice(0, 7), offset);
  return `${month}-${pad(Math.min(Number(date.slice(8)), lastDayOfMonth(month)))}`;
};

/**
 * Where a navigation key moves focus. `undefined` means the key is not a navigation key. A move that would leave the allowed range
 * is pulled back to its edge when that edge is in the target month; otherwise focus stays where it is. Greyed days are never reached.
 */
export function keyboardTarget(current: string, key: string, min?: string, max?: string): string | undefined {
  const month = current.slice(0, 7);
  const target = key === 'ArrowLeft' ? shiftDay(current, -1) : key === 'ArrowRight' ? shiftDay(current, 1)
    : key === 'ArrowUp' ? shiftDay(current, -7) : key === 'ArrowDown' ? shiftDay(current, 7)
    : key === 'PageUp' ? sameDayInMonth(current, -1) : key === 'PageDown' ? sameDayInMonth(current, 1)
    : key === 'Home' ? `${month}-01` : key === 'End' ? `${month}-${pad(lastDayOfMonth(month))}` : undefined;
  if (!target) return undefined;
  const bounded = min && target < min ? min : max && target > max ? max : target;
  return bounded.slice(0, 7) === target.slice(0, 7) ? bounded : current;
}
