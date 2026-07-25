import React, { useState, useEffect } from 'react';
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
import { swalSuccess, swalError } from '../../utils/swal';

interface ComplaintTicket {
  id: string;
  category: 'Attendance Discrepancy' | 'Face Verification Issue' | 'Lecturer Feedback' | 'System Bug' | 'General Inquiry';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  subject: string;
  message: string;
  attachmentName?: string;
  status: 'Open' | 'In Review' | 'Resolved' | 'Closed';
  createdAt: string;
  adminResponse?: string;
  resolvedAt?: string;
}

export const StudentContact: React.FC = () => {
  const [tickets, setTickets] = useState<ComplaintTicket[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState<ComplaintTicket['category']>('Attendance Discrepancy');
  const [priority, setPriority] = useState<ComplaintTicket['priority']>('Medium');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  // Load from local storage or set initial mock tickets
  useEffect(() => {
    const saved = localStorage.getItem('student_contact_tickets');
    if (saved) {
      try {
        setTickets(JSON.parse(saved));
        return;
      } catch (e) {
        console.error("Failed to parse saved tickets", e);
      }
    }

    // Default mock tickets
    const initialTickets: ComplaintTicket[] = [
      {
        id: 'TKT-2026-84920',
        category: 'Attendance Discrepancy',
        priority: 'High',
        subject: 'Marked absent for BMCS2073 Lecture on 24th July despite attending',
        message: 'I was present in Lab 1 for the entire 2-hour session. My face scan failed due to lighting conditions. Lecturer Dr. Low informed me to lodge an admin inquiry for attendance credit.',
        attachmentName: 'Lecture_Photo_24July.jpg',
        status: 'In Review',
        createdAt: '2026-07-24 04:30 PM',
        adminResponse: 'Admin Support: Request received. Verifying WiFi AP logs and lecturer roster.'
      },
      {
        id: 'TKT-2026-72810',
        category: 'Face Verification Issue',
        priority: 'Medium',
        subject: 'Face enrollment update needed after haircut/glasses change',
        message: 'Hi Admin, I recently updated my spectacles and the kiosk scanner gives a 65% match warning. Requesting face re-registration.',
        status: 'Resolved',
        createdAt: '2026-07-15 10:20 AM',
        adminResponse: 'Admin Support: Face biometric profile reset. Please re-capture face at Student Affairs Kiosk.',
        resolvedAt: '2026-07-16 02:00 PM'
      }
    ];

    setTickets(initialTickets);
    localStorage.setItem('student_contact_tickets', JSON.stringify(initialTickets));
  }, []);

  const saveTickets = (newList: ComplaintTicket[]) => {
    setTickets(newList);
    localStorage.setItem('student_contact_tickets', JSON.stringify(newList));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      swalError('Missing Subject', 'Please enter a brief subject line for your inquiry.');
      return;
    }

    if (!message.trim()) {
      swalError('Missing Message', 'Please describe your complaint or technical issue in detail.');
      return;
    }

    const newTicket: ComplaintTicket = {
      id: `TKT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      category: category,
      priority: priority,
      subject: subject.trim(),
      message: message.trim(),
      attachmentName: attachment ? attachment.name : undefined,
      status: 'Open',
      createdAt: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    const updated = [newTicket, ...tickets];
    saveTickets(updated);

    // Reset Form
    setSubject('');
    setMessage('');
    setAttachment(null);
    setIsModalOpen(false);

    swalSuccess(
      'Complaint Ticket Created',
      `Ticket ID ${newTicket.id} submitted to Admin Helpdesk. Response will be posted here.`
    );
  };

  // Filtered List
  const filteredTickets = tickets.filter(t => {
    const matchesStatus = filterStatus === 'All' || t.status === filterStatus;
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => t.status === 'Open').length;
  const inReviewTickets = tickets.filter(t => t.status === 'In Review').length;
  const resolvedTickets = tickets.filter(t => t.status === 'Resolved').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner (Theme Dynamic) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-700 via-purple-700 to-slate-800 dark:from-indigo-900/40 dark:via-purple-900/30 dark:to-slate-900/50 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-500/20 shadow-lg text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-200 dark:text-indigo-400 font-semibold text-xs uppercase tracking-wider">
            <Mail className="w-4 h-4" />
            <span>Admin Helpdesk & Complaints</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-space text-white">
            Contact Admin & Inquiries
          </h1>
          <p className="text-sm text-slate-200 dark:text-slate-400 max-w-2xl">
            Lodge attendance discrepancies, face scanner technical issues, or general complaints directly to system administrators and academic coordinators.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-indigo-800 hover:bg-slate-100 dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-500 font-semibold text-sm transition-all shadow-md cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Complaint Ticket</span>
        </button>
      </div>

      {/* Stats Grid (Theme Synced) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
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
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80'
              }`}
            >
              {status === 'All' ? 'All Tickets' : status}
            </button>
          ))}
        </div>

        <div className="relative flex-grow md:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Ticket ID, subject..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Tickets List Cards (Theme Synced) */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="uipro-card bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="text-slate-800 dark:text-slate-300 font-medium text-sm">No Complaint Tickets Found</div>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
              {searchQuery || filterStatus !== 'All'
                ? 'No tickets match your active filter criteria.'
                : 'You have not submitted any complaint tickets yet.'}
            </p>
          </div>
        ) : (
          filteredTickets.map(ticket => (
            <div
              key={ticket.id}
              className="uipro-card bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 transition-all space-y-4 shadow-xs"
            >
              {/* Ticket Top Meta */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{ticket.id}</span>
                  
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
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{ticket.createdAt}</span>
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

              {/* Admin Response Box */}
              {ticket.adminResponse && (
                <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <MessageCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Admin Helpdesk Response</span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 pl-5">{ticket.adminResponse}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal: New Complaint Ticket */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 font-space text-base">Submit Complaint / Inquiry</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Send technical or attendance issues directly to Admin Helpdesk</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
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
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="Attendance Discrepancy">Attendance Discrepancy (Marked absent by error)</option>
                  <option value="Face Verification Issue">Face Verification Issue (Camera / Biometric error)</option>
                  <option value="Lecturer Feedback">Lecturer & Class Roster Feedback</option>
                  <option value="System Bug">System Bug / Technical Error</option>
                  <option value="General Inquiry">General Academic Inquiry</option>
                </select>
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
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
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
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Marked absent for BMCS2073 lecture on 24th July"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Detailed Message */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Detailed Message / Description</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Please describe your inquiry, date of class, and any error message received..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              {/* Optional Attachment */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Optional Attachment (Screenshot/Photo)</label>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                  <UploadCloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div className="flex-grow min-w-0">
                    {attachment ? (
                      <span className="text-xs text-slate-800 dark:text-slate-200 truncate block">{attachment.name}</span>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">Attach screenshot or proof (optional)</span>
                    )}
                  </div>
                  <label className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer transition-colors shrink-0">
                    {attachment ? 'Change' : 'Browse'}
                    <input type="file" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md cursor-pointer"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
