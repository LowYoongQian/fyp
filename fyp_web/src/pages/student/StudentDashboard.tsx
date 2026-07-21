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
  AlertCircle
} from 'lucide-react';

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
        setLoading(false); // Render instantly, avoiding skeleton animation
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
  const getAttendanceRateForCourse = (courseId: number) => {
    const enrolment = enrolments.find(e => e.course_id === courseId);
    return enrolment && typeof enrolment.attendance_rate === 'number'
      ? enrolment.attendance_rate
      : 100; // default to 100 if no sessions completed yet
  };

  const overallAttendance = enrolments.length > 0
    ? Math.round(enrolments.reduce((acc, curr) => acc + getAttendanceRateForCourse(curr.course_id), 0) / enrolments.length)
    : 95;

  const totalCreditHours = enrolments.reduce((acc, curr) => {
    return acc + (typeof curr.credit_hours === 'number' ? curr.credit_hours : 3.0);
  }, 0);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-200/60 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-slate-200/60 rounded-2xl" />
          <div className="h-28 bg-slate-200/60 rounded-2xl" />
          <div className="h-28 bg-slate-200/60 rounded-2xl" />
        </div>
        <div className="h-64 bg-slate-200/60 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Session Warning / Gate Notification */}
      {activeSessions.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-4 text-xs text-red-800 shadow-sm animate-bounce">
          <AlertCircle className="h-5 w-5 text-red-650 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider block">Active Check-In Window Open!</span>
            <span>
              You have {activeSessions.length} active class gate(s) open for check-in. Please launch the <strong>Flutter Mobile App</strong> on your phone to complete your face and WiFi check-in.
            </span>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="uipro-card bg-gradient-to-br from-brand-blue/90 to-brand-blue-dark/95 text-white relative overflow-hidden p-6 rounded-2xl shadow-premium">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-16 -mb-16 blur-2xl" />

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/15">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-100">Student Portal</span>
          </div>
          <h2 className="text-2xl font-display font-bold leading-tight">
            Welcome back, {student?.name || 'Student'}!
          </h2>
          <div className="text-xs text-slate-200 max-w-xl font-medium space-y-1">
            <p>ID: {student?.student_code} · {user?.email}</p>
            <p className="flex items-center gap-1.5 pt-1 text-[11px] text-white/90">
              <GraduationCap className="h-4.5 w-4.5 text-slate-200" />
              {getProgrammeName()}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="uipro-card bg-white/85 border border-slate-200/50 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Enrolled Courses</span>
            <span className="text-2xl font-display font-extrabold text-slate-800">{enrolments.length}</span>
            <span className="text-[10px] text-slate-450 block font-medium">({totalCreditHours} Credit Hours total)</span>
          </div>
          <div className="p-3 bg-brand-blue-light text-brand-blue rounded-xl">
            <BookOpen className="h-5 w-5" />
          </div>
        </div>

        <div className="uipro-card bg-white/85 border border-slate-200/50 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Overall Attendance Rate</span>
            <span className="text-2xl font-display font-extrabold text-slate-800">{overallAttendance}%</span>
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-600 font-semibold">Good Academic Standing</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="uipro-card bg-white/85 border border-slate-200/50 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Facial Verification Status</span>
            <span className="text-sm font-extrabold text-slate-800 block pt-1">
              {student?.is_face_registered ? 'Verified' : 'Not Registered'}
            </span>
            <span className="text-[10px] text-slate-450 block font-medium">
              {student?.is_face_registered ? 'Biometric check-in enabled' : 'Please register face via mobile app'}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${student?.is_face_registered ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-650'}`}>
            <Smartphone className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrolled Modules List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
            Enrolled Course Modules :
          </h3>
          
          {enrolments.length === 0 ? (
            <div className="uipro-card bg-white/85 p-8 text-center text-slate-400 border border-slate-200/50 rounded-2xl">
              No registered course modules found.
            </div>
          ) : (
            <div className="space-y-3">
              {enrolments.map(e => {
                const rate = getAttendanceRateForCourse(e.course_id);
                
                return (
                  <div key={e.id} className="uipro-card bg-white/85 hover:bg-white border border-slate-200/50 hover:border-slate-300 p-4.5 rounded-xl transition-all flex justify-between items-center shadow-xs">
                    <div className="space-y-1 max-w-[70%]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black text-brand-blue tracking-wider px-1.5 py-0.5 bg-brand-blue-light rounded-md">
                          {e.course_code}
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Group: {e.class_group.replaceAll('G', 'Group ')}
                        </span>
                      </div>
                      <h4 className="text-xs font-extrabold text-slate-800 line-clamp-1">
                        {e.course_name}
                      </h4>
                      <p className="text-[10px] text-slate-450 font-medium">
                        Credit Hours: {e.credit_hours} · Room: {e.schedule_room || 'TBA'}
                      </p>
                    </div>

                    {/* Attendance percentage indicator */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Attendance</span>
                        <span className={`text-xs font-extrabold ${rate < 80 ? 'text-red-500' : rate < 90 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {rate}%
                        </span>
                      </div>
                      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
            Check-In Guidelines :
          </h3>
          <div className="uipro-card bg-white/85 border border-slate-200/50 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-xl space-y-3 text-[11px] text-slate-650">
              <p className="font-bold text-brand-blue uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="h-4 w-4" />
                Mobile Check-in Steps:
              </p>
              <ul className="list-disc pl-4 space-y-2 leading-relaxed font-medium">
                <li>Launch the <strong className="text-slate-800">Flutter Mobile App</strong>.</li>
                <li>Verify your <strong className="text-slate-800">Selfie facial signature</strong> (ensure good lighting).</li>
                <li>Connect to the <strong className="text-slate-800">TARUMT Campus WiFi</strong> network.</li>
                <li>Complete the <strong className="text-slate-800">Liveness challenge prompt</strong> before the window closes.</li>
              </ul>
            </div>

            <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl flex gap-2.5 text-[10px] text-sky-700">
              <Wifi className="h-4.5 w-4.5 text-sky-500 shrink-0 mt-0.5" />
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
