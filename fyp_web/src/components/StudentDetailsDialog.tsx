import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, RefreshCw, UserRound, X } from 'lucide-react';
import { apiService } from '../services/api';
import type { AdminStudent, StudentDetails } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import { attendanceDateTime } from '../utils/attendanceTime';
import { ImageViewer } from './ImageViewer';
import { ModalLayer } from './ModalLayer';
import { ShimmerProfileModal } from './Shimmer';

// `for` ties a result to the student and attempt it was loaded for, so a late answer can never show another student's photo.
type Photo = { for: string } & ({ state: 'loading'; progress: number | null } | { state: 'ready'; url: string } | { state: 'none'; text: string } | { state: 'error'; text: string });

const NA = 'Not available';
const yes = (value: boolean) => (value ? 'Yes' : 'No');
const when = (value: string | null) => (value ? attendanceDateTime(value) : NA);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="mt-0.5 break-words text-xs font-medium text-slate-800">{children || NA}</dd></div>;
}

/** Stored passwords are salted bcrypt hashes and cannot be shown; the honest alternative is to set a new one through the existing Edit form. */
export function PasswordRow({ linked, onChange }: { linked: boolean; onChange?: () => void }) {
  return <div className="min-w-0 sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Password</dt>
    <dd className="mt-0.5 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-800">
      <span>{linked ? 'Current password cannot be viewed. Use Edit to set a new password.' : 'No login account is linked, so there is no password to change.'}</span>
      {linked && onChange && <button type="button" onClick={onChange} className="uipro-button uipro-button-secondary">Change password</button>}
    </dd></div>;
}

/**
 * The registered face in a fixed 192px frame. While it downloads: a soft moving backdrop, the real percentage (or "Loading photo…" when the
 * size is unknown) and a thin bar under it. Once the image has decoded it is revealed from a strong blur to sharp; reduced motion skips the
 * animation. A missing photo and an error keep the same frame, so nothing around it moves.
 */
function FacePhoto({ photo, name, onBroken }: { photo: Photo; name: string; onBroken: () => void }) {
  const [revealed, setRevealed] = useState('');   // the url that has decoded and may sharpen
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef<HTMLButtonElement>(null);
  const [clock, setClock] = useState({ for: '', ms: 0 });   // time spent loading this photo
  const loading = photo.state === 'loading';
  useEffect(() => {
    if (!loading) return;
    const start = performance.now();
    const timer = window.setInterval(() => setClock({ for: photo.for, ms: performance.now() - start }), 100);
    return () => window.clearInterval(timer);
  }, [loading, photo.for]);
  const sharp = photo.state === 'ready' && revealed === photo.url;
  // shortcut: until bytes arrive (the server is still fetching the photo) the percentage is a time estimate easing toward 90 %;
  // the real download share takes over as soon as it is larger, and it reaches 100 % only when the photo is here.
  const elapsed = clock.for === photo.for ? clock.ms : 0;
  const percent = loading ? Math.round(Math.max(90 * (1 - Math.exp(-elapsed / 2500)), (photo.progress ?? 0) * 100)) : 100;
  return (
    <div data-face-photo={photo.state === 'ready' ? (sharp ? 'sharp' : 'revealing') : photo.state} className="relative h-48 w-48 overflow-hidden rounded-2xl">
      {photo.state === 'ready' && <img key={photo.url} src={photo.url} alt={`Registered face of ${name}`} onError={onBroken} onClick={() => setExpanded(true)}
        // One painted frame of the blurred image first; a fast decode in the same frame would otherwise skip the reveal transition.
        onLoad={event => { const url = photo.url; void event.currentTarget.decode().catch(() => undefined).then(() => requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(url)))); }}
        className={`face-photo-image absolute inset-0 h-full w-full cursor-zoom-in object-cover ${sharp ? 'is-sharp' : ''}`} />}
      {(loading || (photo.state === 'ready' && !sharp && !revealed)) && (
        <div role="progressbar" aria-label="Loading photo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
          className={`face-photo-backdrop absolute inset-0 flex flex-col items-center justify-center gap-2 ${photo.state === 'ready' ? 'is-leaving' : ''}`}>
          <span aria-hidden="true" className="text-lg font-bold tabular-nums text-slate-700">{percent}%</span>
          <span aria-hidden="true" className="face-photo-track"><span style={{ width: `${percent}%` }} /></span>
          <span aria-hidden="true" className="text-[11px] font-medium text-slate-500">Loading photo…</span>
        </div>
      )}
      {photo.state === 'ready' && <button ref={expandButton} type="button" onClick={() => setExpanded(true)} aria-label="Expand photo" title="Expand photo"
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/55 text-white backdrop-blur-sm transition-colors hover:bg-slate-900/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
        <Maximize2 aria-hidden="true" className="h-4 w-4" />
      </button>}
      {expanded && photo.state === 'ready' && <ImageViewer url={photo.url} label={`Registered face of ${name}, full size`}
        onClose={() => { setExpanded(false); window.requestAnimationFrame(() => expandButton.current?.focus()); }} />}
      {(photo.state === 'none' || photo.state === 'error') && (
        <div role={photo.state === 'error' ? 'alert' : 'status'} className={`flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-center text-xs ${photo.state === 'error' ? 'border-rose-300 bg-rose-50/60 text-rose-700' : 'border-slate-300 text-slate-500'}`}>
          <UserRound aria-hidden="true" className="h-7 w-7 opacity-60" />
          {photo.text}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h3 className="text-xs font-bold text-slate-700">{title}</h3>
    <dl className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">{children}</dl></section>;
}

export function StudentDetailsDialog({ student, onClose, onChangePassword }: { student: AdminStudent; onClose: () => void; onChangePassword?: () => void }) {
  const [details, setDetails] = useState<StudentDetails | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const current = `${student.id}:${attempt}`;
  const [loadedPhoto, setPhoto] = useState<Photo>({ for: current, state: 'loading', progress: null });
  const photo: Photo = loadedPhoto.for === current ? loadedPhoto : { for: current, state: 'loading', progress: null };
  const dialogRef = useRef<HTMLElement>(null);
  const retry = useCallback(() => { setDetails(null); setError(''); setAttempt(n => n + 1); }, []);

  // One effect per student/attempt: a rapid A-to-B switch or close aborts A, so stale data and photos never render.
  useEffect(() => {
    const controller = new AbortController();
    const key = `${student.id}:${attempt}`;
    let objectUrl = '';
    (async () => {
      try {
        const loaded = await apiService.adminGetStudentDetails(student.id, controller.signal);
        if (controller.signal.aborted) return;
        setDetails(loaded);
        const { is_registered, photo_available, registration_version } = loaded.face;
        if (!is_registered || !registration_version) return setPhoto({ for: key, state: 'none', text: 'Not registered' });
        if (!photo_available) return setPhoto({ for: key, state: 'none', text: 'Photo unavailable' });
        try {
          const blob = await apiService.adminGetFacePhoto(student.id, registration_version, controller.signal,
            progress => { if (!controller.signal.aborted) setPhoto({ for: key, state: 'loading', progress }); });
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(blob);
          setPhoto({ for: key, state: 'ready', url: objectUrl });
        } catch (failure) {
          if (controller.signal.aborted) return;
          const status = (failure as { response?: { status?: number } })?.response?.status;
          setPhoto(status === 404 ? { for: key, state: 'none', text: 'Photo unavailable' } : { for: key, state: 'error', text: apiErrorMessage(failure, 'The photo could not be loaded.') });
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(apiErrorMessage(failure, 'Student details could not be loaded.'));
      }
    })();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [student.id, attempt]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const fallbackFocus = Array.from(previousFocus?.parentElement?.querySelectorAll<HTMLElement>('button') || [])
      .find(target => target !== previousFocus);
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => (previousFocus?.isConnected ? previousFocus : fallbackFocus)?.focus();
  }, []);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;   // the full-size photo above handled it (it keeps Tab on its Close button)
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
  return <ModalLayer className="fixed inset-0 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="student-details-title" className="uipro-card relative w-full max-w-2xl max-h-[90dvh] flex flex-col gap-5 overflow-hidden bg-white !p-6">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div><h2 id="student-details-title" className="font-display font-bold text-lg text-slate-900 flex items-center gap-2"><UserRound className="text-brand-blue h-5 w-5" /> Student details</h2>
          <p className="text-xs text-slate-500 mt-1">{student.name} · {student.student_code}</p></div>
        <button type="button" aria-label="Close student details" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
      {error ? <div role="alert" className="space-y-3 rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700">
        <p>{error}</p><button type="button" onClick={retry} className="uipro-button uipro-button-secondary"><RefreshCw className="h-4 w-4 mr-2" />Retry</button></div>
      : !details ? <div role="status" aria-label="Loading student details"><ShimmerProfileModal /></div> : <>
        <section aria-label="Registered face" className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <FacePhoto photo={photo} name={details.identity.name} onBroken={() => setPhoto({ for: current, state: 'error', text: 'The photo could not be displayed.' })} />
          {photo.state === 'error' && <button type="button" onClick={retry} className="uipro-button uipro-button-secondary"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>}
        </section>
        <Group title="Identity">
          <Field label="Name">{details.identity.name}</Field>
          <Field label="Student code">{details.identity.student_code}</Field>
          <Field label="Student ID">{details.identity.student_id}</Field>
          <Field label="User ID">{details.identity.user_id}</Field>
          <Field label="Email">{details.identity.email}</Field>
          <Field label="Profile avatar">{details.identity.avatar_url ? <img src={details.identity.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : null}</Field>
        </Group>
        <Group title="Account">
          <Field label="Account role">{account?.account_role}</Field>
          <Field label="Status">{account?.status}</Field>
          <Field label="Created">{when(account?.created_at ?? null)}</Field>
          <Field label="Last login">{when(account?.last_login_at ?? null)}</Field>
          <Field label="Recovery email">{account?.recovery_email}</Field>
          <Field label="Recovery email verified">{account ? yes(account.recovery_email_verified) : null}</Field>
          <PasswordRow linked={!!account} onChange={onChangePassword} />
        </Group>
        <Group title="Programme and courses">
          <Field label="Programme">{details.programme ? `${details.programme.code} · ${details.programme.name}` : null}</Field>
          <div className="sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Enrolled courses</dt>
            <dd className="mt-1 space-y-1 text-xs text-slate-800">{details.courses.length ? details.courses.map(course =>
              <p key={`${course.code}-${course.class_group}`}>{course.code} · {course.name} · {course.semester || NA} · Group {course.class_group || NA}</p>) : NA}</dd></div>
        </Group>
        <Group title="Face registration">
          <Field label="Status">{details.face.is_registered ? 'Registered' : 'Not registered'}</Field>
          <Field label="Samples">{details.face.sample_count != null ? String(details.face.sample_count) : null}</Field>
          <Field label="Last updated">{when(details.face.updated_at)}</Field>
        </Group>
      </>}
      </div>
      <footer className="flex shrink-0 justify-end border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="uipro-button uipro-button-secondary">Close</button></footer>
    </section>
  </ModalLayer>;
}
