import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, UserRound, X } from 'lucide-react';
import { apiService } from '../services/api';
import type { AdminStaff, StaffDetails } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import { attendanceDateTime } from '../utils/attendanceTime';
import { ModalLayer } from './ModalLayer';
import { ShimmerProfileModal } from './Shimmer';

const NA = 'Not available';
const yes = (value: boolean) => (value ? 'Yes' : 'No');
const when = (value: string | null) => (value ? attendanceDateTime(value) : NA);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="mt-0.5 break-words text-xs font-medium text-slate-800">{children || NA}</dd></div>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h3 className="text-xs font-bold text-slate-700">{title}</h3>
    <dl className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">{children}</dl></section>;
}

export function StaffDetailsDialog({ staff, onClose }: { staff: AdminStaff; onClose: () => void }) {
  const [details, setDetails] = useState<StaffDetails | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const retry = useCallback(() => { setDetails(null); setError(''); setImageFailed(false); setAttempt(n => n + 1); }, []);

  // Scoped to one staff member: closing, switching or logging out aborts the request, so nothing stale renders.
  useEffect(() => {
    const controller = new AbortController();
    apiService.adminGetStaffDetails(staff.id, controller.signal)
      .then(loaded => { if (!controller.signal.aborted) setDetails(loaded); })
      .catch(failure => { if (!controller.signal.aborted) setError(apiErrorMessage(failure, 'Staff details could not be loaded.')); });
    return () => controller.abort();
  }, [staff.id, attempt]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const fallbackFocus = Array.from(previousFocus?.parentElement?.querySelectorAll<HTMLElement>('button') || [])
      .find(target => target !== previousFocus);
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => (previousFocus?.isConnected ? previousFocus : fallbackFocus)?.focus();
  }, []);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const targets = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') || []);
      const first = targets[0], last = targets.at(-1);
      if (!dialogRef.current?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [onClose]);

  const account = details?.account;
  const prefs = account?.preferences;
  const avatar = details?.identity.avatar_url;
  return <ModalLayer className="fixed inset-0 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="staff-details-title" className="uipro-card relative w-full max-w-2xl max-h-[90dvh] flex flex-col gap-5 overflow-hidden bg-white !p-6">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div><h2 id="staff-details-title" className="font-display font-bold text-lg text-slate-900 flex items-center gap-2"><UserRound className="text-brand-blue h-5 w-5" /> Staff details</h2>
          <p className="text-xs text-slate-500 mt-1">{staff.name} · {staff.staff_id}</p></div>
        <button type="button" aria-label="Close staff details" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {error ? <div role="alert" className="space-y-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700">
          <p>{error}</p><button type="button" onClick={retry} className="uipro-button uipro-button-secondary"><RefreshCw className="h-4 w-4 mr-2" />Retry</button></div>
        : !details ? <div role="status" aria-label="Loading staff details"><ShimmerProfileModal /></div> : <>
          <section aria-label="Profile photo" className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            {avatar && !imageFailed
              ? <img src={avatar} alt={`Profile photo of ${details.identity.name}`} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} className="h-48 w-48 rounded-2xl object-cover" />
              : <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500" role={imageFailed ? 'alert' : 'status'}>
                  {imageFailed ? 'Image unavailable' : 'No profile photo'}</div>}
            {imageFailed && <button type="button" onClick={() => setImageFailed(false)} className="uipro-button uipro-button-secondary"><RefreshCw className="h-4 w-4 mr-2" />Retry image</button>}
          </section>
          <Group title="Identity">
            <Field label="Name">{details.identity.name}</Field>
            <Field label="Staff ID">{details.identity.staff_id}</Field>
            <Field label="Profile ID">{details.identity.lecturer_id}</Field>
            <Field label="User ID">{details.identity.user_id}</Field>
            <Field label="Email">{details.identity.email}</Field>
            <Field label="Assigned staff role">{details.identity.staff_role}</Field>
          </Group>
          <Group title="Account">
            <Field label="Account role">{account?.account_role}</Field>
            <Field label="Status">{account?.status}</Field>
            <Field label="Created">{when(account?.created_at ?? null)}</Field>
            <Field label="Last login">{when(account?.last_login_at ?? null)}</Field>
            <Field label="Two-factor authentication">{account ? yes(account.two_factor_enabled) : null}</Field>
            <Field label="Recovery email">{account?.recovery_email}</Field>
            <Field label="Recovery email verified">{account ? yes(account.recovery_email_verified) : null}</Field>
            <Field label="Display">{prefs ? `${prefs.theme} theme · ${prefs.font_size} text · ${prefs.language}` : null}</Field>
            <Field label="Notifications">{prefs ? `All ${yes(prefs.notifications)} · Email ${yes(prefs.email_notifications)} · Push ${yes(prefs.push_notifications)} · In-app ${yes(prefs.in_app_notifications)}` : null}</Field>
          </Group>
          <Group title="Assigned courses">
            <div className="sm:col-span-2"><dd className="space-y-1 text-xs text-slate-800">{details.courses.length ? details.courses.map(course =>
              <p key={course.code}>{course.code} · {course.name} · {course.roles.join(', ')}</p>) : 'No courses assigned'}</dd></div>
          </Group>
        </>}
      </div>
      <footer className="flex shrink-0 justify-end border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="uipro-button uipro-button-secondary">Close</button></footer>
    </section>
  </ModalLayer>;
}
