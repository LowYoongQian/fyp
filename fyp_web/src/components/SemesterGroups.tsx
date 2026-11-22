import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { apiService } from '../services/api';
import type { AcademicSemester, GroupChange, GroupPreview, GroupRoster, GroupSaveResult } from '../services/api';
import { DialogShell } from './DialogShell';
import { LoadingRegion, ShimmerText } from './Shimmer';
import { swalChoose, swalConfirm, swalError, swalSuccess } from '../utils/swal';
import { detailOf } from '../utils/groupChanges';

const order = (group: string) => parseInt(group.slice(1)) || 0;

/** Programme scope, explained before anything is saved: the programme group, the courses that follow it and the ones that stay. */
function programmeChangeText(change: GroupChange, termName: string) {
  const moving = change.courses_moving ?? [], staying = change.courses_unchanged ?? [];
  return `Programme group for ${termName}: ${change.from ?? 'none'} → ${change.to}. `
    + (moving.length ? `Courses moving with them: ${moving.join(', ')}. ` : 'No course enrolment changes. ')
    + (staying.length ? `Courses staying in their own group: ${staying.join(', ')}. ` : '')
    + 'Enrolments and past attendance are kept.';
}

/** From the next-semester preview: who keeps their group, where new students go, and who needs a decision. Saved only when confirmed. */
export function SemesterGroupCarry({ source, target }: { source: string; target: string }) {
  const [plan, setPlan] = useState<GroupPreview | null>(null);
  const [busy, setBusy] = useState<'' | 'preview' | 'save'>('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<GroupSaveResult | null>(null);
  const run = useRef<AbortController | null>(null);   // the parent keys this by source and target, so a new choice starts clean
  useEffect(() => () => run.current?.abort(), []);

  const load = async () => {
    run.current?.abort();
    const controller = run.current = new AbortController();
    setBusy('preview'); setError('');
    try {
      const answer = await apiService.adminPreviewGroups({ source_semester_id: source, target_semester_id: target }, controller.signal);
      if (run.current === controller) setPlan(answer);
    } catch (caught) {
      if (!controller.signal.aborted) { setPlan(null); setError(detailOf(caught, 'The group preview could not be loaded. Try again.')); }
    } finally { if (run.current === controller) setBusy(''); }
  };
  const save = async () => {
    if (!plan || busy) return;
    const rows = plan.proposals.map(item => ({ student_id: item.student_id, class_group: item.class_group }));
    const returning = plan.proposals.filter(item => item.reason === 'returning').length;
    if (!await swalConfirm(`Save groups for ${plan.target.name}?`,
      `${returning} returning and ${rows.length - returning} new student${rows.length - returning === 1 ? '' : 's'} will be placed as shown. ${plan.note}`, 'Save groups')) return;
    setBusy('save'); setError('');
    try {
      const saved = await apiService.adminSaveGroups(target, rows);   // safe to repeat: anyone already placed is left exactly where they are
      setResult(saved);
      void swalSuccess('Groups saved', `${saved.saved} placed${saved.already ? `, ${saved.already} already in place` : ''}${saved.skipped.length ? `, ${saved.skipped.length} skipped (see the list)` : ''}.`);
      setBusy('');
      await load();
    } catch (caught) { setError(detailOf(caught, 'The groups were not saved. Try again.')); setBusy(''); }
  };

  const ready = !!source && !!target;
  return <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700" data-group-carry>
    <div className="space-y-1"><h4 className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-brand-blue" />Groups for the next semester</h4>
      <p className="text-xs text-slate-500">Returning classmates keep their group. New students fill the first group with space (25 seats) before another opens. Only group membership is saved: nobody is enrolled in a course.</p></div>
    <button type="button" disabled={!ready || !!busy} onClick={() => void load()} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-brand-blue disabled:opacity-50 dark:border-slate-700">
      <Users className="h-4 w-4" />{busy === 'preview' ? 'Checking groups…' : plan ? 'Refresh group preview' : 'Preview groups'}</button>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
    {busy === 'preview' && !plan && <LoadingRegion label="Checking groups…"><ShimmerText height="h-16" className="rounded-xl" /></LoadingRegion>}
    {plan && <div className="space-y-3" aria-busy={!!busy}>
      {plan.blocking.map(text => <p key={text} role="alert" className="flex items-start gap-2 text-xs text-rose-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{text}</p>)}
      {plan.groups.length > 0 && <table className="w-full text-left text-xs" aria-label="Group seats after saving">
        <thead className="text-slate-500"><tr><th className="py-1 font-semibold">Group</th><th className="font-semibold">Already placed</th><th className="font-semibold">Returning</th><th className="font-semibold">New</th><th className="font-semibold">Seats</th></tr></thead>
        <tbody>{plan.groups.map(row => <tr key={row.group} className="border-t border-slate-100 dark:border-slate-800">
          <td className="py-1.5 font-mono font-bold">{row.group}</td><td>{row.already}</td><td>{row.returning}</td><td>{row.new}</td>
          <td className={row.total >= plan.capacity ? 'font-bold text-amber-700 dark:text-amber-300' : ''}>{row.total} of {plan.capacity}</td></tr>)}</tbody>
      </table>}
      {plan.review.length > 0 && <div className="space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" data-group-review>
        <p className="font-bold">Needs a decision ({plan.review.length}) — not placed automatically</p>
        <ul className="space-y-0.5">{plan.review.map(item => <li key={item.student_id}><span className="font-mono">{item.student_code}</span> {item.name}: {item.reason}</li>)}</ul></div>}
      {plan.proposals.length > 0 && <details className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60"><summary className="cursor-pointer font-bold">Placements to save ({plan.proposals.length})</summary>
        <ul className="mt-2 space-y-0.5">{[...plan.proposals].sort((a, b) => order(a.class_group) - order(b.class_group)).map(item => <li key={item.student_id}>
          <span className="font-mono font-bold">{item.class_group}</span> · <span className="font-mono">{item.student_code}</span> {item.name} <span className="text-slate-500">({item.reason === 'returning' ? 'returning' : 'new'})</span></li>)}</ul></details>}
      {plan.already_placed.length > 0 && <p className="text-xs text-slate-500">{plan.already_placed.length} student{plan.already_placed.length === 1 ? ' is' : 's are'} already placed in {plan.target.name} and will not be moved.</p>}
      {result && result.skipped.length > 0 && <ul className="space-y-0.5 text-xs text-amber-800 dark:text-amber-300">{result.skipped.map((item, index) => <li key={`${item.student_id}-${index}`}>{item.student_code ?? 'A student'}: {item.reason}</li>)}</ul>}
      <button type="button" disabled={!!busy || plan.blocking.length > 0 || !plan.proposals.length} onClick={() => void save()}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-xs font-bold text-white disabled:opacity-50">
        <Save className="h-4 w-4" />{busy === 'save' ? 'Saving groups…' : plan.proposals.length ? `Save ${plan.proposals.length} placement${plan.proposals.length === 1 ? '' : 's'}` : 'Nothing to save'}</button>
    </div>}
  </div>;
}

/** One semester's programme groups: add, move or remove a student. Each change says that it applies to the programme group. */
export function SemesterGroupsDialog({ term, onClose }: { term: AcademicSemester; onClose: () => void }) {
  const [roster, setRoster] = useState<GroupRoster | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState('');
  const load = async () => {
    try { setRoster(await apiService.adminGroupRoster(term.id)); setError(''); }
    catch (caught) { setError(detailOf(caught, 'The groups could not be loaded.')); }
  };
  useEffect(() => {
    const controller = new AbortController();
    apiService.adminGroupRoster(term.id, controller.signal).then(setRoster, caught => { if (!controller.signal.aborted) setError(detailOf(caught, 'The groups could not be loaded.')); });
    return () => controller.abort();
  }, [term.id]);

  const groupNames = roster ? roster.groups.map(item => item.group) : [];
  const nextGroup = `G${Math.max(0, ...groupNames.map(order)) + 1}`;
  const place = async (person: { student_id: string; name: string }, current: string | null) => {
    if (working || !roster) return;
    const options: Record<string, string> = {};
    for (const item of roster.groups) if (item.group !== current) options[item.group] = `${item.group} · ${item.count} of ${roster.capacity}${item.count >= roster.capacity ? ' (full)' : ''}`;
    options[nextGroup] = `${nextGroup} · new group`;
    const to = await swalChoose(current ? `Move ${person.name}` : `Add ${person.name} to a group`, `Programme group for ${term.name}.`, options);
    if (!to) return;
    setWorking(person.student_id);
    try {
      const preview = await apiService.adminPlaceInGroup(term.id, person.student_id, to, true);
      if (await swalConfirm(current ? `Move to ${to}?` : `Add to ${to}?`, programmeChangeText(preview, term.name), current ? 'Move student' : 'Add student')) {
        await apiService.adminPlaceInGroup(term.id, person.student_id, to);
        void swalSuccess(current ? 'Student moved' : 'Student added', `${person.name} · ${to}`);
      }
    } catch (caught) { void swalError('Not saved', detailOf(caught, 'Please try again.')); }
    setWorking('');
    await load();
  };
  const remove = async (person: { student_id: string; name: string }, group: string) => {
    if (working || !await swalConfirm(`Remove ${person.name} from ${group}?`,
      `This removes the programme group for ${term.name} only. Their course enrolments, course groups and attendance stay.`, 'Remove from group', true)) return;
    setWorking(person.student_id);
    try { await apiService.adminRemoveFromGroup(term.id, person.student_id); void swalSuccess('Removed from group', person.name); }
    catch (caught) { void swalError('Not removed', detailOf(caught, 'Please try again.')); }
    setWorking('');
    await load();
  };

  const button = 'inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold disabled:opacity-50 dark:border-slate-700';
  return <DialogShell labelledBy="semester-groups-title" widthClass="max-w-3xl" onClose={onClose}>
    <div className="max-h-[80vh] space-y-4 overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-3">
        <div><h3 id="semester-groups-title" className="text-base font-bold">Groups · {term.name}</h3>
          <p className="text-xs text-slate-500">Programme groups for this semester. A change here applies to the programme group; to change one course only, use Change group on the student’s enrolment.</p></div>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {!roster && !error && <LoadingRegion label="Loading groups…" className="space-y-2">{[0, 1].map(index => <ShimmerText key={index} height="h-16" className="rounded-xl" />)}</LoadingRegion>}
      {roster && <>
        {roster.read_only && <p role="status" className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">This semester has ended, so its groups are kept exactly as they were.</p>}
        {!roster.groups.length && <p className="text-xs text-slate-500">No groups yet. Carry groups forward from the next semester preview, or add students below.</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{roster.groups.map(item => <section key={item.group} aria-label={`Group ${item.group}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="mb-2 flex items-center justify-between text-xs font-bold"><span className="font-mono">{item.group}</span><span className={item.count >= roster.capacity ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}>{item.count} of {roster.capacity}</span></p>
          <ul className="space-y-1">{item.members.map(member => <li key={member.student_id} className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 break-words"><span className="font-mono">{member.student_code}</span> {member.name}{!member.recorded && <span className="text-slate-400" title="Taken from their course groups"> · from courses</span>}</span>
            {!roster.read_only && <span className="flex shrink-0 gap-1">
              <button type="button" disabled={!!working} onClick={() => void place(member, item.group)} className={`${button} text-brand-blue`} aria-label={`Move ${member.name}`}><ArrowRightLeft className="h-3 w-3" />Move</button>
              {member.recorded && <button type="button" disabled={!!working} onClick={() => void remove(member, item.group)} className={`${button} text-rose-600`} aria-label={`Remove ${member.name} from ${item.group}`}><Trash2 className="h-3 w-3" />Remove</button>}
            </span>}
          </li>)}</ul>
        </section>)}</div>
        {roster.review.length > 0 && <section className="space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-bold">Course groups disagree — choose their programme group</p>
          {roster.review.map(person => <p key={person.student_id} className="flex items-center justify-between gap-2"><span><span className="font-mono">{person.student_code}</span> {person.name} ({person.groups.join(', ')})</span>
            {!roster.read_only && <button type="button" disabled={!!working} onClick={() => void place(person, null)} className={button}>Choose group</button>}</p>)}
        </section>}
        {!roster.read_only && roster.unplaced.length > 0 && <section className="space-y-1 text-xs">
          <p className="font-bold">In the programme, no group this semester ({roster.unplaced.length})</p>
          <ul className="space-y-1">{roster.unplaced.map(person => <li key={person.student_id} className="flex items-center justify-between gap-2">
            <span><span className="font-mono">{person.student_code}</span> {person.name}</span>
            <button type="button" disabled={!!working} onClick={() => void place(person, null)} className={`${button} text-brand-blue`} aria-label={`Add ${person.name} to a group`}><Plus className="h-3 w-3" />Add to group</button>
          </li>)}</ul>
        </section>}
      </>}
    </div>
  </DialogShell>;
}
