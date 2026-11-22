// One readable line per audit entry: attendance edits are stored as JSON (who, which class, before/after);
// everything else is already a sentence and is shown as written.
export type AuditSummary = { title: string; changes: string[] };

type Snapshot = Record<string, unknown> | null | undefined;
const SHOW_VALUES = new Set(['status', 'method']);
const words = (key: string) => key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const value = (v: unknown) => (v === null || v === undefined || v === '' ? 'none' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));

export function auditSummary(details: string | null | undefined): AuditSummary {
  const text = (details || '').trim();
  if (!text) return { title: 'No details recorded', changes: [] };
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { title: text, changes: [] }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { title: text, changes: [] };
  const d = data as Record<string, unknown>;
  const title = [d.student_name, d.student_code, d.course_code, d.class_group && `Group ${d.class_group}`].filter(Boolean).join(' · ') || text;
  if (!('before' in d) && !('after' in d)) return { title, changes: [] };
  const before = d.before as Snapshot, after = (d.after as Snapshot) || {};
  if (!before) return { title, changes: [after.status ? `New record: ${value(after.status)}` : 'New record'] };
  if (!d.after) return { title, changes: ['Record removed'] };
  const changes = Object.keys(after)
    .filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .sort((a, b) => Number(SHOW_VALUES.has(b)) - Number(SHOW_VALUES.has(a)))
    .map(key => (SHOW_VALUES.has(key) ? `${words(key)}: ${value(before[key])} → ${value(after[key])}` : `${words(key)} changed`));
  return { title, changes: changes.length ? changes : ['No field changed'] };
}

// The full payload, indented when it is JSON so the details dialog is readable.
export const auditPayload = (details: string | null | undefined) => {
  if (!details) return '';
  try { return JSON.stringify(JSON.parse(details), null, 2); } catch { return details; }
};
