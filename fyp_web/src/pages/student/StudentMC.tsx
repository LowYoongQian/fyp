import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Search,
  FileCheck,
  Calendar,
  File,
  X,
  Eye,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { swalSuccess, swalError } from '../../utils/swal';
import { apiService, type MedicalLeaveRecord, type StudentEnrolmentDetail } from '../../services/api';

interface MCRecord {
  id: string;
  courseCode: string;
  courseName: string;
  classGroup: string;
  startDate: string;
  endDate: string;
  reason: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
  remarks?: string;
  aiSummary?: string;
}

const toMCRecord = (row: MedicalLeaveRecord): MCRecord => ({
  id: row.id, courseCode: row.course_code, courseName: row.course_name,
  classGroup: row.class_group, startDate: row.start_date, endDate: row.end_date,
  reason: row.reason, fileName: row.file_name, fileType: row.file_type,
  fileSize: `${(row.file_size / 1024 / 1024).toFixed(2)} MB`,
  status: `${row.status.charAt(0).toUpperCase()}${row.status.slice(1)}` as MCRecord['status'],
  submittedAt: new Date(row.submitted_at).toLocaleString(), remarks: row.remarks || undefined,
  aiSummary: row.ai_summary,
});

export const StudentMC: React.FC = () => {
  const [mcList, setMcList] = useState<MCRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal & Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [enrolledCourses, setEnrolledCourses] = useState<Array<{ id: string; code: string; name: string; group: string }>>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  
  // File upload state with progress bar
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<{ verdict: string; confidence: number; summary: string } | null>(null);

  // Selected MC preview modal
  const [previewMC, setPreviewMC] = useState<MCRecord | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const checkingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isModalOpen && !previewMC) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
        setPreviewMC(null);
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isModalOpen, previewMC]);

  useEffect(() => () => {
    if (checkingTimerRef.current !== null) window.clearInterval(checkingTimerRef.current);
  }, []);

  // Quick reason preset tags
  const quickReasons = [
    'High Fever & Flu',
    'Food Poisoning & Gastroenteritis',
    'Medical Quarantine / Covid-19',
    'Dental Emergency Surgery',
    'Hospitalization / Outpatient Admission'
  ];

  useEffect(() => {
    Promise.all([apiService.studentGetEnrolments(), apiService.studentGetMedicalLeave()])
      .then(([enrolments, records]: [StudentEnrolmentDetail[], MedicalLeaveRecord[]]) => {
        const courses = enrolments.map(item => ({ id: String(item.course_id), code: item.course_code, name: item.course_name, group: item.class_group }));
        setEnrolledCourses(courses);
        setSelectedCourse(current => current || courses[0]?.id || '');
        setMcList(records.map(toMCRecord));
      })
      .catch(() => swalError('Load Failed', 'Could not load medical leave data.'));
  }, []);

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter') {
      dragDepthRef.current += 1;
      setDragActive(true);
    } else if (e.type === 'dragover') {
      e.dataTransfer.dropEffect = 'copy';
    } else if (e.type === 'dragleave') {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const openFilePicker = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFileSelected = (selectedFile: File) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(selectedFile.type)) {
      swalError('Invalid File Format', 'Please upload a PDF document or PNG/JPG image file.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      swalError('File Too Large', 'Maximum allowed file size is 5MB.');
      return;
    }

    setFile(selectedFile);
    setUploadProgress(0);
    setAiResult(null);
  };

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    setAiResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmitMC = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      swalError('Document Missing', 'Please upload your medical document.');
      return;
    }

    if (!reason.trim()) {
      swalError('Missing Details', 'Please state your medical reason or doctor diagnosis notes.');
      return;
    }

    if (!startDate) {
      swalError('Start Date Missing', 'Please select a start date.');
      return;
    }

    if (!endDate) {
      swalError('End Date Missing', 'Please select an end date.');
      return;
    }

    if (endDate <= startDate) {
      swalError('Invalid End Date', 'End date must be after the start date.');
      return;
    }

    if (!selectedCourse) return swalError('Course Missing', 'Select a course.');
    const data = new FormData();
    data.append('course_id', selectedCourse); data.append('start_date', startDate);
    data.append('end_date', endDate); data.append('reason', reason.trim()); data.append('proof', file);
    setIsUploading(true); setUploadProgress(5); setAiResult(null);
    try {
      const saved = await apiService.studentSubmitMedicalLeave(data, percent => {
        setUploadProgress(percent);
        if (percent >= 80 && checkingTimerRef.current === null) {
          checkingTimerRef.current = window.setInterval(() => {
            setUploadProgress(current => Math.min(95, current + 1));
          }, 300);
        }
      });
      if (checkingTimerRef.current !== null) window.clearInterval(checkingTimerRef.current);
      checkingTimerRef.current = null;
      setUploadProgress(100); setMcList(current => [toMCRecord(saved), ...current]);
      setAiResult({ verdict: saved.ai_verdict || 'needs_review', confidence: saved.ai_confidence || 0, summary: saved.ai_summary || 'Document needs staff review.' });
      swalSuccess('Leave Submitted', 'Your medical leave was sent for staff review.');
    } catch (error: any) {
      if (checkingTimerRef.current !== null) window.clearInterval(checkingTimerRef.current);
      checkingTimerRef.current = null;
      setUploadProgress(0);
      const detail = error?.response?.data?.detail;
      swalError('Submit Failed', typeof detail === 'string' ? detail : 'Could not submit medical leave.');
    } finally { setIsUploading(false); }
  };

  // Filtered List
  const filteredRecords = mcList.filter(rec => {
    const matchesFilter = filterStatus === 'All' || rec.status === filterStatus;
    const matchesSearch =
      rec.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.reason.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalCount = mcList.length;
  const pendingCount = mcList.filter(m => m.status === 'Pending').length;
  const approvedCount = mcList.filter(m => m.status === 'Approved').length;
  const rejectedCount = mcList.filter(m => m.status === 'Rejected').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner (Theme Dynamic) */}
      <div className="uipro-card relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 dark:from-blue-950/90 dark:via-indigo-950/95 dark:to-slate-950/95 p-6 rounded-2xl border border-blue-300 dark:border-blue-500/20 shadow-premium text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 dark:bg-indigo-500/10 rounded-full -ml-16 -mb-16 blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 text-blue-200 dark:text-blue-400 font-semibold text-xs uppercase tracking-wider">
            <FileCheck className="w-4 h-4" />
            <span>Medical Leave</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-space text-white">
            Medical Leave Requests
          </h1>
          <p className="text-sm text-slate-200 dark:text-slate-400 max-w-2xl">
            Upload your medical proof and track its status.
          </p>
        </div>

        <button
          onClick={() => { setAiResult(null); setUploadProgress(0); setIsModalOpen(true); }}
          className="relative z-10 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-brand-blue hover:bg-blue-50 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 font-semibold text-sm transition-all shadow-md cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Request</span>
        </button>
      </div>

      {/* Summary Cards (Theme Synced) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <FileText className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-space">{totalCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total</div>
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Clock className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-space">{pendingCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending</div>
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-space">{approvedCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Approved</div>
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <XCircle className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-space">{rejectedCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Rejected</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {['All', 'Pending', 'Approved', 'Rejected'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-brand-blue text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80'
              }`}
            >
              {status === 'All' ? 'All' : status}
            </button>
          ))}
        </div>

        <div className="relative flex-grow md:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search request, course, reason..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* MC Submissions List / Table (Theme Synced) */}
      <div className="uipro-card bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div className="text-slate-800 dark:text-slate-300 font-medium text-sm">No Requests</div>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
              {searchQuery || filterStatus !== 'All'
                ? 'No requests match your search or filter.'
                : 'You have no medical leave requests.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Request & Date</th>
                  <th className="py-3.5 px-4">Course & Group</th>
                  <th className="py-3.5 px-4">Leave Period</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Attachment</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                {filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-blue-600 dark:text-blue-400">
                      <div>{rec.id}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-500 font-sans">{rec.submittedAt}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{rec.courseCode}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{rec.courseName}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{rec.startDate}</span>
                        {rec.startDate !== rec.endDate && (
                          <span>to {rec.endDate}</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <p className="line-clamp-2 max-w-[240px] text-slate-700 dark:text-slate-300">{rec.reason}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300">
                        <File className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span className="truncate max-w-[100px]">{rec.fileName}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {rec.status === 'Approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approved</span>
                        </span>
                      )}
                      {rec.status === 'Pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-[11px] font-semibold">
                          <Clock className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      )}
                      {rec.status === 'Rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-[11px] font-semibold">
                          <XCircle className="w-3 h-3" />
                          <span>Rejected</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setPreviewMC(rec)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Submit New MC */}
      {isModalOpen && createPortal((
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="medical-leave-dialog-title"
            tabIndex={-1}
            className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] outline-none animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <FilePlusIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="medical-leave-dialog-title" className="font-bold text-slate-900 dark:text-slate-100 font-space text-base">Submit Medical Leave</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Add your leave dates and medical proof.</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitMC} className="p-6 space-y-5 overflow-y-auto">
              {/* Select Course */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Course</label>
                <CourseSelect
                  key={`course-${selectedCourse}`}
                  value={selectedCourse}
                  onChange={value => setSelectedCourse(() => value)}
                  options={enrolledCourses}
                />
              </div>

              {/* Absence Date Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Start Date</label>
                  <MedicalLeaveDatePicker
                    key={`start-${startDate}`}
                    value={startDate}
                    onChange={value => {
                      setStartDate(() => value);
                      setEndDate('');
                    }}
                    minDate={getLocalDateValue()}
                    placeholder="Select start date"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">End Date</label>
                  <MedicalLeaveDatePicker
                    key={`end-${startDate}-${endDate}`}
                    value={endDate}
                    onChange={value => setEndDate(() => value)}
                    align="right"
                    minDate={startDate ? addDays(startDate, 1) : undefined}
                    disabled={!startDate}
                    placeholder={startDate ? 'Select end date' : 'Select start date first'}
                  />
                </div>
              </div>

              {/* Medical Reason */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reason</label>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/10 dark:border-slate-700 dark:bg-slate-800">
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    placeholder="Add a short reason..."
                    className="block max-h-28 min-h-[4.5rem] w-full resize-none overflow-y-auto border-0 bg-transparent px-3.5 py-2.5 pr-2 text-xs text-slate-900 outline-none [scrollbar-gutter:stable] dark:text-slate-200"
                    required
                  />
                </div>
                
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {quickReasons.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setReason(tag)}
                      className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* File Drag and Drop Box with Progress Bar */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Medical Proof (PDF / Image)</label>

                {!file ? (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Upload medical proof"
                    onClick={openFilePicker}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openFilePicker();
                      }
                    }}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`group relative overflow-hidden border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer select-none outline-none transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out will-change-transform focus-visible:ring-4 focus-visible:ring-brand-blue/15 ${
                      dragActive
                        ? 'scale-[1.015] border-brand-blue bg-blue-50 shadow-[0_14px_35px_-18px_rgba(37,99,235,0.65)] dark:bg-blue-500/15'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:-translate-y-0.5 hover:border-brand-blue/60 hover:bg-blue-50/60 hover:shadow-md dark:hover:border-blue-500/60 dark:hover:bg-blue-500/10'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/10 transition-opacity duration-200 ${dragActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                    <div className="pointer-events-none relative">
                      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-brand-blue shadow-sm transition-transform duration-200 ease-out dark:bg-blue-500/15 dark:text-blue-300 ${dragActive ? 'scale-110 -translate-y-1' : 'group-hover:scale-105 group-hover:-translate-y-0.5'}`}>
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {dragActive ? (
                          <span className="text-brand-blue dark:text-blue-300">Release to upload</span>
                        ) : (
                          <>Drop your file here, or <span className="text-brand-blue underline underline-offset-2">browse files</span></>
                        )}
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">PDF, PNG or JPG · Max 5 MB</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">{file.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {aiResult ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/25 dark:bg-emerald-500/10 animate-in fade-in slide-in-from-bottom-1 duration-300">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" /> MC format match
                          </span>
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300" aria-live="polite">
                            {Math.round(aiResult.confidence * 100)}%
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/50">
                          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-700 ease-out" style={{ width: `${Math.round(aiResult.confidence * 100)}%` }} />
                        </div>
                        <p className="mt-2 text-[10px] leading-4 text-emerald-800 dark:text-emerald-200">{aiResult.summary}</p>
                        <p className="mt-1 text-[9px] text-slate-500 dark:text-slate-400">Format check only. Staff will confirm the document.</p>
                      </div>
                    ) : isUploading ? (
                      <div className="space-y-1.5" aria-live="polite">
                        <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          <span>{uploadProgress >= 80 ? 'AI checking MC format...' : 'Uploading medical proof...'}</span>
                          <span key={`upload-progress-${uploadProgress}`}>{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 transition-[width] duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" /> Ready for AI format check
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type={aiResult ? 'button' : 'submit'}
                  onClick={aiResult ? () => { setIsModalOpen(false); setReason(''); setStartDate(''); setEndDate(''); removeFile(); } : undefined}
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (uploadProgress >= 80 ? 'Checking MC...' : 'Uploading...') : aiResult ? 'Done' : 'Submit Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      {/* Modal: View Details */}
      {previewMC && createPortal((
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="medical-leave-details-title"
            tabIndex={-1}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 outline-none animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{previewMC.id}</span>
                <h3 id="medical-leave-details-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">{previewMC.courseCode} - {previewMC.courseName}</h3>
              </div>
              <button
                onClick={() => setPreviewMC(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Leave Period:</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{previewMC.startDate} to {previewMC.endDate}</p>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400">Reason:</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/50">{previewMC.reason}</p>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400">Status:</span>
                <div className="mt-1">
                  {previewMC.status === 'Approved' && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-semibold text-[11px]">
                      Approved
                    </span>
                  )}
                  {previewMC.status === 'Pending' && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 font-semibold text-[11px]">
                      Pending
                    </span>
                  )}
                  {previewMC.status === 'Rejected' && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 font-semibold text-[11px]">
                      Rejected
                    </span>
                  )}
                </div>
              </div>

              {previewMC.remarks && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Remarks:</span>
                  <p className="text-slate-700 dark:text-slate-300 italic mt-0.5">{previewMC.remarks}</p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block mb-1.5">Medical Proof:</span>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{previewMC.fileName}</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const blob = await apiService.studentDownloadMedicalProof(previewMC.id);
                        const url = URL.createObjectURL(blob);
                        const anchor = document.createElement('a'); anchor.href = url; anchor.download = previewMC.fileName;
                        anchor.click(); URL.revokeObjectURL(url);
                      } catch { swalError('Download Failed', 'Could not download the medical proof.'); }
                    }}
                    className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewMC(null)}
                className="w-full py-2.5 rounded-xl bg-brand-blue hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};

function getLocalDateValue(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateValue(date);
}

function CourseSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; code: string; name: string; group: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.id === displayValue) ?? options[0];

  useEffect(() => setDisplayValue(value), [value]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className={`w-full min-w-0 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-900 dark:text-slate-100 text-xs font-semibold text-left shadow-2xs transition-all cursor-pointer ${
          open
            ? 'border-brand-blue ring-2 ring-brand-blue/10'
            : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600'
        }`}
      >
        <span key={`course-label-${displayValue}`} className="min-w-0 flex-1 truncate animate-in fade-in duration-150">
          {selected ? `${selected.code} - ${selected.name} (${selected.group})` : 'Select course'}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-brand-blue' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150"
        >
          {options.map(option => {
            const isSelected = option.id === displayValue;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setDisplayValue(option.id);
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-brand-blue text-white'
                    : 'text-slate-700 hover:bg-blue-50 hover:text-brand-blue dark:text-slate-200 dark:hover:bg-blue-500/10'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">{option.code} · {option.name}</span>
                  <span className={`block text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>Group {option.group}</span>
                </span>
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MedicalLeaveDatePicker({
  value,
  onChange,
  align = 'left',
  minDate,
  disabled = false,
  placeholder = 'Select date',
}: {
  value: string;
  onChange: (value: string) => void;
  align?: 'left' | 'right';
  minDate?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const selectedDate = displayValue ? new Date(`${displayValue}T00:00:00`) : null;
  const referenceDate = selectedDate ?? (minDate ? new Date(`${minDate}T00:00:00`) : new Date());
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayValue(value);
    if (value) {
      const nextDate = new Date(`${value}T00:00:00`);
      setMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  }, [value]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const leadingDays = new Date(year, monthIndex, 1).getDay();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array(leadingDays).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
  const selectedLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : placeholder;
  const minimumMonth = minDate ? new Date(`${minDate.slice(0, 7)}-01T00:00:00`) : null;
  const previousMonthDisabled = Boolean(
    minimumMonth && new Date(year, monthIndex, 1).getTime() <= minimumMonth.getTime()
  );

  const selectDay = (day: number) => {
    const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setDisplayValue(date);
    onChange(date);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen(current => !current)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-slate-800 dark:text-slate-100 text-xs font-semibold text-left transition-all cursor-pointer ${
          open ? 'border-brand-blue ring-2 ring-brand-blue/10' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
        } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70 dark:disabled:bg-slate-800/60`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-brand-blue" />
          <span key={`date-label-${displayValue}`} className="truncate animate-in fade-in duration-150">{selectedLabel}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-brand-blue' : ''}`} />
      </button>

      {open && !disabled && (
        <div className={`absolute top-full z-40 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <button
              type="button"
              disabled={previousMonthDisabled}
              onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span
              key={`calendar-month-${year}-${monthIndex}`}
              className="text-xs font-bold text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-bottom-1 duration-150"
            >
              {monthNames[monthIndex]} {year}
            </span>
            <button type="button" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-brand-blue dark:hover:bg-slate-800 cursor-pointer" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const dateValue = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const selected = dateValue === displayValue;
              const today = dateValue === getLocalDateValue();
              const unavailable = Boolean(minDate && dateValue < minDate);
              return (
                <button
                  key={dateValue}
                  type="button"
                  disabled={unavailable}
                  onClick={() => selectDay(day)}
                  className={`aspect-square rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    unavailable
                      ? 'cursor-not-allowed text-slate-300 opacity-45 dark:text-slate-600'
                      : selected
                      ? 'bg-brand-blue text-white shadow-sm'
                      : today
                        ? 'bg-blue-50 text-brand-blue ring-1 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30'
                        : 'text-slate-700 hover:bg-blue-50 hover:text-brand-blue dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const todayValue = getLocalDateValue(today);
              const shortcutValue = minDate && minDate > todayValue ? minDate : todayValue;
              const shortcutDate = new Date(`${shortcutValue}T00:00:00`);
              setMonth(new Date(shortcutDate.getFullYear(), shortcutDate.getMonth(), 1));
              setDisplayValue(shortcutValue);
              onChange(shortcutValue);
              setOpen(false);
            }}
            className="mt-3 w-full rounded-xl bg-blue-50 py-2 text-xs font-bold text-brand-blue hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 cursor-pointer"
          >
            {minDate && minDate > getLocalDateValue() ? 'First available date' : 'Today'}
          </button>
        </div>
      )}
    </div>
  );
}

function FilePlusIcon(props: any) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
