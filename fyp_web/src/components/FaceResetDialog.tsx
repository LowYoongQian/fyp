import { useCallback, useEffect, useRef, useState } from 'react';
import { X, RefreshCw, ScanFace } from 'lucide-react';
import { apiService } from '../services/api';
import type { AdminStudent } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLiveResource } from '../hooks/useLiveResource';
import { apiErrorMessage } from '../utils/apiError';
import { ModalLayer } from './ModalLayer';
import { ShimmerProfileModal } from './Shimmer';

export function FaceResetDialog({ student, onClose, onSaved }: {
  student: AdminStudent; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const load = useCallback((signal: AbortSignal) => apiService.adminGetFaceRegistration(student.id, signal), [student.id]);
  const resource = useLiveResource(load, `face:${user?.user_id}:${student.id}`, ['registry']);
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const fallbackFocus = Array.from(previousFocus?.parentElement?.querySelectorAll<HTMLElement>('button') || [])
      .find(target => target !== previousFocus);
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => (previousFocus?.isConnected ? previousFocus : fallbackFocus)?.focus();
  }, []);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const targets = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') || []);
      const first = targets[0], last = targets.at(-1);
      if (!dialogRef.current?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, [busy, onClose]);
  const registered = resource.data?.is_face_registered;
  const perform = async () => {
    const version = resource.data?.registration_version;
    if (busy || confirmed !== version || !password || !registered || !version) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await apiService.adminResetFace(student.id, password, version);
      resource.setData(() => saved);
      setPassword(''); setConfirmed(null);
      setMessage('Face reset confirmed. The student must register again in the app; attendance history is unchanged.');
      onSaved();
    } catch (failure) {
      setPassword(''); setConfirmed(null);
      setError(apiErrorMessage(failure, 'Reset could not be confirmed. Refresh the status before trying again.'));
      void resource.refresh();
    } finally { setBusy(false); }
  };
  return <ModalLayer className="fixed inset-0 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="face-reset-title" className="uipro-card relative w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-white !p-6 space-y-5">
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div><h2 id="face-reset-title" className="font-display font-bold text-lg text-slate-900 flex items-center gap-2"><ScanFace className="text-brand-blue h-5 w-5" /> Reset registered face</h2>
          <p className="text-xs text-slate-500 mt-1">{student.name} · {student.student_code}</p></div>
        <button type="button" aria-label="Close face reset" disabled={busy} onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
      </header>
      <p className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-800">Handle identity checks at the administration office before resetting. This removes the saved face signature and requires a new live registration in the app; it does not delete attendance history.</p>
      {resource.loading ? <div role="status" aria-label="Loading face registration"><ShimmerProfileModal /></div> : <>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-800">{resource.data ? registered ? 'Face registered · locked for student' : 'Registration required' : 'Status unavailable'}</span>
          <button type="button" aria-label="Refresh face registration" disabled={busy} onClick={() => { setConfirmed(null); setMessage(''); void resource.refresh(); }} className="p-2 rounded-lg hover:bg-white"><RefreshCw className="h-4 w-4 text-brand-blue" /></button>
        </div>
        {(error || resource.error) && <p role="alert" className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-700">{error || resource.error}</p>}
        {message && <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">{message}</p>}
        {registered && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void perform(); }}>
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-xs leading-relaxed text-slate-600"><input type="checkbox" checked={!!confirmed && confirmed === resource.data?.registration_version} disabled={busy} onChange={event => setConfirmed(event.target.checked ? resource.data?.registration_version ?? null : null)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" /><span>I confirm that this student's saved face should be reset after the office identity check.</span></label>
          <label className="block space-y-2 text-xs font-semibold text-slate-600"><span>Your current administrator password</span><input type="password" autoComplete="current-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} required className="uipro-input w-full" /></label>
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} disabled={busy} className="uipro-button uipro-button-secondary disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy || confirmed !== resource.data?.registration_version || !password || !resource.data?.registration_version} className="uipro-button uipro-button-primary disabled:opacity-50"><RefreshCw className="h-4 w-4 mr-2" />{busy ? 'Resetting securely…' : 'Reset face'}</button>
          </div>
        </form>}
      </>}
    </section>
  </ModalLayer>;
}
