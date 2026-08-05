import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiService } from '../../services/api';
import type { RiskScore, AlertLog } from '../../services/api';
import { swalSuccess, swalError, swalInfo } from '../../utils/swal';
import {
  AlertTriangle,
  Mail,
  Send,
  CheckCircle2,
  User,
  RefreshCw,
  Cpu,
  BookOpen,
  ShieldCheck,
  Eye,
  Activity,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Filter,
  ChevronDown,
  Check,
} from 'lucide-react';

type RiskLevel = RiskScore['risk_label'];

// Custom CustomDropdown Option Interface
interface DropdownOption<T> {
  value: T;
  label: string;
}

// Reusable Custom Dropdown Component
function CustomDropdown<T extends string | number>({
  options,
  value,
  onChange,
  icon: Icon,
  placeholder = 'Select option',
  className = '',
}: {
  options: DropdownOption<T>[];
  value: T;
  onChange: (val: T) => void;
  icon?: React.ElementType;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value) || options[0];

  // Close on outside click
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
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-brand-blue dark:text-blue-400' : ''
          }`}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans">
          <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
            {options.map(opt => {
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

export const AtRisk: React.FC = () => {
  const [riskList, setRiskList] = useState<RiskScore[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter States
  const [activeFilter, setActiveFilter] = useState<'all' | RiskLevel>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // QoL Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Email Alert Modal State
  const [selectedStudentForAlert, setSelectedStudentForAlert] = useState<RiskScore | null>(null);
  const [customDraft, setCustomDraft] = useState('');
  const [sendingAlert, setSendingAlert] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [riskData, alertData] = await Promise.all([
        apiService.getRiskScores(),
        apiService.getAlertLogs(),
      ]);
      setRiskList(riskData);
      setAlertLogs(alertData);
    } catch (err) {
      console.error('Failed to load risk dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunNightlyJob = async () => {
    setLoading(true);
    try {
      await apiService.runNightlyRiskScorerJob();
      await loadData();
      await swalInfo('ML Job Completed', 'Recomputed attendance risk scores and refreshed the risk register.');
    } catch (err) {
      console.error(err);
      await swalError('Execution Failed', 'Failed to recompute risk scores.');
    } finally {
      setLoading(false);
    }
  };

  const openAlertModal = (score: RiskScore) => {
    setSelectedStudentForAlert(score);
    const body = `DEAR ${score.student_name?.toUpperCase()},\n\nThis is an official warning regarding your attendance in ${score.course_code}. Your current attendance rate is ${Math.round(score.attendance_rate * 100)}%${score.risk_factors ? ` (${score.risk_factors})` : ''}, which puts you at risk of falling below the university's 80% minimum requirement.\n\nContinued absences may result in a bar from final examinations. Please contact your lecturer or academic office immediately to discuss your status.\n\nBest regards,\nDepartment of Computing\nAcademic Counseling Office`;
    setCustomDraft(body);
  };

  const handleSendManualAlert = async () => {
    if (!selectedStudentForAlert) return;
    setSendingAlert(true);
    try {
      await apiService.triggerManualAlert(selectedStudentForAlert.student_id, selectedStudentForAlert.course_id);
      loadData();
      setSelectedStudentForAlert(null);
      await swalSuccess('Alert Dispatched', "Warning email sent to student and CC'd to academic advisor.");
    } catch (err) {
      console.error(err);
      await swalError('Dispatch Failed', 'Failed to send alert. Please try again.');
    } finally {
      setSendingAlert(false);
    }
  };

  // Distinct courses options for CustomDropdown
  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    riskList.forEach(r => {
      if (r.course_code) map.set(r.course_code, r.course_name || r.course_code);
    });
    const list: DropdownOption<string>[] = [{ value: 'all', label: 'All Courses' }];
    map.forEach((name, code) => {
      list.push({ value: code, label: `${code} - ${name}` });
    });
    return list;
  }, [riskList]);

  // Rows Per Page options for CustomDropdown
  const rowsPerPageOptions: DropdownOption<number>[] = [
    { value: 5, label: '5 per page' },
    { value: 10, label: '10 per page' },
    { value: 20, label: '20 per page' },
    { value: 50, label: '50 per page' },
  ];

  // Filtered risk list
  const filteredRisk = useMemo(() => {
    return riskList
      .filter(item => courseFilter === 'all' || item.course_code === courseFilter)
      .filter(item => activeFilter === 'all' || item.risk_label === activeFilter)
      .filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (item.student_name && item.student_name.toLowerCase().includes(q)) ||
          (item.student_code && item.student_code.toLowerCase().includes(q)) ||
          (item.course_code && item.course_code.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.risk_score - a.risk_score);
  }, [riskList, courseFilter, activeFilter, searchQuery]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [courseFilter, activeFilter, searchQuery, itemsPerPage]);

  // Pagination calculation with safe page clamping
  const totalPages = Math.max(1, Math.ceil(filteredRisk.length / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRisk = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredRisk.slice(start, start + itemsPerPage);
  }, [filteredRisk, safeCurrentPage, itemsPerPage]);

  // Generate smart pagination page numbers with windowing/ellipsis
  const visiblePageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (safeCurrentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages];
  }, [safeCurrentPage, totalPages]);

  // Counts respect current course filter
  const scoped = useMemo(
    () => riskList.filter(i => courseFilter === 'all' || i.course_code === courseFilter),
    [riskList, courseFilter]
  );

  const counts = {
    high: scoped.filter(i => i.risk_label === 'high').length,
    medium: scoped.filter(i => i.risk_label === 'medium').length,
    low: scoped.filter(i => i.risk_label === 'low').length,
    observing: scoped.filter(i => i.risk_label === 'observing').length,
  };

  const badgeClass = (label: RiskLevel) => {
    switch (label) {
      case 'high':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 font-extrabold';
      case 'medium':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 font-extrabold';
      case 'observing':
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-bold';
      default:
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 font-extrabold';
    }
  };

  const statCards = [
    { key: 'high', label: 'High Risk', value: counts.high, icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/50 dark:border-rose-900/30' },
    { key: 'medium', label: 'Medium Risk', value: counts.medium, icon: Activity, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/50 dark:border-amber-900/30' },
    { key: 'low', label: 'Low Risk', value: counts.low, icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/50 dark:border-emerald-900/30' },
    { key: 'observing', label: 'Observing', value: counts.observing, icon: Eye, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/60 border-slate-200/50 dark:border-slate-700/40' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="uipro-card bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 relative overflow-hidden transition-colors shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-brand-blue dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20 shadow-xs">
                <AlertTriangle className="h-5 w-5" />
              </div>
              At-Risk Early-Warning Dashboard
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
              Random Forest machine learning classifier predicting students falling below the 80% attendance threshold. View risk reasons and dispatch official warnings.
            </p>
          </div>

          <button
            onClick={handleRunNightlyJob}
            disabled={loading}
            className="uipro-button uipro-button-primary shrink-0 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-sm cursor-pointer"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Cpu className="h-4 w-4 mr-2" />}
            Recompute Risk Scores
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(c => (
          <button
            key={c.key}
            onClick={() => setActiveFilter(activeFilter === c.key ? 'all' : c.key)}
            className={`uipro-card bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-4 text-left transition-all cursor-pointer ${
              activeFilter === c.key
                ? 'ring-2 ring-brand-blue dark:ring-blue-500 shadow-md scale-[1.01]'
                : 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center border ${c.bg}`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div>
              <div className={`text-2xl font-display font-black ${c.color}`}>{c.value}</div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                {c.label}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Main Content Grid: Risk Register Table + Dispatch Logs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Student Risk Register Table Container */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between transition-colors">
          <div>
            {/* Header & Controls Toolbar */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-sans text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    Student Risk Register
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
                    {filteredRisk.length} students
                  </span>
                </div>

                {/* Risk Level Segmented Buttons */}
                <div className="flex bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/80 text-xs">
                  {(['all', 'high', 'medium', 'low'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1 font-bold rounded-lg transition-all uppercase tracking-wider text-[10px] cursor-pointer ${
                        activeFilter === f
                          ? 'bg-white dark:bg-slate-700 text-brand-blue dark:text-blue-400 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toolbar: Search Input + Custom Course Dropdown + Custom Rows Dropdown */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* Search Bar with Clear Button */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search name, code, or course..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:focus:ring-blue-500/20"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Premium Custom Course Filter Dropdown */}
                  {courseOptions.length > 1 && (
                    <CustomDropdown<string>
                      options={courseOptions}
                      value={courseFilter}
                      onChange={val => setCourseFilter(val)}
                      icon={Filter}
                      className="w-40 sm:w-48"
                    />
                  )}

                  {/* Premium Custom Rows Per Page Dropdown */}
                  <CustomDropdown<number>
                    options={rowsPerPageOptions}
                    value={itemsPerPage}
                    onChange={val => setItemsPerPage(val)}
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-5">Student</th>
                    <th className="py-3.5 px-4">Course</th>
                    <th className="py-3.5 px-4 text-center">Attendance</th>
                    <th className="py-3.5 px-4 text-center">Risk Level</th>
                    <th className="py-3.5 px-4">Risk Reason / Factors</th>
                    <th className="py-3.5 px-5 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    // Theme-Aware Shimmer Skeletons
                    Array.from({ length: itemsPerPage }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-4 px-5">
                          <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-1.5"></div>
                          <div className="h-2.5 w-16 bg-slate-150 dark:bg-slate-800/60 rounded"></div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="h-3.5 w-12 bg-slate-200 dark:bg-slate-800 rounded mx-auto"></div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto"></div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="h-3.5 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded-lg ml-auto"></div>
                        </td>
                      </tr>
                    ))
                  ) : paginatedRisk.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold text-xs"
                      >
                        No matching student records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedRisk.map((item, idx) => {
                      const ratePct = Math.round(item.attendance_rate * 100);
                      const itemKey = item.id || `${item.student_id || item.student_code || 'st'}-${item.course_id || item.course_code || 'cr'}-${safeCurrentPage}-${idx}`;

                      return (
                        <tr
                          key={itemKey}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors align-middle"
                        >
                          {/* Student Info */}
                          <td className="py-3.5 px-5">
                            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                              {item.student_name || 'Unknown Student'}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-semibold mt-0.5">
                              {item.student_code}
                            </div>
                          </td>

                          {/* Course Code */}
                          <td className="py-3.5 px-4 font-mono font-bold text-brand-blue dark:text-blue-400">
                            {item.course_code}
                          </td>

                          {/* Attendance % with visual progress indicator */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`text-xs font-black ${
                                  ratePct < 80
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : ratePct < 88
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {ratePct}%
                              </span>
                              <div className="w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    ratePct < 80
                                      ? 'bg-rose-500'
                                      : ratePct < 88
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, ratePct)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          {/* Risk Level Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider inline-block ${badgeClass(
                                item.risk_label
                              )}`}
                            >
                              {item.risk_label}
                            </span>
                          </td>

                          {/* Risk Factors / Reason */}
                          <td className="py-3.5 px-4 max-w-[240px]">
                            <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug font-medium line-clamp-2">
                              {item.risk_factors || 'Standard monitoring'}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="py-3.5 px-5 text-right">
                            <button
                              onClick={() => openAlertModal(item)}
                              disabled={item.risk_label === 'low' || item.risk_label === 'observing'}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-brand-blue dark:text-blue-400 border border-slate-200 dark:border-slate-700 hover:bg-brand-blue hover:text-white dark:hover:bg-blue-600 dark:hover:text-white hover:border-brand-blue disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              <span>Alert</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Clean Footer Pagination Bar */}
          {filteredRisk.length > 0 && (
            <div key={`at-risk-footer-${safeCurrentPage}-${itemsPerPage}-${filteredRisk.length}`} className="px-5 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans">
              <div className="text-slate-500 dark:text-slate-400 text-[11.5px]">
                Showing <strong className="text-slate-800 dark:text-slate-200">{filteredRisk.length === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1}</strong> to{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {Math.min(safeCurrentPage * itemsPerPage, filteredRisk.length)}
                </strong>{' '}
                of <strong className="text-slate-800 dark:text-slate-200">{filteredRisk.length}</strong> entries
              </div>

              {/* Compact Windowed Pagination */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage === 1 || loading}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1 px-1">
                  {visiblePageNumbers.map((p, idx) => (
                    typeof p === 'number' ? (
                      <button
                        key={`page-btn-${p}`}
                        onClick={() => setCurrentPage(p)}
                        className={`h-7 min-w-[28px] px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          safeCurrentPage === p
                            ? 'bg-brand-blue dark:bg-blue-600 text-white shadow-xs ring-1 ring-brand-blue/30'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={`ellipsis-${idx}-${visiblePageNumbers[idx - 1] || 'start'}`} className="px-1 text-slate-400 font-bold select-none">
                        ...
                      </span>
                    )
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage === totalPages || loading}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  title="Next Page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Email Dispatch Logs Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs p-5 flex flex-col justify-between transition-colors">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20">
                <Send className="h-4 w-4" />
              </div>
              <h3 className="font-sans text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Email Dispatch Logs
              </h3>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[480px] pr-1">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 animate-pulse">
                    <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  </div>
                ))
              ) : alertLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-sans uppercase text-[10px] font-bold">
                  No dispatch logs recorded.
                </div>
              ) : (
                alertLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 rounded-xl space-y-2 text-xs font-sans transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">{log.student_name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                          <BookOpen className="h-3 w-3 text-brand-blue dark:text-blue-400" />
                          {log.course_code}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                          log.triggered_by === 'system'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-brand-blue dark:text-blue-400 border-blue-200/60 dark:border-blue-900/40'
                        }`}
                      >
                        {log.triggered_by.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-800 line-clamp-2 leading-relaxed">
                      {log.email_body}
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                      <span>Sent: {new Date(log.triggered_at).toLocaleDateString()}</span>
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="h-3 w-3" />
                        Delivered
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch Warning Email Modal */}
      {selectedStudentForAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-5 shadow-2xl relative text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-sans text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Mail className="h-4.5 w-4.5 text-brand-blue dark:text-blue-400" />
                Customize Warning Email Dispatch
              </h3>
              <button
                onClick={() => setSelectedStudentForAlert(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3 text-xs font-sans">
              <User className="h-7 w-7 text-brand-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 p-1.5 rounded-lg border border-blue-200/50 dark:border-blue-500/20" />
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  Recipient: {selectedStudentForAlert.student_name} ({selectedStudentForAlert.student_code})
                </p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Course: {selectedStudentForAlert.course_code} · {selectedStudentForAlert.risk_factors}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs font-sans">
              <label className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                Email Body
              </label>
              <textarea
                value={customDraft}
                onChange={e => setCustomDraft(e.target.value)}
                rows={8}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-blue/30 dark:focus:ring-blue-500/30"
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSelectedStudentForAlert(null)}
                className="uipro-button uipro-button-secondary py-2 px-4 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendManualAlert}
                disabled={sendingAlert}
                className="uipro-button uipro-button-primary py-2 px-4 text-xs cursor-pointer dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {sendingAlert ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Dispatch Warning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
