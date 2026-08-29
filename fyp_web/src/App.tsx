import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './components/MainLayout';
import { Login } from './pages/security/Login';
import { LecturerDashboard } from './pages/staff/LecturerDashboard';
import { Analytics } from './pages/staff/Analytics';
import { AtRisk } from './pages/staff/AtRisk';
import { Chatbot } from './pages/staff/Chatbot';
import { CourseAnnouncements } from './pages/staff/CourseAnnouncements';
import { StudentsManager } from './pages/admin/StudentsManager';
import { StaffManager } from './pages/admin/StaffManager';
import { AnnouncementManager } from './pages/admin/AnnouncementManager';
import { CampusNetworkManager } from './pages/admin/CampusNetworkManager';
import { ReportsManager } from './pages/admin/ReportsManager';
import { AuditManager } from './pages/admin/AuditManager';
import { Timetable } from './pages/staff/Timetable';
import { Attendance } from './pages/staff/Attendance';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AcademicManager } from './pages/admin/AcademicManager';
import { AttendanceManager } from './pages/admin/AttendanceManager';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentMC } from './pages/student/StudentMC';
import { StudentContact } from './pages/student/StudentContact';
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
import { applyThemePreference, getAccountThemePreference, resetThemeOnLogout } from './theme/themePreference';
import { recordRecentStaffPage } from './utils/staffRecentPages';

const TAB_ROUTES: Record<string, string> = {
  dashboard: 'staff/dashboard',
  timetable: 'staff/timetable',
  attendance: 'staff/attendance',
  analytics: 'staff/analytics',
  risk: 'staff/at-risk',
  chatbot: 'staff/assistant',
  course_announcements: 'staff/course-notices',
  student_dashboard: 'student/dashboard',
  student_timetable: 'student/timetable',
  student_mc: 'student/medical-leave',
  student_contact: 'student/contact-admin',
  admin_dashboard: 'admin/dashboard',
  admin_students: 'admin/students',
  admin_staff: 'admin/staff',
  admin_academic: 'admin/academics',
  admin_timetable: 'admin/timetable',
  admin_attendance: 'admin/attendance',
  admin_network: 'admin/network-security',
  admin_announcements: 'admin/announcements',
  admin_reports: 'admin/reports/feedback',
  admin_reports_feedback: 'admin/reports/feedback',
  admin_reports_mc: 'admin/reports/medical-leave',
  admin_audit: 'admin/audit-logs',
};

const ROUTE_TABS = Object.fromEntries(
  Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab]),
) as Record<string, string>;

const ROLE_TABS: Record<'student' | 'lecturer' | 'admin', Set<string>> = {
  student: new Set(['student_dashboard', 'student_timetable', 'student_mc', 'student_contact']),
  lecturer: new Set(['dashboard', 'timetable', 'attendance', 'analytics', 'risk', 'course_announcements', 'chatbot']),
  admin: new Set(['admin_dashboard', 'admin_students', 'admin_staff', 'admin_academic', 'admin_timetable', 'admin_attendance', 'admin_network', 'admin_announcements', 'admin_reports', 'admin_reports_feedback', 'admin_reports_mc', 'admin_audit']),
};

const DEFAULT_TABS = { student: 'student_dashboard', lecturer: 'dashboard', admin: 'admin_dashboard' } as const;

function tabFromLocation(): string | null {
  const pathRoute = window.location.pathname.replace(/^\/+|\/+$/g, '');
  // Keep old bookmarked hash links working once, then writeTabLocation migrates them.
  const hashRoute = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  const route = pathRoute || hashRoute;
  return ROUTE_TABS[route] || null;
}

function writeTabLocation(tab: string, replace = false) {
  const route = TAB_ROUTES[tab];
  if (!route) return;
  const nextUrl = `/${route}${window.location.search}`;
  window.history[replace ? 'replaceState' : 'pushState']({ tab }, '', nextUrl);
}

const DashboardContent: React.FC = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const [currentTab, setCurrentTab] = useState(() => tabFromLocation() || 'dashboard');
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    const applyThemeFromStorage = () => {
      if (user?.user_id) {
        applyThemePreference(getAccountThemePreference(user.user_id));
      } else {
        resetThemeOnLogout();
      }
    };
    applyThemeFromStorage();
    window.addEventListener('storage', applyThemeFromStorage);
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    systemTheme.addEventListener('change', applyThemeFromStorage);
    return () => {
      window.removeEventListener('storage', applyThemeFromStorage);
      systemTheme.removeEventListener('change', applyThemeFromStorage);
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      const requestedTab = tabFromLocation();
      const nextTab = requestedTab && ROLE_TABS[user.role].has(requestedTab)
        ? requestedTab
        : DEFAULT_TABS[user.role];
      setCurrentTab(nextTab);
      writeTabLocation(nextTab, true);
    } else if (!loading && window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/');
    }
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    const restoreLocation = () => {
      const requestedTab = tabFromLocation();
      const nextTab = requestedTab && ROLE_TABS[user.role].has(requestedTab)
        ? requestedTab
        : DEFAULT_TABS[user.role];
      setTabLoading(false);
      setCurrentTab(nextTab);
      if (requestedTab !== nextTab) writeTabLocation(nextTab, true);
    };
    window.addEventListener('popstate', restoreLocation);
    return () => {
      window.removeEventListener('popstate', restoreLocation);
    };
  }, [user]);

  useEffect(() => {
    if (user?.role === 'lecturer') {
      recordRecentStaffPage(user.user_id, currentTab);
    }
  }, [currentTab, user]);

  const handleTabChange = (tab: string) => {
    if (!user || !ROLE_TABS[user.role].has(tab)) return;
    setTabLoading(true);
    setCurrentTab(tab);
    if (tabFromLocation() !== tab) writeTabLocation(tab);
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
        case 'student_dashboard':
          return <ShimmerDashboard />;
        case 'timetable':
        case 'student_timetable':
        case 'admin_timetable':
          return <ShimmerTimetable />;
        case 'attendance':
          return <ShimmerAttendance />;
        case 'analytics':
          return <ShimmerAnalytics />;
        case 'risk':
          return <ShimmerAtRisk />;
        case 'chatbot':
          return <ShimmerChatbot />;
        case 'course_announcements':
          return <ShimmerAdminPanel />;
        case 'student_mc':
        case 'student_contact':
          return <ShimmerPage />;
        case 'admin_dashboard':
        case 'admin_academic':
        case 'admin_attendance':
        case 'admin_students':
        case 'admin_staff':
        case 'admin_announcements':
        case 'admin_network':
        case 'admin_reports':
        case 'admin_reports_feedback':
        case 'admin_reports_mc':
        case 'admin_audit':
          return <ShimmerAdminPanel />;
        default:
          return <ShimmerPage />;
      }
    }

    switch (currentTab) {
      case 'dashboard':
        return <LecturerDashboard onNavigate={handleTabChange} />;
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
      case 'course_announcements':
        return <CourseAnnouncements />;
      case 'student_dashboard':
        return <StudentDashboard />;
      case 'student_timetable':
      case 'admin_timetable':
        return <Timetable />;
      case 'student_mc':
        return <StudentMC />;
      case 'student_contact':
        return <StudentContact />;
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
      case 'admin_reports':
      case 'admin_reports_feedback':
        return <ReportsManager activeSubTab="feedback" />;
      case 'admin_reports_mc':
        return <ReportsManager activeSubTab="mc" />;
      case 'admin_audit':
        return <AuditManager />;
      default:
        return user?.role === 'admin' ? <AdminDashboard /> : user?.role === 'student' ? <StudentDashboard /> : <LecturerDashboard onNavigate={handleTabChange} />;
    }
  };

  return (
    <MainLayout
      currentTab={currentTab}
      setCurrentTab={handleTabChange}
      isLoading={tabLoading}
    >
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
