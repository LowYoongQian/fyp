import { TextInput, TextArea } from '../../components/LimitedTextField';
import { ModalLayer } from '../../components/ModalLayer';
import { CustomDropdown } from '../../components/CustomDropdown';
import React, { useState, useCallback, useRef } from 'react';
import {
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  MessageCircle,
  UploadCloud,
  X,
  Mail,
  Eye,
  Paperclip,
  ChevronRight
} from 'lucide-react';
import { apiService } from '../../services/api';
import type { StudentFeedbackReport } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { swalSuccess, swalError } from '../../utils/swal';
import { apiErrorMessage } from '../../utils/apiError';
import { useLiveResource } from '../../hooks/useLiveResource';
import { RecordsStatus } from '../../components/RecordsStatus';
import { RecordPagination } from '../../components/RecordPagination';
import { SubmissionTime, SubmissionTimeFilter } from '../../components/SubmissionTime';
import { matchesSubmissionRange, submissionFilterParams, type SubmissionRange } from '../../utils/submissionTime';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { useNotificationRecord } from '../../hooks/useNotificationRecord';
import { TicketDetailsDialog, type ComplaintTicket } from '../../components/TicketDetailsDialog';
import { STUDENT_STATUS, asFeedbackStatus, storedStatusFor, type FeedbackStatus } from '../../utils/feedbackStatus';

const toTicket = (row: StudentFeedbackReport): ComplaintTicket => ({
  id: row.id, category: row.category, subject: row.subject,
  message: row.message, attachmentName: row.attachment_name || undefined, attachmentType: row.attachment_type || undefined,
  status: asFeedbackStatus(row.status),
  createdAt: row.created_at,
  adminResponse: row.student_response || undefined,
});

/** How each stage looks on a ticket card: its wording comes from the one shared vocabulary. */
const STAGE_LOOK: Record<FeedbackStatus, { Icon: typeof Clock; badge: string; step: number }> = {
  'Pending': { Icon: Clock, step: 0, badge: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' },
  'In Progress': { Icon: Eye, step: 1, badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' },
  'Resolved': { Icon: CheckCircle2, step: 2, badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' },
};
const STATUS_FILTERS = ['All', ...Object.values(STUDENT_STATUS)];

export const StudentContact: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [submissionRange, setSubmissionRange] = useState<SubmissionRange>({ from: '', to: '' });
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);   // the ticket whose details are showing
  const ticketOpener = useRef<HTMLElement | null>(null);                   // its card, so focus can go back there

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState<ComplaintTicket['category']>('Attendance Discrepancy');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const search = useDebouncedSearch(searchQuery);
  const pageKey = JSON.stringify([user?.user_id, filterStatus, search, submissionRange]);
  const [pageSelection, setPageSelection] = useState({ key: '', page: 1 });
  const currentPage = pageSelection.key === pageKey ? pageSelection.page : 1;
  const setCurrentPage = (page: number) => setPageSelection({ key: pageKey, page });
  const loadTickets = useCallback(async (signal: AbortSignal) => {
    const result = await apiService.studentFeedbackPage({ page: currentPage, per_page: 8, search,
      status: storedStatusFor(filterStatus, STUDENT_STATUS),
      ...submissionFilterParams(submissionRange) }, signal);
    return { ...result, items: result.items.map(toTicket) };
  }, [currentPage, search, filterStatus, submissionRange]);
  const { data, setData, loading, error, refresh } = useLiveResource(loadTickets, JSON.stringify([pageKey, currentPage]), ['feedback']);
  const tickets = data?.items || [];
  const [lastSeenTicket, setLastSeenTicket] = useState<ComplaintTicket | null>(null);
  const openTicket = tickets.find(ticket => ticket.id === openTicketId) ?? (lastSeenTicket?.id === openTicketId ? lastSeenTicket : null);   // follows live changes; keeps the last copy if the page moves on
  useNotificationRecord({ tab: 'student_contact', kinds: ['feedback'], ready: !loading && data !== undefined, dataVersion: data,
    locate: async (id, signal) => { const result = await apiService.studentFeedbackPage({ page: 1, per_page: 8, focus_id: id }, signal); return { found: !!result.focus?.found, page: result.page }; },
    apply: page => { setFilterStatus('All'); setSearchQuery(''); setSubmissionRange({ from: '', to: '' });
      setPageSelection({ key: JSON.stringify([user?.user_id, 'All', '', { from: '', to: '' }]), page }); } });

  const showTicket = (ticket: ComplaintTicket, card: HTMLElement) => { ticketOpener.current = card; setLastSeenTicket(ticket); setOpenTicketId(ticket.id); };
  const closeTicket = () => {
    setOpenTicketId(null);
    window.requestAnimationFrame(() => { if (ticketOpener.current?.isConnected) ticketOpener.current.focus(); });
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      swalError('Missing Subject', 'Please enter a brief subject line for your inquiry.');
      return;
    }

    if (!message.trim()) {
      swalError('Missing Message', 'Please describe your complaint or technical issue in detail.');
      return;
    }

    if (submitting) return;
    if (attachment && (attachment.size > 5 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg'].includes(attachment.type))) {
      swalError('Invalid Attachment', 'Choose a PDF, PNG or JPEG up to 5 MB.');
      return;
    }
    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('subject', subject.trim()); data.append('message', message.trim());
      data.append('category', category);   // severity is the admin's to set, never the student's
      if (attachment) data.append('attachment', attachment);
      const created = await apiService.studentCreateFeedback(data);
      setData(previous => {
        const ticket = toTicket(created);
        const matches = (filterStatus === 'All' || filterStatus === STUDENT_STATUS[ticket.status])
          && matchesSubmissionRange(ticket.createdAt, submissionRange)
          && [ticket.id, ticket.subject, ticket.message, ticket.category].some(value => value.toLowerCase().includes(search.toLowerCase()));
        return { ...previous!, items: matches ? [ticket, ...(previous?.items || []).filter(row => row.id !== ticket.id)].slice(0, 8) : previous?.items || [],
          total: (previous?.total || 0) + (matches ? 1 : 0), stats: { ...previous?.stats, Pending: (previous?.stats.Pending || 0) + 1 } };
      });
      setCurrentPage(1);
      void refresh();
      setSubject(''); setMessage(''); setAttachment(null); setIsModalOpen(false);
      swalSuccess('Complaint Ticket Created', `Ticket ID ${created.id} submitted to Admin Helpdesk. Response will be posted here.`);
    } catch (error) {
      swalError('Submission Failed', apiErrorMessage(error, 'Your ticket was not sent. Your form is kept, so please try again.'));
    } finally { setSubmitting(false); }
  };
  const filteredTickets = tickets;
  const totalTickets = data === undefined ? '—' : Object.values(data.stats).reduce((sum, value) => sum + value, 0);
  const openTickets = data === undefined ? '—' : data.stats.Pending || 0;
  const inReviewTickets = data === undefined ? '—' : data.stats['In Progress'] || 0;
  const resolvedTickets = data === undefined ? '—' : data.stats.Resolved || 0;
  const page = data?.page || currentPage;
  const paginatedTickets = tickets;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Banner (Theme Dynamic) */}
      <div className="uipro-card relative flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-brand-blue dark:text-blue-400 font-semibold text-xs uppercase tracking-wider">
            <Mail className="w-4 h-4" />
            <span>Admin Helpdesk & Complaints</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-space text-slate-900 dark:text-white">
            Contact Admin & Inquiries
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Report an attendance or face scan problem, or send a complaint.
          </p>
        </div>

        <button
          disabled={loading}
          onClick={() => setIsModalOpen(true)}
          className="relative z-10 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-blue text-white hover:bg-blue-700 font-semibold text-sm transition-all shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>New Complaint Ticket</span>
        </button>
      </div>

      {/* Stats Grid (Theme Synced) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <MessageSquare className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-space">{totalTickets}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Tickets</div>
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Clock className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-space">{openTickets}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending</div>
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-space">{inReviewTickets}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">In Review</div>
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-space">{resolvedTickets}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Resolved</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {STATUS_FILTERS.map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80'
              }`}
            >
              {status === 'All' ? 'All Tickets' : status}
            </button>
          ))}
        </div>

        <div className="relative flex-grow md:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <TextInput showCounter={false}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Ticket ID, subject..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <SubmissionTimeFilter value={submissionRange} onChange={setSubmissionRange} />
      <RecordsStatus loading={loading} error={error} retry={() => void refresh()} />
      {/* Tickets List Cards (Theme Synced) */}
      <div className="space-y-4">
        {data === undefined ? null : filteredTickets.length === 0 ? (
          <div className="uipro-card bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="text-slate-800 dark:text-slate-300 font-medium text-sm">No Complaint Tickets Found</div>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
              {searchQuery || filterStatus !== 'All' || submissionRange.from || submissionRange.to
                ? 'No tickets match your active filter criteria.'
                : 'You have not submitted any complaint tickets yet.'}
            </p>
          </div>
        ) : (
          paginatedTickets.map(ticket => {
            const stage = STAGE_LOOK[ticket.status];
            const StageIcon = stage.Icon;
            return (
            <div
              key={ticket.id}
              data-notice-record={ticket.id}
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              aria-label={`View details of ${ticket.subject} (${STUDENT_STATUS[ticket.status]})`}
              onClick={event => showTicket(ticket, event.currentTarget)}
              onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); showTicket(ticket, event.currentTarget); } }}
              className="group uipro-card cursor-pointer bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-md hover:-translate-y-px rounded-2xl p-5 transition-all space-y-4 shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50"
            >
              {/* Ticket Top Meta */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <span className="break-all font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{ticket.id}</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {ticket.category}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div><span className="block mb-1 text-xs text-slate-400">Submitted</span><SubmissionTime value={ticket.createdAt} /></div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${stage.badge}`}>
                    <StageIcon className="w-3.5 h-3.5" />
                    <span>{STUDENT_STATUS[ticket.status]}</span>
                  </span>
                </div>
              </div>

              {/* Ticket Subject & a short look at the message; the whole ticket opens on click */}
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-space">{ticket.subject}</h3>
                <p className="line-clamp-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {ticket.message}
                </p>
              </div>

              {ticket.attachmentName && (
                <p className="inline-flex max-w-full items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{ticket.attachmentName}</span></p>
              )}
              {ticket.adminResponse && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                    <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Admin Helpdesk Response</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-slate-800 dark:text-slate-200 pl-5">{ticket.adminResponse}</p>
                </div>
              )}

              {/* Where it stands, and the way in */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div aria-hidden="true" className="flex gap-1">
                  {[0, 1, 2].map(index => (
                    <span key={index} className={`h-1.5 w-8 rounded-full transition-colors ${index <= stage.step ? (ticket.status === 'Resolved' ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-slate-200 dark:bg-slate-700'}`} />
                  ))}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue transition-transform group-hover:translate-x-0.5 dark:text-blue-400">View details<ChevronRight className="h-4 w-4" /></span>
              </div>
            </div>
            );
          })
        )}
      </div>

      {data !== undefined && <RecordPagination page={page} pageSize={8} total={data.total} onChange={setCurrentPage} />}

      <TicketDetailsDialog ticket={openTicket} onClose={closeTicket} />

      {/* Modal: New Complaint Ticket */}
      {isModalOpen && (
        <ModalLayer className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 font-space text-base">Submit Complaint / Inquiry</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Send technical or attendance issues directly to Admin Helpdesk</p>
                </div>
              </div>
              <button
                disabled={submitting} onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitTicket} className="p-6 space-y-4 overflow-y-auto">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Inquiry Category</label>
                <CustomDropdown
                  ariaLabel="Inquiry Category"
                  fullWidth
                  className="w-full"
                  value={category}
                  onChange={setCategory}
                  options={[
                    { value: 'Attendance Discrepancy', label: 'Attendance Discrepancy (Marked absent by error)' },
                    { value: 'Face Verification Issue', label: 'Face Verification Issue (Camera / Biometric error)' },
                    { value: 'Lecturer Feedback', label: 'Lecturer & Class Roster Feedback' },
                    { value: 'System Bug', label: 'System Bug / Technical Error' },
                    { value: 'General Inquiry', label: 'General Academic Inquiry' },
                  ]}
                />
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Subject Title</label>
                <TextInput
                  type="text"
                  value={subject}
                  maxLength={200}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Marked absent for BMCS2073 lecture on 24th July"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Detailed Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Detailed Message / Description</label>
                <TextArea
                  value={message}
                  maxLength={10000}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Please describe your inquiry, date of class, and any error message received..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500 resize-none"
                  required
                />
              </div>

              {/* Optional Attachment */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Optional Attachment (Screenshot/Photo)</label>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                  <UploadCloud className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="flex-grow min-w-0">
                    {attachment ? (
                      <span className="text-xs text-slate-800 dark:text-slate-200 truncate block">{attachment.name}</span>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">Attach screenshot or proof (optional)</span>
                    )}
                  </div>
                  <label className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer transition-colors shrink-0">
                    {attachment ? 'Change' : 'Browse'}
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={submitting} onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </ModalLayer>
      )}
    </div>
  );
};
