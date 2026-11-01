import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Info } from 'lucide-react';
import { apiService } from '../services/api';
import type { AcademicSemester, Programme, RolloverPreview } from '../services/api';
import { CustomDropdown } from './CustomDropdown';
import { LoadingRegion, ShimmerText } from './Shimmer';

type Props = { terms: AcademicSemester[]; programmes: Programme[] };

/** Read-only look at carrying one semester's courses into another. It never saves anything and has no apply button. */
export function SemesterRolloverPreview({ terms, programmes }: Props) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [picked, setPicked] = useState<string[] | null>(null);   // null: every course of the source semester
  const [plan, setPlan] = useState<RolloverPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useRef<AbortController | null>(null);

  const label = (term: AcademicSemester) => `${programmes.find(p => String(p.id) === term.programme_id)?.code ?? ''} · ${term.name} (${term.start_date} – ${term.end_date})`;
  const options = (skip: string) => [{ value: '', label: 'Select semester' }, ...terms.filter(term => term.id !== skip).map(term => ({ value: term.id, label: label(term) }))];
  // A changed choice makes the shown plan stale: drop it rather than leave an old answer on screen.
  const choose = (apply: () => void) => { run.current?.abort(); apply(); setPlan(null); setError(''); setBusy(false); };
  useEffect(() => () => run.current?.abort(), []);

  const preview = async (courses: string[] | null) => {
    if (!source || !target || busy) return;
    run.current?.abort();
    const controller = run.current = new AbortController();
    setBusy(true); setError('');
    try {
      const result = await apiService.adminPreviewRollover({ source_semester_id: source, target_semester_id: target, ...(courses ? { course_ids: courses } : {}) }, controller.signal);
      if (run.current === controller) setPlan(result);
    } catch (caught: unknown) {
      if (controller.signal.aborted) return;
      const detail = (caught as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      setPlan(null); setError(typeof detail === 'string' ? detail : 'The preview could not be loaded. Try again.');
    } finally { if (run.current === controller) setBusy(false); }
  };
  const selected = picked ?? plan?.courses.map(course => course.course_id) ?? [];
  const toggle = (id: string) => setPicked(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);

  return <section aria-labelledby="rollover-title" className="uipro-card min-w-0 space-y-4 p-6 lg:col-span-3">
    <div className="space-y-1"><h3 id="rollover-title" className="flex items-center gap-2 text-sm font-bold"><Eye className="h-5 w-5 text-brand-blue" />Next semester preview</h3>
      <p className="text-xs text-slate-500">See what carrying courses into a new semester would involve. Nothing is saved or moved.</p></div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="min-w-0 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><span>From semester</span>
        <CustomDropdown fullWidth className="w-full" ariaLabel="Source semester" value={source} options={options(target)} onChange={value => choose(() => { setSource(value); setPicked(null); })} /></div>
      <div className="min-w-0 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><span>To semester</span>
        <CustomDropdown fullWidth className="w-full" ariaLabel="Target semester" value={target} options={options(source)} onChange={value => choose(() => setTarget(value))} /></div>
    </div>
    <button type="button" disabled={!source || !target || busy} onClick={() => void preview(picked)} className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><Eye className="h-4 w-4" />{busy ? 'Checking…' : plan ? 'Refresh preview' : 'Show preview'}</button>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
    {busy && !plan && <LoadingRegion label="Checking the courses…" className="space-y-2">{[0, 1].map(index => <ShimmerText key={index} height="h-16" className="rounded-xl" />)}</LoadingRegion>}
    {plan && <div aria-busy={busy} className="space-y-4">
      <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><Info className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Not ready to apply.</strong> {plan.limitation}</span></p>
      {[...plan.blocking.map(text => ({ text, tone: 'rose' })), ...plan.warnings.map(text => ({ text, tone: 'amber' }))].map(item => <p key={item.text} role="alert" className={`flex items-start gap-2 text-xs ${item.tone === 'rose' ? 'text-rose-700' : 'text-amber-800'}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{item.text}</p>)}
      <p className="text-xs text-slate-500">{plan.totals.selected} of {plan.totals.source_courses} courses · {plan.totals.students} students · {plan.totals.needing_attention} need attention</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60"><p className="font-bold">Stays as it is</p>{plan.retained.map(text => <p key={text} className="text-slate-600 dark:text-slate-300">{text}</p>)}</div>
        <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60"><p className="font-bold">Never copied</p>{plan.never_copied.map(text => <p key={text} className="text-slate-600 dark:text-slate-300">{text}</p>)}</div>
      </div>
      <ul className="space-y-3">{plan.courses.map(course => <li key={course.course_id} className="rounded-xl border border-slate-200 p-4 text-xs dark:border-slate-700">
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-0.5" checked={selected.includes(course.course_id)} onChange={() => toggle(course.course_id)} aria-label={`Include ${course.course_code}`} />
          <span className="min-w-0 break-words"><span className="block font-semibold">{course.course_code} · {course.course_name}</span>
            <span className="text-slate-500">{course.lecturer ? `Lecturer: ${course.lecturer.name}` : 'No lecturer'}{course.staff.length ? ` · ${course.staff.map(member => `${member.role}: ${member.name}`).join(', ')}` : ''}</span></span></label>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Would copy: {course.would_copy.staff} teaching staff, {course.would_copy.groups} group{course.would_copy.groups === 1 ? '' : 's'}. {course.students_eligible} of {course.students} students could be enrolled again{course.groups.length ? ` (${course.groups.map(group => `${group.group}: ${group.students}`).join(', ')})` : ''}.</p>
        {course.issues.length ? <ul className="mt-2 space-y-1 text-amber-800 dark:text-amber-300">{course.issues.map(issue => <li key={issue} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{issue}</li>)}</ul>
          : <p className="mt-2 flex items-center gap-2 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Nothing missing.</p>}
      </li>)}</ul>
      {plan.not_included.length > 0 && <ul className="space-y-1 text-xs text-slate-500">{plan.not_included.map(item => <li key={item.course_id}>{item.course_code ?? 'Unknown course'}: {item.reason}</li>)}</ul>}
      {picked && <button type="button" disabled={busy} onClick={() => void preview(picked)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-brand-blue dark:border-slate-700">Update preview for the chosen courses</button>}
    </div>}
  </section>;
}
