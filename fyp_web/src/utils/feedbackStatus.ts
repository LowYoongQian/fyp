/** What the server stores for a feedback report. */
export type FeedbackStatus = 'Pending' | 'In Progress' | 'Resolved';

/** The words each side sees. The stored values never change; only the wording does. */
export const STUDENT_STATUS: Record<FeedbackStatus, string> = { 'Pending': 'Pending', 'In Progress': 'In Review', 'Resolved': 'Resolved' };
export const ADMIN_STATUS: Record<FeedbackStatus, string> = { 'Pending': 'Pending', 'In Progress': 'In Progress', 'Resolved': 'Completed' };

/** An unknown or missing status reads as Pending, never as something finished. */
export const asFeedbackStatus = (value: string | null | undefined): FeedbackStatus => (value === 'In Progress' || value === 'Resolved' ? value : 'Pending');

/** The stored status a filter label stands for ('All' stays 'All'). */
export const storedStatusFor = (label: string, names: Record<FeedbackStatus, string>): string =>
  (Object.keys(names) as FeedbackStatus[]).find(status => names[status] === label) ?? label;
