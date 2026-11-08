import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, ImageOff, Maximize2, RefreshCw } from 'lucide-react';
import { ImageViewer } from './ImageViewer';
import { LoadingRegion, ShimmerText } from './Shimmer';
import { saveBlob, safeDownloadName } from '../utils/downloadName';
import { formatFileSize } from '../utils/announcementMeta';
import { swalError } from '../utils/swal';

const IMAGE_TYPES = ['image/png', 'image/jpeg'];
const KIND_TEXT: Record<string, string> = {
  'application/pdf': 'PDF document. Download it to read it.',
  'application/msword': 'Word document. Download it to read it.',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document. Download it to read it.',
};

type Preview = { state: 'loading' } | { state: 'ready'; url: string } | { state: 'error'; retry: boolean; message: string };

/**
 * One attachment as a framed preview: an image area with Expand at its top right and a slim footer with the file name and Download at its
 * bottom right. `load` reads the file through whichever authorised route the caller owns (a feedback report, a notice), into a private object
 * URL that is revoked when the record changes or the dialog closes. A PDF, Word file or other type is a file card and is only fetched when
 * Download is pressed. Mount it with a `key` for the record, so one record's picture can never be seen under another.
 */
export function AttachmentPreview({ name, type, size, load }: { name?: string | null; type?: string | null; size?: number | null; load: (signal?: AbortSignal) => Promise<Blob> }) {
  const isImage = IMAGE_TYPES.includes(type || '');
  const [preview, setPreview] = useState<Preview>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    if (!isImage) return;
    const controller = new AbortController();
    let url = '';
    blobRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new attempt starts from the loading picture
    setPreview({ state: 'loading' });
    loadRef.current(controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      blobRef.current = blob;
      url = URL.createObjectURL(blob);
      setPreview({ state: 'ready', url });
    }, (error: { response?: { status?: number } }) => {
      if (controller.signal.aborted) return;
      const status = error?.response?.status;
      if (status === 404) setPreview({ state: 'error', retry: false, message: 'This attachment is no longer available.' });
      else if (status === 403 || status === 401) setPreview({ state: 'error', retry: false, message: 'You do not have access to this attachment.' });
      else setPreview({ state: 'error', retry: true, message: 'The image could not be loaded.' });
    });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); blobRef.current = null; };
  }, [isImage, attempt]);

  const download = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      saveBlob(blobRef.current ?? await loadRef.current(), safeDownloadName(name, type));
    } catch {
      void swalError('Download failed', 'The attachment could not be downloaded. Please try again.');
    } finally { setDownloading(false); }
  }, [downloading, name, type]);

  if (!name) return <p className="text-xs text-slate-500 dark:text-slate-400">No attachment.</p>;

  const area = 'relative flex h-56 items-center justify-center bg-slate-50 dark:bg-slate-800/60 sm:h-64';
  return (
    <>
      <figure aria-label={`Attachment ${name}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {isImage ? (
          <div className={area}>
            {preview.state === 'loading' && (
              <LoadingRegion label="Loading attachment…" className="w-full space-y-3 p-6" outerClassName="w-full"><ShimmerText height="h-36" className="rounded-lg" /></LoadingRegion>
            )}
            {preview.state === 'ready' && (
              <>
                <img src={preview.url} alt={`Attachment: ${name}`} onError={() => setPreview({ state: 'error', retry: true, message: 'This image could not be displayed.' })}
                  className="max-h-full max-w-full object-contain" />
                <button ref={expandButton} type="button" onClick={() => setExpanded(true)} aria-label="Expand image" title="Expand image"
                  className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition-colors hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200">
                  <Maximize2 className="h-4 w-4" />
                </button>
              </>
            )}
            {preview.state === 'error' && (
              <div role="alert" className="flex flex-col items-center gap-2 px-6 text-center text-xs text-slate-600 dark:text-slate-300">
                <ImageOff className="h-6 w-6 text-slate-400" />
                <p>{preview.message}</p>
                {preview.retry && <button type="button" onClick={() => setAttempt(count => count + 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-brand-blue dark:border-slate-700"><RefreshCw className="h-3.5 w-3.5" />Try again</button>}
              </div>
            )}
          </div>
        ) : (
          <div className={`${area} flex-col gap-2 px-6 text-center`}>
            <FileText className="h-8 w-8 text-slate-400" />
            <p className="max-w-full break-words text-xs font-semibold text-slate-700 dark:text-slate-200">{name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{KIND_TEXT[type || ''] ?? 'A preview is not available for this file type.'}</p>
          </div>
        )}
        <figcaption className="flex min-h-11 items-center justify-between gap-3 border-t border-slate-200 px-3 py-1.5 dark:border-slate-700">
          <span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400" title={name}>{name}{size ? ` · ${formatFileSize(size)}` : ''}</span>
          <button type="button" onClick={() => void download()} disabled={downloading} aria-label={`Download ${name}`} title="Download" aria-busy={downloading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:cursor-wait disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800">
            <Download className="h-4 w-4" />
          </button>
        </figcaption>
      </figure>
      {expanded && preview.state === 'ready' && <ImageViewer url={preview.url} label={`Attachment ${name}`} onClose={() => { setExpanded(false); window.requestAnimationFrame(() => expandButton.current?.focus()); }} />}
    </>
  );
}
