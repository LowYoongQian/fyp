import React, { useState, useEffect } from 'react';
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
  Download
} from 'lucide-react';
import { swalSuccess, swalError } from '../../utils/swal';

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
}

export const StudentMC: React.FC = () => {
  const [mcList, setMcList] = useState<MCRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal & Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('BMCS2073');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  
  // File upload state with progress bar
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Selected MC preview modal
  const [previewMC, setPreviewMC] = useState<MCRecord | null>(null);

  // Available enrolled courses
  const enrolledCourses = [
    { code: 'BMCS2073', name: 'Software Information Security', group: 'G1' },
    { code: 'BMCS2013', name: 'Data Structures and Algorithms', group: 'G2' },
    { code: 'BMCS2083', name: 'Cloud Computing Infrastructure', group: 'G1' },
    { code: 'BMCS3013', name: 'Final Year Project 1', group: 'All' },
  ];

  // Quick reason preset tags
  const quickReasons = [
    'High Fever & Flu',
    'Food Poisoning & Gastroenteritis',
    'Medical Quarantine / Covid-19',
    'Dental Emergency Surgery',
    'Hospitalization / Outpatient Admission'
  ];

  // Load from local storage or set initial mock data
  useEffect(() => {
    const saved = localStorage.getItem('student_mc_records');
    if (saved) {
      try {
        setMcList(JSON.parse(saved));
        return;
      } catch (e) {
        console.error("Failed to parse saved MCs", e);
      }
    }

    // Default mock MC records
    const initialMcs: MCRecord[] = [
      {
        id: 'MC-2026-0042',
        courseCode: 'BMCS2073',
        courseName: 'Software Information Security',
        classGroup: 'G1',
        startDate: '2026-07-20',
        endDate: '2026-07-21',
        reason: 'High Fever & Flu certified by Poliklinik Famili.',
        fileName: 'Klinik_MC_Ref_84920.pdf',
        fileType: 'application/pdf',
        fileSize: '1.2 MB',
        status: 'Approved',
        submittedAt: '2026-07-20 09:15 AM',
        remarks: 'Approved by Dr. Low. Attendance excused.'
      },
      {
        id: 'MC-2026-0038',
        courseCode: 'BMCS2013',
        courseName: 'Data Structures and Algorithms',
        classGroup: 'G2',
        startDate: '2026-07-12',
        endDate: '2026-07-12',
        reason: 'Severe migraine and doctor advised rest.',
        fileName: 'Medical_Cert_July12.png',
        fileType: 'image/png',
        fileSize: '840 KB',
        status: 'Approved',
        submittedAt: '2026-07-12 11:30 AM',
        remarks: 'Excused for Lab Session.'
      }
    ];

    setMcList(initialMcs);
    localStorage.setItem('student_mc_records', JSON.stringify(initialMcs));
  }, []);

  const saveMCList = (newList: MCRecord[]) => {
    setMcList(newList);
    localStorage.setItem('student_mc_records', JSON.stringify(newList));
  };

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    setIsUploading(true);
    setUploadProgress(0);

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 20;
      setUploadProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(interval);
        setIsUploading(false);
      }
    }, 150);
  };

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleSubmitMC = (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      swalError('Missing Medical Document', 'Please upload your scanned Medical Certificate document/image.');
      return;
    }

    if (!reason.trim()) {
      swalError('Missing Details', 'Please state your medical reason or doctor diagnosis notes.');
      return;
    }

    const courseObj = enrolledCourses.find(c => c.code === selectedCourse) || enrolledCourses[0];

    const newRecord: MCRecord = {
      id: `MC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      courseCode: courseObj.code,
      courseName: courseObj.name,
      classGroup: courseObj.group,
      startDate: startDate,
      endDate: endDate,
      reason: reason.trim(),
      fileName: file.name,
      fileType: file.type,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      status: 'Pending',
      submittedAt: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    const updated = [newRecord, ...mcList];
    saveMCList(updated);

    // Reset Form
    setReason('');
    removeFile();
    setIsModalOpen(false);

    swalSuccess(
      'MC Submitted Successfully',
      `Your Medical Certificate (${newRecord.id}) has been submitted. Academic registry & lecturer will review your submission.`
    );
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-800 dark:from-blue-900/40 dark:via-indigo-900/30 dark:to-slate-900/50 p-6 rounded-2xl border border-blue-200 dark:border-blue-500/20 shadow-lg text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-200 dark:text-blue-400 font-semibold text-xs uppercase tracking-wider">
            <FileCheck className="w-4 h-4" />
            <span>Academic Absence Registry</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-space text-white">
            Medical Certificate (MC) Submissions
          </h1>
          <p className="text-sm text-slate-200 dark:text-slate-400 max-w-2xl">
            Submit medical documentation to verify excused absences. Submitted MCs are automatically routed to your lecturer and academic registry for approval.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-blue-800 hover:bg-slate-100 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 font-semibold text-sm transition-all shadow-md cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Submit New MC</span>
        </button>
      </div>

      {/* Summary Cards (Theme Synced) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <FileText className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-space">{totalCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Submissions</div>
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Clock className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-space">{pendingCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Review</div>
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-space">{approvedCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Approved (Excused)</div>
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <XCircle className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-space">{rejectedCount}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Rejected</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {['All', 'Pending', 'Approved', 'Rejected'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80'
              }`}
            >
              {status === 'All' ? 'All Submissions' : status}
            </button>
          ))}
        </div>

        <div className="relative flex-grow md:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search MC ID, course, reason..."
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
            <div className="text-slate-800 dark:text-slate-300 font-medium text-sm">No MC Submissions Found</div>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
              {searchQuery || filterStatus !== 'All'
                ? 'No MC records match your active search or status filter criteria.'
                : 'You have not submitted any medical certificates yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">MC ID & Date</th>
                  <th className="py-3.5 px-4">Course & Group</th>
                  <th className="py-3.5 px-4">Absence Period</th>
                  <th className="py-3.5 px-4">Reason / Diagnosis</th>
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
                          <span>Approved (Excused)</span>
                        </span>
                      )}
                      {rec.status === 'Pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-[11px] font-semibold">
                          <Clock className="w-3 h-3" />
                          <span>Pending Review</span>
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <FilePlusIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 font-space text-base">Submit Medical Certificate</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Upload doctor's MC document for class absence approval</p>
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
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Course / Class Module</label>
                <select
                  value={selectedCourse}
                  onChange={e => setSelectedCourse(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                >
                  {enrolledCourses.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name} ({c.group})
                    </option>
                  ))}
                </select>
              </div>

              {/* Absence Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Absence Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Absence End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Medical Reason */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Medical Reason / Clinic Note</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder="Describe your medical condition or clinic advice..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-blue-500 resize-none"
                  required
                />
                
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
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Upload MC Document (PDF / Image)</label>

                {!file ? (
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                      dragActive
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <UploadCloud className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Drag & drop your MC file here, or{' '}
                      <label className="text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-500">
                        browse files
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Supports PDF, PNG, JPG (Max 5MB)</p>
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

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        <span>{isUploading ? 'Uploading file...' : 'Upload Complete'}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
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
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  Submit Medical Certificate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details */}
      {previewMC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{previewMC.id}</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{previewMC.courseCode} - {previewMC.courseName}</h3>
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
                <span className="text-slate-500 dark:text-slate-400">Absence Period:</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{previewMC.startDate} to {previewMC.endDate}</p>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400">Diagnosis / Medical Reason:</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/50">{previewMC.reason}</p>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400">Status:</span>
                <div className="mt-1">
                  {previewMC.status === 'Approved' && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-semibold text-[11px]">
                      Approved (Excused Absence)
                    </span>
                  )}
                  {previewMC.status === 'Pending' && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 font-semibold text-[11px]">
                      Pending Review
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
                  <span className="text-slate-500 dark:text-slate-400">Lecturer / Admin Remarks:</span>
                  <p className="text-slate-700 dark:text-slate-300 italic mt-0.5">{previewMC.remarks}</p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block mb-1.5">Attached Medical Certificate:</span>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{previewMC.fileName}</span>
                  </div>
                  <button
                    onClick={() => swalSuccess('Download Started', `Downloading ${previewMC.fileName}...`)}
                    className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function FilePlusIcon(props: any) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
