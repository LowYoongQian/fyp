import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './components/MainLayout';
import { Login } from './pages/security/Login';
import { LecturerDashboard } from './pages/staff/LecturerDashboard';
import { Analytics } from './pages/staff/Analytics';
import { AtRisk } from './pages/staff/AtRisk';
import { Chatbot } from './pages/staff/Chatbot';
import { StudentsManager } from './pages/admin/StudentsManager';
import { StaffManager } from './pages/admin/StaffManager';
import { AnnouncementManager } from './pages/admin/AnnouncementManager';
import { CampusNetworkManager } from './pages/admin/CampusNetworkManager';
import { Timetable } from './pages/staff/Timetable';
import { Attendance } from './pages/staff/Attendance';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AcademicManager } from './pages/admin/AcademicManager';
import { AttendanceManager } from './pages/admin/AttendanceManager';
import { StudentDashboard } from './pages/student/StudentDashboard';
import {
  ShimmerPage,
  ShimmerTimetable,
  ShimmerDashboard,
  ShimmerAttendance,
  ShimmerAnalytics,
  ShimmerAtRisk,
  ShimmerChatbot,
  ShimmerAdminPanel
} from './components/Shimmer';
import './App.css';
import { applyThemePreference } from './theme/themePreference';

const DashboardContent: React.FC = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    const applyThemeFromStorage = () => {
      applyThemePreference();
    };
    applyThemeFromStorage();
    window.addEventListener('storage', applyThemeFromStorage);
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    systemTheme.addEventListener('change', applyThemeFromStorage);
    return () => {
      window.removeEventListener('storage', applyThemeFromStorage);
      systemTheme.removeEventListener('change', applyThemeFromStorage);
    };
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setCurrentTab('admin_dashboard');
      } else if (user.role === 'student') {
        setCurrentTab('student_dashboard');
      } else {
        setCurrentTab('dashboard');
      }
    }
  }, [user]);

  const handleTabChange = (tab: string) => {
    setTabLoading(true);
    setCurrentTab(tab);
    setTimeout(() => {
      setTabLoading(false);
    }, 450);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex bg-slate-50 overflow-hidden relative">
        {/* Sidebar Skeleton */}
        <aside className="w-72 border-r border-slate-200/50 bg-white/95 p-6 space-y-6 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl shimmer-placeholder shrink-0" />
              <div className="space-y-2 flex-grow min-w-0">
                <div className="w-2/3 h-4 shimmer-placeholder rounded" />
                <div className="w-1/3 h-2.5 shimmer-placeholder rounded" />
              </div>
            </div>
            <div className="space-y-3 pt-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-full h-10 rounded-xl shimmer-placeholder" />
              ))}
            </div>
          </div>
          <div className="w-full h-16 rounded-xl shimmer-placeholder" />
        </aside>
        
        {/* Main Content Skeleton */}
        <div className="flex-grow flex flex-col min-w-0 overflow-y-auto">
          <header className="h-20 border-b border-slate-100 bg-white/50 px-8 flex items-center justify-between shrink-0">
            <div className="w-32 h-3.5 shimmer-placeholder rounded" />
            <div className="w-28 h-6 rounded-full shimmer-placeholder" />
          </header>
          <main className="p-8 max-w-7xl w-full mx-auto">
            <ShimmerDashboard />
          </main>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderActiveTab = () => {
    if (tabLoading) {
      switch (currentTab) {
        case 'dashboard':
          return <ShimmerDashboard />;
        case 'timetable':
          return <ShimmerTimetable />;
        case 'attendance':
          return <ShimmerAttendance />;
        case 'analytics':
          return <ShimmerAnalytics />;
        case 'risk':
          return <ShimmerAtRisk />;
        case 'chatbot':
          return <ShimmerChatbot />;
        case 'student_dashboard':
          return <ShimmerDashboard />;
        case 'student_timetable':
          return <ShimmerTimetable />;
        case 'admin_dashboard':
        case 'admin_academic':
        case 'admin_attendance':
        case 'admin_students':
        case 'admin_staff':
        case 'admin_announcements':
        case 'admin_network':
          return <ShimmerAdminPanel />;
        default:
          return <ShimmerPage />;
      }
    }

    switch (currentTab) {
      case 'dashboard':
        return <LecturerDashboard />;
      case 'timetable':
        return <Timetable />;
      case 'attendance':
        return <Attendance />;
      case 'analytics':
        return <Analytics />;
      case 'risk':
        return <AtRisk />;
      case 'chatbot':
        return <Chatbot />;
      case 'student_dashboard':
        return <StudentDashboard />;
      case 'student_timetable':
        return <Timetable />;
      case 'admin_dashboard':
        return <AdminDashboard />;
      case 'admin_academic':
        return <AcademicManager />;
      case 'admin_attendance':
        return <AttendanceManager />;
      case 'admin_students':
        return <StudentsManager />;
      case 'admin_staff':
        return <StaffManager />;
      case 'admin_announcements':
        return <AnnouncementManager />;
      case 'admin_network':
        return <CampusNetworkManager />;
      default:
        return user?.role === 'admin' ? <AdminDashboard /> : user?.role === 'student' ? <StudentDashboard /> : <LecturerDashboard />;
    }
  };

  return (
    <MainLayout currentTab={currentTab} setCurrentTab={handleTabChange}>
      {renderActiveTab()}
    </MainLayout>
  );
};

import { DialogProvider } from './context/DialogContext';

function App() {
  return (
    <AuthProvider>
      <DialogProvider>
        <DashboardContent />
      </DialogProvider>
    </AuthProvider>
  );
}

export default App;
