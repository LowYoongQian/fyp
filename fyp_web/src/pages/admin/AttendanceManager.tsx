import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../../services/api';
import type { AdminSession, AdminAttendanceRecord } from '../../services/api';
import { swalSuccess, swalError } from '../../utils/swal';
import {
  UserCheck,
  Search,
  X,
  Wifi,
  User,
  ShieldAlert,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  BookOpen,
  Filter,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { ShimmerTableSkeleton } from '../../components/Shimmer';

export const AttendanceManager: React.FC = () => {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // QOL Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Table Pagination States
  const [page, setPage] = useState<number>(1);
  const limit = 10; // Items per page
  const [pageChanging, setPageChanging] = useState(false);

  // Selected session for attendance details modal
  const [selectedSession, setSelectedSession] = useState<AdminSession | null>(null);
  const [attendanceList, setAttendanceList] = useState<AdminAttendanceRecord[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [modalStatusFilter, setModalStatusFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [submittingStudentId, setSubmittingStudentId] = useState<number | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.adminGetSessions();
      setSessions(data);
      setPage(1);
    } catch (err: any) {
      setError('Failed to load class sessions. Please verify the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic filter dropdown options
  const uniqueCourses = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach(s => map.set(s.course_code, s.course_name));
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [sessions]);

  const uniqueGroups = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => {
      if (s.class_group) set.add(s.class_group);
    });
    return Array.from(set).sort();
  }, [sessions]);

  const uniqueStaff = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => {
      if (s.lecturer_name) set.add(s.lecturer_name);
    });
    return Array.from(set).sort();
  }, [sessions]);

  // Combined QOL Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      // 1. Status Filter
      if (statusFilter === 'active' && !s.is_open && s.status !== 'Active') return false;
      if (statusFilter === 'closed' && (s.is_open || s.status === 'Active')) return false;

      // 2. Course Filter
      if (selectedCourse !== 'all' && s.course_code !== selectedCourse) return false;

      // 3. Class Group Filter
      if (selectedGroup !== 'all' && s.class_group !== selectedGroup) return false;

      // 4. Staff Filter
      if (selectedStaff !== 'all' && s.lecturer_name !== selectedStaff) return false;

      // 5. Text Search (Course code, name, staff, group)
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchCourseCode = s.course_code.toLowerCase().includes(q);
        const matchCourseName = s.course_name.toLowerCase().includes(q);
        const matchLecturer = s.lecturer_name.toLowerCase().includes(q);
        const matchGroup = s.class_group.toLowerCase().includes(q);
        const matchRole = (s.lecturer_role || '').toLowerCase().includes(q);

        if (!matchCourseCode && !matchCourseName && !matchLecturer && !matchGroup && !matchRole) {
          return false;
        }
      }

      return true;
    });
  }, [sessions, statusFilter, selectedCourse, selectedGroup, selectedStaff, searchQuery]);

  // Table Pagination Computations
  const totalCount = filteredSessions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(page * limit, totalCount);

  const paginatedSessions = useMemo(() => {
    return filteredSessions.slice(startIndex, endIndex);
  }, [filteredSessions, startIndex, endIndex]);

  const handlePageChange = (newPage: number) => {
    if (newPage === page || newPage < 1 || newPage > totalPages) return;
    setPageChanging(true);
    setPage(newPage);
    setTimeout(() => {
      setPageChanging(false);
    }, 300);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSelectedCourse('all');
    setSelectedGroup('all');
    setSelectedStaff('all');
    setPage(1);
  };

  const isFilterActive = searchQuery !== '' || statusFilter !== 'all' || selectedCourse !== 'all' || selectedGroup !== 'all' || selectedStaff !== 'all';

  // Session Attendance Modal Logic
  const openAttendanceModal = async (session: AdminSession) => {
    setSelectedSession(session);
    setAttendanceList([]);
    setModalError(null);
    setModalLoading(true);
    setStudentSearchQuery('');
    setModalStatusFilter('all');
    try {
      const data = await apiService.adminGetSessionAttendance(session.id);
      setAttendanceList(data.attendance_list || []);
    } catch (err: any) {
      setModalError('Failed to fetch session attendance detail.');
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeAttendanceModal = () => {
    setSelectedSession(null);
    setAttendanceList([]);
    setModalError(null);
  };

  const handleToggleStatus = async (record: AdminAttendanceRecord) => {
    if (!selectedSession) return;
    setSubmittingStudentId(record.student_id);
    const newStatus = record.status === 'present' ? 'absent' : 'present';
    
    try {
      await apiService.adminUpdateAttendance(selectedSession.id, record.student_id, {
        status: newStatus,
        wifi_verified: record.wifi_verified,
        liveness_passed: record.liveness_passed
      });
      
      setAttendanceList(prev =>
        prev.map(item =>
          item.student_id === record.student_id
            ? { ...item, status: newStatus, marked_at: new Date().toISOString() }
            : item
        )
      );
      await swalSuccess(
        'Attendance Updated',
        `${record.student_name} marked as ${newStatus}.`
      );
    } catch (err: any) {
      await swalError('Update Failed', err.response?.data?.detail || 'Failed to update attendance status.');
    } finally {
      setSubmittingStudentId(null);
    }
  };

  const handleToggleOverride = async (record: AdminAttendanceRecord, type: 'wifi' | 'liveness') => {
    if (!selectedSession) return;
    setSubmittingStudentId(record.student_id);
    const updatedWifi = type === 'wifi' ? !record.wifi_verified : record.wifi_verified;
    const updatedLiveness = type === 'liveness' ? !record.liveness_passed : record.liveness_passed;

    try {
      await apiService.adminUpdateAttendance(selectedSession.id, record.student_id, {
        status: record.status,
        wifi_verified: updatedWifi,
        liveness_passed: updatedLiveness
      });

      setAttendanceList(prev =>
        prev.map(item =>
          item.student_id === record.student_id
            ? { ...item, wifi_verified: updatedWifi, liveness_passed: updatedLiveness, marked_at: new Date().toISOString() }
            : item
        )
      );
      await swalSuccess(
        'Override Applied',
        `${type === 'wifi' ? 'WiFi' : 'Liveness'} flag updated for ${record.student_name}.`
      );
    } catch (err: any) {
      await swalError('Update Failed', err.response?.data?.detail || 'Failed to update verification override.');
    } finally {
      setSubmittingStudentId(null);
    }
  };

  // Filter students inside modal
  const filteredAttendance = useMemo(() => {
    return attendanceList.filter(r => {
      if (modalStatusFilter === 'present' && r.status !== 'present') return false;
      if (modalStatusFilter === 'absent' && r.status !== 'absent') return false;
      if (studentSearchQuery.trim()) {
        const q = studentSearchQuery.toLowerCase().trim();
        return r.student_name.toLowerCase().includes(q) || r.student_code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [attendanceList, modalStatusFilter, studentSearchQuery]);

  const formatDateTime = (dtStr: string | null) => {
    if (!dtStr) return 'N/A';
    const date = new Date(dtStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const activeSessionCount = sessions.filter(s => s.is_open || s.status === 'Active').length;
  const closedSessionCount = sessions.length - activeSessionCount;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="uipro-card bg-white/75 backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2.5">
              <UserCheck className="h-5.5 w-5.5 text-brand-blue" />
              Attendance
            </h2>
            <p className="text-xs text-slate-500 font-sans">
              View class sessions and student attendance records.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={fetchSessions}
              disabled={loading}
              className="uipro-button uipro-button-secondary py-2 px-3.5 text-xs flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh Sessions
            </button>
          </div>
        </div>
      </div>

      {/* Controls & Table Container */}
      <div className="uipro-card space-y-5">
        {/* QOL Category Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setStatusFilter('all'); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Sessions ({sessions.length})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter('active'); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200'
                  : 'text-slate-500 hover:text-emerald-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active ({activeSessionCount})
            </button>
            <button
              type="button"
              onClick={() => { setStatusFilter('closed'); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'closed'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Closed ({closedSessionCount})
            </button>
          </div>

          {/* Multi-Criteria Filters Toggle */}
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              isFilterActive
                ? 'bg-brand-blue-light text-brand-blue border-brand-blue/20'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filter Criteria</span>
            {isFilterActive && (
              <span className="w-2 h-2 rounded-full bg-brand-blue" />
            )}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isFilterDrawerOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* QOL Advanced Filter Bar */}
        {(isFilterDrawerOpen || isFilterActive) && (
          <div className="p-4 bg-slate-50/80 border border-slate-200/70 rounded-xl space-y-3 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* 1. Search Query */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Search Keyword</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Course, Staff, Student..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    className="w-full uipro-input !pl-9 !py-2 text-xs"
                  />
                </div>
              </div>

              {/* 2. Course Filter */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Course</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => { setSelectedCourse(e.target.value); setPage(1); }}
                  className="w-full uipro-input !py-2 text-xs bg-white cursor-pointer"
                >
                  <option value="all">All Courses ({uniqueCourses.length})</option>
                  {uniqueCourses.map(c => (
                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              {/* 3. Class Group Filter */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Class Group</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => { setSelectedGroup(e.target.value); setPage(1); }}
                  className="w-full uipro-input !py-2 text-xs bg-white cursor-pointer"
                >
                  <option value="all">All Groups ({uniqueGroups.length})</option>
                  {uniqueGroups.map(g => (
                    <option key={g} value={g}>{g.startsWith('G') ? `Group ${g.replace('G', '')}` : g}</option>
                  ))}
                </select>
              </div>

              {/* 4. Staff / Lecturer Filter */}
              <div className="space-y-1">
                <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Staff / Lecturer</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => { setSelectedStaff(e.target.value); setPage(1); }}
                  className="w-full uipro-input !py-2 text-xs bg-white cursor-pointer"
                >
                  <option value="all">All Staff ({uniqueStaff.length})</option>
                  {uniqueStaff.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            {isFilterActive && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/50">
                <span className="text-[11px] text-slate-500 font-medium">
                  Found <strong className="text-slate-800">{totalCount}</strong> matching sessions
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-bold text-danger-red hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sessions Table Output */}
        {loading || pageChanging ? (
          <ShimmerTableSkeleton
            headers={['Course', 'Staff Name', 'Role', 'Group', 'Opened At', 'Closed At', 'Status', 'Actions']}
            rows={limit}
            showPagination={true}
          />
        ) : error ? (
          <div className="py-12 text-center text-danger-red font-sans text-xs bg-danger-red-light border border-danger-red/10 rounded-xl">
            {error}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-sans text-xs border border-dashed border-slate-200 rounded-xl space-y-2">
            <p className="font-semibold text-slate-600">No class sessions found</p>
            <p className="text-[11px] text-slate-400">Try broadening your search keyword or clearing filter selections.</p>
            {isFilterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 py-1.5 px-4 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Staff Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Group</th>
                    <th className="py-3 px-4">Opened At</th>
                    <th className="py-3 px-4">Closed At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                  {paginatedSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <div>
                            <p className="font-bold text-slate-800">{session.course_code}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{session.course_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{session.lecturer_name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-650 border border-slate-200">
                          {session.lecturer_role || 'Lecturer'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 font-bold">
                        {session.class_group.startsWith('G') ? `Group ${session.class_group.replace('G', '')}` : session.class_group}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">{formatDateTime(session.opened_at)}</td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {session.status === 'Closed' ? (
                          formatDateTime(session.closed_at)
                        ) : (
                          <span className="text-brand-blue font-semibold italic flex items-center gap-1">
                            <Clock className="h-3 w-3 animate-spin shrink-0" /> In Progress
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {session.status === 'Active' || session.is_open ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success-green-light text-success-green border border-success-green/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-success-green animate-ping shrink-0" />
                            <span>Active</span>
                          </span>
                        ) : session.status === 'On Going' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                            <span>On Going</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <span>Closed</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openAttendanceModal(session)}
                          className="uipro-button uipro-button-primary bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-md shadow-blue-500/20 py-1.5 px-3.5 text-[10px] font-bold rounded-xl border-0 cursor-pointer"
                        >
                          Audit Attendance
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Standard Table Pagination Footer (Matches Staff/Students format) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500 mt-4">
              <div>
                Showing <span className="font-bold text-slate-700">{totalCount > 0 ? startIndex + 1 : 0}</span> to{' '}
                <span className="font-bold text-slate-700">{endIndex}</span> of{' '}
                <span className="font-bold text-slate-700">{totalCount}</span> class sessions
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={page === 1 || pageChanging}
                  onClick={() => handlePageChange(1)}
                  className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  First
                </button>
                <button
                  type="button"
                  disabled={page === 1 || pageChanging}
                  onClick={() => handlePageChange(page - 1)}
                  className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-slate-650">
                  Page <span className="font-bold text-slate-800">{page}</span> of <span className="font-bold text-slate-800">{totalPages}</span>
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || pageChanging}
                  onClick={() => handlePageChange(page + 1)}
                  className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || pageChanging}
                  onClick={() => handlePageChange(totalPages)}
                  className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Dialog: AUDIT / MANAGE ATTENDANCE */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm" onClick={closeAttendanceModal} />
          
          <div className="max-w-4xl w-full uipro-card bg-white relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                  <UserCheck className="h-4.5 w-4.5 text-brand-blue" />
                  Audit Attendance Directory
                </h3>
                <p className="text-[10px] text-slate-400">
                  Course: <strong className="text-slate-700">{selectedSession.course_code} - {selectedSession.course_name}</strong> | Group: <strong className="text-slate-700">{selectedSession.class_group.startsWith('G') ? `Group ${selectedSession.class_group.replace('G', '')}` : selectedSession.class_group}</strong>
                </p>
              </div>
              <button
                onClick={closeAttendanceModal}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Constraints Banner */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex gap-2.5 text-[10px] text-slate-500 font-sans leading-relaxed">
              <ShieldAlert className="h-4.5 w-4.5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-700">Administrative Audit Mode</p>
                <p>
                  As an administrator, you can toggle a student's check-in status (Present/Absent) or manually verify check-in requirements (WiFi network match and facial liveness challenge). Attendance records **cannot be permanently deleted** from the system database; toggling to absent will write an <strong className="text-slate-600">"absent"</strong> audit status.
                </p>
              </div>
            </div>

            {/* Modal Controls Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Modal Filter Chips */}
              <div className="flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-xl w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setModalStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    modalStatusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  All ({attendanceList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalStatusFilter('present')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    modalStatusFilter === 'present' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Present ({attendanceList.filter(r => r.status === 'present').length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalStatusFilter('absent')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    modalStatusFilter === 'absent' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Absent ({attendanceList.filter(r => r.status === 'absent').length})
                </button>
              </div>

              {/* Modal student search toolbar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student name or code..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full uipro-input !pl-9 !py-2 text-xs"
                />
              </div>
            </div>

            {/* Attendance list output */}
            <div className="overflow-y-auto flex-1 min-h-0 border border-slate-100 rounded-xl">
              {modalLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2 font-sans text-xs">
                  <Loader2 className="h-6 w-6 text-brand-blue animate-spin" />
                  <span>Loading enrolment checklist...</span>
                </div>
              ) : modalError ? (
                <div className="p-4 text-center text-danger-red font-sans text-xs bg-danger-red-light">
                  {modalError}
                </div>
              ) : filteredAttendance.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-sans text-xs">
                  No enrolled students found matching search.
                </div>
              ) : (
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead className="bg-slate-50/75 sticky top-0 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider z-10">
                    <tr>
                      <th className="py-2.5 px-4">Student Details</th>
                      <th className="py-2.5 px-4">Student Code</th>
                      <th className="py-2.5 px-4">Checked-In</th>
                      <th className="py-2.5 px-4 text-center">WiFi Verified</th>
                      <th className="py-2.5 px-4 text-center">Liveness Passed</th>
                      <th className="py-2.5 px-4 text-center">Attendance Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {filteredAttendance.map((record) => {
                      const isSubmitting = submittingStudentId === record.student_id;
                      return (
                        <tr key={record.student_id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800">{record.student_name}</td>
                          <td className="py-3 px-4 font-mono text-slate-500 font-bold">{record.student_code}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {record.marked_at ? formatDateTime(record.marked_at) : 'Not marked'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleOverride(record, 'wifi')}
                              disabled={isSubmitting}
                              className={`inline-flex items-center gap-1 py-1 px-2.5 rounded-lg border text-[10px] font-semibold cursor-pointer select-none transition-all ${
                                record.wifi_verified
                                  ? 'bg-success-green-light text-success-green border-success-green/10 hover:bg-success-green/10'
                                  : 'bg-danger-red-light text-danger-red border-danger-red/10 hover:bg-danger-red/10'
                              }`}
                            >
                              <Wifi className="h-3 w-3 shrink-0" />
                              <span>{record.wifi_verified ? 'Verified' : 'Bypassed'}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleOverride(record, 'liveness')}
                              disabled={isSubmitting}
                              className={`inline-flex items-center gap-1 py-1 px-2.5 rounded-lg border text-[10px] font-semibold cursor-pointer select-none transition-all ${
                                record.liveness_passed
                                  ? 'bg-success-green-light text-success-green border-success-green/10 hover:bg-success-green/10'
                                  : 'bg-danger-red-light text-danger-red border-danger-red/10 hover:bg-danger-red/10'
                              }`}
                            >
                              <User className="h-3 w-3 shrink-0" />
                              <span>{record.liveness_passed ? 'Passed' : 'Bypassed'}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {record.status === 'present' ? (
                              <span className="uipro-badge uipro-badge-success inline-flex items-center">
                                <CheckCircle className="h-3 w-3 mr-1" /> Present
                              </span>
                            ) : (
                              <span className="uipro-badge uipro-badge-danger inline-flex items-center">
                                <XCircle className="h-3 w-3 mr-1" /> Absent
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleToggleStatus(record)}
                              disabled={isSubmitting}
                              className={`uipro-button py-1.5 px-3 text-[10px] font-bold cursor-pointer transition-all ${
                                record.status === 'present'
                                  ? 'uipro-button-secondary border-danger-red/20 text-danger-red hover:bg-danger-red-light hover:text-danger-red'
                                  : 'uipro-button-primary bg-success-green hover:bg-success-green/90 border-success-green/10'
                              }`}
                            >
                              {isSubmitting ? (
                                <Loader2 className="h-3 w-3 animate-spin mx-2" />
                              ) : record.status === 'present' ? (
                                'Mark Absent'
                              ) : (
                                'Mark Present'
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="flex justify-end pt-2">
              <button
                onClick={closeAttendanceModal}
                className="uipro-button uipro-button-secondary py-2 px-4 cursor-pointer"
              >
                Close Audit panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
