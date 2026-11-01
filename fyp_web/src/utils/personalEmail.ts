// Same rule as the server's domain/personal_email.py: atoms joined by single dots, so no leading, trailing or doubled dot in the local part.
const ATOM = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const ADDRESS = new RegExp(`^${ATOM}(?:\\.${ATOM})*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,63}$`);
const SCHOOL = /@(?:[^@]+\.)?school\.edu$/i;

/** The short message to show for a personal email that cannot be linked, or null when its format is acceptable (ownership is proved by a code). */
export function personalEmailError(address: string): string | null {
  const typed = address.trim();
  if (typed.length > 254 || typed.split('@')[0].length > 64 || !ADDRESS.test(typed)) return 'Enter a valid email address.';
  return SCHOOL.test(typed) ? 'Use a personal email, not a school address.' : null;
}
