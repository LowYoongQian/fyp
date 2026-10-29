export type AccountRole = { role?: string; staff_role?: string | null };

export function accountRoleLabel(account: AccountRole | null | undefined): string {
  if (account?.role === 'admin') return 'Administrator';
  if (account?.role === 'student') return 'Student';
  if (account?.role === 'lecturer') {
    const designation = account.staff_role?.trim().toLowerCase();
    if (designation === 'lecturer') return 'Lecturer';
    if (designation === 'tutor') return 'Tutor';
    return 'Staff';
  }
  return 'User';
}

export function canPublishCourseNotices(account: AccountRole | null | undefined): boolean {
  return account?.role === 'lecturer' && account.staff_role?.trim().toLowerCase() === 'lecturer';
}
