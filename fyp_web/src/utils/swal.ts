import Swal from 'sweetalert2';

const base = Swal.mixin({
  customClass: {
    popup: '!rounded-2xl !shadow-2xl !border !border-slate-100 !font-sans',
    title: '!text-slate-900 !font-display !font-bold !text-base',
    htmlContainer: '!text-slate-500 !text-sm',
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
    popup: '!rounded-xl !shadow-xl !border !border-slate-100 !font-sans !bg-white/95 !backdrop-blur-md !p-3',
    title: '!text-slate-900 !font-bold !text-xs !text-left !m-0 !pl-1',
    htmlContainer: '!text-slate-500 !text-[11px] !text-left !m-0 !mt-1 !pl-1',
    icon: '!m-0 !mr-2',
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
  base.fire({
    icon: 'info',
    title,
    text,
    confirmButtonText: 'OK',
    confirmButtonColor: '#2563eb',
    timer: 3500,
    timerProgressBar: true,
  });

export const swalConfirmDelete = (itemName: string, extraText?: string) =>
  base.fire({
    icon: 'warning',
    title: 'Confirm Deletion',
    html: `<span>You are about to delete <strong>${itemName}</strong>.</span>${extraText ? `<br/><span class="text-xs text-slate-400 mt-1 block">${extraText}</span>` : ''}`,
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
  }).then(r => r.isConfirmed);

export const swalConfirm = (title: string, text?: string, confirmLabel = 'Confirm') =>
  base.fire({
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmLabel,
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
  }).then(r => r.isConfirmed);
