import Swal from 'sweetalert2';

// Custom SVG glyph generators for Dribbble-style Toast status icons
const glyphSuccess = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
const glyphWarning = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
const glyphError = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
const glyphInfo = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

const toastBase = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  showCloseButton: true,
  timer: 4000,
  timerProgressBar: true,
  showClass: { popup: 'toast-in', backdrop: '', icon: '' },
  hideClass: { popup: 'toast-out', backdrop: '', icon: '' },
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

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
  toastBase.fire({
    iconHtml: glyphSuccess,
    icon: 'success',
    title,
    text,
    customClass: {
      popup: 'toast-success',
    },
  });

export const swalWarning = (title: string, text?: string) =>
  toastBase.fire({
    iconHtml: glyphWarning,
    icon: 'warning',
    title,
    text,
    customClass: {
      popup: 'toast-warning',
    },
  });

export const swalError = (title: string, text?: string) =>
  toastBase.fire({
    iconHtml: glyphError,
    icon: 'error',
    title,
    text,
    customClass: {
      popup: 'toast-error',
    },
  });

export const swalInfo = (title: string, text?: string) =>
  toastBase.fire({
    iconHtml: glyphInfo,
    icon: 'info',
    title,
    text,
    customClass: {
      popup: 'toast-info',
    },
  });

export const closeSwal = () => Swal.close();

export const swalConfirm = async (title: string, text: string, confirmText: string = 'Yes, proceed'): Promise<boolean> => {
  const result = await baseModal.fire({
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
