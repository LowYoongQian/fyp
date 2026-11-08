import { TextInput } from '../../components/LimitedTextField';
import { SemestersPanel } from '../../components/SemestersPanel';
import { FloatingPanel } from '../../components/FloatingPanel';
import { RecordPagination } from '../../components/RecordPagination';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiService, clearApiCache } from '../../services/api';
import type { Programme, Course, LookupKind, LookupStudent, LookupStaff, LookupProgramme, LookupCourse, ProgrammeRecord, CourseRecord, AssignmentRecord, StudentRecord, AllocationCheck } from '../../services/api';
import { useLookup } from '../../hooks/useLookup';
import { useRecordPage } from '../../hooks/useRecordPage';
import { swalSuccess, swalError, swalConfirm } from '../../utils/swal';
import { Layers, BookOpen, UserCheck, GraduationCap, Plus, Trash2, ChevronDown, Check, RefreshCw, FolderOpen, Briefcase, Search, X, AlertCircle, CalendarDays } from 'lucide-react';
import { LoadingRegion, ShimmerAcademics, ShimmerText } from '../../components/Shimmer';

/** A bespoke picker's open list in the CustomDropdown look: pale selected and hover rows, rounded and padded, the scrollbar inside the rounded shell. */
const MenuPanel: React.FC<{ header?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode }> = ({ header, footer, children }) => (
  <FloatingPanel clip className="absolute left-0 right-0 mt-1.5 flex flex-col rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 dark:border-slate-800 dark:bg-slate-900">
    {header && <div className="mb-1.5 shrink-0">{header}</div>}
    <div className="custom-scrollbar min-h-0 max-h-52 space-y-0.5 overflow-y-auto pr-0.5">{children}</div>
    {footer && <div className="mt-1 shrink-0 border-t border-slate-100 pt-1 dark:border-slate-800">{footer}</div>}
  </FloatingPanel>
);

const MenuOption: React.FC<{ primary: string; secondary?: string; aside?: React.ReactNode; label?: string; selected?: boolean; disabled?: boolean; mono?: boolean; secondaryMono?: boolean; onSelect: () => void }> = ({ primary, secondary, aside, label, selected = false, disabled = false, mono = false, secondaryMono = false, onSelect }) => (
  <button type="button" disabled={disabled} aria-current={selected ? 'true' : undefined} aria-label={label ?? (secondary ? `${primary}, ${secondary}` : undefined)} onClick={onSelect}
    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${disabled ? 'cursor-not-allowed text-slate-400 dark:text-slate-500' : 'cursor-pointer'} ${selected
      ? 'bg-blue-50/90 text-brand-blue dark:bg-blue-500/10 dark:text-blue-400'
      : disabled ? '' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'}`}>
    <span className="flex min-w-0 flex-col">
      <span className={`truncate font-bold ${mono ? 'font-mono' : ''}`}>{primary}</span>
      {secondary && <span className={`truncate text-[10px] font-medium ${secondaryMono ? 'font-mono' : ''} ${selected ? 'text-blue-700/80 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>{secondary}</span>}
    </span>
    {aside}
    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-blue dark:text-blue-400" />}
  </button>
);

type OptionLook = { primary: string; secondary?: string; aside?: React.ReactNode; label?: string; disabled?: boolean; mono?: boolean; secondaryMono?: boolean };

/** A picker that searches on the server as you type, one small page at a time (ACADEMIC-SEARCH-11): it works the same with 100,000 records. */
function LookupMenu<T extends { id: string }>({ kind, params = {}, placeholder, option, selectedId, onSelect, before, emptyText = 'Nothing to choose yet.' }: {
  kind: LookupKind; params?: Record<string, string | undefined>; placeholder: string; option: (item: T) => OptionLook; selectedId: string;
  onSelect: (item: T) => void; before?: React.ReactNode; emptyText?: string;
}) {
  const lookup = useLookup<T>(kind, params);
  const searchRef = useRef<HTMLInputElement>(null);
  // The panel is hidden until it has been placed, so autoFocus would miss it; focus once it is showing.
  useEffect(() => { const frame = requestAnimationFrame(() => searchRef.current?.focus()); return () => cancelAnimationFrame(frame); }, []);
  const focusFirst = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    event.currentTarget.closest('[data-floating-panel]')?.querySelector<HTMLButtonElement>('.overflow-y-auto button:not([disabled])')?.focus();
  };
  return (
    <MenuPanel header={
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input ref={searchRef} type="search" value={lookup.query} onChange={event => lookup.setQuery(event.target.value)} onKeyDown={focusFirst} placeholder={placeholder} aria-label={placeholder}
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
      </div>
    }>
      {!lookup.query && before}
      {lookup.items.map(item => <MenuOption key={item.id} {...option(item)} selected={String(item.id) === selectedId} onSelect={() => onSelect(item)} />)}
      {lookup.status === 'loading' && <p role="status" className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">Searching…</p>}
      {lookup.status === 'error' && (
        <div role="alert" className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <span>Could not load the list.</span>
          <button type="button" onClick={lookup.retry} className="rounded-md px-2 py-1 font-bold text-brand-blue hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10">Try again</button>
        </div>
      )}
      {lookup.status === 'ready' && lookup.items.length === 0 && <p className="px-3 py-3 text-center text-xs text-slate-500 dark:text-slate-400">{lookup.query ? 'No matches.' : emptyText}</p>}
      {lookup.status === 'ready' && lookup.hasMore && (
        <button type="button" onClick={lookup.loadMore} className="w-full rounded-lg px-3 py-2 text-xs font-bold text-brand-blue hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10">Load more</button>
      )}
    </MenuPanel>
  );
}

/** A student in a picker: their programme and whether they already have a course this semester, so search results are never ambiguous. */
const studentOption = (s: LookupStudent): OptionLook => ({
  primary: s.name, secondary: `${s.student_code}${s.programme_code ? ` · ${s.programme_code}` : ' · No programme yet'}`, secondaryMono: true,
  aside: s.current_enrolled ? <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">Enrolled this semester</span> : undefined,
});

type ApiFailure = { response?: { status: number; data?: { detail?: string } } };
type SubTab = 'programmes' | 'courses' | 'staff' | 'students' | 'semesters';
type ListTab = Exclude<SubTab, 'semesters'>;
type Errors = Record<string, string | undefined>;
const PER_PAGE = 10;
const RECORD_KIND = { programmes: 'programmes', courses: 'courses', staff: 'assignments', students: 'students' } as const;
const TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: 'programmes', label: 'Programmes', icon: Layers },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'staff', label: 'Staff Roles', icon: Briefcase },
  { id: 'students', label: 'Student Allocation', icon: UserCheck },
  { id: 'semesters', label: 'Semesters', icon: CalendarDays },
];
const ROLES = ['Lecturer', 'Tutor', 'Practical'] as const;
const groupLabel = (group: string) => (group.startsWith('G') ? `Group ${group.slice(1)}` : group);
const detailOf = (error: unknown, fallback: string) => {
  const detail = (error as ApiFailure).response?.data?.detail;
  return typeof detail === 'string' && detail ? detail : fallback;
};

/** One labelled field: the label, the control, a short hint, and the field's own error right under it. */
const Field: React.FC<{ label: string; htmlFor?: string; error?: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, htmlFor, error, hint, children }) => (
  <div className="min-w-0 space-y-1.5">
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</label>
    {children}
    {hint && !error && <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p>}
    {error && <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}</p>}
  </div>
);

const INPUT = 'w-full uipro-input';
const INVALID = '!border-rose-400 !ring-2 !ring-rose-100 dark:!ring-rose-500/20';

/** A picker's trigger and its open list. Clicking outside or Escape closes it (FloatingPanel). */
const Picker: React.FC<{ id: string; name: string; value: string; placeholder: string; open: boolean; setOpen: (open: boolean) => void; disabled?: boolean; invalid?: boolean;
  describedBy?: string; children: React.ReactNode }> = ({ id, name, value, placeholder, open, setOpen, disabled, invalid, describedBy, children }) => (
  <div className="relative">
    {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />}
    <div className={`relative ${open ? 'z-50' : ''}`}>
      <button id={id} type="button" data-picker={name} disabled={disabled} aria-expanded={open} aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : describedBy} onClick={() => setOpen(!open)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm text-slate-800 shadow-sm transition-colors hover:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none disabled:hover:border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800/60 ${invalid ? INVALID : ''}`}>
        <span className={`min-w-0 truncate ${value ? 'font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>{value || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180 text-brand-blue' : 'text-slate-500'}`} />
      </button>
      {open && children}
    </div>
  </div>
);

/** The status of a course's semester in words people use, so a course kept from an ended semester is never shown as current. */
const STATUS_LOOK: Record<string, [string, string]> = {
  active: ['Current', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'],
  upcoming: ['Upcoming', 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'],
  ended: ['Ended', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'],
  undated: ['No semester', 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'],
};
const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const [text, look] = STATUS_LOOK[status] ?? STATUS_LOOK.undated;
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${look}`}>{text}</span>;
};

/** A row's delete button: a real target with a name that says what it removes. */
const RowDelete: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:hover:bg-rose-500/10">
    <Trash2 className="h-4 w-4" />
  </button>
);

/**
 * A tab's record list: search, a range like "11-20 of 60", the rows, paging, and clear loading, error, empty and no-match states. The
 * rows come one page at a time from the server, so the list stays bounded however many records exist.
 */
function RecordsPanel<T extends { id: string }>({ tab, title, search, onSearch, page, onPage, version, highlight, placeholder, empty, children, onSettled }: {
  tab: ListTab; title: string; search: string; onSearch: (value: string) => void; page: number; onPage: (page: number) => void; version: number;
  highlight?: string; placeholder: string; empty: string; children: (row: T, highlighted: boolean) => React.ReactNode; onSettled: () => void;
}) {
  const records = useRecordPage<T>(RECORD_KIND[tab], search, page, PER_PAGE, version);
  const data = records.data;
  useEffect(() => { if (records.status !== 'loading') onSettled(); }, [records.status, onSettled]);
  // The server answers with the page it really showed (a page past the end after a delete becomes the last page): keep them in step.
  // Only for the answer to this page; while the next page loads, the previous answer is still on screen.
  useEffect(() => { if (data && records.asked === page && data.page !== page) onPage(data.page); }, [data, records.asked, page, onPage]);
  const total = data?.total ?? 0;
  return (
    <section aria-labelledby={`${tab}-records-title`} className="uipro-card min-w-0 space-y-4 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <FolderOpen className="h-5 w-5 shrink-0 text-brand-blue" />
          <div className="min-w-0">
            <h3 id={`${tab}-records-title`} className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <p aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">{data ? `${total} ${total === 1 ? 'record' : 'records'}${search.trim() ? ' found' : ''}` : 'Loading…'}</p>
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" value={search} onChange={event => onSearch(event.target.value)} placeholder={placeholder} aria-label={placeholder}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          {search && <button type="button" onClick={() => onSearch('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>

      {records.status === 'error' && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <span>{data ? 'Could not refresh this list. What is shown may be out of date.' : 'This list could not be loaded.'}</span>
          <button type="button" onClick={records.retry} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold dark:border-rose-500/30 dark:bg-slate-900"><RefreshCw className="h-3.5 w-3.5" />Try again</button>
        </div>
      )}
      {!data && records.status === 'loading' && (
        <LoadingRegion label={`Loading ${title.toLowerCase()}…`} className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => <ShimmerText key={index} height="h-16" className="rounded-xl" />)}
        </LoadingRegion>
      )}
      {data && (
        <div aria-busy={records.status === 'loading'} className={`space-y-3 transition-opacity ${records.status === 'loading' ? 'opacity-60' : ''}`}>
          {data.items.length === 0
            ? <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{search.trim() ? `Nothing matches “${search.trim()}”.` : empty}</p>
            : data.items.map(row => <React.Fragment key={row.id}>{children(row, row.id === highlight)}</React.Fragment>)}
        </div>
      )}
      {data && total > 0 && <RecordPagination page={data.page} pageSize={PER_PAGE} total={total} onChange={onPage} />}
    </section>
  );
}

const ROW = (highlighted: boolean) => `rounded-xl border p-4 transition-colors ${highlighted
  ? 'border-emerald-300 bg-emerald-50/70 ring-2 ring-emerald-200 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:ring-emerald-500/20'
  : 'border-slate-200/70 bg-slate-50/70 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50'}`;

export const AcademicManager: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('programmes');
  const [ready, setReady] = useState(false);   // the first list answer has arrived: until then the whole page is its system skeleton
  const [syncing, setSyncing] = useState(false);
  // A list answered (data or an error): the page leaves its first-load skeleton, and a running Sync on that tab is done.
  const listSettled = useCallback(() => { setReady(true); setSyncing(false); }, []);
  const [search, setSearch] = useState<Record<ListTab, string>>({ programmes: '', courses: '', staff: '', students: '' });
  const [page, setPage] = useState<Record<ListTab, number>>({ programmes: 1, courses: 1, staff: 1, students: 1 });
  const [version, setVersion] = useState(0);
  const [highlight, setHighlight] = useState<{ tab: ListTab; id: string } | null>(null);

  // Semesters needs the full programme and course lists (its course checklist); they load the first time that tab is opened.
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [referenceState, setReferenceState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const loadReference = useCallback(async () => {
    setReferenceState('loading');
    // Each list applies on its own: a failed course list must not hide the programmes (the semester form still needs them).
    const [programmeList, courseList] = await Promise.allSettled([apiService.adminGetProgrammes(), apiService.adminGetCourses()]);
    if (programmeList.status === 'fulfilled') setProgrammes(programmeList.value);
    if (courseList.status === 'fulfilled') setCourses(courseList.value);
    setReferenceState(courseList.status === 'fulfilled' ? 'ready' : 'error');
  }, []);

  const searchFor = (tab: ListTab) => (value: string) => { setSearch(current => ({ ...current, [tab]: value })); setPage(current => ({ ...current, [tab]: 1 })); };
  const pageFor = useCallback((tab: ListTab) => (value: number) => setPage(current => (current[tab] === value ? current : { ...current, [tab]: value })), []);
  /** After a save: show the saved record (searched by its own code) and mark it, without moving the page. Other lists refresh quietly. */
  const showSaved = (tab: ListTab, code: string, id?: string) => {
    setSearch(current => ({ ...current, [tab]: code }));
    setPage(current => ({ ...current, [tab]: 1 }));
    setVersion(value => value + 1);
    if (id) { setHighlight({ tab, id }); window.setTimeout(() => setHighlight(current => (current?.id === id ? null : current)), 4000); }
  };
  const refresh = () => setVersion(value => value + 1);
  const sync = async () => {
    setSyncing(true);
    clearApiCache();
    refresh();
    if (referenceState !== 'idle') await loadReference();
    if (activeSubTab === 'semesters') setSyncing(false);   // a list tab stays busy until its list answers (listSettled)
  };

  // ---------------- Programmes ----------------
  const [progCode, setProgCode] = useState('');
  const [progName, setProgName] = useState('');
  const [progErrors, setProgErrors] = useState<Errors>({});
  const [savingProgramme, setSavingProgramme] = useState(false);
  const addProgramme = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingProgramme) return;
    const errors: Errors = { code: progCode.trim() ? undefined : 'Enter a programme code.', name: progName.trim() ? undefined : 'Enter the programme name.' };
    setProgErrors(errors);
    if (focusFirstError(errors, { code: 'programme-code', name: 'programme-name' })) return;
    setSavingProgramme(true);
    try {
      const saved = await apiService.adminCreateProgramme({ name: progName.trim(), code: progCode.trim() });
      setProgCode(''); setProgName(''); setProgErrors({});
      showSaved('programmes', saved.code, String(saved.id));
      if (referenceState !== 'idle') void loadReference();
      void swalSuccess('Programme added', `${saved.code} is ready to use.`);
    } catch (error) {
      const status = (error as ApiFailure).response?.status;
      if (status === 400 || status === 409) { setProgErrors({ code: detailOf(error, 'This code is already used.') }); focusById('programme-code'); }
      else void swalError(status ? 'Programme not added' : 'Could not confirm', status ? detailOf(error, 'Check the fields and try again.') : 'The connection failed. Check the list before trying again; your entries are kept.');
      if (!status) refresh();
    } finally { setSavingProgramme(false); }
  };
  const deleteProgramme = async (row: ProgrammeRecord) => {
    const affected = [row.student_count && `${row.student_count} student${row.student_count === 1 ? '' : 's'}`, row.course_count && `${row.course_count} course${row.course_count === 1 ? '' : 's'}`].filter(Boolean).join(' and ');
    const terms = 'Its upcoming and ended semesters are removed with it (an ongoing semester must be deleted first).';
    if (!await swalConfirm(`Delete ${row.code}?`, `${affected ? `${affected} will be left without a programme. Their records are kept.` : 'No students or courses use this programme.'} ${terms}`, 'Delete programme', true)) return;
    try {
      await apiService.adminDeleteProgramme(row.id);
      refresh();
      if (referenceState !== 'idle') void loadReference();
      void swalSuccess('Programme deleted', `${row.code} was removed.`);
    } catch (error) { void swalError('Programme not deleted', detailOf(error, 'Please try again.')); }
  };

  // ---------------- Courses ----------------
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseCredits, setCourseCredits] = useState('3');
  const [courseProgramme, setCourseProgramme] = useState<{ id: string; label: string } | null>(null);
  const [courseProgrammeOpen, setCourseProgrammeOpen] = useState(false);
  const [courseErrors, setCourseErrors] = useState<Errors>({});
  const [savingCourse, setSavingCourse] = useState(false);
  const addCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingCourse) return;
    const credits = Number(courseCredits);
    const errors: Errors = {
      code: courseCode.trim() ? undefined : 'Enter a course code.',
      name: courseName.trim() ? undefined : 'Enter the course title.',
      credits: courseCredits && Number.isFinite(credits) && credits >= 0.5 && credits <= 12 && credits * 2 === Math.round(credits * 2) ? undefined : 'Use 0.5 to 12 credits, in steps of 0.5.',
    };
    setCourseErrors(errors);
    if (focusFirstError(errors, { code: 'course-code', name: 'course-name', credits: 'course-credits' })) return;
    setSavingCourse(true);
    try {
      const saved = await apiService.adminCreateCourse({ course_name: courseName.trim(), course_code: courseCode.trim(), credit_hours: credits, lecturer_id: null, programme_id: courseProgramme?.id ?? null } as never);
      setCourseCode(''); setCourseName(''); setCourseCredits('3'); setCourseProgramme(null); setCourseErrors({});
      showSaved('courses', saved.course_code, String(saved.id));
      if (referenceState !== 'idle') void loadReference();
      void swalSuccess('Course added', `${saved.course_code} is ready to use.`);
    } catch (error) {
      const status = (error as ApiFailure).response?.status;
      const detail = detailOf(error, '');
      if (status && /code/i.test(detail)) { setCourseErrors({ code: detail }); focusById('course-code'); }
      else void swalError(status ? 'Course not added' : 'Could not confirm', status ? detail || 'Check the fields and try again.' : 'The connection failed. Check the list before trying again; your entries are kept.');
      if (!status) refresh();
    } finally { setSavingCourse(false); }
  };
  const deleteCourse = async (row: CourseRecord) => {
    const parts = [row.enrolment_count && `${row.enrolment_count} enrolment${row.enrolment_count === 1 ? '' : 's'}`, row.session_count && `${row.session_count} class session${row.session_count === 1 ? '' : 's'} with their attendance`].filter(Boolean);
    if (!await swalConfirm(`Delete ${row.course_code}?`, parts.length ? `This also permanently removes ${parts.join(' and ')}.` : 'No students or classes use this course yet.', 'Delete course', true)) return;
    try {
      await apiService.adminDeleteCourse(row.id);
      refresh();
      if (referenceState !== 'idle') void loadReference();
      void swalSuccess('Course deleted', `${row.course_code} was removed.`);
    } catch (error) { void swalError('Course not deleted', detailOf(error, 'Please try again.')); }
  };

  // ---------------- Staff roles ----------------
  const [assignStaff, setAssignStaff] = useState<{ id: string; label: string } | null>(null);
  const [assignCourse, setAssignCourse] = useState<{ id: string; label: string; code: string } | null>(null);
  const [assignRole, setAssignRole] = useState<(typeof ROLES)[number]>('Lecturer');
  const [assignStaffOpen, setAssignStaffOpen] = useState(false);
  const [assignCourseOpen, setAssignCourseOpen] = useState(false);
  const [assignErrors, setAssignErrors] = useState<Errors>({});
  const [savingAssignment, setSavingAssignment] = useState(false);
  const addAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingAssignment) return;
    const errors: Errors = { staff: assignStaff ? undefined : 'Choose a staff member.', course: assignCourse ? undefined : 'Choose a course.' };
    setAssignErrors(errors);
    if (focusFirstError(errors, { staff: 'assign-staff', course: 'assign-course' })) return;
    setSavingAssignment(true);
    try {
      const saved = await apiService.adminCreateAssignment({ course_id: assignCourse!.id, lecturer_id: assignStaff!.id, role: assignRole });
      const code = assignCourse!.code;
      setAssignStaff(null); setAssignCourse(null); setAssignErrors({});
      showSaved('staff', code, saved?.id ? String(saved.id) : undefined);
      void swalSuccess('Staff assigned', `${assignRole} role added for ${code}.`);
    } catch (error) {
      const status = (error as ApiFailure).response?.status;
      void swalError(status ? 'Not assigned' : 'Could not confirm', status ? detailOf(error, 'Please try again.') : 'The connection failed. Check the list before trying again; your entries are kept.');
      if (!status) refresh();
    } finally { setSavingAssignment(false); }
  };
  const deleteAssignment = async (row: AssignmentRecord) => {
    if (!await swalConfirm('Remove this teaching role?', `${row.lecturer_name} will no longer be the ${row.role.toLowerCase()} for ${row.course_code}. Past classes and attendance are kept.`, 'Remove role', true)) return;
    try {
      await apiService.adminDeleteAssignment(row.id);
      refresh();
      void swalSuccess('Role removed', `${row.lecturer_name} · ${row.course_code}`);
    } catch (error) { void swalError('Role not removed', detailOf(error, 'Please try again.')); }
  };

  // ---------------- Student allocation: one student, their programme, a valid course, its real semester and a group ----------------
  const [student, setStudent] = useState<LookupStudent | null>(null);
  const [programme, setProgramme] = useState<{ id: string; label: string } | null>(null);
  const [course, setCourse] = useState<LookupCourse | null>(null);
  const [group, setGroup] = useState('');
  const [semesterText, setSemesterText] = useState('');   // only for an older course without a semester
  // The answer for one course and student; anything else (no course yet, or another pick) reads as not loaded yet.
  const [checkAnswer, setCheckAnswer] = useState<{ key: string; data?: AllocationCheck; failed?: boolean } | null>(null);
  const [openPicker, setOpenPicker] = useState<'' | 'student' | 'programme' | 'course' | 'group'>('');
  const [allocErrors, setAllocErrors] = useState<Errors>({});
  const [savingAllocation, setSavingAllocation] = useState(false);
  const savingAllocationRef = useRef(false);
  const programmeFixed = !!student?.programme_id;
  const pickerOpen = (name: typeof openPicker) => (open: boolean) => setOpenPicker(open ? name : '');

  const manualGroups = (courseId: string): string[] => { try { return JSON.parse(localStorage.getItem(`sas_manual_groups_${courseId}`) || '[]'); } catch { return []; } };

  // A course was picked: fetch its real groups and the student's credits; choose the first group with room.
  const checkKey = course ? `${course.id}|${student?.id ?? ''}` : '';
  useEffect(() => {
    if (!checkKey) return;
    const [courseId, studentId] = checkKey.split('|');
    const controller = new AbortController();
    apiService.adminAllocationCheck(courseId, studentId || undefined, controller.signal).then(result => {
      setCheckAnswer({ key: checkKey, data: result });
      setGroup(current => current || result.groups.find(item => !item.full)?.group || '');
    }, () => { if (!controller.signal.aborted) setCheckAnswer({ key: checkKey, failed: true }); });
    return () => controller.abort();
  }, [checkKey]);
  const check = checkAnswer?.key === checkKey ? checkAnswer.data ?? null : null;
  const checkState = !checkKey ? 'idle' : checkAnswer?.key !== checkKey ? 'loading' : checkAnswer.failed ? 'error' : 'ready';
  const groups = (() => {
    if (!course || !check) return [];
    const known = new Map(check.groups.map(item => [item.group, item]));
    for (const extra of manualGroups(course.id)) if (!known.has(extra)) known.set(extra, { group: extra, count: 0, full: false });
    return [...known.values()].sort((a, b) => (parseInt(a.group.slice(1)) || 0) - (parseInt(b.group.slice(1)) || 0));
  })();

  const chooseStudent = (next: LookupStudent) => {
    setOpenPicker('');
    if (student?.id === next.id) return;
    setStudent(next);
    // Only what depends on the student is cleared: their programme (fixed when assigned), the course list and the group.
    setProgramme(next.programme_id ? { id: String(next.programme_id), label: next.programme_code || 'Assigned programme' } : programmeFixed ? null : programme);
    setCourse(null); setGroup(''); setAllocErrors({});
  };
  const chooseProgramme = (next: LookupProgramme) => {
    setOpenPicker('');
    if (programme?.id === String(next.id)) return;
    setProgramme({ id: String(next.id), label: `${next.code} - ${next.name}` });
    setCourse(null); setGroup('');
    setAllocErrors(current => ({ ...current, programme: undefined }));
  };
  const chooseCourse = (next: LookupCourse) => {
    setOpenPicker('');
    setCourse(next); setGroup('');
    setAllocErrors(current => ({ ...current, course: undefined, group: undefined }));
  };
  const addGroup = () => {
    if (!course) return;
    const highest = groups.reduce((max, item) => Math.max(max, parseInt(item.group.slice(1)) || 0), 0);
    const next = `G${highest + 1}`;
    try { localStorage.setItem(`sas_manual_groups_${course.id}`, JSON.stringify([...new Set([...manualGroups(course.id), next])])); } catch { /* the choice still applies to this save */ }
    setGroup(next); setOpenPicker('');
  };
  const resetAllocation = () => { setStudent(null); setProgramme(null); setCourse(null); setGroup(''); setSemesterText(''); setAllocErrors({}); setOpenPicker(''); };

  const semesterName = check?.semester?.name || course?.semester?.name || semesterText.trim();
  const saveAllocation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingAllocationRef.current) return;   // a second click while the first save runs (a ref: state only updates after the next render)
    const chosenGroup = groups.find(item => item.group === group);
    const errors: Errors = {
      student: student ? undefined : 'Choose a student.',
      programme: programme ? undefined : 'Choose the student’s programme.',
      course: course ? undefined : 'Choose a course.',
      semester: !course || semesterName ? undefined : 'Enter the semester for this course.',
      group: !course ? undefined : !group ? 'Choose a group.' : chosenGroup?.full ? 'This group is full. Choose another or add a group.' : undefined,
    };
    setAllocErrors(errors);
    if (focusFirstError(errors, { student: 'alloc-student', programme: 'alloc-programme', course: 'alloc-course', semester: 'alloc-semester', group: 'alloc-group' })) return;
    const allocation = { student_id: student!.id, programme_id: programme!.id, course_id: course!.id, semester: semesterName, class_group: group };
    savingAllocationRef.current = true;
    setSavingAllocation(true);
    let notice: () => Promise<unknown>;
    try {
      let saved;
      try {
        saved = await apiService.adminSaveStudentAllocation(allocation);
      } catch (error) {
        if ((error as ApiFailure).response && (error as ApiFailure).response!.status < 500) throw error;   // the system answered: that is the real reason
        saved = await apiService.adminSaveStudentAllocation(allocation);   // lost answer: repeating is safe, it says "already saved" if the first try went through
      }
      const code = student!.student_code, id = student!.id;
      resetAllocation();
      showSaved('students', code, id);
      notice = () => saved.programme_changed || saved.enrolled
        ? swalSuccess('Student enrolled', 'The programme and course enrolment were saved.')
        : swalSuccess('Already saved', 'This enrolment was already saved. Nothing changed.');
    } catch (error) {
      const answer = (error as ApiFailure).response;
      if (!answer || answer.status >= 500) refresh();
      notice = answer && answer.status < 500
        ? () => swalError('Not enrolled', answer.data?.detail || 'Please check the choices and try again.')
        : () => swalError('Could not confirm', "The connection failed, so we can't tell if this was saved. The list was refreshed; please check it before trying again. What you entered is kept.");
    }
    savingAllocationRef.current = false;
    setSavingAllocation(false);
    await notice();
  };

  // Before the first list answer the whole page is the Academic Manager skeleton; afterwards everything stays and only parts refresh.
  const skeleton = !ready && activeSubTab !== 'semesters';
  const header = (
    <div className="uipro-card flex flex-col items-start justify-between gap-4 bg-white/75 p-5 backdrop-blur-md sm:flex-row sm:items-center sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-slate-800 dark:text-slate-100"><GraduationCap className="h-5 w-5 text-brand-blue" />Academics</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Programmes, courses, teaching roles, enrolments and semesters.</p>
      </div>
      <button type="button" onClick={sync} disabled={syncing} aria-busy={syncing}
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 disabled:cursor-wait dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <RefreshCw className={`h-4 w-4 text-slate-500 ${syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} />Sync Records
      </button>
    </div>
  );

  const formCard = (title: string, icon: React.ElementType, children: React.ReactNode) => {
    const Icon = icon;
    return (
      <div className="uipro-card min-w-0 space-y-5 self-start p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Icon className="h-5 w-5 text-brand-blue" />{title}</h3>
        {children}
      </div>
    );
  };
  const actions = (primary: string, busy: boolean, busyText: string, onReset?: () => void, dirty = false) => (
    <div className="flex items-center gap-2 pt-1">
      <button type="submit" disabled={busy} aria-busy={busy} className="uipro-button uipro-button-primary flex-1 disabled:cursor-wait disabled:opacity-60">{busy ? busyText : primary}</button>
      {onReset && <button type="button" onClick={onReset} disabled={busy || !dirty} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Reset</button>}
    </div>
  );

  const listFor = (tab: ListTab) => (
    tab === 'programmes' ? (
      <RecordsPanel<ProgrammeRecord> tab="programmes" key="programmes" title="Programmes" placeholder="Search code or name" empty="No programmes yet. Add the first one with the form."
        search={search.programmes} onSearch={searchFor('programmes')} page={page.programmes} onPage={pageFor('programmes')} version={version} onSettled={listSettled}
        highlight={highlight?.tab === 'programmes' ? highlight.id : undefined}>
        {(row, lit) => (
          <div className={`${ROW(lit)} flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold text-brand-blue">{row.code}</p>
              <p className="break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{row.name}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{row.student_count} student{row.student_count === 1 ? '' : 's'} · {row.course_count} course{row.course_count === 1 ? '' : 's'}</p>
            </div>
            <RowDelete label={`Delete programme ${row.code}`} onClick={() => void deleteProgramme(row)} />
          </div>
        )}
      </RecordsPanel>
    ) : tab === 'courses' ? (
      <RecordsPanel<CourseRecord> tab="courses" key="courses" title="Courses" placeholder="Search code, title or programme" empty="No courses yet. Add the first one with the form."
        search={search.courses} onSearch={searchFor('courses')} page={page.courses} onPage={pageFor('courses')} version={version} onSettled={listSettled}
        highlight={highlight?.tab === 'courses' ? highlight.id : undefined}>
        {(row, lit) => (
          <div className={`${ROW(lit)} flex items-start justify-between gap-3`}>
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold text-brand-blue">{row.course_code}</span><StatusPill status={row.semester?.status ?? 'undated'} /></p>
              <p className="break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{row.course_name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{row.credit_hours ?? 0} credits · {row.programme_code ? `${row.programme_code} - ${row.programme_name}` : 'No programme'}{row.semester ? ` · ${row.semester.name} (${row.semester.start_date} – ${row.semester.end_date})` : ''}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{row.enrolment_count} enrolled · {row.session_count} class session{row.session_count === 1 ? '' : 's'}</p>
            </div>
            <RowDelete label={`Delete course ${row.course_code}`} onClick={() => void deleteCourse(row)} />
          </div>
        )}
      </RecordsPanel>
    ) : tab === 'staff' ? (
      <RecordsPanel<AssignmentRecord> tab="staff" key="staff" title="Teaching roles" placeholder="Search staff, course or role" empty="No teaching roles yet. Assign staff with the form."
        search={search.staff} onSearch={searchFor('staff')} page={page.staff} onPage={pageFor('staff')} version={version} onSettled={listSettled}
        highlight={highlight?.tab === 'staff' ? highlight.id : undefined}>
        {(row, lit) => (
          <div className={`${ROW(lit)} flex items-center justify-between gap-3`}>
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-slate-800 dark:text-slate-100">{row.lecturer_name}</span><span className="font-mono text-xs text-slate-500">{row.staff_id}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.role === 'Lecturer' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : row.role === 'Tutor' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>{row.role}</span></p>
              <p className="break-words text-xs text-slate-600 dark:text-slate-300"><span className="font-mono font-bold text-brand-blue">{row.course_code}</span> {row.course_name}</p>
            </div>
            <RowDelete label={`Remove ${row.role} role of ${row.lecturer_name} for ${row.course_code}`} onClick={() => void deleteAssignment(row)} />
          </div>
        )}
      </RecordsPanel>
    ) : (
      <RecordsPanel<StudentRecord> tab="students" key="students" title="Student enrolments" placeholder="Search student, ID, programme or course" empty="No students yet."
        search={search.students} onSearch={searchFor('students')} page={page.students} onPage={pageFor('students')} version={version} onSettled={listSettled}
        highlight={highlight?.tab === 'students' ? highlight.id : undefined}>
        {(row, lit) => (
          <div className={`${ROW(lit)} space-y-3`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="break-words text-sm font-bold text-slate-800 dark:text-slate-100">{row.name}</p><p className="font-mono text-xs text-slate-500">{row.student_code}</p></div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.programme_code ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`} title={row.programme_name ?? undefined}>{row.programme_code ?? 'No programme yet'}</span>
            </div>
            {row.enrolments.length === 0
              ? <p className="text-xs text-slate-500 dark:text-slate-400">No courses yet.</p>
              : <ul className="space-y-2">{row.enrolments.map(item => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <div className="min-w-0 text-xs">
                    <p className="flex flex-wrap items-center gap-2"><span className="font-mono font-bold text-brand-blue">{item.course_code}</span><span className="break-words font-medium text-slate-700 dark:text-slate-200">{item.course_name}</span></p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400">{groupLabel(item.class_group)}{item.semester_name ? ` · ${item.semester_name}` : ''}<StatusPill status={item.status} /></p>
                  </div>
                  <RowDelete label={`Drop ${item.course_code} for ${row.name}`} onClick={async () => {
                    if (!await swalConfirm(`Drop ${item.course_code}?`, `${row.name} will no longer be enrolled in ${item.course_code}. Their past attendance is kept.`, 'Drop course', true)) return;
                    try { await apiService.adminDeleteEnrolment(item.id); refresh(); void swalSuccess('Course dropped', `${item.course_code} · ${row.name}`); }
                    catch (error) { void swalError('Course not dropped', detailOf(error, 'Please try again.')); }
                  }} />
                </li>
              ))}</ul>}
          </div>
        )}
      </RecordsPanel>
    )
  );

  const formFor = (tab: ListTab) => {
    if (tab === 'programmes') return formCard('Add programme', Plus, (
      <form noValidate onSubmit={addProgramme} className="space-y-4">
        <Field label="Programme code" htmlFor="programme-code" error={progErrors.code}>
          <TextInput id="programme-code" type="text" placeholder="e.g. BCSF" value={progCode} aria-invalid={!!progErrors.code || undefined} aria-describedby={progErrors.code ? 'programme-code-error' : undefined}
            onChange={event => { setProgCode(event.target.value.toUpperCase()); setProgErrors(current => ({ ...current, code: undefined })); }} className={`${INPUT} ${progErrors.code ? INVALID : ''}`} />
        </Field>
        <Field label="Programme name" htmlFor="programme-name" error={progErrors.name}>
          <TextInput id="programme-name" type="text" placeholder="e.g. Bachelor of Computer Science (Honours)" value={progName} aria-invalid={!!progErrors.name || undefined} aria-describedby={progErrors.name ? 'programme-name-error' : undefined}
            onChange={event => { setProgName(event.target.value); setProgErrors(current => ({ ...current, name: undefined })); }} className={`${INPUT} ${progErrors.name ? INVALID : ''}`} />
        </Field>
        {actions('Add programme', savingProgramme, 'Adding…', () => { setProgCode(''); setProgName(''); setProgErrors({}); }, !!(progCode || progName))}
      </form>
    ));
    if (tab === 'courses') return formCard('Add course', Plus, (
      <form noValidate onSubmit={addCourse} className="space-y-4">
        <Field label="Course code" htmlFor="course-code" error={courseErrors.code}>
          <TextInput id="course-code" type="text" placeholder="e.g. CS-202" value={courseCode} aria-invalid={!!courseErrors.code || undefined} aria-describedby={courseErrors.code ? 'course-code-error' : undefined}
            onChange={event => { setCourseCode(event.target.value.toUpperCase()); setCourseErrors(current => ({ ...current, code: undefined })); }} className={`${INPUT} ${courseErrors.code ? INVALID : ''}`} />
        </Field>
        <Field label="Course title" htmlFor="course-name" error={courseErrors.name}>
          <TextInput id="course-name" type="text" placeholder="e.g. Database Management Systems" value={courseName} aria-invalid={!!courseErrors.name || undefined} aria-describedby={courseErrors.name ? 'course-name-error' : undefined}
            onChange={event => { setCourseName(event.target.value); setCourseErrors(current => ({ ...current, name: undefined })); }} className={`${INPUT} ${courseErrors.name ? INVALID : ''}`} />
        </Field>
        <Field label="Credits" htmlFor="course-credits" error={courseErrors.credits} hint="Academic credits, 0.5 to 12.">
          <input id="course-credits" type="number" min="0.5" max="12" step="0.5" value={courseCredits} aria-invalid={!!courseErrors.credits || undefined} aria-describedby={courseErrors.credits ? 'course-credits-error' : undefined}
            onChange={event => { setCourseCredits(event.target.value); setCourseErrors(current => ({ ...current, credits: undefined })); }} className={`${INPUT} ${courseErrors.credits ? INVALID : ''}`} />
        </Field>
        <Field label="Programme (optional)" htmlFor="course-programme" hint="A course in a programme can only be taken by that programme’s students.">
          <Picker id="course-programme" name="course-programme" value={courseProgramme?.label ?? ''} placeholder="No programme" open={courseProgrammeOpen} setOpen={setCourseProgrammeOpen}>
            <LookupMenu<LookupProgramme> kind="programmes" placeholder="Search programme code or name"
              before={<MenuOption primary="No programme" selected={!courseProgramme} onSelect={() => { setCourseProgramme(null); setCourseProgrammeOpen(false); }} />}
              option={p => ({ primary: p.code, secondary: p.name })} selectedId={courseProgramme?.id ?? ''}
              onSelect={p => { setCourseProgramme({ id: String(p.id), label: `${p.code} - ${p.name}` }); setCourseProgrammeOpen(false); }} />
          </Picker>
        </Field>
        {actions('Add course', savingCourse, 'Adding…', () => { setCourseCode(''); setCourseName(''); setCourseCredits('3'); setCourseProgramme(null); setCourseErrors({}); }, !!(courseCode || courseName || courseProgramme || courseCredits !== '3'))}
      </form>
    ));
    if (tab === 'staff') return formCard('Assign staff', Plus, (
      <form noValidate onSubmit={addAssignment} className="space-y-4">
        <Field label="Staff member" htmlFor="assign-staff" error={assignErrors.staff}>
          <Picker id="assign-staff" name="assign-staff" value={assignStaff?.label ?? ''} placeholder="Choose staff" open={assignStaffOpen} setOpen={setAssignStaffOpen} invalid={!!assignErrors.staff}>
            <LookupMenu<LookupStaff> kind="staff" placeholder="Search name, staff ID or email"
              option={s => ({ primary: s.name, secondary: s.staff_id, secondaryMono: true })} selectedId={assignStaff?.id ?? ''}
              onSelect={s => { setAssignStaff({ id: String(s.id), label: `${s.name} (${s.staff_id})` }); setAssignStaffOpen(false); setAssignErrors(current => ({ ...current, staff: undefined })); }} />
          </Picker>
        </Field>
        <Field label="Course" htmlFor="assign-course" error={assignErrors.course}>
          <Picker id="assign-course" name="assign-course" value={assignCourse?.label ?? ''} placeholder="Choose a course" open={assignCourseOpen} setOpen={setAssignCourseOpen} invalid={!!assignErrors.course}>
            <LookupMenu<LookupCourse> kind="courses" placeholder="Search course code or name"
              option={c => ({ primary: c.course_code, secondary: c.course_name, mono: true })} selectedId={assignCourse?.id ?? ''}
              onSelect={c => { setAssignCourse({ id: String(c.id), label: `${c.course_code} - ${c.course_name}`, code: c.course_code }); setAssignCourseOpen(false); setAssignErrors(current => ({ ...current, course: undefined })); }} />
          </Picker>
        </Field>
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold text-slate-700 dark:text-slate-200">Teaching role</legend>
          <div role="radiogroup" aria-label="Teaching role" className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
            {ROLES.map(role => (
              <button key={role} type="button" role="radio" aria-checked={assignRole === role} onClick={() => setAssignRole(role)}
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 ${assignRole === role ? 'bg-white text-brand-blue shadow-sm dark:bg-slate-900 dark:text-blue-300' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'}`}>{role}</button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">The role this person has in this course, whatever their account role is.</p>
        </fieldset>
        {actions('Assign staff', savingAssignment, 'Assigning…', () => { setAssignStaff(null); setAssignCourse(null); setAssignRole('Lecturer'); setAssignErrors({}); }, !!(assignStaff || assignCourse))}
      </form>
    ));
    const chosenGroup = groups.find(item => item.group === group);
    const creditsAfter = check?.credits_used != null && course ? check.credits_used + Number(check.course_credits ?? course.credit_hours ?? 0) : null;
    return formCard('Enrol student', Plus, (
      <form noValidate onSubmit={saveAllocation} className="space-y-4">
        <Field label="Student" htmlFor="alloc-student" error={allocErrors.student} hint="Students without a course this semester are listed first; search to find anyone.">
          <Picker id="alloc-student" name="student" value={student ? `${student.name} (${student.student_code})` : ''} placeholder="Choose a student" open={openPicker === 'student'} setOpen={pickerOpen('student')} invalid={!!allocErrors.student}>
            <LookupMenu<LookupStudent> kind="students" placeholder="Search name, student ID or email" emptyText="Everyone has a course this semester. Search to find an enrolled student."
              option={studentOption} selectedId={student?.id ?? ''} onSelect={chooseStudent} />
          </Picker>
        </Field>
        <Field label="Programme" htmlFor="alloc-programme" error={allocErrors.programme}
          hint={programmeFixed ? 'A student keeps one programme. Courses are added from it.' : !student ? 'Choose the student first.' : 'This becomes the student’s programme.'}>
          {programmeFixed
            ? <p id="alloc-programme" data-picker="programme" className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">{programme?.label}</p>
            : <Picker id="alloc-programme" name="programme" value={programme?.label ?? ''} placeholder="Choose a programme" open={openPicker === 'programme'} setOpen={pickerOpen('programme')} disabled={!student} invalid={!!allocErrors.programme}>
                <LookupMenu<LookupProgramme> kind="programmes" placeholder="Search programme code or name" option={p => ({ primary: p.code, secondary: p.name })} selectedId={programme?.id ?? ''} onSelect={chooseProgramme} />
              </Picker>}
        </Field>
        <Field label="Course" htmlFor="alloc-course" error={allocErrors.course} hint={!student ? 'Choose the student first.' : !programme ? 'Choose the programme first.' : 'Only courses from this programme are offered.'}>
          <Picker id="alloc-course" name="course" value={course ? `${course.course_code} - ${course.course_name}` : ''} placeholder="Choose a course" open={openPicker === 'course'} setOpen={pickerOpen('course')} disabled={!student || !programme} invalid={!!allocErrors.course}>
            <LookupMenu<LookupCourse> kind="courses" placeholder="Search course code or name" params={{ programme_id: programme?.id, student_id: student?.id }}
              emptyText="No more courses to add from this programme. Search to see all of them."
              option={c => ({ primary: c.course_code, secondary: `${c.course_name}${c.semester ? ` · ${c.semester.name} (${c.semester.status})` : ''}`, mono: true,
                disabled: c.enrolled || c.semester?.status === 'ended',
                aside: c.enrolled ? <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Already taking</span>
                  : c.semester?.status === 'ended' ? <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Ended</span> : undefined })}
              selectedId={course?.id ?? ''} onSelect={chooseCourse} />
          </Picker>
        </Field>
        {course && (
          course.semester || check?.semester
            ? <Field label="Semester" htmlFor="alloc-semester"><p id="alloc-semester" className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">{semesterName} <span className="text-xs text-slate-500">({(check?.semester ?? course.semester)!.start_date} – {(check?.semester ?? course.semester)!.end_date})</span></p></Field>
            : <Field label="Semester" htmlFor="alloc-semester" error={allocErrors.semester} hint="This course has no semester; type the term it belongs to.">
                <TextInput id="alloc-semester" type="text" value={semesterText} onChange={event => { setSemesterText(event.target.value); setAllocErrors(current => ({ ...current, semester: undefined })); }} placeholder="e.g. 2026 Semester 1"
                  aria-invalid={!!allocErrors.semester || undefined} className={`${INPUT} ${allocErrors.semester ? INVALID : ''}`} />
              </Field>
        )}
        <Field label="Group" htmlFor="alloc-group" error={allocErrors.group} hint={!course ? 'Choose a course first.' : checkState === 'error' ? 'Group seats could not be loaded.' : undefined}>
          <Picker id="alloc-group" name="group" value={group ? `${groupLabel(group)}${chosenGroup ? ` · ${chosenGroup.count} of 25` : ''}` : ''} placeholder={checkState === 'loading' ? 'Loading groups…' : 'Choose a group'}
            open={openPicker === 'group'} setOpen={pickerOpen('group')} disabled={!course || checkState !== 'ready'} invalid={!!allocErrors.group}>
            <MenuPanel footer={
              <button type="button" onClick={addGroup} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold text-brand-blue transition-colors hover:bg-blue-50/90 dark:text-blue-400 dark:hover:bg-blue-500/10">
                <Plus className="h-3.5 w-3.5" />Create New Group
              </button>
            }>
              {groups.map(item => (
                <MenuOption key={item.group} primary={groupLabel(item.group)} label={`${groupLabel(item.group)}, ${item.count} of 25${item.full ? ', full' : ''}`} disabled={item.full} selected={group === item.group}
                  aside={<span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${item.full ? 'bg-danger-red-light text-danger-red' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{item.count} / 25 {item.full ? '(Full)' : ''}</span>}
                  onSelect={() => { setGroup(item.group); setOpenPicker(''); setAllocErrors(current => ({ ...current, group: undefined })); }} />
              ))}
            </MenuPanel>
          </Picker>
        </Field>
        {student && course && (
          <dl data-allocation-summary aria-label="About to save" className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs dark:border-blue-500/20 dark:bg-blue-500/10">
            <dt className="text-slate-500 dark:text-slate-400">Student</dt><dd className="min-w-0 break-words font-semibold text-slate-800 dark:text-slate-100">{student.name} ({student.student_code})</dd>
            <dt className="text-slate-500 dark:text-slate-400">Programme</dt><dd className="min-w-0 break-words font-semibold text-slate-800 dark:text-slate-100">{programme?.label}{!programmeFixed && ' (new)'}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Course</dt><dd className="min-w-0 break-words font-semibold text-slate-800 dark:text-slate-100">{course.course_code} - {course.course_name}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Group</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{group ? groupLabel(group) : '—'}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Semester</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{semesterName || '—'}</dd>
            {creditsAfter != null && check?.credits_limit != null && <><dt className="text-slate-500 dark:text-slate-400">Credits</dt>
              <dd className={`font-semibold ${creditsAfter > check.credits_limit ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>{creditsAfter} of {check.credits_limit} after saving{creditsAfter > check.credits_limit ? ' — over the limit' : ''}</dd></>}
          </dl>
        )}
        {actions('Save Student Allocation', savingAllocation, 'Saving Allocation...', resetAllocation, !!student)}
      </form>
    ));
  };

  // One tree, hidden behind the skeleton until the first list answers: the list that is loading is the one shown (no second fetch).
  return (
    <>
    {skeleton && <ShimmerAcademics tab={activeSubTab} />}
    <div className={skeleton ? 'hidden' : 'space-y-6'}>
      {header}
      <nav aria-label="Academic sections" className="flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-200/60 bg-slate-100/60 p-1 text-xs dark:border-slate-700 dark:bg-slate-800/60 sm:w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button key={tab.id} type="button" aria-current={active ? 'page' : undefined} onClick={() => { setActiveSubTab(tab.id); setOpenPicker(''); if (tab.id === 'semesters' && referenceState === 'idle') void loadReference(); }}
              className={`flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 ${active ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </nav>
      {activeSubTab === 'semesters'
        ? <SemestersPanel programmes={programmes} courses={courses} onSaved={() => { void loadReference(); refresh(); }} coursesLoading={referenceState === 'loading'} coursesError={referenceState === 'error'} onRetryCourses={loadReference} onOpenCourses={() => setActiveSubTab('courses')} />
        : <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
            {formFor(activeSubTab)}
            {listFor(activeSubTab)}
          </div>}
    </div>
    </>
  );
};

/** Marks the first field with an error and moves keyboard focus to it. Returns true when there was one. */
function focusFirstError(errors: Errors, ids: Record<string, string>) {
  const first = Object.keys(ids).find(key => errors[key]);
  if (first) focusById(ids[first]);
  return !!first;
}
function focusById(id: string) {
  window.requestAnimationFrame(() => document.getElementById(id)?.focus());
}
