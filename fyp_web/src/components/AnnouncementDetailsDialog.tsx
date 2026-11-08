import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Building2, Calendar, CalendarClock, CheckCircle2, Clock, Edit2, ExternalLink, Flag, Maximize2, Megaphone, Trash2, User, Users, X } from 'lucide-react';
import type { Announcement } from '../services/api';
import { DialogShell, Reveal } from './DialogShell';
import { AttachmentPreview } from './AttachmentPreview';
import { ImageViewer } from './ImageViewer';
import { audienceLabel, formatNoticeTime, linkifyParts, noticeImage, noticeState, relativeTime, safeHttpUrl, type NoticeState } from '../utils/announcementMeta';

export type NoticeViewer = 'student' | 'staff' | 'admin';
/** What the person opening a notice may do to it. Without these the dialog only reads. */
export interface NoticeActions { onModify?: () => void; onDelete?: () => Promise<boolean | void> }

const STATE_LOOK: Record<NoticeState, { label: string; Icon: typeof Clock; className: string }> = {
  draft: { label: 'Draft', Icon: Edit2, className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' },
  scheduled: { label: 'Scheduled', Icon: CalendarClock, className: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300' },
  live: { label: 'Live', Icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' },
  expired: { label: 'Expired', Icon: Clock, className: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};
const PRIORITY_LOOK: Record<string, string> = {
  High: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  Low: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

/**
 * A notice in full, for whoever opens it from a card: the picture, who it is for and who posted it, when it was posted and how long it is
 * visible, the whole message (web addresses open as links), the attachment and the link. An administrator also sees its state (draft,
 * scheduled, live, expired) and can modify or delete it from here. If the notice disappears while this is open, the last copy stays with a
 * clear note instead of pretending it is still current.
 */
export function AnnouncementDetailsDialog({ notice, gone = false, viewer, loadAttachment, actions, onClose }: {
  notice: Announcement | null; gone?: boolean; viewer: NoticeViewer; loadAttachment: (notice: Announcement, signal?: AbortSignal) => Promise<Blob>; actions?: NoticeActions; onClose: () => void;
}) {
  return <AnimatePresence>{notice && <Body key={String(notice.id)} notice={notice} gone={gone} viewer={viewer} loadAttachment={loadAttachment} actions={actions} onClose={onClose} />}</AnimatePresence>;
}

function Body({ notice, gone, viewer, loadAttachment, actions, onClose }: {
  notice: Announcement; gone: boolean; viewer: NoticeViewer; loadAttachment: (notice: Announcement, signal?: AbortSignal) => Promise<Blob>; actions?: NoticeActions; onClose: () => void;
}) {
  const reduce = !!useReducedMotion();
  const isAdmin = viewer === 'admin';
  const image = noticeImage(notice.image_base64);
  const link = safeHttpUrl(notice.external_link);
  const state = noticeState(notice);
  const stateLook = STATE_LOOK[state];
  const StateIcon = stateLook.Icon;
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const expandButton = useRef<HTMLButtonElement>(null);
  const showPriority = isAdmin || notice.priority === 'High' || notice.priority === 'Low';

  const when = (value: string | null | undefined) => {
    const relative = relativeTime(value);
    return <>{formatNoticeTime(value)}{relative && <span className="text-slate-500 dark:text-slate-400"> · {relative}</span>}</>;
  };
  const rows: { Icon: typeof Clock; label: string; value: ReactNode }[] = [
    { Icon: Calendar, label: 'Posted', value: when(notice.created_at) },
    { Icon: User, label: 'Posted by', value: notice.publisher || 'ADMIN' },
    { Icon: Users, label: 'For', value: audienceLabel(notice) },
    ...(isAdmin && notice.faculty && !(notice.faculty === 'All Faculties' && (!notice.department || notice.department === 'All')) ? [{ Icon: Building2, label: 'Faculty', value: notice.department && notice.department !== notice.faculty ? `${notice.faculty} · ${notice.department}` : notice.faculty }] : []),
    ...(isAdmin && notice.publish_start ? [{ Icon: CalendarClock, label: 'Starts', value: when(notice.publish_start) }] : []),
    ...(notice.publish_end ? [{ Icon: Clock, label: isAdmin ? 'Expires' : 'Visible until', value: when(notice.publish_end) }] : []),
  ];
  const remove = async () => {
    if (!actions?.onDelete || deleting) return;
    setDeleting(true);
    try { if (await actions.onDelete()) onClose(); } finally { setDeleting(false); }
  };

  return (
    <DialogShell labelledBy="notice-details-title" onClose={onClose} widthClass="max-w-2xl">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <h2 id="notice-details-title" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Megaphone className="h-5 w-5 text-brand-blue" />Notice details</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 dark:hover:bg-slate-800 dark:hover:text-slate-200">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {gone && (
          <Reveal>
            <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />This notice was removed or has expired. You are looking at the last copy that was loaded.
            </p>
          </Reveal>
        )}

        {image && (
          <Reveal index={0}>
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60">
              <motion.img src={image} alt={`Picture for ${notice.title}`} onClick={() => setExpanded(true)} className="mx-auto block max-h-72 w-full cursor-zoom-in object-contain"
                initial={reduce ? false : { opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduce ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }} />
              <button ref={expandButton} type="button" onClick={() => setExpanded(true)} aria-label="Expand picture" title="Expand picture"
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-600 shadow-sm transition-colors hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200">
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </Reveal>
        )}

        <Reveal index={1} className="space-y-2.5">
          {(isAdmin || showPriority) && (
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && <span data-notice-state={state} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${stateLook.className}`}><StateIcon className="h-3.5 w-3.5" />{stateLook.label}</span>}
              {showPriority && <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${PRIORITY_LOOK[notice.priority] ?? PRIORITY_LOOK.Medium}`}><Flag className="h-3.5 w-3.5" />{notice.priority} priority</span>}
            </div>
          )}
          <h3 className="break-words font-display text-xl font-bold leading-snug text-slate-900 dark:text-slate-50">{notice.title}</h3>
        </Reveal>

        <Reveal index={2} className="space-y-1.5">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Description</h4>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">
            {notice.content ? linkifyParts(notice.content).map((part, index) => part.type === 'link'
              ? <a key={index} href={part.value} target="_blank" rel="noopener noreferrer" className="text-brand-blue underline decoration-blue-300 underline-offset-2 hover:decoration-brand-blue dark:text-blue-400">{part.value}</a>
              : <span key={index}>{part.value}</span>) : <span className="text-slate-500">No description.</span>}
          </p>
        </Reveal>

        <Reveal index={3}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm dark:border-slate-800 dark:bg-slate-800/30">
            {rows.map(({ Icon, label, value }) => (
              <div key={label} className="contents">
                <dt className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><Icon className="h-4 w-4 shrink-0" />{label}</dt>
                <dd className="min-w-0 break-words font-medium text-slate-800 dark:text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        {(notice.attachment_name || notice.external_link) && (
          <Reveal index={4} className="space-y-3">
            {notice.attachment_name && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Attachment</h4>
                <AttachmentPreview key={String(notice.id)} name={notice.attachment_name} type={notice.attachment_mime_type} size={notice.attachment_size} load={signal => loadAttachment(notice, signal)} />
              </div>
            )}
            {notice.external_link && (link
              ? <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-brand-blue transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800">
                  <ExternalLink className="h-4 w-4 shrink-0" />Open link<span className="truncate font-normal text-slate-500 dark:text-slate-400">{new URL(link).hostname}</span>
                </a>
              : <p className="text-xs text-slate-500 dark:text-slate-400">A link was attached but it is not a web address, so it is not shown.</p>)}
          </Reveal>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        {actions?.onDelete && (
          <button type="button" onClick={() => void remove()} disabled={deleting} aria-busy={deleting} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-rose-500/10">
            <Trash2 className="h-4 w-4" />{deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
        {actions?.onModify && (
          <button type="button" onClick={actions.onModify} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            <Edit2 className="h-4 w-4" />Modify
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-xl bg-brand-blue px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50">Close</button>
      </div>

      {expanded && image && <ImageViewer url={image} label={`Picture for ${notice.title}`} onClose={() => { setExpanded(false); window.requestAnimationFrame(() => expandButton.current?.focus()); }} />}
    </DialogShell>
  );
}
