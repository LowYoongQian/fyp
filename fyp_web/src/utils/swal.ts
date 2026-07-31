import Swal from 'sweetalert2';

const base = Swal.mixin({
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

// Composed with a per-state class below, so the state can set --toast-accent
// without each caller restating the shared look.
const TOAST_POPUP =
  '!rounded-2xl !shadow-xl !border border-slate-200 dark:border-slate-800 !font-sans uipro-card !p-3.5 !pb-4';

// A filled dot with a thin white glyph, replacing the stock ring-plus-stroke-
// animation icon. Sized by .toast-glyph so it stays aligned with the title.
const glyph = (path: string) =>
  `<span class="toast-glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg></span>`;

const toastBase = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  showClass: { popup: 'toast-in', backdrop: '', icon: '' },
  hideClass: { popup: 'toast-out', backdrop: '', icon: '' },
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

// SweetAlert2 merges a mixin's customClass by replacing it, not deep-merging, so
// the shared parts live here and each state only appends its own popup class.
const toastClasses = (state: string) => ({
  popup: `${TOAST_POPUP} ${state}`,
  title: '!text-slate-900 dark:!text-slate-100 !font-bold !text-xs !text-left !m-0 !pl-1',
  htmlContainer: '!text-slate-600 dark:!text-slate-300 !text-[11px] !text-left !m-0 !mt-1 !pl-1',
});

export const swalSuccess = (title: string, text?: string) =>
  toastBase.fire({
    iconHtml: glyph('M20 6 9 17l-5-5'),
    icon: 'success',
    title,
    text,
    customClass: toastClasses('toast-success'),
  });

// Used before a theme or route transition so an open toast cannot inherit
// styles from both the old and new screen.
export const closeSwal = () => Swal.close();

export const swalError = (title: string, text?: string) =>
  base.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'Close',
    confirmButtonColor: '#ef4444',
  });

export const swalWarning = (title: string, text?: string) =>
  base.fire({
    icon: 'warning',
    title,
    text,
    confirmButtonText: 'OK',
    confirmButtonColor: '#f97316',
    timer: 3500,
    timerProgressBar: true,
  });

export const swalInfo = (title: string, text?: string) =>
  toastBase.fire({
    iconHtml: glyph('M12 16v-5M12 8h.01'),
    icon: 'info',
    title,
    text,
    customClass: toastClasses('toast-info'),
  });

export const swalConfirm = async (title: string, text: string, confirmText: string = 'Yes, proceed'): Promise<boolean> => {
  const result = await base.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel'
  });
  return result.isConfirmed;
};

export const swalConfirmDelete = async (itemName: string, detailText?: string): Promise<boolean> => {
  const result = await base.fire({
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
