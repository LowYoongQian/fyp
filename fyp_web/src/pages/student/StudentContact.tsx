import { TextInput, TextArea } from '../../components/LimitedTextField';
import { ModalLayer } from '../../components/ModalLayer';
import { CustomDropdown } from '../../components/CustomDropdown';
import React, { useState, useCallback } from 'react';
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
  Mail
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

interface ComplaintTicket {
  id: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  subject: string;
  message: string;
  attachmentName?: string;
  status: string;
  createdAt: string;
  adminResponse?: string;
  resolvedAt?: string;
}

const toTicket = (row: StudentFeedbackReport): ComplaintTicket => ({
  id: row.id, category: row.category, priority: row.priority, subject: row.subject,
  message: row.message, attachmentName: row.attachment_name || undefined,
  status: row.status === 'Pending' ? 'Open' : row.status === 'In Progress' ? 'In Review' : row.status,
  createdAt: row.created_at,
  adminResponse: row.student_response || undefined,
});

export const StudentContact: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [submissionRange, setSubmissionRange] = useState<SubmissionRange>({ from: '', to: '' });

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState<ComplaintTicket['category']>('Attendance Discrepancy');
  const [priority, setPriority] = useState<ComplaintTicket['priority']>('Medium');
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
      status: filterStatus === 'Open' ? 'Pending' : filterStatus === 'In Review' ? 'In Progress' : filterStatus,
      ...submissionFilterParams(submissionRange) }, signal);
    return { ...result, items: result.items.map(toTicket) };
  }, [currentPage, search, filterStatus, submissionRange]);
  const { data, setData, loading, error, refresh } = useLiveResource(loadTickets, JSON.stringify([pageKey, currentPage]), ['feedback']);
  const tickets = data?.items || [];

  const downloadAttachment = async (ticket: ComplaintTicket) => {
    try {
      const blob = await apiService.downloadFeedbackAttachment(ticket.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = ticket.attachmentName || 'attachment'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { swalError('Download Failed', 'Please try again.'); }
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
      data.append('category', category); data.append('priority', priority);
      if (attachment) data.append('attachment', attachment);
      const created = await apiService.studentCreateFeedback(data);
      setData(previous => {
        const ticket = toTicket(created);
        const matches = (filterStatus === 'All' || filterStatus === ticket.status)
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
      swalError('Submission Failed', apiErrorMessage(error, 'Your ticket could not be confirmed. Your form has been kept; check your connection and try again.'));
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
            Lodge attendance discrepancies, face scanner technical issues, or general complaints directly to system administrators and academic coordinators.
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
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Open Tickets</div>
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
          {['All', 'Open', 'In Review', 'Resolved'].map(status => (
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
          paginatedTickets.map(ticket => (
            <div
              key={ticket.id}
              className="uipro-card bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 transition-all space-y-4 shadow-xs"
            >
              {/* Ticket Top Meta */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{ticket.id}</span>
                  
                  {/* Category Badge */}
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                    {ticket.category}
                  </span>

                  {/* Priority Badge */}
                  {ticket.priority === 'Urgent' && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-[10px] font-bold">
                      URGENT
                    </span>
                  )}
                  {ticket.priority === 'High' && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-[10px] font-bold">
                      HIGH
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <div><span className="block mb-1 text-[10px] text-slate-400">Submitted</span><SubmissionTime value={ticket.createdAt} /></div>
                  {ticket.status === 'Resolved' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Resolved</span>
                    </span>
                  )}
                  {ticket.status === 'In Review' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-[11px] font-semibold">
                      <Clock className="w-3 h-3" />
                      <span>In Review</span>
                    </span>
                  )}
                  {ticket.status === 'Open' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-[11px] font-semibold">
                      <Clock className="w-3 h-3" />
                      <span>Open</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Ticket Subject & Description */}
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-space">{ticket.subject}</h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {ticket.message}
                </p>
              </div>

              {ticket.attachmentName && <button type="button" onClick={() => downloadAttachment(ticket)} className="text-sm text-blue-600 underline">Download {ticket.attachmentName}</button>}
              {/* Admin Response Box */}
              {ticket.adminResponse && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                    <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Admin Helpdesk Response</span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 pl-5">{ticket.adminResponse}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {data !== undefined && <RecordPagination page={page} pageSize={8} total={data.total} onChange={setCurrentPage} />}

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

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Priority Level</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Low', 'Medium', 'High', 'Urgent'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        priority === p
                          ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
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
