import { useEffect, useState } from 'react';
import { formatDate, getMalaysiaDate } from '../utils/campusCalendar';

/** The current Asia/Kuala_Lumpur date (YYYY-MM-DD). It is re-read every 15 seconds, so a screen left open rolls over at Malaysia midnight. */
export function useMalaysiaToday() {
  const [today, setToday] = useState(() => formatDate(getMalaysiaDate()));
  useEffect(() => {
    const update = () => setToday(formatDate(getMalaysiaDate()));
    const timer = window.setInterval(update, 15000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  return today;
}
