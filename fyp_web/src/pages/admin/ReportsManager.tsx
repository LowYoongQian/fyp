import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../../services/api';
import type { StudentFeedbackReport, MCReportItem } from '../../services/api';
import {
  MessageSquare,
  FileCheck,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check
} from 'lucide-react';
import { swalSuccess, swalError, swalConfirm } from '../../utils/swal';

interface DropdownOption<T> {
  value: T;
  label: string;
}

function CustomDropdown<T extends string | number>({
  options,
  value,
  onChange,
  icon: Icon,
  label,
  placeholder = 'Select option',
  className = '',
}: {
  options: (DropdownOption<T> | T)[];
  value: T;
  onChange: (val: T) => void;
  icon?: React.ElementType;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: DropdownOption<T>[] = options.map(opt =>
    typeof opt === 'object' && opt !== null && 'value' in opt
      ? (opt as DropdownOption<T>)
      : { value: opt as T, label: String(opt) }
  );

  const selectedOption = normalizedOptions.find(o => o.value === value) || normalizedOptions[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between gap-2 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:focus:ring-blue-500/20 transition-all cursor-pointer shadow-2xs"
      >
        <div className="flex items-center gap-1.5 truncate">
          {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />}
          <span className="truncate">
            {label ? `${label}: ${selectedOption ? selectedOption.label : placeholder}` : (selectedOption ? selectedOption.label : placeholder)}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-brand-blue dark:text-blue-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans">
          <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
            {normalizedOptions.map(opt => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-500/10 text-brand-blue dark:text-blue-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-brand-blue dark:text-blue-400 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ReportsManagerProps {
  activeSubTab?: 'feedback' | 'mc';
}

export const ReportsManager: React.FC<ReportsManagerProps> = ({ activeSubTab = 'feedback' }) => {
  const [subTab, setSubTab] = useState<'feedback' | 'mc'>(activeSubTab);

  useEffect(() => {
    if (activeSubTab) {
      setSubTab(activeSubTab);
    }
  }, [activeSubTab]);
  const [loading, setLoading] = useState(true);

  // Feedback State
  const [feedbackList, setFeedbackList] = useState<StudentFeedbackReport[]>([]);
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('All');
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState('All');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<StudentFeedbackReport | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [updatingFeedbackId, setUpdatingFeedbackId] = useState<string | null>(null);

  // MC Report State
  const [mcList, setMcList] = useState<MCReportItem[]>([]);
  const [mcStatusFilter, setMcStatusFilter] = useState('All');
  const [mcSearch, setMcSearch] = useState('');
  const [selectedMc, setSelectedMc] = useState<MCReportItem | null>(null);
  const [updatingMcId, setUpdatingMcId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  useEffect(() => {
    loadData();
  }, [subTab, feedbackStatusFilter, feedbackCategoryFilter, mcStatusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (subTab === 'feedback') {
        const data = await apiService.getAdminFeedback(feedbackStatusFilter, feedbackCategoryFilter);
        setFeedbackList(data);
      } else {
        const data = await apiService.getAdminMCReports(mcStatusFilter);
        setMcList(data);
      }
    } catch (err: any) {
      console.error("Failed to load report data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFeedbackStatus = async (feedbackId: string, status: string) => {
    try {
      setUpdatingFeedbackId(feedbackId);
      await apiService.updateAdminFeedback(feedbackId, {
        status,
        admin_notes: adminNoteInput || undefined
      });
      await swalSuccess('Status Updated', `Feedback report status marked as '${status}'.`);
      setSelectedFeedback(null);
      setAdminNoteInput('');
      loadData();
    } catch (err: any) {
      await swalError('Update Failed', err.message);
    } finally {
      setUpdatingFeedbackId(null);
    }
  };

  const handleUpdateMcStatus = async (recordId: string, status: string) => {
    const isApprove = status === 'Approved';
    const confirm = await swalConfirm(
      `${status} MC Report?`,
      `Are you sure you want to set this medical certificate report to '${status}'?`,
      isApprove ? 'Yes, Approve MC' : 'Yes, Reject MC'
    );
    if (!confirm) return;

    try {
      setUpdatingMcId(recordId);
      await apiService.updateAdminMCReport(recordId, status);
      await swalSuccess('MC Updated', `Medical Certificate has been ${status.toLowerCase()}.`);
      setSelectedMc(null);
      loadData();
    } catch (err: any) {
      await swalError('Update Failed', err.message);
    } finally {
      setUpdatingMcId(null);
    }
  };

  // Filtered lists
  const filteredFeedback = feedbackList.filter(f =>
    f.student_name.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
    f.student_code.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
    f.subject.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
    f.message.toLowerCase().includes(feedbackSearch.toLowerCase())
  );

  const filteredMc = mcList.filter(m =>
    m.student_name.toLowerCase().includes(mcSearch.toLowerCase()) ||
    m.student_code.toLowerCase().includes(mcSearch.toLowerCase()) ||
    m.course_name.toLowerCase().includes(mcSearch.toLowerCase()) ||
    m.course_code.toLowerCase().includes(mcSearch.toLowerCase())
  );

  const activeListLength = subTab === 'feedback' ? filteredFeedback.length : filteredMc.length;
  const totalPages = Math.ceil(activeListLength / rowsPerPage) || 1;
  const paginatedFeedback = filteredFeedback.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const paginatedMc = filteredMc.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="uipro-card bg-white/80 dark:bg-slate-900/80 backdrop-blur-md relative overflow-hidden border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl">
        <div className="space-y-1">
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            {subTab === 'mc' ? (
              <>
                <FileCheck className="h-6 w-6 text-brand-blue" />
                Medical Certificate (MC) Reports
              </>
            ) : (
              <>
                <MessageSquare className="h-6 w-6 text-brand-blue" />
                Student Feedback Reports
              </>
            )}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-sans">
            {subTab === 'mc'
              ? "Review and verify official Medical Certificate (MC) leave requests submitted by students."
              : "Review student issue submissions, application feedback, and inquiries."}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="uipro-card bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 space-y-6">
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={subTab === 'feedback' ? "Search student, subject..." : "Search student, course..."}
              value={subTab === 'feedback' ? feedbackSearch : mcSearch}
              onChange={(e) => subTab === 'feedback' ? setFeedbackSearch(e.target.value) : setMcSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {subTab === 'feedback' ? (
              <>
                <CustomDropdown<string>
                  label="Status"
                  value={feedbackStatusFilter}
                  options={['All', 'Pending', 'In Progress', 'Resolved']}
                  onChange={(val: string) => setFeedbackStatusFilter(val)}
                />
                <CustomDropdown<string>
                  label="Category"
                  value={feedbackCategoryFilter}
                  options={['All', 'Attendance Issue', 'App Bug', 'Network Error', 'General']}
                  onChange={(val: string) => setFeedbackCategoryFilter(val)}
                />
              </>
            ) : (
              <CustomDropdown<string>
                label="MC Status"
                value={mcStatusFilter}
                options={['All', 'Pending', 'Approved', 'Rejected']}
                onChange={(val: string) => setMcStatusFilter(val)}
              />
            )}
          </div>
        </div>

        {/* Shimmer Loader */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 w-full rounded-xl shimmer-placeholder" />
            ))}
          </div>
        ) : subTab === 'feedback' ? (
          /* FEEDBACK TAB TABLE */
          paginatedFeedback.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No student feedback reports found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Subject & Details</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Submitted At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {paginatedFeedback.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">
                        <div>{f.student_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{f.student_code}</div>
                      </td>
                      <td className="py-4 px-4 max-w-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{f.subject}</div>
                        <div className="text-slate-500 dark:text-slate-400 truncate text-[11px]">{f.message}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {f.category}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400">
                        {new Date(f.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide inline-flex items-center gap-1.5 ${
                          f.status === 'Resolved'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                            : f.status === 'In Progress'
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50'
                        }`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => { setSelectedFeedback(f); setAdminNoteInput(f.admin_notes || ''); }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* MC REPORTS TAB TABLE */
          paginatedMc.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <FileCheck className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No Medical Certificate (MC) submissions found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Date Submitted</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {paginatedMc.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">
                        <div>{m.student_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{m.student_code}</div>
                      </td>
                      <td className="py-4 px-4 text-slate-800 dark:text-slate-200 font-medium">
                        <div>{m.course_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{m.course_code}</div>
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400">
                        {new Date(m.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {m.flag_reason || "Medical Leave Certificate"}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide inline-flex items-center gap-1.5 ${
                          m.status === 'Approved'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                            : m.status === 'Rejected'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => setSelectedMc(m)}
                          className="px-3 py-1.5 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue dark:bg-brand-blue/20 dark:hover:bg-brand-blue/30 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> Inspect MC Proof
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-900 dark:text-white">{activeListLength === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}</span> to{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{Math.min(currentPage * rowsPerPage, activeListLength)}</span> of{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{activeListLength}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium px-2">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FEEDBACK DETAILS & ACTION MODAL */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-brand-blue" />
                Feedback Details
              </h3>
              <button onClick={() => setSelectedFeedback(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">{selectedFeedback.student_name}</div>
                  <div className="text-slate-400 font-mono">{selectedFeedback.student_code}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {selectedFeedback.category}
                </span>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Subject</label>
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{selectedFeedback.subject}</div>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Student Message</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-slate-700 dark:text-slate-300 text-xs leading-relaxed mt-1 whitespace-pre-wrap">
                  {selectedFeedback.message}
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Admin Response / Internal Notes</label>
                <textarea
                  rows={3}
                  value={adminNoteInput}
                  onChange={(e) => setAdminNoteInput(e.target.value)}
                  placeholder="Enter resolution notes or response..."
                  className="w-full mt-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleUpdateFeedbackStatus(selectedFeedback.id, 'In Progress')}
                disabled={updatingFeedbackId === selectedFeedback.id}
                className="px-4 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-all"
              >
                Set In Progress
              </button>
              <button
                onClick={() => handleUpdateFeedbackStatus(selectedFeedback.id, 'Resolved')}
                disabled={updatingFeedbackId === selectedFeedback.id}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" /> Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MC PROOF INSPECTOR MODAL */}
      {selectedMc && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-brand-blue" />
                Inspect Medical Certificate (MC)
              </h3>
              <button onClick={() => setSelectedMc(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                <div>
                  <label className="text-slate-400">Student</label>
                  <div className="font-bold text-slate-900 dark:text-white">{selectedMc.student_name}</div>
                  <div className="text-slate-400 font-mono">{selectedMc.student_code}</div>
                </div>
                <div>
                  <label className="text-slate-400">Course</label>
                  <div className="font-bold text-slate-900 dark:text-white">{selectedMc.course_name}</div>
                  <div className="text-slate-400 font-mono">{selectedMc.course_code}</div>
                </div>
              </div>

              {/* Image Preview */}
              <div>
                <label className="text-slate-400 font-medium block mb-2">Uploaded Document Proof</label>
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 max-h-64 flex items-center justify-center">
                  <img
                    src={selectedMc.mc_proof_url}
                    alt="Medical Certificate Proof"
                    className="max-h-64 object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedMc(null)}
                className="px-4 py-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-medium text-xs"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateMcStatus(selectedMc.id, 'Rejected')}
                  disabled={updatingMcId === selectedMc.id}
                  className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                >
                  <XCircle className="h-4 w-4" /> Reject MC
                </button>
                <button
                  onClick={() => handleUpdateMcStatus(selectedMc.id, 'Approved')}
                  disabled={updatingMcId === selectedMc.id}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve MC
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
