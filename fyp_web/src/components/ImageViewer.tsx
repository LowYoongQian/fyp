import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ModalLayer } from './ModalLayer';

/**
 * A picture shown large over everything else. Escape, Close or a click outside the picture leaves it. It handles its own keys in the capture
 * phase, so Escape closes only the picture and not the dialog it was opened from; the caller returns focus to the control that opened it.
 */
export function ImageViewer({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <ModalLayer role="dialog" aria-modal="true" aria-label={label} onClick={onClose}
      className="fixed inset-0 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onKeyDown={event => { if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); } }}>
      <button ref={close} type="button" onClick={onClose} aria-label="Close image" title="Close"
        className="fixed right-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue dark:bg-slate-800 dark:text-slate-100">
        <X className="h-5 w-5" />
      </button>
      <img src={url} alt={label} onClick={event => event.stopPropagation()} className="max-h-[88vh] max-w-[94vw] rounded-lg bg-white object-contain shadow-2xl dark:bg-slate-900" />
    </ModalLayer>
  );
}
