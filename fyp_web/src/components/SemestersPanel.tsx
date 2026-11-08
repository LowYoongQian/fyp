import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { BookOpen, CalendarDays, Check, Pencil, Save, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { apiService } from '../services/api';
import type { AcademicSemester, Course, Programme, SemesterWrite } from '../services/api';
import { CustomDropdown } from './CustomDropdown';
import { DialogShell } from './DialogShell';
import { LoadingRegion, ShimmerSemesterCards, ShimmerText } from './Shimmer';
import { DatePicker } from './DatePicker';
import { SemesterRolloverPreview } from './SemesterRolloverPreview';
import { TextInput } from './LimitedTextField';
import { useMalaysiaToday } from '../hooks/useMalaysiaToday';
import { swalConfirm, swalError, swalSuccess } from '../utils/swal';

const empty = (today: string): SemesterWrite => ({ name: '', programme_id: '', start_date: today, end_date: '', max_student_credits: 18, course_ids: [] });
const SEARCH_AT = 8; // A search box only earns its place once the list is long enough to scroll.
const detailOf = (error: unknown) => (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;

type CourseState = {
  /** Course data state from the parent, so a failed or pending load is never shown as "no courses". */
  coursesLoading?: boolean; coursesError?: boolean; onRetryCourses?: () => void; onOpenCourses?: () => void;
};
type Props = CourseState & { programmes: Programme[]; courses: Course[]; onSaved: () => void };

/** One semester form: on the page it creates; in the edit dialog (`stored` set) it changes that saved semester. */
function SemesterForm({ programmes, courses, stored, onDone, onCancel, coursesLoading = false, coursesError = false, onRetryCourses, onOpenCourses }: CourseState & {
  programmes: Programme[]; courses: Course[]; stored?: AcademicSemester; onDone: () => Promise<void>; onCancel?: () => void;
}) {
  const today = useMalaysiaToday();
  const [form, setForm] = useState<SemesterWrite>(() => stored ? { ...stored, course_ids: stored.course_ids || [] } : empty(today));
  const [saving, setSaving] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const editing = !!stored;
  const idPrefix = editing ? 'semester-edit' : 'semester-create';

  // Only newly chosen dates must be today or later; a saved past date that is left unchanged stays valid (the server compares with the stored row too).
  const endMin = form.start_date > today ? form.start_date : today;
  const dateError = form.start_date && form.start_date < today && form.start_date !== stored?.start_date ? 'The start date cannot be before today (Malaysia time).'
    : form.end_date && form.end_date < today && form.end_date !== stored?.end_date ? 'The end date cannot be before today (Malaysia time).'
    : form.start_date && form.end_date && form.end_date < form.start_date ? 'The end date must be on or after the start date.' : '';
  const datesReady = !!form.start_date && !!form.end_date && !dateError;

  const field = 'w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  const label = 'min-w-0 space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300';
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !datesReady) return;
    setSaving(true);
    try {
      await apiService.adminSaveSemester(form, stored?.id);
      if (!editing) { setForm(empty(today)); setCourseSearch(''); }
      await onDone();
      void swalSuccess('Semester saved', 'Dates and credit limits now apply.');
    } catch (error: unknown) {
      const detail = detailOf(error);
      await swalError('Semester not saved', typeof detail === 'string' ? detail : 'Check the dates, programme and credit limit, then try again.');
    } finally { setSaving(false); }
  };

  const inProgramme = courses.filter(course => String(course.programme_id) === form.programme_id);
  const available = inProgramme.filter(course => !course.semester_id);
  const assigned = inProgramme.length - available.length;
  const needle = courseSearch.trim().toLowerCase();
  const shown = needle ? inProgramme.filter(course => `${course.course_code} ${course.course_name}`.toLowerCase().includes(needle)) : inProgramme;
  const withoutProgramme = courses.filter(course => !course.programme_id).length;
  const toggleCourse = (id: string, checked: boolean) => setForm({ ...form, course_ids: checked ? form.course_ids.filter(value => value !== id) : [...form.course_ids, id] });

  const note = (text: React.ReactNode, tone = 'text-slate-500') => <p className={`rounded-xl bg-slate-50 p-3 text-xs leading-relaxed dark:bg-slate-800/60 ${tone}`}>{text}</p>;
  const courseList = () => {
    if (!form.programme_id) return note('Choose a programme to see its courses.');
    if (coursesLoading && !courses.length) return <LoadingRegion label="Loading courses…" className="space-y-2">{[0, 1, 2].map(index => <ShimmerText key={index} height="h-14" className="rounded-lg" />)}</LoadingRegion>;
    if (coursesError && !courses.length) return <div role="alert" className="space-y-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
      <p>Courses could not be loaded.</p>
      {onRetryCourses && <button type="button" onClick={onRetryCourses} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold dark:bg-slate-900"><RefreshCw className="h-3.5 w-3.5" />Retry</button>}
    </div>;
    if (!inProgramme.length) return <div className="space-y-2">
      {note('This programme has no courses yet. Add a course first.')}
      {onOpenCourses && <button type="button" onClick={onOpenCourses} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-brand-blue dark:border-slate-700 dark:bg-slate-900"><BookOpen className="h-4 w-4" />Create a course</button>}
      {withoutProgramme > 0 && note(`${withoutProgramme} existing course${withoutProgramme === 1 ? ' has' : 's have'} no programme, so ${withoutProgramme === 1 ? 'it' : 'they'} cannot be added here until one is assigned.`)}
    </div>;
    return <>
      {coursesError && <p role="alert" className="mb-2 rounded-xl bg-amber-50 p-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">The latest refresh failed; this list may be out of date.{onRetryCourses && <button type="button" onClick={onRetryCourses} className="ml-2 font-semibold underline">Retry</button>}</p>}
      <p aria-live="polite" className="mb-2 text-[11px] text-slate-500">{form.course_ids.length} selected · {available.length} available · {assigned} already in a semester</p>
      {inProgramme.length >= SEARCH_AT && <div className="relative mb-2"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input type="search" aria-label="Search courses" value={courseSearch} onChange={event => setCourseSearch(event.target.value)} placeholder="Search by code or name" className={`${field} !py-2 !pl-9`} /></div>}
      {!available.length && !editing && note('Every course in this programme already has a semester.')}
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {shown.map(course => {
          const fixed = !!course.semester_id;
          const id = String(course.id);
          const checked = form.course_ids.includes(id);
          return <button key={course.id} type="button" role="checkbox" aria-checked={checked} disabled={fixed || saving} onClick={() => toggleCourse(id, checked)}
            className={`flex w-full items-start gap-3 rounded-lg p-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:cursor-not-allowed ${checked ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-slate-50 hover:bg-blue-50/60 dark:bg-slate-800'} ${fixed ? 'opacity-70' : ''}`}>
            <span aria-hidden="true" className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'}`}>{checked && <Check className="h-3 w-3" />}</span>
            <span className="min-w-0 break-words"><span className="block font-semibold">{course.course_code} · {course.credit_hours ?? 0} credits</span>
              <span className="text-slate-500">{course.course_name}{fixed ? (checked ? ' · In this semester (locked)' : ' · Already assigned to another semester') : ''}</span></span>
          </button>;
        })}
        {!shown.length && <p className="p-2 text-xs text-slate-400">No course matches “{courseSearch}”.</p>}
      </div>
    </>;
  };

  const fields = <>
    <div className={label}><span>Study programme</span>{editing ? <p className={field}>{programmes.find(p => String(p.id) === form.programme_id)?.name}</p> : <CustomDropdown fullWidth className="w-full" ariaLabel="Semester programme" value={form.programme_id}
      options={[{ value: '', label: 'Select programme' }, ...programmes.map(p => ({ value: String(p.id), label: `${p.code} · ${p.name}` }))]}
      onChange={value => setForm({ ...form, programme_id: value, course_ids: [] })} />}
      {editing && <p className="text-[10px] text-slate-400">The saved programme is fixed to preserve history.</p>}</div>
    <label className={`block ${label}`}>Semester name<TextInput required aria-label="Semester name" className={field} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="2026 Semester 2" /></label>
    <div className="space-y-2">
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${editing ? '' : 'lg:grid-cols-1'}`}>
        <div className={label}><span>Start date</span><DatePicker label="Semester start date" value={form.start_date} today={today} min={today} invalid={!!dateError} describedBy={`${idPrefix}-date-help`} onChange={start_date => setForm({ ...form, start_date })} /></div>
        <div className={label}><span>End date</span><DatePicker label="Semester end date" value={form.end_date} today={today} min={endMin} invalid={!!dateError} describedBy={`${idPrefix}-date-help`} onChange={end_date => setForm({ ...form, end_date })} /></div>
      </div>
      <p id={`${idPrefix}-date-help`} className="text-[11px] text-slate-500">Dates before today are not selectable (Malaysia time, today is {today}).{stored && (stored.start_date < today || stored.end_date < today) ? ' A saved past date stays unless you change it.' : ''}</p>
      {dateError && <p role="alert" className="text-xs font-semibold text-rose-600">{dateError}</p>}
      {!dateError && (!form.start_date || !form.end_date) && <p className="text-[11px] text-slate-400">Choose both a start and an end date.</p>}
    </div>
    <label className={`block ${label}`}>Maximum academic credits per student<input required type="number" min="0.5" max="60" step="0.5" aria-label="Maximum student credits" className={field} value={form.max_student_credits} onChange={event => setForm({ ...form, max_student_credits: Number(event.target.value) })} /></label>
    <p className="text-[11px] text-slate-500">The most credits a student can enrol in.</p>
    <fieldset className="space-y-3"><legend className="mb-2 text-xs font-semibold">Courses in this semester</legend>
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">{courseList()}</div>
    </fieldset>
  </>;
  const saveButton = (extra = '') => <button type="submit" disabled={saving || !form.programme_id || !datesReady} className={`flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-xs font-bold text-white disabled:opacity-50 ${extra}`}><Save className="h-4 w-4" />{saving ? 'Saving…' : editing ? 'Save changes' : 'Save semester'}</button>;

  if (!editing) return <form onSubmit={save} className="uipro-card min-w-0 space-y-5 p-6 lg:col-span-1">
    <fieldset disabled={saving} className="min-w-0 space-y-5">
      <h3 className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="h-5 w-5 text-brand-blue" />Create semester</h3>
      <p className="text-xs leading-relaxed text-slate-500">The semester ends at the end of this date (Malaysia time).</p>
      {fields}
      {saveButton('w-full')}
    </fieldset>
  </form>;

  // The edit dialog: a fixed header and footer around a scrolling body, so Save and Cancel stay in reach on small screens.
  return <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
    <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
      <div className="min-w-0"><h3 id="semester-edit-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><Pencil className="h-4 w-4 text-brand-blue" />Edit semester</h3>
        <p className="mt-0.5 break-words text-xs text-slate-500">{stored.name} · ends at the end of its end date (Malaysia time)</p></div>
      <button type="button" aria-label="Close" disabled={saving} onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
    </header>
    <fieldset disabled={saving} className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">{fields}</fieldset>
    <footer className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
      <button type="button" disabled={saving} onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
      {saveButton()}
    </footer>
  </form>;
}

export function SemestersPanel({ programmes, courses, onSaved, ...courseState }: Props) {
  const [terms, setTerms] = useState<AcademicSemester[]>([]);
  const [editing, setEditing] = useState<AcademicSemester>();
  const [deleting, setDeleting] = useState<string>();
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    try { setTerms(await apiService.adminGetSemesters()); setLoadError(false); }
    catch { setLoadError(true); }
    finally { setLoaded(true); }
  };
  useEffect(() => {
    let active = true;
    apiService.adminGetSemesters().then(value => { if (active) { setTerms(value); setLoadError(false); } })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const remove = async (term: AcademicSemester) => {
    const count = term.course_ids?.length ?? 0;
    const courseText = count ? `Its ${count} course${count === 1 ? '' : 's'} stay with their students, classes and attendance, but leave this semester, so its dates and credit limit no longer apply to them.` : 'No courses are in this semester.';
    const ongoing = term.status === 'active' ? ' This semester is ongoing.' : '';
    if (!await swalConfirm(`Delete ${term.name}?`, `${courseText}${ongoing} Afterwards its courses and programme can be deleted.`, 'Delete semester', true)) return;
    setDeleting(term.id);
    try {
      await apiService.adminDeleteSemester(term.id);
      await load(); onSaved();
      void swalSuccess('Semester deleted', `${term.name} was removed.`);
    } catch (error) {
      const detail = detailOf(error);
      void swalError('Semester not deleted', typeof detail === 'string' ? detail : 'Please try again.');
    } finally { setDeleting(undefined); }
  };

  return <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <SemesterForm programmes={programmes} courses={courses} {...courseState} onDone={async () => { await load(); onSaved(); }} />
    <section className="uipro-card min-w-0 space-y-4 p-6 lg:col-span-2">
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Programme semesters</h3><button aria-label="Refresh semesters" onClick={load}><RefreshCw className="h-4 w-4 text-brand-blue" /></button></div>
      {loadError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-xs text-rose-700">Semester settings could not load; refresh to retry.</p>}
      {!loaded && !loadError && <ShimmerSemesterCards />}
      {loaded && !loadError && !terms.length && <p className="py-8 text-center text-xs text-slate-400">No semesters yet.</p>}
      {terms.map(term => <article key={term.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row dark:border-slate-700 dark:bg-slate-800">
        <div className="min-w-0 space-y-2"><h4 className="break-words text-sm font-bold">{term.name}</h4><p className="text-xs text-slate-500">{programmes.find(p => String(p.id) === term.programme_id)?.code} · {term.start_date} – {term.end_date}</p><p className="text-xs">{term.max_student_credits} credits maximum per student · {term.course_ids?.length ?? 0} courses</p><span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-900 dark:text-blue-200">{term.status}</span></div>
        <div className="flex shrink-0 gap-2 self-start">
          <button type="button" disabled={!!deleting} aria-label={`Edit ${term.name}`} onClick={() => setEditing(term)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-brand-blue disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><Pencil className="h-4 w-4" />Edit</button>
          <button type="button" disabled={!!deleting} aria-label={`Delete ${term.name}`} onClick={() => void remove(term)} className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:bg-slate-900 dark:hover:bg-rose-950/40"><Trash2 className="h-4 w-4" />{deleting === term.id ? 'Deleting…' : 'Delete'}</button>
        </div>
      </article>)}
    </section>
    {terms.length >= 2 && <SemesterRolloverPreview terms={terms} programmes={programmes} />}
    <AnimatePresence>
      {editing && <DialogShell key={editing.id} labelledBy="semester-edit-title" widthClass="max-w-2xl" onClose={() => setEditing(undefined)}>
        <SemesterForm programmes={programmes} courses={courses} {...courseState} stored={editing} onCancel={() => setEditing(undefined)}
          onDone={async () => { setEditing(undefined); await load(); onSaved(); }} />
      </DialogShell>}
    </AnimatePresence>
  </div>;
}
