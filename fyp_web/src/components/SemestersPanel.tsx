import { useEffect, useState } from 'react';
import { CalendarDays, Pencil, Plus, Save, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';
import type { AcademicSemester, Course, Programme, SemesterWrite } from '../services/api';
import { CustomDropdown } from './CustomDropdown';
import { TextInput } from './LimitedTextField';
import { swalError, swalSuccess } from '../utils/swal';
import { getMalaysiaDate, formatDate } from '../utils/campusCalendar';

const empty = (): SemesterWrite => ({ name: '', programme_id: '', start_date: formatDate(getMalaysiaDate()), end_date: '', max_student_credits: 18, course_ids: [] });
export function SemestersPanel({ programmes, courses, onSaved }: { programmes: Programme[]; courses: Course[]; onSaved: () => void }) {
  const [terms, setTerms] = useState<AcademicSemester[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const load = async () => {
    try { setTerms(await apiService.adminGetSemesters()); setLoadError(false); }
    catch { setLoadError(true); }
  };
  useEffect(() => {
    let active = true;
    apiService.adminGetSemesters().then(value => { if (active) { setTerms(value); setLoadError(false); } })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);
  const field = 'w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  const label = 'min-w-0 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300';
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await apiService.adminSaveSemester(form, editing);
      await load(); onSaved(); setEditing(undefined); setForm(empty());
      await swalSuccess('Semester saved', 'Dates and student credit limits are now enforced by the server.');
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      await swalError('Semester not saved', typeof detail === 'string' ? detail : 'Check the dates, programme and credit limit, then try again.');
    } finally { setSaving(false); }
  };
  return <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <form onSubmit={save} className="uipro-card min-w-0 space-y-5 p-6 lg:col-span-1">
      <fieldset disabled={saving} className="min-w-0 space-y-5">
      <h3 className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="h-5 w-5 text-brand-blue" />{editing ? 'Edit semester' : 'Create semester'}</h3>
      <p className="text-xs leading-relaxed text-slate-500">End date is inclusive in Malaysia time; expiry stops new allocations and check-ins, not historical records.</p>
      <div className={label}><span>Study programme</span>{editing ? <p className={field}>{programmes.find(p => String(p.id) === form.programme_id)?.name}</p> : <CustomDropdown fullWidth className="w-full" ariaLabel="Semester programme" value={form.programme_id}
        options={[{ value: '', label: 'Select programme' }, ...programmes.map(p => ({ value: String(p.id), label: `${p.code} · ${p.name}` }))]}
        onChange={value => setForm({ ...form, programme_id: value, course_ids: [] })} />}
        {editing && <p className="text-[10px] text-slate-400">The saved programme is fixed to preserve history.</p>}</div>
      <label className={`block ${label}`}>Semester name<TextInput required aria-label="Semester name" className={field} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="2026 Semester 2" /></label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <label className={label}>Start date<input required type="date" aria-label="Semester start date" className={field} value={form.start_date} onChange={event => setForm({ ...form, start_date: event.target.value })} /></label>
        <label className={label}>End date<input required type="date" aria-label="Semester end date" min={form.start_date} className={field} value={form.end_date} onChange={event => setForm({ ...form, end_date: event.target.value })} /></label>
      </div>
      <label className={`block ${label}`}>Maximum academic credits per student<input required type="number" min="0.5" max="60" step="0.5" aria-label="Maximum student credits" className={field} value={form.max_student_credits} onChange={event => setForm({ ...form, max_student_credits: Number(event.target.value) })} /></label>
      <p className="text-[11px] text-slate-500">This limits enrolled academic credits, not attendance/contact hours; existing attendance percentages stay unchanged.</p>
      <fieldset className="space-y-3"><legend className="mb-2 text-xs font-semibold">Courses in this semester</legend>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          {courses.filter(c => String(c.programme_id) === form.programme_id).map(course => {
            const fixed = !!course.semester_id;
            const checked = form.course_ids.includes(String(course.id));
            return <label key={course.id} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
              <input type="checkbox" className="mt-0.5 accent-blue-600" disabled={fixed || saving} checked={checked} onChange={() => setForm({ ...form, course_ids: checked ? form.course_ids.filter(id => id !== String(course.id)) : [...form.course_ids, String(course.id)] })} />
              <span className="min-w-0 break-words"><span className="block font-semibold">{course.course_code} · {course.credit_hours ?? 0} credits</span><span className="text-slate-500">{course.course_name}{fixed && !checked ? ' · Already assigned' : ''}</span></span>
            </label>;
          })}
          {!form.programme_id && <p className="text-xs text-slate-400">Choose a programme to see its courses.</p>}
        </div>
      </fieldset>
      <button type="submit" disabled={saving || !form.programme_id} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save semester'}</button>
      {editing && <button type="button" disabled={saving} onClick={() => { setEditing(undefined); setForm(empty()); }} className="flex items-center gap-2 text-xs text-brand-blue"><Plus className="h-4 w-4" />Create another semester</button>}
      </fieldset>
    </form>
    <section className="uipro-card min-w-0 space-y-4 p-6 lg:col-span-2">
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Programme semesters</h3><button aria-label="Refresh semesters" onClick={load}><RefreshCw className="h-4 w-4 text-brand-blue" /></button></div>
      {loadError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-xs text-rose-700">Semester settings could not load; refresh to retry.</p>}
      {!loadError && !terms.length && <p className="py-8 text-center text-xs text-slate-400">No semesters configured; existing courses keep their current behaviour until assigned.</p>}
      {terms.map(term => <article key={term.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row dark:border-slate-700 dark:bg-slate-800">
        <div className="min-w-0 space-y-2"><h4 className="break-words text-sm font-bold">{term.name}</h4><p className="text-xs text-slate-500">{programmes.find(p => String(p.id) === term.programme_id)?.code} · {term.start_date} – {term.end_date}</p><p className="text-xs">{term.max_student_credits} credits maximum per student · {term.course_ids?.length ?? 0} courses</p><span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-900 dark:text-blue-200">{term.status}</span></div>
        <button disabled={saving} type="button" aria-label={`Edit ${term.name}`} onClick={() => { setEditing(term.id); setForm({ ...term, course_ids: term.course_ids || [] }); }} className="flex shrink-0 items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-brand-blue dark:border-slate-700 dark:bg-slate-900"><Pencil className="h-4 w-4" />Edit</button>
      </article>)}
    </section>
  </div>;
}
