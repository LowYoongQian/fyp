import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { swalSuccess } from '../../utils/swal';
import { ShimmerTableRows } from '../../components/Shimmer';
import type { Course, ActiveSession, SessionAttendanceDetail, StudentAttendance, Announcement } from '../../services/api';
import {
  Play,
  Wifi,
  RefreshCw,
  Layers,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  User,
  BookOpen,
  Calendar,
  Sparkles,
  Bell,
  Mail,
  Phone,
  Check,
  Clock
} from 'lucide-react';

export const LecturerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolments, setEnrolments] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  
  // Create Session Form
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [classGroup, setClassGroup] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState<number>(0);
  const triggerReRender = () => setRenderKey(prev => prev + 1);

  const courseDropdownRef = useRef<HTMLDivElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  const [isCourseOpen, setIsCourseOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target as Node)) {
        setIsCourseOpen(false);
      }
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setIsGroupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live Monitoring Session
  const [monitoredSessionId, setMonitoredSessionId] = useState<number | string | null>(null);
  const [attendanceData, setAttendanceData] = useState<SessionAttendanceDetail | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [realAnnouncements, setRealAnnouncements] = useState<Announcement[]>([]);

  const pollingRef = useRef<any>(null);

  const lecturerName = user 
    ? (user.email.split('@')[0].toUpperCase() === 'LEE' 
        ? 'Dr. Lee Min' 
        : user.email.split('@')[0].toUpperCase() === 'WONG' 
          ? 'Dr. Wong Kang Shiang' 
          : 'Dr. ' + user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1)) 
    : 'Dr. Lee Min';

  const getCourseIdentifier = (c: Course): string => {
    if (!c) return '';
    if (c.id !== undefined && c.id !== null && String(c.id).trim() !== '') return String(c.id).trim();
    if (c.course_id !== undefined && c.course_id !== null && String(c.course_id).trim() !== '') return String(c.course_id).trim();
    if (c.course_code && String(c.course_code).trim() !== '') return String(c.course_code).trim();
    return '';
  };

  const getAvailableGroupsForCourse = (courseId: string): string[] => {
    if (!courseId) return ['G1'];
    const matched = courses.find(c => 
      getCourseIdentifier(c) === courseId || 
      String(c.id) === courseId || 
      (c.course_id && String(c.course_id) === courseId) || 
      c.course_code === courseId
    );
    const targetIdStr = matched ? String(matched.id) : courseId;
    const targetCode = matched ? matched.course_code : courseId;

    const inUse = Array.from(new Set(
      enrolments
        .filter(e => String(e.course_id) === targetIdStr || e.course_code === targetCode)
        .map(e => e.class_group)
    )).filter((g: any) => g && g.startsWith('G')) as string[];

    if (!inUse.includes('G1')) {
      inUse.push('G1');
    }

    const manualKey = `sas_manual_groups_${courseId}`;
    try {
      const storedManual = JSON.parse(localStorage.getItem(manualKey) || '[]');
      storedManual.forEach((g: string) => {
        if (!inUse.includes(g)) {
          inUse.push(g);
        }
      });
    } catch (e) {
      console.error(e);
    }

    inUse.sort((a, b) => {
      const numA = parseInt(a.replace('G', '')) || 1;
      const numB = parseInt(b.replace('G', '')) || 1;
      return numA - numB;
    });

    const highestGroup = inUse[inUse.length - 1];
    const count = enrolments.filter(e => e.course_id.toString() === courseId && e.class_group === highestGroup).length;
    if (count >= 25) {
      const highestNum = parseInt(highestGroup.replace('G', '')) || 1;
      const nextGroup = `G${highestNum + 1}`;
      if (!inUse.includes(nextGroup)) {
        inUse.push(nextGroup);
      }
    }

    return inUse;
  };

  // Reset classGroup to G1 or check validity when course or enrolments change
  useEffect(() => {
    if (!selectedCourseId) return;
    const available = getAvailableGroupsForCourse(selectedCourseId);
    if (classGroup !== 'All' && !available.includes(classGroup)) {
      setClassGroup('G1');
    }
  }, [selectedCourseId, enrolments]);

  // Load initial data
  useEffect(() => {
    loadInitialData();

    return () => {
      stopPolling();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      const [coursesList, enrolmentsList, announcementsList] = await Promise.all([
        apiService.getCourses(),
        apiService.getEnrolments(),
        apiService.lecturerGetAnnouncements().catch(() => [])
      ]);
      setCourses(coursesList);
      setEnrolments(enrolmentsList);
      setRealAnnouncements(announcementsList);
      await fetchActiveSessions(coursesList);
    } catch (err) {
      console.error("Failed to load initial lecturer dashboard data:", err);
    }
  };  const fetchActiveSessions = async (coursesList?: Course[]) => {
    try {
      const data = await apiService.getActiveSessions();
      const listToUse = coursesList || courses;
      const detailed = data.map((s: any) => {
        const c = listToUse.find(course => String(course.id) === String(s.course_id));
        return {
          ...s,
          course_name: c ? c.course_name : 'Unknown Course',
          course_code: c ? c.course_code : 'N/A'
        };
      });
      setActiveSessions(detailed);
    } catch (err: any) {
      console.error("Error fetching active sessions:", err);
    }
  };
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreationError(null);
    try {
      if (!selectedCourseId) throw new Error('Please select a subject course');
      if (!classGroup) throw new Error('Please select a class allocation group');
      const response = await apiService.openSession(selectedCourseId, classGroup);
      await fetchActiveSessions();
      handleStartMonitor(response.id);
      await swalSuccess('Session Opened', 'Attendance window is now live for students.');
    } catch (err: any) {
      console.error(err);
      setCreationError(err.response?.data?.detail || err.message || 'Failed to open class session.');
    } finally {
      setCreating(false);
    }
  };

  const startPolling = (sessionId: number | string) => {
    stopPolling();
    const tick = async () => {
      try {
        const data = await apiService.getSessionAttendance(sessionId);
        setAttendanceData(data);
      } catch (err) {
        console.error("Polling attendance failed", err);
      }
    };

    tick();
    pollingRef.current = setInterval(tick, 5000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleStartMonitor = async (sessionId: number | string) => {
    setLoadingAttendance(true);
    setAttendanceError(null);
    setMonitoredSessionId(sessionId);
    try {
      const data = await apiService.getSessionAttendance(sessionId);
      setAttendanceData(data);
      setLoadingAttendance(false);
      startPolling(sessionId);
    } catch (err: any) {
      console.error(err);
      setAttendanceError(err.response?.data?.detail || 'Failed to load attendance logs.');
      setLoadingAttendance(false);
    }
  };

  const handleManualMark = (studentId: number | string, currentStatus: string) => {
    if (!attendanceData) return;
    
    const updatedList = attendanceData.attendance_list.map((s): StudentAttendance => {
      if (s.student_id === studentId) {
        const nextStatus = currentStatus === 'present' ? 'absent' : 'present';
        return {
          ...s,
          status: nextStatus,
          marked_at: nextStatus === 'present' ? new Date().toISOString() : null,
          confidence_score: nextStatus === 'present' ? 1.0 : null,
        };
      }
      return s;
    });

    setAttendanceData({
      ...attendanceData,
      attendance_list: updatedList
    });
  };

  // Calculate statistics
  const presentCount = attendanceData?.attendance_list.filter(s => s.status === 'present').length || 0;
  const totalCount = attendanceData?.attendance_list.length || 0;
  const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Static/default rates for display before a monitored session is live
  const displayRate = monitoredSessionId ? rate : 92; 

  // Calculate unique enrolled students count
  const totalEnrolledStudents = React.useMemo(() => {
    try {
      const courseIds = courses.map(c => c.id);
      const studentIds = enrolments
        .filter(e => courseIds.includes(e.course_id))
        .map(e => e.student_id);
      return new Set(studentIds).size;
    } catch (err) {
      console.error("Error calculating enrolled students:", err);
      return 0;
    }
  }, [courses, enrolments]);

  const announcements = realAnnouncements.length > 0
    ? realAnnouncements.map(a => ({
        id: a.id,
        title: a.title,
        body: a.content,
        date: new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        type: a.publisher || 'ADMIN'
      }))
    : [
        {
          id: 1,
          title: "Mid-Term Examination Schedule",
          body: "Subnet security bounds apply to Hall A and Hall B examination rooms. Timetable key sync is mandatory.",
          date: "June 15, 2026",
          type: "Exam"
        },
        {
          id: 2,
          title: "FastAPI Core Router Maintenance",
          body: "Database transaction validation engines will undergo scheduled migration backup on June 18 at 02:00 AM.",
          date: "June 14, 2026",
          type: "System"
        }
      ];

  return (
    <div className="space-y-6">
      {/* Top Section Row (Profile Card, Stats grid, Shortcuts list) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Profile Card */}
        <div className="xl:col-span-4 uipro-card bg-gradient-to-br from-blue-50/50 via-white to-white relative overflow-hidden flex flex-col justify-between p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue shadow-inner shrink-0">
                  <User className="h-8 w-8" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-5.5 h-5.5 bg-success-green border-2 border-white rounded-full flex items-center justify-center text-[10px] text-white">
                  ✓
                </span>
              </div>
              <div>
                <h3 className="text-lg font-display font-extrabold text-slate-800 leading-tight">
                  {lecturerName}
                </h3>
                <span className="text-[10px] font-bold text-brand-blue bg-brand-blue-light px-2 py-0.5 rounded-md uppercase tracking-wider mt-1 inline-block">
                  Senior Lecturer
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Managing smart attendance rosters, liveness verification nodes, and student risk analytics profiles.
            </p>
            
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[10.5px] text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Joined January 2025</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>+60 12-345 6789</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Metric Cards Grid */}
        <div className="xl:col-span-5 grid grid-cols-2 gap-4">
          <div className="uipro-card bg-white p-5 flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Enrolled</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50">
                <User className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-display font-extrabold text-slate-800">{totalEnrolledStudents}</span>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">Unique Students Enrolled</p>
            </div>
          </div>

          <div className="uipro-card bg-white p-5 flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Sessions</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/50">
                <Play className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-display font-extrabold text-slate-800">{activeSessions.length}</span>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">Currently Open Subnets</p>
            </div>
          </div>

          <div className="uipro-card bg-white p-5 flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">My Courses</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/50">
                <BookOpen className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-display font-extrabold text-slate-800">{courses.length}</span>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">Assigned Enrolled Roster</p>
            </div>
          </div>

          <div className="uipro-card bg-white p-5 flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"> Roster Classes</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/50">
                <Layers className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-display font-extrabold text-slate-800">6</span>
              <p className="text-[9px] text-slate-400 font-semibold mt-1">Lecture & Tutorial Groups</p>
            </div>
          </div>
        </div>

        {/* Shortcuts Card */}
        <div className="xl:col-span-3 uipro-card bg-white p-5 flex flex-col justify-between">
          <div className="pb-2.5 border-b border-slate-100 mb-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-brand-blue" />
              Shortcuts
            </h4>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button className="w-full text-left py-2 px-3 bg-slate-50 border border-slate-200/60 rounded-xl text-[10.5px] font-semibold text-slate-650 hover:bg-brand-blue-light hover:text-brand-blue hover:border-brand-blue/10 transition-all cursor-pointer">
              Teacher's Classes
            </button>
            <button className="w-full text-left py-2 px-3 bg-slate-50 border border-slate-200/60 rounded-xl text-[10.5px] font-semibold text-slate-650 hover:bg-brand-blue-light hover:text-brand-blue hover:border-brand-blue/10 transition-all cursor-pointer">
              Teacher's Students
            </button>
            <button className="w-full text-left py-2 px-3 bg-slate-50 border border-slate-200/60 rounded-xl text-[10.5px] font-semibold text-slate-650 hover:bg-brand-blue-light hover:text-brand-blue hover:border-brand-blue/10 transition-all cursor-pointer">
              Teacher's Lessons
            </button>
            <button className="w-full text-left py-2 px-3 bg-slate-50 border border-slate-200/60 rounded-xl text-[10.5px] font-semibold text-slate-650 hover:bg-brand-blue-light hover:text-brand-blue hover:border-brand-blue/10 transition-all cursor-pointer">
              Teacher's Exams
            </button>
          </div>
        </div>

      </div>

      {/* Main Grid: Control Panel vs Performance & Active Classes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Session Actions & Monitoring (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active checking monitor panel if monitored session is active */}
          {monitoredSessionId ? (
            <div className="uipro-card space-y-6 relative overflow-hidden bg-white/75">
              
              {/* Panel Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-success-green rounded-full animate-ping" />
                    <h3 className="text-base font-display font-extrabold text-slate-800">
                      Live Checking Monitor Panel
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Monitoring Group <strong className="text-slate-700">{attendanceData?.class_group}</strong> ·{' '}
                    <strong className="text-slate-700">{attendanceData?.course_name} ({attendanceData?.course_code})</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-success-green bg-success-green/10 border border-success-green/20 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                    Gate Open
                  </span>
                </div>
              </div>

              {loadingAttendance ? (
                <div className="py-6">
                  <ShimmerTableRows rows={4} />
                </div>
              ) : attendanceError ? (
                <div className="p-4 bg-danger-red-light border border-danger-red/10 rounded-xl text-center text-danger-red text-xs">
                  {attendanceError}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-sans uppercase tracking-wider font-semibold">
                    <span className="text-slate-400">Attendee Ledger ({totalCount} enrolled)</span>
                    <span className="text-slate-400 flex items-center gap-1.5 font-bold">
                      <RefreshCw className="h-3 w-3 animate-spin text-success-green" />
                      Auto-syncing every 5s
                    </span>
                  </div>

                  {/* Student Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {attendanceData?.attendance_list.map((student) => {
                      const isPresent = student.status === 'present';
                      return (
                        <div
                          key={student.student_id}
                          className={`p-4 rounded-xl border transition-all space-y-3 relative overflow-hidden group ${
                            isPresent
                              ? 'bg-success-green-light/40 border-success-green/20 hover:border-success-green/35'
                              : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 leading-none mb-1">{student.student_name}</h4>
                              <span className="text-[9.5px] text-slate-400 font-mono tracking-wide">{student.student_code}</span>
                            </div>
                            <span className={`uipro-badge shrink-0 ${
                              isPresent
                                ? 'uipro-badge-success'
                                : 'uipro-badge-warning'
                            }`}>
                              {isPresent ? 'Present' : 'Absent'}
                            </span>
                          </div>

                          {isPresent && (
                            <div className="grid grid-cols-3 gap-1 bg-white border border-slate-100 p-2 rounded-xl text-[9px] text-slate-500 font-sans uppercase tracking-wider text-center">
                              <div className="flex flex-col items-center gap-1 py-0.5 border-r border-slate-100" title="WiFi subnet checked server-side">
                                <Wifi className="h-3.5 w-3.5 text-success-green" />
                                <span className="scale-90 text-slate-400 font-semibold mt-0.5">WiFi Ok</span>
                              </div>
                              <div className="flex flex-col items-center gap-1 py-0.5 border-r border-slate-100" title="Google ML Kit face mesh pass">
                                <ShieldCheck className="h-3.5 w-3.5 text-success-green" />
                                <span className="scale-90 text-slate-400 font-semibold mt-0.5">Liveness</span>
                              </div>
                              <div className="flex flex-col items-center gap-1 py-0.5" title="Cosine Similarity Score match">
                                <HelpCircle className="h-3.5 w-3.5 text-warning-orange" />
                                <span className="scale-90 text-slate-400 font-semibold mt-0.5">Sim: {student.confidence_score ? Math.round(student.confidence_score * 100) : '0'}%</span>
                              </div>
                            </div>
                          )}

                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[9px] font-sans">
                            <span className="text-slate-400">
                              {student.marked_at ? `Marked: ${new Date(student.marked_at).toLocaleTimeString()}` : 'No record'}
                            </span>
                            <button
                              onClick={() => handleManualMark(student.student_id, student.status)}
                              className="px-2 py-0.5 bg-white hover:bg-slate-50 text-brand-blue border border-slate-200 hover:border-slate-300 rounded-md font-bold transition-all uppercase tracking-wider text-[8px] cursor-pointer"
                            >
                              Override
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Open Class Form */}
          <div className="uipro-card bg-white/75 relative flex flex-col justify-between z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="p-2 bg-brand-blue-light rounded-xl text-brand-blue shadow-xs">
                  <Play className="h-4 w-4" />
                </div>
                <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Open Session Window
                </h3>
              </div>

              {creationError && (
                <div className="p-3 bg-danger-red-light border border-danger-red/10 rounded-xl text-[10px] text-danger-red font-mono">
                  {creationError}
                </div>
              )}

              <form key={`session-form-${renderKey}-${selectedCourseId}-${classGroup}`} onSubmit={handleCreateSession} className="space-y-4 font-sans">
                {/* Select Subject Course */}
                <div className="space-y-1.5 relative" ref={courseDropdownRef}>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Select Subject Course</label>
                  <div className="relative">
                    <button
                      key={`course-btn-${renderKey}-${selectedCourseId}`}
                      type="button"
                      onClick={() => {
                        setIsCourseOpen(prev => !prev);
                        setIsGroupOpen(false);
                      }}
                      className={`w-full py-2.5 px-4 text-left flex items-center justify-between bg-slate-50 dark:bg-slate-800/90 border rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/80 transition-all cursor-pointer ${
                        isCourseOpen ? 'border-brand-blue dark:border-sky-400 ring-2 ring-brand-blue/20 dark:ring-sky-400/20' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="truncate font-semibold">
                        {(() => {
                          if (!selectedCourseId) return '-- Select Subject Course --';
                          const matchedCourse = courses.find(c => {
                            const cId = getCourseIdentifier(c);
                            return cId && (
                              cId === selectedCourseId || 
                              String(c.id) === String(selectedCourseId) || 
                              (c.course_id && String(c.course_id) === String(selectedCourseId)) ||
                              c.course_code === selectedCourseId
                            );
                          });
                          if (matchedCourse) {
                            return `${matchedCourse.course_code} - ${matchedCourse.course_name}`;
                          }
                          return selectedCourseId;
                        })()}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${isCourseOpen ? 'rotate-180 text-brand-blue dark:text-sky-400' : ''}`} />
                    </button>

                    {isCourseOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xl rounded-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        {courses.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center font-medium">No courses available</div>
                        ) : (
                          courses.map((c) => {
                            const cId = getCourseIdentifier(c);
                            const isSelected = cId === selectedCourseId || String(c.id) === String(selectedCourseId) || c.course_code === selectedCourseId;
                            return (
                              <button
                                key={cId || c.course_code}
                                type="button"
                                onClick={() => {
                                  setSelectedCourseId(cId);
                                  setClassGroup('');
                                  setIsCourseOpen(false);
                                  triggerReRender();
                                }}
                                className={`group w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer my-0.5 ${
                                  isSelected 
                                    ? 'bg-brand-blue-light dark:bg-sky-500/20 text-brand-blue dark:text-sky-300 font-bold border border-brand-blue/20 dark:border-sky-500/30' 
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                                }`}
                              >
                                <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                                  <span className="font-semibold font-mono text-brand-blue dark:text-sky-400 group-hover:text-brand-blue dark:group-hover:text-sky-300 transition-colors">{c.course_code}</span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors truncate">{c.course_name}</span>
                                </div>
                                {isSelected && (
                                  <span className="flex items-center gap-1 text-[10px] bg-brand-blue dark:bg-sky-500 text-white dark:text-slate-900 px-2 py-0.5 rounded-md font-extrabold shadow-xs shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    Selected
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Upcoming Class Schedule Display Container */}
                {(() => {
                  const selectedCourse = selectedCourseId ? courses.find(c => {
                    const cId = getCourseIdentifier(c);
                    return cId && (
                      cId === selectedCourseId || 
                      String(c.id) === String(selectedCourseId) || 
                      (c.course_id && String(c.course_id) === String(selectedCourseId)) ||
                      c.course_code === selectedCourseId
                    );
                  }) : undefined;

                  const checkScheduleStatus = (course?: Course) => {
                    if (!course) {
                      return {
                        canStart: false,
                        displayText: 'No subject course selected',
                        subText: 'Select a course above to view scheduled class time.',
                        isWithinOneHour: false,
                      };
                    }

                    const { schedule_day, schedule_start, schedule_end, schedule_room } = course;
                    const roomStr = schedule_room ? `Room: ${schedule_room}` : 'Room TBA';

                    if (!schedule_start) {
                      return {
                        canStart: true,
                        displayText: `Flexible Schedule | ${roomStr}`,
                        subText: 'No fixed timetable assigned. Ready to launch.',
                        isWithinOneHour: true,
                      };
                    }

                    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const now = new Date();
                    const currentDayName = daysOfWeek[now.getDay()];

                    const parseTimeToMinutes = (timeStr: string): number | null => {
                      if (!timeStr) return null;
                      const clean = timeStr.trim().toUpperCase();
                      const isPM = clean.includes('PM');
                      const isAM = clean.includes('AM');
                      const numPart = clean.replace(/(AM|PM)/g, '').trim();
                      const parts = numPart.split(':');
                      let hours = parseInt(parts[0], 10);
                      const minutes = parts[1] ? parseInt(parts[1], 10) : 0;

                      if (isNaN(hours)) return null;
                      if (isPM && hours < 12) hours += 12;
                      if (isAM && hours === 12) hours = 0;

                      return hours * 60 + minutes;
                    };

                    const startMinutes = parseTimeToMinutes(schedule_start);
                    const endMinutes = schedule_end ? parseTimeToMinutes(schedule_end) : null;
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();

                    const formattedDay = schedule_day ? (schedule_day.charAt(0).toUpperCase() + schedule_day.slice(1).toLowerCase()) : 'Today';
                    const isSameDay = !schedule_day || formattedDay.toLowerCase() === currentDayName.toLowerCase();

                    if (isSameDay && startMinutes !== null) {
                      const diffMinutes = startMinutes - currentMinutes;

                      if (currentMinutes >= startMinutes && (endMinutes === null || currentMinutes <= endMinutes + 30)) {
                        return {
                          canStart: true,
                          displayText: `${formattedDay} ${schedule_start} - ${schedule_end || ''} | ${roomStr}`,
                          subText: 'Class window is currently active.',
                          isWithinOneHour: true,
                        };
                      }

                      if (diffMinutes > 0 && diffMinutes <= 60) {
                        return {
                          canStart: true,
                          displayText: `${formattedDay} ${schedule_start} - ${schedule_end || ''} | ${roomStr}`,
                          subText: `Upcoming: Starts in ${diffMinutes} minutes`,
                          isWithinOneHour: true,
                        };
                      }

                      if (diffMinutes > 60) {
                        const hoursLeft = (diffMinutes / 60).toFixed(1);
                        return {
                          canStart: false,
                          displayText: `${formattedDay} ${schedule_start} - ${schedule_end || ''} | ${roomStr}`,
                          subText: `Scheduled today in ${hoursLeft} hours. Unlocks 1 hour before class.`,
                          isWithinOneHour: false,
                        };
                      }
                    }

                    return {
                      canStart: false,
                      displayText: `${formattedDay} ${schedule_start}${schedule_end ? ` - ${schedule_end}` : ''} | ${roomStr}`,
                      subText: `Class is scheduled for ${formattedDay}. Opening unlocks 1h before start.`,
                      isWithinOneHour: false,
                    };
                  };

                  const scheduleStatus = checkScheduleStatus(selectedCourse);

                  return (
                    <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-2 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-brand-blue dark:text-sky-400" />
                          Upcoming Class Schedule
                        </span>
                        {selectedCourse && (
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md flex items-center gap-1 ${
                            scheduleStatus.canStart
                              ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-500/20'
                          }`}>
                            {scheduleStatus.canStart ? '🟢 Ready to Launch' : '🔒 Locked'}
                          </span>
                        )}
                      </div>

                      {!selectedCourse ? (
                        <div className="py-2 text-[11px] text-slate-400 dark:text-slate-500 text-center font-medium italic">
                          No subject course selected. Select a course above to view scheduled class time.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{scheduleStatus.displayText}</span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {scheduleStatus.subText}
                          </div>

                          {!scheduleStatus.canStart && (
                            <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 truncate w-full">
                                <Clock className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                {(() => {
                                  const { schedule_day, schedule_start } = selectedCourse;
                                  if (!schedule_start) return 'Flexible schedule';

                                  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                  const now = new Date();
                                  const currentDayIndex = now.getDay();
                                  const currentDayName = daysOfWeek[currentDayIndex];

                                  const parseTimeToMinutes = (timeStr: string): number | null => {
                                    if (!timeStr) return null;
                                    const clean = timeStr.trim().toUpperCase();
                                    const isPM = clean.includes('PM');
                                    const isAM = clean.includes('AM');
                                    const numPart = clean.replace(/(AM|PM)/g, '').trim();
                                    const parts = numPart.split(':');
                                    let hours = parseInt(parts[0], 10);
                                    const minutes = parts[1] ? parseInt(parts[1], 10) : 0;

                                    if (isNaN(hours)) return null;
                                    if (isPM && hours < 12) hours += 12;
                                    if (isAM && hours === 12) hours = 0;

                                    return hours * 60 + minutes;
                                  };

                                  const startMinutes = parseTimeToMinutes(schedule_start);
                                  const currentMinutes = now.getHours() * 60 + now.getMinutes();

                                  const formattedDay = schedule_day ? (schedule_day.charAt(0).toUpperCase() + schedule_day.slice(1).toLowerCase()) : 'Today';
                                  const isSameDay = !schedule_day || formattedDay.toLowerCase() === currentDayName.toLowerCase();

                                  if (isSameDay && startMinutes !== null) {
                                    const diffMinutes = startMinutes - currentMinutes;
                                    if (diffMinutes > 0) {
                                      const hours = Math.floor(diffMinutes / 60);
                                      const mins = diffMinutes % 60;
                                      if (hours > 0) {
                                        return `Time Remaining: Starts in ${hours}h ${mins}m`;
                                      }
                                      return `Time Remaining: Starts in ${mins} mins`;
                                    }
                                  }

                                  const targetDayIndex = daysOfWeek.findIndex(d => d.toLowerCase() === formattedDay.toLowerCase());
                                  if (targetDayIndex !== -1) {
                                    let daysDiff = targetDayIndex - currentDayIndex;
                                    if (daysDiff <= 0) daysDiff += 7;
                                    return `Time Remaining: Starts in ${daysDiff} day${daysDiff > 1 ? 's' : ''} (${formattedDay} ${schedule_start})`;
                                  }

                                  return `Time Remaining: Scheduled for ${formattedDay} at ${schedule_start}`;
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Class Allocation Group */}
                <div className="space-y-1.5 relative" ref={groupDropdownRef}>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Class Allocation Group</label>
                  <div className="relative">
                    <button
                      key={`group-btn-${renderKey}-${classGroup}`}
                      type="button"
                      disabled={!selectedCourseId}
                      onClick={() => {
                        if (!selectedCourseId) return;
                        setIsGroupOpen(prev => !prev);
                        setIsCourseOpen(false);
                      }}
                      className={`w-full py-2.5 px-4 text-left flex items-center justify-between bg-slate-50 dark:bg-slate-800/90 border rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-700/80 transition-all cursor-pointer ${
                        !selectedCourseId ? 'opacity-60 cursor-not-allowed' : ''
                      } ${
                        isGroupOpen ? 'border-brand-blue dark:border-sky-400 ring-2 ring-brand-blue/20 dark:ring-sky-400/20' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="truncate">
                        {!selectedCourseId
                          ? '-- Select Subject Course First --'
                          : !classGroup
                            ? '-- Select Class Allocation Group --'
                            : classGroup === 'All'
                              ? 'Lecture (All Allocation Groups)'
                              : `Group ${classGroup.replace('G', '')}`}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${isGroupOpen ? 'rotate-180 text-brand-blue dark:text-sky-400' : ''}`} />
                    </button>

                    {isGroupOpen && selectedCourseId && (
                      <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xl rounded-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        {['All', ...getAvailableGroupsForCourse(selectedCourseId)].map((g) => {
                          const isSelected = classGroup === g;
                          const labelText = g === 'All' ? 'Lecture (All Allocation Groups)' : `Group ${g.replace('G', '')}`;
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                setClassGroup(g);
                                setIsGroupOpen(false);
                                triggerReRender();
                              }}
                              className={`group w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer my-0.5 ${
                                isSelected 
                                  ? 'bg-brand-blue-light dark:bg-sky-500/20 text-brand-blue dark:text-sky-300 font-bold border border-brand-blue/20 dark:border-sky-500/30' 
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                              }`}
                            >
                              <span className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-blue dark:group-hover:text-sky-300 transition-colors">
                                {labelText}
                              </span>
                              {isSelected && (
                                <span className="flex items-center gap-1 text-[10px] bg-brand-blue dark:bg-sky-500 text-white dark:text-slate-900 px-2 py-0.5 rounded-md font-extrabold shadow-xs shrink-0">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  Selected
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit button with 1-hour window lock enforce */}
                {(() => {
                  const selectedCourse = selectedCourseId ? courses.find(c => {
                    const cId = getCourseIdentifier(c);
                    return cId && (
                      cId === selectedCourseId || 
                      String(c.id) === String(selectedCourseId) || 
                      (c.course_id && String(c.course_id) === String(selectedCourseId)) ||
                      c.course_code === selectedCourseId
                    );
                  }) : undefined;

                  let canStart = false;
                  if (!selectedCourse) {
                    canStart = false;
                  } else if (!selectedCourse.schedule_start) {
                    canStart = true;
                  } else {
                    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const now = new Date();
                    const currentDayName = daysOfWeek[now.getDay()];

                    const parseTimeToMinutes = (timeStr: string): number | null => {
                      if (!timeStr) return null;
                      const clean = timeStr.trim().toUpperCase();
                      const isPM = clean.includes('PM');
                      const isAM = clean.includes('AM');
                      const numPart = clean.replace(/(AM|PM)/g, '').trim();
                      const parts = numPart.split(':');
                      let hours = parseInt(parts[0], 10);
                      const minutes = parts[1] ? parseInt(parts[1], 10) : 0;

                      if (isNaN(hours)) return null;
                      if (isPM && hours < 12) hours += 12;
                      if (isAM && hours === 12) hours = 0;

                      return hours * 60 + minutes;
                    };

                    const startMinutes = parseTimeToMinutes(selectedCourse.schedule_start);
                    const endMinutes = selectedCourse.schedule_end ? parseTimeToMinutes(selectedCourse.schedule_end) : null;
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();

                    const formattedDay = selectedCourse.schedule_day ? (selectedCourse.schedule_day.charAt(0).toUpperCase() + selectedCourse.schedule_day.slice(1).toLowerCase()) : 'Today';
                    const isSameDay = !selectedCourse.schedule_day || formattedDay.toLowerCase() === currentDayName.toLowerCase();

                    if (isSameDay && startMinutes !== null) {
                      const diffMinutes = startMinutes - currentMinutes;
                      if (currentMinutes >= startMinutes && (endMinutes === null || currentMinutes <= endMinutes + 30)) {
                        canStart = true;
                      } else if (diffMinutes > 0 && diffMinutes <= 60) {
                        canStart = true;
                      }
                    }
                  }

                  const isLocked = !!selectedCourseId && !!classGroup && !canStart;
                  const isButtonDisabled = creating || !canStart || !selectedCourseId || !classGroup;

                  return (
                    <div className="relative group w-full mt-2">
                      <button
                        type="submit"
                        disabled={isButtonDisabled}
                        title={isLocked ? 'Opens 1h before class' : undefined}
                        className={`w-full uipro-button uipro-button-primary cursor-pointer transition-all ${
                          isButtonDisabled ? 'opacity-60 cursor-not-allowed bg-slate-400 hover:bg-slate-400' : ''
                        }`}
                      >
                        {creating
                          ? 'Launching...'
                          : !selectedCourseId
                            ? 'Select Subject Course'
                            : !classGroup
                              ? 'Select Class Allocation Group'
                              : !canStart
                                ? 'Locked'
                                : 'Start Active Session'}
                      </button>

                      {/* Floating tooltip on hover when locked */}
                      {isLocked && (
                        <div className="absolute left-1/2 -top-10 -translate-x-1/2 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 text-[11px] font-bold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                          <span>Opens 1h before class</span>
                          <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95 dark:border-t-slate-100/95" />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </form>
            </div>
          </div>
        </div>

        {/* Right Side: Performance circle, active list, announcements (Span 1) */}
        <div className="space-y-6">
          
          {/* Performance Circle Gauge */}
          <div className="uipro-card bg-white p-5 flex flex-col items-center text-center">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-start pb-2 border-b border-slate-100 w-full text-left">
              Overall Class Performance
            </h4>
            <div className="flex flex-col items-center justify-center p-2 mt-4">
              <div className="relative w-36 h-20">
                {/* semicircle: chord 120 => radius 60, arc length = PI * 60 */}
                <svg className="w-full h-full" viewBox="0 0 140 80">
                  <path
                    d="M 10 72 A 60 60 0 0 1 130 72"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth={8}
                    strokeLinecap="round"
                  />
                  <path
                    d="M 10 72 A 60 60 0 0 1 130 72"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth={8}
                    strokeDasharray={188.5}
                    strokeDashoffset={188.5 * (1 - displayRate / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                  <span className="text-xl font-display font-extrabold text-slate-800">
                    {(displayRate / 10).toFixed(1)}
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">of 10 max LTS</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-500 mt-3">1st Semester - 2nd Semester</span>
            </div>
          </div>

          {/* Currently Active Sessions List */}
          <div className="uipro-card bg-white/75 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-brand-blue" />
                Active Classes List
              </h4>
              <button
                onClick={() => fetchActiveSessions()}
                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded transition-all cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
              {activeSessions.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  No active sessions
                </div>
              ) : (
                activeSessions.map(session => (
                  <div
                    key={session.id}
                    className={`p-3 rounded-xl border transition-all flex justify-between items-center ${
                      monitoredSessionId === session.id
                        ? 'bg-brand-blue-light/25 border-brand-blue/20'
                        : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8.5px] font-bold text-brand-blue font-mono tracking-wider bg-brand-blue-light px-1.5 py-0.2 rounded-md">
                          {session.course_code}
                        </span>
                        <span className="text-[8.5px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md">
                          {session.class_group}
                        </span>
                      </div>
                      <h5 className="text-[11px] font-extrabold text-slate-800 truncate mt-1">{session.course_name}</h5>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => handleStartMonitor(session.id)}
                        className={`py-1 px-2.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                          monitoredSessionId === session.id
                            ? 'bg-brand-blue text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
                        }`}
                      >
                        {monitoredSessionId === session.id ? 'Live' : 'View'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Announcements Card */}
          <div className="uipro-card bg-white p-5 min-w-0 overflow-hidden">
            <div className="pb-3 border-b border-slate-200 mb-3">
              <h4 className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-brand-blue" />
                Administrative Notices
              </h4>
            </div>

            <div className="space-y-3">
              {announcements.map((notice) => (
                <div key={notice.id} className="min-w-0 overflow-hidden p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <span className="text-[9px] font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider truncate">
                      {notice.type}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 shrink-0">{notice.date}</span>
                  </div>
                  <h5 className="text-xs font-extrabold text-slate-900 leading-snug break-words">{notice.title}</h5>
                  <p className="text-[10.5px] font-medium text-slate-600 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {notice.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
