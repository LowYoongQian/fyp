import { FloatingPanel } from '../../components/FloatingPanel';
import { TextInput, TextArea } from '../../components/LimitedTextField';
import { ModalLayer } from '../../components/ModalLayer';
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { useLiveResource } from '../../hooks/useLiveResource';
import { RecordsStatus } from '../../components/RecordsStatus';
import { apiErrorMessage } from '../../utils/apiError';
import { SubmissionTime, SubmissionTimeFilter } from '../../components/SubmissionTime';
import { submissionFilterParams, type SubmissionRange } from '../../utils/submissionTime';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';

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
        <FloatingPanel className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans">
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
        </FloatingPanel>
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
  const { user } = useAuth();
  const [feedbackRange, setFeedbackRange] = useState<SubmissionRange>({ from: '', to: '' });
  const [mcRange, setMcRange] = useState<SubmissionRange>({ from: '', to: '' });

  // Feedback State
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState('All');
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState('All');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackSnapshot, setFeedbackSnapshot] = useState<{ scope: string; report: StudentFeedbackReport } | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [updatingFeedbackId, setUpdatingFeedbackId] = useState<string | null>(null);

  // MC Report State
  const [mcStatusFilter, setMcStatusFilter] = useState('All');
  const [mcSearch, setMcSearch] = useState('');
  const [mcSnapshot, setMcSnapshot] = useState<{ scope: string; report: MCReportItem } | null>(null);
  const [updatingMcId, setUpdatingMcId] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofType, setProofType] = useState('');
  const [proofError, setProofError] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const search = useDebouncedSearch(subTab === 'feedback' ? feedbackSearch : mcSearch);
  const filterKey = JSON.stringify([user?.user_id, subTab, feedbackStatusFilter, feedbackCategoryFilter, mcStatusFilter, search, feedbackRange, mcRange]);
  const [pageSelection, setPageSelection] = useState({ key: '', page: 1 });
  const currentPage = pageSelection.key === filterKey ? pageSelection.page : 1;
  const setCurrentPage = (page: number) => setPageSelection({ key: filterKey, page });
  const rowsPerPage = 10;
  const loadReports = useCallback(async (signal: AbortSignal) => subTab === 'feedback'
    ? apiService.adminFeedbackPage({ page: currentPage, per_page: rowsPerPage, search, status: feedbackStatusFilter,
        category: feedbackCategoryFilter, ...submissionFilterParams(feedbackRange) }, signal).then(result => ({ ...result, feedback: result.items, mc: [] as MCReportItem[] }))
    : apiService.adminMedicalPage({ page: currentPage, per_page: rowsPerPage, search, status: mcStatusFilter,
        ...submissionFilterParams(mcRange) }, signal).then(result => ({ ...result, feedback: [] as StudentFeedbackReport[], mc: result.items })),
  [subTab, currentPage, search, feedbackStatusFilter, feedbackCategoryFilter, mcStatusFilter, feedbackRange, mcRange]);
  const scope = JSON.stringify([filterKey, currentPage]);
  const { data, setData, loading, error, refresh: loadData } = useLiveResource(loadReports, scope, [subTab === 'feedback' ? 'feedback' : 'medical']);
  const feedbackList = data?.feedback || [];
  const mcList = data?.mc || [];
  const setSelectedFeedback = (report: StudentFeedbackReport | null) => setFeedbackSnapshot(report ? { scope, report } : null);
  const setSelectedMc = (report: MCReportItem | null) => setMcSnapshot(report ? { scope, report } : null);
  const selectedFeedback = feedbackSnapshot?.scope === scope ? feedbackList.find(row => row.id === feedbackSnapshot.report.id) || feedbackSnapshot.report : null;
  const selectedMc = mcSnapshot?.scope === scope ? mcList.find(row => row.id === mcSnapshot.report.id && row.source === mcSnapshot.report.source) || mcSnapshot.report : null;
  const proofId = selectedMc?.id;
  const proofSource = selectedMc?.source;
  const proofMime = selectedMc?.file_type;
  const legacyProof = selectedMc?.mc_proof_url;

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setProofUrl(null);
    setProofError('');
    setProofType(proofMime || '');
    if (proofSource === 'request' && proofId) {
      apiService.getAdminMCProof(proofId).then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setProofType(blob.type || proofMime || '');
        setProofUrl(objectUrl);
      }).catch(() => {
        if (active) setProofError('Unable to load the submitted document. Close and reopen this report to retry.');
      });
    } else if (proofId) {
      setProofUrl(legacyProof || null);
      if (!legacyProof) setProofError('No document is attached to this record.');
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proofId, proofSource, proofMime, legacyProof]);

  const handleUpdateFeedbackStatus = async (feedbackId: string, status: string) => {
    if (updatingFeedbackId) return;
    try {
      setUpdatingFeedbackId(feedbackId);
      const updated = await apiService.updateAdminFeedback(feedbackId, {
        status,
        student_response: adminNoteInput
      });
      setData(previous => ({ ...previous!, feedback: (previous?.feedback || []).map(row => row.id === feedbackId ? updated : row), mc: previous?.mc || [] }));
      void loadData();
      await swalSuccess('Status Updated', `Feedback report status marked as '${status}'.`);
      setSelectedFeedback(null);
      setAdminNoteInput('');
    } catch (err) {
      await swalError('Update Failed', apiErrorMessage(err, 'The response could not be saved. Please try again.'));
    } finally {
      setUpdatingFeedbackId(null);
    }
  };

  const handleUpdateMcStatus = async (report: MCReportItem, status: string) => {
    if (updatingMcId) return;
    const isApprove = status === 'Approved';
    const confirm = await swalConfirm(
      `${status} MC Report?`,
      `Are you sure you want to set this medical certificate report to '${status}'?`,
      isApprove ? 'Yes, Approve MC' : 'Yes, Reject MC'
    );
    if (!confirm) return;

    try {
      setUpdatingMcId(report.id);
      await apiService.updateAdminMCReport(report.id, status, report.source, reviewNote);
      setData(previous => ({ ...previous!, feedback: previous?.feedback || [], mc: (previous?.mc || []).map(row => row.id === report.id && row.source === report.source ? { ...row, status, flag_reason: reviewNote } : row) }));
      void loadData();
      await swalSuccess('MC Updated', `Medical Certificate has been ${status.toLowerCase()}.`);
      setSelectedMc(null);
    } catch (err) {
      await swalError('Update Failed', apiErrorMessage(err, 'The decision could not be saved. Please try again.'));
    } finally {
      setUpdatingMcId(null);
    }
  };

  const activeListLength = data?.total || 0;
  const totalPages = Math.ceil(activeListLength / rowsPerPage) || 1;
  const page = data?.page || currentPage;
  const paginatedFeedback = feedbackList;
  const paginatedMc = mcList;

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
            <TextInput showCounter={false}
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
                  options={['All', 'Attendance Discrepancy', 'Face Verification Issue', 'Lecturer Feedback', 'System Bug', 'General Inquiry', 'Attendance Issue', 'App Bug', 'Network Error', 'General']}
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

        <div className="mb-4"><SubmissionTimeFilter value={subTab === 'feedback' ? feedbackRange : mcRange} onChange={subTab === 'feedback' ? setFeedbackRange : setMcRange} /></div>
        <RecordsStatus loading={loading} error={error} retry={() => void loadData()} layout="table" />
        {data === undefined ? null : subTab === 'feedback' ? (
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
                        <SubmissionTime value={f.created_at} />
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
                          onClick={() => { setSelectedFeedback(f); setAdminNoteInput(f.student_response || ''); }}
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
                    <th className="py-3 px-4">Course / Leave Dates</th>
                    <th className="py-3 px-4">Date Submitted</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {paginatedMc.map((m) => (
                    <tr key={`${m.source || 'attendance'}:${m.id}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">
                        <div>{m.student_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{m.student_code}</div>
                      </td>
                      <td className="py-4 px-4 text-slate-800 dark:text-slate-200 font-medium">
                        <div>{m.course_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{m.course_code}</div>
                        {m.start_date && <div className="mt-1">{m.start_date} to {m.end_date}</div>}
                      </td>
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400">
                        <SubmissionTime value={m.timestamp} />
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {m.reason || m.flag_reason || "Medical Leave Certificate"}
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
                          onClick={() => { setSelectedMc(m); setReviewNote(''); }}
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
            Showing <span className="font-semibold text-slate-900 dark:text-white">{activeListLength === 0 ? 0 : (page - 1) * rowsPerPage + 1}</span> to{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{Math.min(page * rowsPerPage, activeListLength)}</span> of{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{activeListLength}</span> entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, page - 1))}
              disabled={page === 1 || data === undefined}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages || data === undefined}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FEEDBACK DETAILS & ACTION MODAL */}
      {selectedFeedback && (
        <ModalLayer className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
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
                <div className="mb-3"><span className="block mb-2 text-slate-400">Submitted</span><SubmissionTime value={selectedFeedback.created_at} /></div>
                <label className="text-slate-400 font-medium">Subject</label>
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{selectedFeedback.subject}</div>
                <p>Priority: {selectedFeedback.priority || 'Medium'}</p>
                {selectedFeedback.attachment_name && <button type="button" className="text-blue-600 underline" onClick={async () => {
                  try {
                    const blob = await apiService.downloadFeedbackAttachment(selectedFeedback.id, true);
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url; link.download = selectedFeedback.attachment_name || 'attachment'; link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  } catch { swalError('Download Failed', 'Please try again.'); }
                }}>Download {selectedFeedback.attachment_name}</button>}
              </div>

              <div>
                <label className="text-slate-400 font-medium">Student Message</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-slate-700 dark:text-slate-300 text-xs leading-relaxed mt-1 whitespace-pre-wrap">
                  {selectedFeedback.message}
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Response to Student (visible to the student)</label>
                {selectedFeedback.admin_notes && <p className="my-2 whitespace-pre-wrap">Previous internal notes (admin only): {selectedFeedback.admin_notes}</p>}
                <TextArea
                  rows={3}
                  value={adminNoteInput}
                  maxLength={5000}
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
        </ModalLayer>
      )}

      {/* MC PROOF INSPECTOR MODAL */}
      {selectedMc && (
        <ModalLayer className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl animate-fade-in">
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

              <div className="text-slate-700 dark:text-slate-300 space-y-2">
                <p>Status: <strong>{selectedMc.status}</strong></p>
                <div className="my-3"><span className="block mb-2 text-slate-400">Submitted</span><SubmissionTime value={selectedMc.timestamp} /></div>
                {selectedMc.start_date && <p>Leave dates: {selectedMc.start_date} to {selectedMc.end_date}</p>}
                <p className="whitespace-pre-wrap">Reason: {selectedMc.reason || selectedMc.flag_reason || 'Not provided'}</p>
              </div>

              {selectedMc.status === 'Pending' && <label className="block space-y-2 text-slate-500 dark:text-slate-400">
                <span>Review note (visible to the student)</span>
                <TextArea value={reviewNote} onChange={event => setReviewNote(event.target.value)} maxLength={1000} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Explain the decision or any missing information…" />
              </label>}

              {/* Submitted document preview */}
              <div>
                <label className="text-slate-400 font-medium block mb-2">Uploaded Document Proof</label>
                {proofError ? <p role="alert" className="text-rose-600">{proofError}</p> : proofUrl ? (
                  <>
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 max-h-64 flex items-center justify-center">
                      {proofType === 'application/pdf' || selectedMc.file_name?.toLowerCase().endsWith('.pdf') ? (
                        <iframe title="Medical Certificate PDF" src={proofUrl} className="w-full h-64" />
                      ) : (
                        <img src={proofUrl} alt="Medical Certificate Proof" className="max-h-64 object-contain" />
                      )}
                    </div>
                    <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-brand-blue underline">Open submitted document</a>
                  </>
                ) : <p className="text-slate-500">Loading submitted document...</p>}
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
                  onClick={() => handleUpdateMcStatus(selectedMc, 'Rejected')}
                  disabled={updatingMcId === selectedMc.id || (selectedMc.source === 'request' && selectedMc.status !== 'Pending')}
                  className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                >
                  <XCircle className="h-4 w-4" /> Reject MC
                </button>
                <button
                  onClick={() => handleUpdateMcStatus(selectedMc, 'Approved')}
                  disabled={updatingMcId === selectedMc.id || (selectedMc.source === 'request' && selectedMc.status !== 'Pending')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve MC
                </button>
              </div>
            </div>
          </div>
        </ModalLayer>
      )}
    </div>
  );
};
