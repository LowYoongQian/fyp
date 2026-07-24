import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { AdminStudent, AdminStaff, Programme, Course, ActiveSession } from '../../services/api';
import {
  Users,
  Briefcase,
  Layers,
  BookOpen,
  Play,
  ShieldCheck,
  UserX,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sList, stList, pList, cList, aList] = await Promise.all([
        apiService.adminGetStudents(),
        apiService.adminGetStaff(),
        apiService.adminGetProgrammes(),
        apiService.adminGetCourses(),
        apiService.getActiveSessions()
      ]);
      setStudents(sList.items);
      setStaff(stList.items);
      setProgrammes(pList);
      setCourses(cList);
      setActiveSessions(aList);
    } catch (err) {
      console.error("Error loading admin dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute metrics
  const verifiedCount = students.filter(s => s.is_face_registered).length;
  const missingSelfieCount = students.length - verifiedCount;
  const livenessCompletionRate = students.length > 0 
    ? Math.round((verifiedCount / students.length) * 100) 
    : 0;

  const quickStats = [
    {
      title: 'Total Students',
      value: students.length,
      subtitle: 'Enrolled students',
      color: 'bg-blue-50 text-blue-600 border-blue-100/50',
      icon: Users
    },
    {
      title: 'Staff',
      value: staff.length,
      subtitle: 'Lecturers & staff',
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100/50',
      icon: Briefcase
    },
    {
      title: 'Programmes',
      value: programmes.length,
      subtitle: 'Active programmes',
      color: 'bg-purple-50 text-purple-600 border-purple-100/50',
      icon: Layers
    },
    {
      title: 'Courses',
      value: courses.length,
      subtitle: 'Active courses',
      color: 'bg-pink-50 text-pink-600 border-pink-100/50',
      icon: BookOpen
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="uipro-card bg-white/75 backdrop-blur-md relative overflow-hidden p-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-extrabold text-slate-800 flex items-center gap-2">
              <Sparkles className="h-5.5 w-5.5 text-brand-blue" />
              Dashboard
            </h2>
            <p className="text-xs text-slate-400">
              Overview of students, staff, courses, and attendance.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 py-2 px-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Sync Stats
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="uipro-card bg-white p-6 h-28 shimmer-placeholder" />
          ))}
        </div>
      ) : (
        <>
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.title} className="uipro-card bg-white p-6 flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.title}</span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${stat.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-display font-extrabold text-slate-800">{stat.value}</span>
                    <p className="text-[9.5px] text-slate-400 font-semibold mt-1">{stat.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main Grid: Biometric Completion & System Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Liveness Registration Gauge (Span 2) */}
            <div className="lg:col-span-2 uipro-card bg-white p-6 space-y-6">
              <div className="pb-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Face Registration
                </h3>
                <span className="text-[10px] font-bold text-brand-blue bg-brand-blue-light px-2.5 py-0.5 rounded-md uppercase">
                  Face Data
                </span>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8 justify-around py-4">
                {/* Radial Gauge */}
                <div className="flex flex-col items-center justify-center p-2">
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
                        stroke="#10B981"
                        strokeWidth={8}
                        strokeDasharray={109.95}
                        strokeDashoffset={109.95 - (livenessCompletionRate / 100) * 109.95}
                        strokeLinecap="round"
                        className="transition-all duration-500 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                      <span className="text-2xl font-display font-extrabold text-slate-800">
                        {livenessCompletionRate}%
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Registered</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-4">Face Registration Progress</span>
                </div>

                {/* Details list */}
                <div className="space-y-4 font-sans text-xs w-full max-w-xs">
                  <div className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      <div>
                        <span className="font-bold text-slate-800 block">Registered Students</span>
                        <span className="text-[9.5px] text-slate-400">Face registered</span>
                      </div>
                    </div>
                    <span className="text-base font-extrabold text-slate-700">{verifiedCount}</span>
                  </div>

                  <div className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <UserX className="h-5 w-5 text-amber-600" />
                      <div>
                        <span className="font-bold text-slate-800 block">Pending Registration</span>
                        <span className="text-[9.5px] text-slate-400">Face not registered</span>
                      </div>
                    </div>
                    <span className="text-base font-extrabold text-slate-700">{missingSelfieCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Class Checking Status */}
            <div className="uipro-card bg-white p-6 space-y-6">
              <div className="pb-4 border-b border-slate-100 flex items-center gap-2">
                <Play className="h-4.5 w-4.5 text-brand-blue" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Active Sessions
                </h3>
              </div>

              <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
                <div className="relative">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md ${
                    activeSessions.length > 0 
                      ? 'bg-success-green-light border border-success-green/20 text-success-green' 
                      : 'bg-slate-50 border border-slate-150 text-slate-400'
                  }`}>
                    <Play className={`h-8 w-8 ${activeSessions.length > 0 ? 'animate-pulse' : ''}`} />
                  </div>
                  {activeSessions.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-danger-red border-2 border-white rounded-full animate-ping" />
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-slate-800">
                    {activeSessions.length} Active Classes
                  </h4>
                  <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed">
                    {activeSessions.length > 0 
                      ? 'Lecturers are currently running attendance check-ins.' 
                      : 'No active class sessions right now.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
