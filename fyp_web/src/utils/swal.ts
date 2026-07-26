import Swal from 'sweetalert2';

const base = Swal.mixin({
  customClass: {
    popup: '!rounded-2xl !shadow-2xl !border border-slate-200 dark:border-slate-800 !font-sans uipro-card',
    title: '!text-slate-900 dark:!text-slate-100 !font-display !font-bold !text-base',
    htmlContainer: '!text-slate-600 dark:!text-slate-300 !text-sm',
    confirmButton: '!rounded-xl !px-5 !py-2.5 !text-sm !font-semibold !shadow-none',
    cancelButton: '!rounded-xl !px-5 !py-2.5 !text-sm !font-semibold !shadow-none',
    icon: '!border-0',
  },
  backdrop: true,
  buttonsStyling: true,
  showClass: { popup: 'animate__animated animate__fadeInDown animate__faster' },
  hideClass: { popup: 'animate__animated animate__fadeOutUp animate__faster' },
});

const toastBase = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  customClass: {
    popup: '!rounded-2xl !shadow-xl !border border-slate-200 dark:border-slate-800 !font-sans uipro-card !p-3.5',
    title: '!text-slate-900 dark:!text-slate-100 !font-bold !text-xs !text-left !m-0 !pl-1',
    htmlContainer: '!text-slate-600 dark:!text-slate-300 !text-[11px] !text-left !m-0 !mt-1 !pl-1',
    icon: '!m-0 !mr-2.5 !border-0',
  },
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

export const swalSuccess = (title: string, text?: string) =>
  toastBase.fire({
    icon: 'success',
    title,
    text,
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
    icon: 'info',
    title,
    text,
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
