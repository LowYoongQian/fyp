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
  Phone
} from 'lucide-react';

export const LecturerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolments, setEnrolments] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  
  // Create Session Form
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [classGroup, setClassGroup] = useState<string>('G1');
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);

  // Live Monitoring Session
  const [monitoredSessionId, setMonitoredSessionId] = useState<number | null>(null);
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

  const getAvailableGroupsForCourse = (courseId: string): string[] => {
    if (!courseId) return ['G1'];
    const inUse = Array.from(new Set(
      enrolments
        .filter(e => e.course_id.toString() === courseId)
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
      if (coursesList.length > 0) {
        setSelectedCourseId(coursesList[0].id.toString());
      }
      await fetchActiveSessions(coursesList);
    } catch (err) {
      console.error("Failed to load initial lecturer dashboard data:", err);
    }
  };  const fetchActiveSessions = async (coursesList?: Course[]) => {
    try {
      const data = await apiService.getActiveSessions();
      const listToUse = coursesList || courses;
      const detailed = data.map(s => {
        const c = listToUse.find(course => course.id === s.course_id);
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
      if (!selectedCourseId) throw new Error('Please select a course');
      const response = await apiService.openSession(Number(selectedCourseId), classGroup);
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

  const startPolling = (sessionId: number) => {
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

  const handleStartMonitor = async (sessionId: number) => {
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

  const handleManualMark = (studentId: number, currentStatus: string) => {
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
        type: a.priority
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
          <div className={`uipro-card bg-white/75 relative flex flex-col justify-between ${isCourseDropdownOpen ? 'z-50' : 'z-10'}`}>
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

              <form onSubmit={handleCreateSession} className="space-y-4 font-sans">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Subject Course</label>
                  
                  {isCourseDropdownOpen && (
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsCourseDropdownOpen(false)} 
                    />
                  )}
                  
                  <div className={`relative ${isCourseDropdownOpen ? 'z-50' : 'z-45'}`}>
                    <button
                      type="button"
                      onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
                      className="w-full uipro-input py-2.5 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50 transition-all cursor-pointer"
                    >
                      <span className="truncate">
                        {courses.find(c => c.id.toString() === selectedCourseId)
                          ? `${courses.find(c => c.id.toString() === selectedCourseId)?.course_code} - ${courses.find(c => c.id.toString() === selectedCourseId)?.course_name}`
                          : '-- Select Subject Course --'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                    </button>
                    
                    {isCourseDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg z-50 animate-in fade-in duration-100">
                        {courses.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCourseId(c.id.toString());
                              setIsCourseDropdownOpen(false);
                            }}
                            className={`group w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-brand-blue hover:text-white transition-all flex flex-col gap-0.5 border-b border-slate-100 last:border-b-0 cursor-pointer ${
                              selectedCourseId === c.id.toString() ? 'bg-slate-50 font-bold' : ''
                            }`}
                          >
                            <span className="font-semibold font-mono text-brand-blue group-hover:text-white/90 transition-colors">{c.course_code}</span>
                            <span className="text-[10px] text-slate-500 group-hover:text-white/80 transition-colors truncate">{c.course_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Class Allocation Group</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['All', ...getAvailableGroupsForCourse(selectedCourseId)].map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setClassGroup(g)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          classGroup === g
                            ? 'bg-brand-blue-light border-brand-blue/20 text-brand-blue'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                        }`}
                      >
                        {g === 'All' ? 'Lecture' : `Group ${g.replace('G', '')}`}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full uipro-button uipro-button-primary mt-2 cursor-pointer"
                >
                  {creating ? 'Launching...' : 'Start Active Session'}
                </button>
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
              <div className="relative w-36 h-20 overflow-hidden">
                <svg className="w-full h-full transform translate-y-2">
                  <path
                    d="M 10 70 A 35 35 0 0 1 130 70"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth={8}
                    strokeLinecap="round"
                  />
                  <path
                    d="M 10 70 A 35 35 0 0 1 130 70"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth={8}
                    strokeDasharray={109.95}
                    strokeDashoffset={109.95 - (displayRate / 100) * 109.95}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
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
          <div className="uipro-card bg-white/75 p-5">
            <div className="pb-3 border-b border-slate-100 mb-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-brand-blue" />
                Administrative Notices
              </h4>
            </div>

            <div className="space-y-3">
              {announcements.map((notice) => (
                <div key={notice.id} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] font-extrabold text-brand-blue bg-brand-blue-light/50 px-2 py-0.2 rounded-full uppercase tracking-wider scale-95 origin-left">
                      {notice.type}
                    </span>
                    <span className="text-[8px] font-semibold text-slate-400">{notice.date}</span>
                  </div>
                  <h5 className="text-[11px] font-extrabold text-slate-800 leading-tight">{notice.title}</h5>
                  <p className="text-[9.5px] text-slate-450 leading-relaxed">{notice.body}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
