export const STAFF_PAGE_LINKS = [
  { id: 'timetable', label: 'Timetable' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'risk', label: 'At-Risk Students' },
  { id: 'course_announcements', label: 'Course Notices' },
  { id: 'chatbot', label: 'AI Assistant' },
] as const;

export type StaffPageId = (typeof STAFF_PAGE_LINKS)[number]['id'];

const storageKey = (userId: string | number) => `sas_staff_recent_pages:${userId}`;

export function readRecentStaffPages(userId: string | number): StaffPageId[] {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
    const validIds = new Set<string>(STAFF_PAGE_LINKS.map(page => page.id));
    return Array.isArray(stored)
      ? stored.filter((id): id is StaffPageId => typeof id === 'string' && validIds.has(id)).slice(0, 4)
      : [];
  } catch {
    return [];
  }
}

export function recordRecentStaffPage(userId: string | number, pageId: string) {
  if (!STAFF_PAGE_LINKS.some(page => page.id === pageId)) return;
  const next = [pageId as StaffPageId, ...readRecentStaffPages(userId).filter(id => id !== pageId)].slice(0, 4);
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
}
