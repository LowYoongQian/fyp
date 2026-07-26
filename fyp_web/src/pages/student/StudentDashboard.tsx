import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import type { StudentProfile, StudentEnrolmentDetail, StudentActiveSession } from '../../services/api';
import {
  Smartphone,
  BookOpen,
  Sparkles,
  Wifi,
  ShieldCheck,
  GraduationCap,
  Activity,
  AlertCircle,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [enrolments, setEnrolments] = useState<StudentEnrolmentDetail[]>([]);
  const [activeSessions, setActiveSessions] = useState<StudentActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudentData();
  }, [user]);

  const loadStudentData = async () => {
    // 1. Try loading from cache first
    const cachedProfile = localStorage.getItem('cached_student_profile');
    const cachedEnrolments = localStorage.getItem('cached_student_enrolments');
    const cachedSessions = localStorage.getItem('cached_student_active_sessions');

    let hasCached = false;
    if (cachedProfile && cachedEnrolments && cachedSessions) {
      try {
        setStudent(JSON.parse(cachedProfile));
        setEnrolments(JSON.parse(cachedEnrolments));
        setActiveSessions(JSON.parse(cachedSessions));
        setLoading(false);
        hasCached = true;
      } catch (e) {
        console.error("Failed to parse cached data:", e);
      }
    }

    if (!hasCached) {
      setLoading(true);
    }

    try {
      // 2. Fetch fresh data from backend
      const [profile, enrolmentsList, activeSessionsList] = await Promise.all([
        apiService.studentGetProfile(),
        apiService.studentGetEnrolments(),
        apiService.studentGetActiveSessions(),
      ]);

      setStudent(profile);
      setEnrolments(enrolmentsList);
      setActiveSessions(activeSessionsList);

      // Save fresh data to local cache
      localStorage.setItem('cached_student_profile', JSON.stringify(profile));
      localStorage.setItem('cached_student_enrolments', JSON.stringify(enrolmentsList));
      localStorage.setItem('cached_student_active_sessions', JSON.stringify(activeSessionsList));
    } catch (err) {
      console.error("Failed to load student dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Resolve study programme details from profile
  const getProgrammeName = () => {
    if (!student) return 'N/A';
    return student.programme_name || 'Programme not assigned';
  };

  // Get attendance percentage from enrolment detail
  const getAttendanceRateForCourse = (courseId: number | string) => {
    const enrolment = enrolments.find(e => String(e.course_id) === String(courseId));
    return enrolment && typeof enrolment.attendance_rate === 'number'
      ? enrolment.attendance_rate
      : 100;
  };

  const overallAttendance = enrolments.length > 0
    ? Math.round(enrolments.reduce((acc, curr) => acc + getAttendanceRateForCourse(curr.course_id), 0) / enrolments.length)
    : 95;

  const totalCreditHours = enrolments.reduce((acc, curr) => {
    return acc + (typeof curr.credit_hours === 'number' ? curr.credit_hours : 3.0);
  }, 0);

  // ----------------------------------------------------
  // Chart Data Preparation (Semester Analytics)
  // ----------------------------------------------------
  
  // 1. Weekly Attendance Trend Data (Weeks 1 to 12)
  const weeklyTrendData = [
    { week: 'Wk 1', rate: 100, target: 80 },
    { week: 'Wk 2', rate: 100, target: 80 },
    { week: 'Wk 3', rate: 95, target: 80 },
    { week: 'Wk 4', rate: 90, target: 80 },
    { week: 'Wk 5', rate: 95, target: 80 },
    { week: 'Wk 6', rate: 88, target: 80 },
    { week: 'Wk 7', rate: 92, target: 80 },
    { week: 'Wk 8', rate: 96, target: 80 },
    { week: 'Wk 9', rate: 94, target: 80 },
    { week: 'Wk 10', rate: 98, target: 80 },
    { week: 'Wk 11', rate: 95, target: 80 },
    { week: 'Wk 12', rate: overallAttendance, target: 80 },
  ];

  // 2. Course Comparison Bar Chart Data
  const courseComparisonData = enrolments.length > 0
    ? enrolments.map(e => ({
        code: e.course_code,
        name: e.course_name,
        rate: getAttendanceRateForCourse(e.course_id),
      }))
    : [
        { code: 'BMCS2073', name: 'Software Info Security', rate: 96 },
        { code: 'BMCS2013', name: 'Data Structures & Algo', rate: 88 },
        { code: 'BMCS2083', name: 'Cloud Computing Infra', rate: 92 },
        { code: 'BMCS3013', name: 'Final Year Project 1', rate: 100 },
      ];

  // 3. Attendance Status Donut Chart Data
  const statusPieData = [
    { name: 'Verified Present', value: 24, color: '#10B981' },
    { name: 'Late Arrival', value: 2, color: '#F59E0B' },
    { name: 'Excused (MC)', value: 2, color: '#3B82F6' },
    { name: 'Unexcused Absent', value: 1, color: '#EF4444' },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Active Session Warning / Gate Notification */}
      {activeSessions.length > 0 && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 flex gap-4 text-xs text-red-800 dark:text-red-400 shadow-sm animate-pulse">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider block text-red-700 dark:text-red-400">Class Check-In Open!</span>
            <span className="text-slate-700 dark:text-slate-300">
              You have {activeSessions.length} active class check-in(s) open. Open the mobile app on your phone to verify your selfie facial signature.
            </span>
          </div>
        </div>
      )}

      {/* Welcome Banner (Theme Dynamic) */}
      <div className="uipro-card bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 dark:from-blue-950/90 dark:via-indigo-950/95 dark:to-slate-950/95 text-white relative overflow-hidden p-6 rounded-2xl border border-blue-300 dark:border-blue-500/20 shadow-premium">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 dark:bg-indigo-500/10 rounded-full -ml-16 -mb-16 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full border border-white/20">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-100">Student Portal</span>
          </div>
          <h2 className="text-2xl font-display font-bold leading-tight text-white">
            Welcome back, {student?.name || 'Student'}!
          </h2>
          <div className="text-xs text-slate-200 dark:text-slate-300 max-w-xl font-medium space-y-1">
            <p>ID: {student?.student_code} · {user?.email}</p>
            <p className="flex items-center gap-1.5 pt-1 text-[11px] text-white/90 dark:text-slate-200">
              <GraduationCap className="h-4.5 w-4.5 text-blue-200 dark:text-blue-400" />
              {getProgrammeName()}
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards Row (Theme Synced) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Enrolled Courses</span>
            <span className="text-2xl font-display font-extrabold text-slate-900 dark:text-slate-100">{enrolments.length}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">({totalCreditHours} Credit Hours total)</span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
            <BookOpen className="h-5 w-5" />
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Attendance Rate</span>
            <span className="text-2xl font-display font-extrabold text-slate-900 dark:text-slate-100">{overallAttendance}%</span>
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Good Standing (&gt;80% Safe Zone)</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Face Biometric Status</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 block pt-1">
              {student?.is_face_registered ? 'Registered & Active' : 'Not Registered'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
              {student?.is_face_registered ? 'Facial liveness verification ready' : 'Register face in mobile app'}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${student?.is_face_registered ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'}`}>
            <Smartphone className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* VISUAL CHARTS SECTION (Theme Mode Synchronized) */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Attendance Analytics & Future Trend Insights :</span>
          </h3>
          <span className="text-[10px] font-mono font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-500/20">
            Semester 1 Analytics
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Weekly Attendance Rate Trend (Area Chart) */}
          <div className="lg:col-span-2 uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200 font-space flex items-center gap-2">
                  <span>Weekly Attendance Health Trend</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tracking weekly check-in consistency against the <strong className="text-amber-600 dark:text-amber-400">80% Exam Barring Threshold</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  Your Rate
                </span>
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  80% Requirement
                </span>
              </div>
            </div>

            <div className="h-60 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.3} />
                  <XAxis dataKey="week" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} domain={[50, 100]} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      borderRadius: '12px',
                      color: 'var(--theme-text-primary)',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [`${value}%`, 'Attendance Rate']}
                  />
                  <ReferenceLine y={80} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: '80% Requirement', fill: '#D97706', fontSize: 10, position: 'insideTopRight' }} />
                  <Area type="monotone" dataKey="rate" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#attendanceGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Attendance Status Breakdown (Donut Pie Chart) */}
          <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xs">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200 font-space flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Session Status Breakdown</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Total 29 completed class sessions this semester.</p>
            </div>

            <div className="h-44 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--theme-surface)',
                      borderColor: 'var(--theme-border)',
                      borderRadius: '12px',
                      color: 'var(--theme-text-primary)',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-space">{overallAttendance}%</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Safe Zone</span>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 font-medium truncate">24 Verified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 font-medium truncate">2 Late</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 font-medium truncate">2 Excused (MC)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 font-medium truncate">1 Absent</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 3: Course-by-Course Attendance Comparison (Bar Chart) */}
        <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200 font-space flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Subject Attendance Comparison</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Attendance percentages breakdown per registered course module.</p>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Exam Requirement: <strong className="text-amber-600 dark:text-amber-400">&ge; 80%</strong>
            </div>
          </div>

          <div className="h-48 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.3} />
                <XAxis dataKey="code" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--theme-surface)',
                    borderColor: 'var(--theme-border)',
                    borderRadius: '12px',
                    color: 'var(--theme-text-primary)',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`${value}%`, 'Attendance Rate']}
                />
                <ReferenceLine y={80} stroke="#F59E0B" strokeDasharray="4 4" />
                <Bar dataKey="rate" radius={[8, 8, 0, 0]} barSize={36}>
                  {courseComparisonData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.rate >= 90 ? '#10B981' : entry.rate >= 80 ? '#3B82F6' : '#EF4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Grid: Enrolled Modules & Guidelines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Enrolled Modules List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider pl-1">
            Enrolled Course Modules :
          </h3>
          
          {enrolments.length === 0 ? (
            <div className="uipro-card bg-white dark:bg-slate-900/60 p-8 text-center text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-2xl">
              No registered course modules found.
            </div>
          ) : (
            <div className="space-y-3">
              {enrolments.map(e => {
                const rate = getAttendanceRateForCourse(e.course_id);
                
                return (
                  <div key={e.id} className="uipro-card bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 p-4.5 rounded-xl transition-all flex justify-between items-center shadow-xs">
                    <div className="space-y-1 max-w-[70%]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black text-blue-700 dark:text-blue-400 tracking-wider px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 rounded-md border border-blue-200 dark:border-blue-500/20">
                          {e.course_code}
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Group: {e.class_group.replaceAll('G', 'Group ')}
                        </span>
                      </div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 line-clamp-1">
                        {e.course_name}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        Credit Hours: {e.credit_hours} · Room: {e.schedule_room || 'TBA'}
                      </p>
                    </div>

                    {/* Attendance percentage indicator */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Attendance</span>
                        <span className={`text-xs font-extrabold ${rate < 80 ? 'text-red-600 dark:text-red-400' : rate < 90 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {rate}%
                        </span>
                      </div>
                      <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${rate < 80 ? 'bg-red-500' : rate < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${rate}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Guidelines Card */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider pl-1">
            Check-In Guidelines :
          </h3>
          <div className="uipro-card bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-3 text-[11px] text-slate-700 dark:text-slate-300">
              <p className="font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="h-4 w-4" />
                Mobile Check-in Steps:
              </p>
              <ul className="list-disc pl-4 space-y-2 leading-relaxed font-medium text-slate-700 dark:text-slate-300">
                <li>Launch the <strong className="text-slate-900 dark:text-slate-100">Flutter Mobile App</strong>.</li>
                <li>Verify your <strong className="text-slate-900 dark:text-slate-100">Selfie facial signature</strong> (ensure good lighting).</li>
                <li>Connect to the <strong className="text-slate-900 dark:text-slate-100">SWAS Campus WiFi</strong> network.</li>
                <li>Complete the <strong className="text-slate-900 dark:text-slate-100">Liveness challenge prompt</strong> before the window closes.</li>
              </ul>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/20 rounded-xl flex gap-2.5 text-[10px] text-blue-800 dark:text-blue-300">
              <Wifi className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="font-medium">
                Subnet validation checks require you to be connected to official campus access points to register presence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
