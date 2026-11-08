import Swal from 'sweetalert2';

// Custom SVG glyph generators for Dribbble-style Toast status icons
const glyphSuccess = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 toast-check-svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" class="toast-check-circle"/><polyline points="22 4 12 14.01 9 11.01" class="toast-check-path"/></svg>`;
const glyphWarning = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
const glyphError = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
const glyphInfo = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

const toastBase = Swal.mixin({
  toast: true,
  // Top right, just under the header and its bell (index.css sets the inset); never centred over the page.
  position: 'top-end',
  showConfirmButton: false,
  showCloseButton: true,
  timer: 4000,
  timerProgressBar: true,
  showClass: { popup: 'toast-in', backdrop: '', icon: '' },
  hideClass: { popup: 'toast-out', backdrop: '', icon: '' },
  didOpen: (toast) => {
    // Pause while the pointer is really over it (it MOVED there) or keyboard focus is in it, so it can be read. A toast that merely
    // appears under a resting pointer (the button just pressed) still closes on time. It never takes focus itself.
    toast.addEventListener('mousemove', () => { if (Swal.isTimerRunning()) Swal.stopTimer(); });
    toast.addEventListener('mouseleave', Swal.resumeTimer);
    toast.addEventListener('focusin', Swal.stopTimer);
    toast.addEventListener('focusout', Swal.resumeTimer);
    // A failure is announced at once; every other update politely, after what the screen reader is saying.
    const urgent = toast.classList.contains('toast-error');
    toast.setAttribute('role', urgent ? 'alert' : 'status');
    toast.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
  }
});

type ToastKind = 'success' | 'warning' | 'error' | 'info';
type Pending = { kind: ToastKind; key: string; run: () => Promise<unknown>; done: Promise<unknown>; resolve: (value: unknown) => void };
const MAX_WAITING = 3;
let showing: { key: string; done: Promise<unknown> } | null = null;
const waiting: Pending[] = [];

/** A toast waits while a modal dialog is open (it must not replace it), or while the notification panel leaves no room beneath it
 * (on a phone it fills the screen): then it shows, still top right, as soon as the panel closes. */
const blocked = () => (Swal.isVisible() && !Swal.getPopup()?.classList.contains('swal2-toast'))
  || (document.querySelector('.notification-panel')?.getBoundingClientRect().bottom ?? 0) + 120 > window.innerHeight;

/**
 * Keeps the toast in the top-right corner but below the notification panel while that panel is open (it opens in the same corner),
 * by moving only its top edge. Runs whenever something is added to or removed from the page body (the panel is mounted there).
 */
function placeToasts() {
  const panel = document.querySelector('.notification-panel');
  const top = panel ? Math.round(panel.getBoundingClientRect().bottom + 12) : null;
  if (top === null) document.documentElement.style.removeProperty('--toast-top');
  else document.documentElement.style.setProperty('--toast-top', `${top}px`);
}
if (typeof window !== 'undefined' && typeof MutationObserver !== 'undefined') {
  new MutationObserver(placeToasts).observe(document.body, { childList: true });
  window.addEventListener('resize', placeToasts);
}

/**
 * One toast at a time, in order (NOTIFICATION-UI-11). The same message already showing or waiting is not repeated; at most three wait,
 * and when that is full the oldest that is not a failure gives way, so a failure is never lost behind later news.
 */
function enqueue(kind: ToastKind, title: string, text: string | undefined, run: () => Promise<unknown>): Promise<unknown> {
  const key = `${kind}|${title}|${text ?? ''}`;
  if (showing?.key === key) return showing.done;
  const twin = waiting.find(item => item.key === key);
  if (twin) return twin.done;
  let resolve!: (value: unknown) => void;
  const done = new Promise(r => { resolve = r; });
  waiting.push({ kind, key, run, done, resolve });
  if (waiting.length > MAX_WAITING) {
    const drop = waiting.findIndex(item => item.kind !== 'error');
    const [dropped] = waiting.splice(drop === -1 ? 0 : drop, 1);
    dropped.resolve(undefined);
  }
  if (!showing) void next();
  return done;
}

async function next(): Promise<void> {
  const item = waiting.shift();
  if (!item) { showing = null; return; }
  while (blocked()) await new Promise(r => setTimeout(r, 300));
  showing = { key: item.key, done: item.done };
  try { item.resolve(await item.run()); } catch { item.resolve(undefined); }
  void next();
}

const baseModal = Swal.mixin({
  customClass: {
    popup: '!rounded-2xl !shadow-2xl !border border-slate-200 dark:border-slate-800 !font-sans uipro-card',
    title: '!text-slate-900 dark:!text-slate-100 !font-display !font-bold !text-base',
    htmlContainer: '!text-slate-600 dark:!text-slate-300 !text-sm',
    confirmButton: '!rounded-xl !px-5 !py-2.5 !text-sm !font-semibold !shadow-none cursor-pointer',
    cancelButton: '!rounded-xl !px-5 !py-2.5 !text-sm !font-semibold !shadow-none cursor-pointer',
    icon: '!border-0',
  },
  backdrop: true,
  buttonsStyling: true,
  allowOutsideClick: true,
  allowEscapeKey: true,
});

export const swalSuccess = (title: string, text?: string) =>
  enqueue('success', title, text, () => toastBase.fire({
    iconHtml: glyphSuccess,
    icon: 'success',
    title,
    text,
    customClass: {
      popup: 'toast-success',
    },
  }));

export const swalWarning = (title: string, text?: string) =>
  enqueue('warning', title, text, () => toastBase.fire({
    iconHtml: glyphWarning,
    icon: 'warning',
    title,
    text,
    customClass: {
      popup: 'toast-warning',
    },
  }));

export const swalError = (title: string, text?: string) =>
  enqueue('error', title, text, () => toastBase.fire({
    iconHtml: glyphError,
    icon: 'error',
    title,
    text,
    customClass: {
      popup: 'toast-error',
    },
  }));

export const swalInfo = (title: string, text?: string) =>
  enqueue('info', title, text, () => toastBase.fire({
    iconHtml: glyphInfo,
    icon: 'info',
    title,
    text,
    customClass: {
      popup: 'toast-info',
    },
  }));

export const closeSwal = () => Swal.close();

/** `danger`: the action removes something, so the confirm button is red. */
export const swalConfirm = async (title: string, text: string, confirmText: string = 'Yes, proceed', danger = false): Promise<boolean> => {
  const result = await baseModal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: danger ? '#ef4444' : '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel'
  });
  return result.isConfirmed;
};

export const swalConfirmDelete = async (itemName: string, detailText?: string): Promise<boolean> => {
  const result = await baseModal.fire({
    title: `Delete ${itemName}?`,
    text: detailText || 'This action cannot be undone.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Yes, delete it',
    cancelButtonText: 'Cancel'
  });
  return result.isConfirmed;
};
