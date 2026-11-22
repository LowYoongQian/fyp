import { apiService } from '../services/api';
import { swalChoose, swalConfirm, swalError, swalSuccess } from './swal';

export const detailOf = (caught: unknown, fallback: string) => {
  const detail = (caught as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};

/** Course scope: one enrolment changes group; the programme group stays. Shown before it is saved. Resolves true when saved. */
export async function changeCourseGroup(enrolment: { id: string; course_id: string; course_code: string; class_group: string }, studentName: string): Promise<boolean> {
  try {
    const check = await apiService.adminAllocationCheck(enrolment.course_id);
    const options = Object.fromEntries(check.groups.filter(item => item.group !== enrolment.class_group)
      .map(item => [item.group, `${item.group} · ${item.count} of 25${item.full ? ' (full)' : ''}`]));
    if (!Object.keys(options).length) { void swalError('No other group', `${enrolment.course_code} has only ${enrolment.class_group}. Create another group from Enrol student first.`); return false; }
    const to = await swalChoose(`Change ${enrolment.course_code} group`, `${studentName} is in ${enrolment.class_group}. This changes ${enrolment.course_code} only.`, options);
    if (!to) return false;
    const preview = await apiService.moveCourseGroup(enrolment.id, to, true);
    if (!await swalConfirm(`Move to ${to} in ${enrolment.course_code}?`,
      `Only ${enrolment.course_code} changes: ${preview.from} → ${preview.to}.${preview.programme_group ? ` Their programme group stays ${preview.programme_group}.` : ''} Past attendance is kept.`, 'Change group')) return false;
    await apiService.moveCourseGroup(enrolment.id, to);
    void swalSuccess('Group changed', `${studentName} · ${enrolment.course_code} ${to}`);
    return true;
  } catch (caught) { void swalError('Group not changed', detailOf(caught, 'Please try again.')); return false; }
}
