// The browser's own "Please fill out this field." bubble cannot be styled. Every form that relies on required, email,
// pattern or length checks shows this instead: the same check, in plain words naming the field, in the app's look.
type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>';

/** The field's visible name: its own label, else the label just above it (labels here often lack htmlFor). */
function nameOf(field: FormField) {
  let label: Element | null | undefined = field.labels?.[0];
  for (let node = field.parentElement, depth = 0; !label && node && depth < 3; node = node.parentElement, depth++) label = node.querySelector(':scope > label');
  return (label?.textContent || field.getAttribute('aria-label') || '').replace(/[*:]/g, '').trim() || 'This field';
}

export function fieldMessage(field: FormField) {
  const v = field.validity, name = nameOf(field), input = field as HTMLInputElement;
  if (v.valueMissing) return input.type === 'checkbox' ? 'Tick this box to continue.' : field instanceof HTMLSelectElement ? `Choose ${name.toLowerCase()}.` : `${name} is required.`;
  if (v.typeMismatch) return input.type === 'email' ? 'Enter a valid email address, like name@school.edu.' : input.type === 'url' ? 'Enter a full link, starting with https://.' : `${name} is not valid.`;
  if (v.patternMismatch) return field.title ? `Use this format: ${field.title.replace(/\.$/, '')}.` : `${name} is not in the expected format.`;
  if (v.tooShort) return `${name} needs at least ${input.minLength} characters.`;
  if (v.rangeUnderflow) return `${name} must be ${input.min} or more.`;
  if (v.rangeOverflow) return `${name} must be ${input.max} or less.`;
  if (v.stepMismatch) return `${name} must go up in steps of ${input.step}.`;
  if (v.badInput) return `${name} is not a valid ${input.type === 'number' ? 'number' : 'value'}.`;
  return field.validationMessage;   // a form's own setCustomValidity text
}

let shown: { field: FormField; box: HTMLElement; marked: boolean } | null = null;

function clear() {
  if (!shown) return;
  shown.box.remove();
  shown.field.removeAttribute('data-field-error');
  if (shown.marked) shown.field.removeAttribute('aria-invalid');
  shown = null;
}

function place() {
  if (!shown) return;
  if (!shown.field.isConnected) return clear();
  let anchor: Element = shown.field;
  while (!anchor.getClientRects().length && anchor.parentElement) anchor = anchor.parentElement;   // a hidden control: point at what is visible
  const rect = anchor.getBoundingClientRect(), box = shown.box;
  const above = rect.bottom + 8 + box.offsetHeight > innerHeight && rect.top > box.offsetHeight + 8;
  box.classList.toggle('above', above);
  box.style.top = `${above ? rect.top - box.offsetHeight - 8 : rect.bottom + 8}px`;
  box.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - box.offsetWidth - 8))}px`;
}

function show(field: FormField) {
  clear();
  const box = document.createElement('div');
  box.className = 'field-error-callout';
  box.setAttribute('role', 'alert');
  box.innerHTML = ICON;
  box.append(Object.assign(document.createElement('span'), { textContent: fieldMessage(field) }));
  document.body.append(box);
  const marked = !field.hasAttribute('aria-invalid');
  field.setAttribute('data-field-error', '');
  if (marked) field.setAttribute('aria-invalid', 'true');
  shown = { field, box, marked };
  place();
}

/** Installs once for the whole app; forms keep their native checks and only the message changes. */
export function installFieldErrors() {
  let reported = false;
  document.addEventListener('invalid', event => {
    event.preventDefault();   // no browser bubble
    if (reported) return;     // one submit fires this for every bad field; show the first, the next appears once it is fixed
    reported = true;
    setTimeout(() => { reported = false; });
    const field = event.target as FormField;
    field.focus();
    show(field);
  }, true);
  const fixed = (event: Event) => { if (shown && event.target === shown.field) clear(); };
  document.addEventListener('input', fixed, true);
  document.addEventListener('change', fixed, true);
  document.addEventListener('pointerdown', event => { if (shown && event.target !== shown.field) clear(); }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') clear(); }, true);
  document.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);
}
