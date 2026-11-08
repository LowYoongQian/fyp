import { AnimatePresence } from 'motion/react';
import { MessageCircle, MessageSquare, X } from 'lucide-react';
import { DialogShell } from './DialogShell';
import { FeedbackProgress } from './FeedbackProgress';
import { AttachmentPreview } from './AttachmentPreview';
import { apiService } from '../services/api';
import { SubmissionTime } from './SubmissionTime';
import { STUDENT_STATUS, type FeedbackStatus } from '../utils/feedbackStatus';

export interface ComplaintTicket {
  id: string;
  category: string;
  subject: string;
  message: string;
  attachmentName?: string;
  attachmentType?: string;
  status: FeedbackStatus;
  createdAt: string;
  adminResponse?: string;
}

/**
 * A student's ticket in full: what they sent, where it stands (as an animated three-stage progress), the administrator's reply and their own
 * attachment. It follows the ticket while it is open, so a status change moves the progress on without closing it. Escape, Close or a click
 * outside leaves; focus starts inside and stays inside.
 */
export function TicketDetailsDialog({ ticket, onClose }: { ticket: ComplaintTicket | null; onClose: () => void }) {
  return <AnimatePresence>{ticket && <DialogBody key={ticket.id} ticket={ticket} onClose={onClose} />}</AnimatePresence>;
}

function DialogBody({ ticket, onClose }: { ticket: ComplaintTicket; onClose: () => void }) {
  return (
    <DialogShell labelledBy="ticket-details-title" onClose={onClose}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h2 id="ticket-details-title" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <MessageSquare className="h-5 w-5 text-brand-blue" />Ticket details
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section aria-label="Progress" className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-5 dark:border-slate-800 dark:bg-slate-800/30">
            <FeedbackProgress status={ticket.status} />
          </section>

          <section aria-label="Your ticket" className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <span className="inline-block rounded-md border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{ticket.category}</span>
                <p className="break-all font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{ticket.id}</p>
              </div>
              <div><span className="mb-1 block text-xs text-slate-400">Submitted</span><SubmissionTime value={ticket.createdAt} /></div>
            </div>
            <h3 className="break-words font-space text-base font-bold text-slate-900 dark:text-slate-100">{ticket.subject}</h3>
            <p className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">{ticket.message}</p>
          </section>

          {ticket.attachmentName && (
            <section aria-label="Attachment" className="space-y-1.5">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">Attachment</h4>
              <AttachmentPreview key={ticket.id} name={ticket.attachmentName} type={ticket.attachmentType} load={signal => apiService.downloadFeedbackAttachment(ticket.id, false, signal)} />
            </section>
          )}

          <section aria-label="Admin response" className="space-y-1.5">
            {ticket.adminResponse ? (
              <div className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 p-3.5 dark:border-blue-500/20 dark:bg-blue-950/30">
                <div className="flex items-center gap-1.5 text-sm font-bold text-blue-700 dark:text-blue-300"><MessageCircle className="h-4 w-4" />Admin Helpdesk Response</div>
                <p className="whitespace-pre-wrap break-words pl-5 text-sm text-slate-800 dark:text-slate-200">{ticket.adminResponse}</p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-3.5 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No response yet. It will appear here once an administrator replies{ticket.status === 'Pending' ? '' : ` (this ticket is ${STUDENT_STATUS[ticket.status]})`}.
              </p>
            )}
          </section>
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Close</button>
        </div>
    </DialogShell>
  );
}
