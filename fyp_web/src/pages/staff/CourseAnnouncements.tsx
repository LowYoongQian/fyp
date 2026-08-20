import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Calendar, CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Edit2, ExternalLink, File, Link2, Megaphone, Paperclip, Plus, Search, Send, Trash2, Upload, Users, X } from 'lucide-react';
import { apiService } from '../../services/api';
import type { Announcement, CourseAnnouncementOption } from '../../services/api';
import { ShimmerAdminPanel } from '../../components/Shimmer';
import { swalConfirmDelete, swalError, swalSuccess } from '../../utils/swal';

const SelectMenu = ({ value, options, onChange, label }: { value: string; options: { value: string; label: string; detail?: string }[]; onChange: (value: string) => void; label: string }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => String(option.value) === String(value));
  return <div className="relative" onBlur={event => !event.currentTarget.contains(event.relatedTarget as Node | null) && setOpen(false)}>
    <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)} className={`flex h-12 w-full items-center gap-3 rounded-xl border px-4 text-left transition-all ${open ? 'border-brand-blue bg-white ring-4 ring-brand-blue/10' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}>
      <span key={String(selected?.value || value)} className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-800">{selected?.label || `Select ${label.toLowerCase()}`}</span>{selected?.detail && <span className="block truncate text-[10px] text-slate-400">{selected.detail}</span>}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-brand-blue' : ''}`} />
    </button>
    {open && <div className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
      {options.map(option => { const isSelected = String(option.value) === String(value); return <button key={option.value} type="button" onClick={() => { onChange(String(option.value)); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{option.label}</span>{option.detail && <span className="block truncate text-[10px] text-slate-400">{option.detail}</span>}</span>{isSelected && <Check className="h-4 w-4 shrink-0 text-blue-600" />}</button>; })}
    </div>}
  </div>;
};

const DateTimePicker = ({ value, onChange, label, align = 'left', minValue }: { value: string; onChange: (value: string) => void; label: string; align?: 'left' | 'right'; minValue?: string }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = value ? new Date(`${value}:00`) : new Date();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [draftDate, setDraftDate] = useState(value.slice(0, 10));
  const [hour, setHour] = useState(initial.getHours() % 12 || 12);
  const [minute, setMinute] = useState(initial.getMinutes());
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.getHours() >= 12 ? 'PM' : 'AM');

  useEffect(() => {
    if (!value) return;
    const next = new Date(`${value}:00`);
    setDraftDate(value.slice(0, 10)); setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setHour(next.getHours() % 12 || 12); setMinute(next.getMinutes()); setPeriod(next.getHours() >= 12 ? 'PM' : 'AM');
  }, [value]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthName = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const leading = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [...Array(leading).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const todayValue = (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; })();
  const selectedLabel = value ? new Date(`${value}:00`).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : `Select ${label.toLowerCase()}`;
  const minDate = minValue?.slice(0, 10);
  const apply = () => {
    const date = draftDate || todayValue;
    const hours24 = (hour % 12) + (period === 'PM' ? 12 : 0);
    onChange(`${date}T${String(hours24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    setOpen(false);
  };

  return <div ref={rootRef} className="relative">
    <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(current => !current)} className={`flex h-12 w-full items-center gap-2 rounded-xl border bg-slate-50 px-3.5 text-left text-xs font-semibold transition-all ${open ? 'border-brand-blue bg-white ring-4 ring-brand-blue/10' : 'border-slate-200 hover:border-blue-300 hover:bg-white'}`}>
      <Calendar className="h-4 w-4 shrink-0 text-blue-600" /><span key={value || label} className={`min-w-0 flex-1 truncate ${value ? 'text-slate-800' : 'text-slate-400'}`}>{selectedLabel}</span><ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-blue-600' : ''}`} />
    </button>
    {open && <div role="dialog" aria-label={`${label} date and time`} className={`absolute bottom-full z-[80] mb-2 w-[320px] max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${align === 'right' ? 'right-0' : 'left-0'}`}>
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3"><button type="button" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button><p key={`${year}-${monthIndex}`} className="text-xs font-extrabold text-slate-800 animate-in fade-in slide-in-from-bottom-1 duration-150">{monthName}</p><button type="button" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button></div>
      <div className="mb-1 grid grid-cols-7 text-center text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day => <span key={day} className="py-1">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">{cells.map((day, index) => {
        if (!day) return <span key={`empty-${index}`} />;
        const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const disabled = Boolean(minDate && date < minDate);
        const selected = date === draftDate;
        return <button key={date} type="button" disabled={disabled} onClick={() => setDraftDate(date)} className={`aspect-square rounded-lg text-[11px] font-bold transition-all ${disabled ? 'cursor-not-allowed text-slate-300' : selected ? 'bg-blue-600 text-white shadow-sm' : date === todayValue ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-slate-700 hover:bg-slate-100 hover:text-blue-700'}`}>{day}</button>;
      })}</div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase text-slate-500"><Clock className="h-3.5 w-3.5 text-blue-600" /> Time</div><div className="flex items-center justify-between gap-2"><div className="flex items-center rounded-lg border border-slate-200 bg-white"><button type="button" onClick={() => setHour(current => current === 1 ? 12 : current - 1)} className="h-9 w-8 text-slate-500 hover:text-blue-600">−</button><span className="w-7 text-center text-xs font-extrabold tabular-nums text-slate-800">{String(hour).padStart(2, '0')}</span><button type="button" onClick={() => setHour(current => current === 12 ? 1 : current + 1)} className="h-9 w-8 text-slate-500 hover:text-blue-600">+</button></div><span className="font-extrabold text-slate-400">:</span><div className="flex items-center rounded-lg border border-slate-200 bg-white"><button type="button" onClick={() => setMinute(current => (current + 55) % 60)} className="h-9 w-8 text-slate-500 hover:text-blue-600">−</button><span className="w-7 text-center text-xs font-extrabold tabular-nums text-slate-800">{String(minute).padStart(2, '0')}</span><button type="button" onClick={() => setMinute(current => (current + 5) % 60)} className="h-9 w-8 text-slate-500 hover:text-blue-600">+</button></div><div className="flex rounded-lg bg-slate-200 p-0.5">{(['AM','PM'] as const).map(value => <button key={value} type="button" onClick={() => setPeriod(value)} className={`h-8 rounded-md px-2.5 text-[10px] font-extrabold transition ${period === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>{value}</button>)}</div></div></div>
      <div className="mt-4 flex gap-2"><button type="button" onClick={() => { onChange(''); setDraftDate(''); setOpen(false); }} className="h-9 flex-1 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-50">Clear</button><button type="button" onClick={apply} className="h-9 flex-[1.5] rounded-xl bg-blue-600 text-[10px] font-extrabold text-white shadow-sm hover:bg-blue-700">Apply date & time</button></div>
    </div>}
  </div>;
};

export const CourseAnnouncements: React.FC = () => {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [courses, setCourses] = useState<CourseAnnouncementOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [group, setGroup] = useState('all');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState<'ready' | 'uploading' | 'saving' | 'complete' | 'error'>('ready');
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [notices, options] = await Promise.all([apiService.lecturerGetCourseAnnouncements(), apiService.lecturerGetCourseAnnouncementOptions()]);
      setRows(notices); setCourses(options); setCourseId(current => current || options[0]?.id || '');
    } catch { await swalError('Load Failed', 'Course notices could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const course = courses.find(item => String(item.id) === String(courseId));
  const filtered = useMemo(() => rows.filter(row => `${row.title} ${row.content} ${row.target_course_code}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const reset = () => { setTitle(''); setContent(''); setPriority('Medium'); setStart(''); setEnd(''); setLink(''); setFile(null); setGroup('all'); setUploadProgress(0); setUploadState('ready'); setDragActive(false); };
  const startCreate = () => { setEditing(null); reset(); setOpen(true); };
  const startEdit = (row: Announcement) => {
    const selectedCourse = courses.find(item => item.course_code === row.target_course_code);
    setEditing(row); setCourseId(String(selectedCourse?.id || '')); setGroup(row.target_group || 'all');
    setTitle(row.title); setContent(row.content); setPriority(row.priority || 'Medium');
    setStart(row.publish_start?.slice(0, 16) || ''); setEnd(row.publish_end?.slice(0, 16) || '');
    setLink(row.external_link || ''); setFile(null); setUploadProgress(0); setUploadState('ready'); setOpen(true);
  };
  const chooseFile = (nextFile: File | null) => {
    if (!nextFile) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(nextFile.type)) return void swalError('Wrong File', 'Use PDF, PNG, JPG, DOC, or DOCX.');
    if (nextFile.size > 5 * 1024 * 1024) return void swalError('File Too Large', 'Use a file under 5 MB.');
    setFile(nextFile); setUploadProgress(0); setUploadState('ready');
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!courseId || !title.trim() || !content.trim()) return swalError('Missing Details', 'Add a course, title, and message.');
    if (end && start && new Date(end) <= new Date(start)) return swalError('Check Dates', 'Expiry must be later.');
    setSubmitting(true);
    const data = new FormData();
    data.append('course_id', courseId); data.append('target_group', group); data.append('title', title.trim()); data.append('content', content.trim()); data.append('priority', priority);
    if (start) data.append('publish_start', new Date(start).toISOString());
    if (end) data.append('publish_end', new Date(end).toISOString());
    if (link.trim()) data.append('external_link', link.trim());
    if (file) data.append('attachment', file);
    try {
      if (file) { setUploadProgress(1); setUploadState('uploading'); }
      const trackUpload = (percent: number) => {
        setUploadProgress(percent);
        setUploadState(percent >= 99 ? 'saving' : 'uploading');
      };
      const saved = editing
        ? await apiService.lecturerUpdateCourseAnnouncement(editing.id, data, trackUpload)
        : await apiService.lecturerCreateCourseAnnouncement(data, trackUpload);
      if (file) { setUploadProgress(100); setUploadState('complete'); }
      setRows(current => editing ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current]);
      setOpen(false); setEditing(null); reset();
      await swalSuccess(editing ? 'Notice Updated' : 'Notice Sent', `${saved.recipient_count || 0} students notified.`);
    } catch (error: any) { if (file) setUploadState('error'); await swalError('Send Failed', error.response?.data?.detail || 'Try again.'); }
    finally { setSubmitting(false); }
  };
  const remove = async (row: Announcement) => {
    if (!await swalConfirmDelete(row.title)) return;
    try { await apiService.lecturerDeleteCourseAnnouncement(row.id); setRows(current => current.filter(item => item.id !== row.id)); await swalSuccess('Notice Deleted', 'The course notice was removed.'); }
    catch { await swalError('Delete Failed', 'Try again.'); }
  };
  if (loading) return <ShimmerAdminPanel />;
  return <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
    <section className="uipro-card flex flex-col gap-5 border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Megaphone className="h-5 w-5" /></div><div><p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Course communication</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">Course Notices</h1><p className="mt-1 text-xs text-slate-500">Send one update to every enrolled student.</p></div></div>
      <button onClick={startCreate} disabled={!courses.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 text-xs font-extrabold text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-50"><Plus className="h-4 w-4" /> New Notice</button>
    </section>
    <div className="grid gap-4 sm:grid-cols-3">
      {[['Total notices', rows.length, Megaphone, 'text-blue-600 bg-blue-50'], ['Courses reached', new Set(rows.map(row => row.target_course_code)).size, Users, 'text-emerald-600 bg-emerald-50'], ['Scheduled', rows.filter(row => row.publish_start && new Date(row.publish_start) > new Date()).length, CalendarClock, 'text-amber-600 bg-amber-50']].map(([label, value, Icon, color]: any) => <div key={label} className="uipro-card flex items-center gap-4 bg-white p-5"><div className={`rounded-xl p-3 ${color}`}><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-extrabold text-slate-900">{value}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p></div></div>)}
    </div>
    <section className="uipro-card bg-white p-5"><div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-extrabold text-slate-900">My notices</h2><p className="text-[10px] text-slate-500">Only you and administrators can manage these.</p></div><label className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:w-72"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notices..." className="w-full bg-transparent text-xs outline-none" /></label></div>
      <div className="space-y-3">{filtered.length ? filtered.map(row => <article key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-blue-200 hover:bg-white hover:shadow-sm"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-100 px-2.5 py-1 text-[9px] font-extrabold text-blue-700">{row.target_course_code}</span><span className="rounded-full bg-slate-200 px-2.5 py-1 text-[9px] font-bold text-slate-600">{row.target_group?.toLowerCase() === 'all' ? 'All groups' : row.target_group}</span><span className="text-[9px] font-bold text-slate-400">{new Date(row.created_at).toLocaleString()}</span></div><h3 className="text-sm font-extrabold text-slate-900">{row.title}</h3><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{row.content}</p><div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold">{row.attachment_name && <span className="flex items-center gap-1 text-blue-600"><Paperclip className="h-3.5 w-3.5" />{row.attachment_name}</span>}{row.external_link && <a href={row.external_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600"><ExternalLink className="h-3.5 w-3.5" />Open link</a>}</div></div><div className="flex shrink-0 gap-1"><button onClick={() => startEdit(row)} className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" aria-label="Edit notice"><Edit2 className="h-4 w-4" /></button><button onClick={() => remove(row)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label="Delete notice"><Trash2 className="h-4 w-4" /></button></div></div></article>) : <div className="py-16 text-center"><Bell className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">No course notices</p><p className="text-xs text-slate-400">Create your first notice when ready.</p></div>}</div>
    </section>
    {open && createPortal(<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}><form onSubmit={submit} role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-brand-blue"><Send className="h-5 w-5" /></div><div><h2 className="text-base font-extrabold text-slate-900">{editing ? 'Edit Course Notice' : 'New Course Notice'}</h2><p className="text-[10px] text-slate-500">Everyone selected below will be notified.</p></div></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><div className="announcement-modal-scroll flex-1 space-y-4 overflow-y-auto px-6 py-5">
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><label className="text-[10px] font-extrabold uppercase text-slate-500">Course</label><SelectMenu label="Course" value={courseId} onChange={value => { setCourseId(value); setGroup('all'); }} options={courses.map(item => ({ value: String(item.id), label: item.course_code, detail: item.course_name }))} /></div><div className="space-y-1.5"><label className="text-[10px] font-extrabold uppercase text-slate-500">Audience</label><SelectMenu label="Audience" value={group} onChange={setGroup} options={[{ value: 'all', label: 'All enrolled groups', detail: 'Notify every student' }, ...(course?.groups || []).map(value => ({ value, label: value, detail: 'This group only' }))]} /></div></div>
      <div className="space-y-1.5"><label className="text-[10px] font-extrabold uppercase text-slate-500">Title</label><input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} className="uipro-input w-full" placeholder="e.g. Class room changed" /></div>
      <div className="space-y-1.5"><label className="text-[10px] font-extrabold uppercase text-slate-500">Message</label><textarea value={content} onChange={e => setContent(e.target.value)} maxLength={2000} className="announcement-content-scroll uipro-input min-h-28 w-full resize-none" placeholder="Write a short course update..." /></div>
      <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-1.5"><label className="text-[10px] font-extrabold uppercase text-slate-500">Priority</label><SelectMenu label="Priority" value={priority} onChange={setPriority} options={['High','Medium','Low'].map(value => ({ value, label: value }))} /></div><div className="space-y-1.5"><label className="text-[10px] font-extrabold uppercase text-slate-500">Publish</label><DateTimePicker label="Publish" value={start} onChange={value => { setStart(value); if (end && value && new Date(end) <= new Date(value)) setEnd(''); }} /></div><div className="space-y-1.5"><label className="text-[10px] font-extrabold uppercase text-slate-500">Expiry</label><DateTimePicker label="Expiry" value={end} onChange={setEnd} minValue={start} align="right" /></div></div>
      <div className="space-y-1.5"><label className="text-[10px] font-extrabold uppercase text-slate-500">Link (optional)</label><div className="relative"><Link2 className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="url" value={link} onChange={e => setLink(e.target.value)} className="uipro-input w-full !pl-11 !pr-4" placeholder="https://..." /></div></div>
      <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" hidden onChange={e => { chooseFile(e.target.files?.[0] || null); e.target.value = ''; }} /><div role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()} onClick={() => !submitting && fileRef.current?.click()} onDragEnter={e => { e.preventDefault(); setDragActive(true); }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragActive(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragActive(false); }} onDrop={e => { e.preventDefault(); setDragActive(false); if (!submitting) chooseFile(e.dataTransfer.files?.[0] || null); }} className={`w-full cursor-pointer rounded-2xl border-2 border-dashed p-4 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 ${dragActive ? 'scale-[1.01] border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40'}`}><div className="flex min-h-16 items-center gap-3"><div className="rounded-xl bg-white p-2.5 text-brand-blue shadow-sm">{file ? <File className="h-5 w-5" /> : <Upload className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700">{dragActive ? 'Drop file to add it' : file?.name || 'Choose or drop a course file'}</p><p className="text-[10px] text-slate-400">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, image, DOC or DOCX · Max 5 MB'}</p></div>{file && !submitting && <button type="button" onClick={e => { e.stopPropagation(); setFile(null); setUploadProgress(0); setUploadState('ready'); }} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove file"><X className="h-4 w-4" /></button>}</div>{file && <div className="mt-3 border-t border-slate-200 pt-3"><div className="mb-1.5 flex items-center justify-between text-[10px] font-bold"><span className={uploadState === 'error' ? 'text-rose-600' : uploadState === 'complete' ? 'text-emerald-600' : 'text-slate-500'}>{uploadState === 'ready' ? 'Ready to upload' : uploadState === 'uploading' ? 'Uploading to server' : uploadState === 'saving' ? 'Saving securely' : uploadState === 'complete' ? 'Upload complete' : 'Upload failed'}</span><span className="tabular-nums text-slate-600">{uploadProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full transition-[width] duration-200 ease-out ${uploadState === 'error' ? 'bg-rose-500' : uploadState === 'complete' ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${uploadProgress}%` }} /></div></div>}</div>
    </div><footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button type="button" onClick={() => setOpen(false)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-600">Cancel</button><button disabled={submitting} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-blue px-6 text-xs font-extrabold text-white shadow-lg disabled:opacity-60"><Send className="h-4 w-4" />{submitting ? 'Saving...' : editing ? 'Update Notice' : 'Send Notice'}</button></footer></form></div>, document.body)}
  </div>;
};
