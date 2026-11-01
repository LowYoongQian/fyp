import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarClock, CheckCircle2, Mail, RefreshCw, ScanFace, Smartphone } from 'lucide-react';
import { apiService } from '../services/api';
import type { StudentNextAction as NextAction } from '../services/api';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { LoadingRegion, ShimmerText } from './Shimmer';

const KNOWN = ['check_in', 'register_face', 'verify_email', 'view_next_class', 'none'];

type Card = { icon: React.ElementType; title: string; text: string; button?: { label: string; run: () => void } };

const clock = (value: string | null) => value ? new Date(value).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }) : '';

function cardFor(data: NextAction): Card {
  const session = data.session;
  const where = session ? `${session.course_code}${session.room ? ` · ${session.room}` : ''}${session.scheduled_start ? ` · started ${clock(session.scheduled_start)}` : ''}` : '';
  switch (data.action) {
    case 'check_in': return { icon: Smartphone, title: 'Check in now', text: `${where}. Open the mobile app to check in.${data.waiting > 1 ? ` ${data.waiting - 1} more class${data.waiting > 2 ? 'es are' : ' is'} open.` : ''}` };
    case 'register_face': return { icon: ScanFace, title: 'Register your face', text: session ? `${session.course_code} is open, but you need a registered face to check in. Open the mobile app to register.` : 'You need a registered face to check in. Open the mobile app to register.' };
    case 'verify_email': return { icon: Mail, title: 'Verify your email', text: 'Add and verify a personal email for notices and password resets.', button: { label: 'Verify email', run: () => window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { tab: 'security' } })) } };
    case 'view_next_class': {
      const next = data.next_class!;
      return { icon: CalendarClock, title: 'Your next class', text: `${next.course_code} · ${next.day} ${next.start}–${next.end}${next.room ? ` · ${next.room}` : ''}`,
        button: { label: 'View timetable', run: () => window.dispatchEvent(new CustomEvent('open-app-tab', { detail: { tab: 'student_timetable' } })) } };
    }
    default: return data.reason === 'no_enrolment'
      ? { icon: CheckCircle2, title: 'No classes yet', text: 'You are not enrolled in any course this semester.' }
      : { icon: CheckCircle2, title: 'No upcoming class', text: 'You are all set for now.' };
  }
}

/** One compact next step for the signed-in student, decided by the server. It only reads; the buttons open pages that already exist. */
export function StudentNextAction({ userId }: { userId: string }) {
  const [data, setData] = useState<NextAction | null>(null);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; latest.current += 1; }; }, []);

  const load = useCallback(async () => {
    const id = ++latest.current;
    try {
      const next = await apiService.studentGetNextAction();
      if (!KNOWN.includes(next?.action)) throw new Error('Unrecognised answer');   // an old or malformed answer is a failure, never a made-up step
      if (alive.current && latest.current === id) { setData(next); setFailed(false); }
    } catch {
      if (alive.current && latest.current === id) setFailed(true);
    }
  }, []);
  // A new account starts clean, so another student's step never shows while this one loads.
  useEffect(() => { setData(null); setFailed(false); void load(); }, [load, userId]);
  useEffect(() => {
    const again = () => void load();
    window.addEventListener('recovery-email-verified', again);
    window.addEventListener('focus', again);
    return () => { window.removeEventListener('recovery-email-verified', again); window.removeEventListener('focus', again); };
  }, [load]);
  useLiveRefresh(load, ['sessions', 'attendance', 'account', 'timetable'], userId);

  if (!data && !failed) return <LoadingRegion label="Loading your next step…" className="uipro-card space-y-2 p-4"><ShimmerText width="w-1/3" height="h-4" /><ShimmerText width="w-2/3" height="h-3" /></LoadingRegion>;
  if (!data) return <div role="alert" className="uipro-card flex flex-wrap items-center justify-between gap-3 p-4 text-xs"><p className="text-slate-600 dark:text-slate-300">Your next step could not be loaded.</p>
    <button type="button" onClick={() => { setFailed(false); void load(); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-brand-blue dark:border-slate-700"><RefreshCw className="h-3.5 w-3.5" />Retry</button></div>;
  const card = cardFor(data);
  return <section aria-label="Your next step" data-next-action={data.action} className="uipro-card flex flex-wrap items-center justify-between gap-4 p-4">
    <div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><card.icon className="h-5 w-5" /></span>
      <div className="min-w-0"><h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{card.title}</h3><p className="mt-0.5 break-words text-xs text-slate-600 dark:text-slate-300">{card.text}</p>
        {failed && <p role="status" className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Could not refresh; this may be out of date.</p>}</div></div>
    {card.button && <button type="button" onClick={card.button.run} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30">{card.button.label}<ArrowRight className="h-4 w-4" /></button>}
  </section>;
}
