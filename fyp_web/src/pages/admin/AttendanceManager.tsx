import React, { useState, useEffect } from 'react';
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
  BookOpen
} from 'lucide-react';

export const AttendanceManager: React.FC = () => {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected session for attendance details modal
  const [selectedSession, setSelectedSession] = useState<AdminSession | null>(null);
  const [attendanceList, setAttendanceList] = useState<AdminAttendanceRecord[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
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
    } catch (err: any) {
      setError('Failed to load class sessions. Please verify the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAttendanceModal = async (session: AdminSession) => {
    setSelectedSession(session);
    setAttendanceList([]);
    setModalError(null);
    setModalLoading(true);
    setStudentSearchQuery('');
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
      
      // Update local state
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

      // Update local state
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

  // Filter sessions
  const filteredSessions = sessions.filter(s =>
    s.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.lecturer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter students inside modal
  const filteredAttendance = attendanceList.filter(r =>
    r.student_name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
    r.student_code.toLowerCase().includes(studentSearchQuery.toLowerCase())
  );

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

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="uipro-card bg-white/75 backdrop-blur-md relative overflow-hidden">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2.5">
              <UserCheck className="h-5.5 w-5.5 text-brand-blue" />
              Attendance Registry & Overrides
            </h2>
            <p className="text-xs text-slate-500 font-sans">
              Monitor active and completed class sessions, audit student check-in records, and modify attendance or verification parameters.
            </p>
          </div>
          <button
            onClick={fetchSessions}
            className="uipro-button uipro-button-secondary shrink-0 self-start md:self-auto"
          >
            Refresh Sessions
          </button>
        </div>
      </div>

      {/* Controls & Table Container */}
      <div className="uipro-card space-y-4">
        {/* Search Toolbar */}
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search sessions by course code, title, or lecturer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full uipro-input !pl-10"
          />
        </div>

        {/* Directory Output */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3 font-sans text-xs">
            <Loader2 className="h-8 w-8 text-brand-blue animate-spin" />
            <span>Retrieving class sessions...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-danger-red font-sans text-xs bg-danger-red-light border border-danger-red/10 rounded-xl">
            {error}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-sans text-xs border border-dashed border-slate-200 rounded-xl">
            No class sessions found matching search filters.
          </div>
        ) : (
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
                {filteredSessions.map((session) => (
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
                      {session.status === 'Active' ? (
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
                        className="uipro-button uipro-button-primary py-1.5 px-3.5 text-[10px] cursor-pointer"
                      >
                        Audit Attendance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

            {/* Modal search toolbar */}
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search enrolled students by name or code..."
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                className="w-full uipro-input !pl-10"
              />
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
                  No enrolled students found.
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
