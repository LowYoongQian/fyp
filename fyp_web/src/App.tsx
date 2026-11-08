import { hasTimetableParams, resetTimetableRoute, TIMETABLE_PARAMS } from './utils/semesterRoute';
import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './components/MainLayout';
import {
  ShimmerPage,
  ShimmerTimetable,
  ShimmerAcademics,
  ShimmerDashboard,
  ShimmerStudentDashboard,
  ShimmerLogin,
  ShimmerAttendance,
  ShimmerAnalytics,
  ShimmerAtRisk,
  ShimmerChatbot,
  ShimmerAdminPanel,
  ShimmerCampusNetwork,
  ShimmerProfileModal,
  ShimmerSettingsModal
} from './components/Shimmer';
import './App.css';
import { applyThemePreference, getAccountThemePreference, resetThemeOnLogout } from './theme/themePreference';
import { recordRecentStaffPage } from './utils/staffRecentPages';
import { isSignInPath, ROUTE_EVENT, surfaceFor } from './utils/publicRoute';

// Keep the login screen and role pages out of the first download. Each screen is
// fetched only when it is needed, so students do not download admin and staff code.
const Login = lazy(() => import('./pages/security/Login').then(module => ({ default: module.Login })));
const LecturerDashboard = lazy(() => import('./pages/staff/LecturerDashboard').then(module => ({ default: module.LecturerDashboard })));
const Analytics = lazy(() => import('./pages/staff/Analytics').then(module => ({ default: module.Analytics })));
const AtRisk = lazy(() => import('./pages/staff/AtRisk').then(module => ({ default: module.AtRisk })));
const Chatbot = lazy(() => import('./pages/staff/Chatbot').then(module => ({ default: module.Chatbot })));
const CourseAnnouncements = lazy(() => import('./pages/staff/CourseAnnouncements').then(module => ({ default: module.CourseAnnouncements })));
const StudentsManager = lazy(() => import('./pages/admin/StudentsManager').then(module => ({ default: module.StudentsManager })));
const StaffManager = lazy(() => import('./pages/admin/StaffManager').then(module => ({ default: module.StaffManager })));
const AnnouncementManager = lazy(() => import('./pages/admin/AnnouncementManager').then(module => ({ default: module.AnnouncementManager })));
const CampusNetworkManager = lazy(() => import('./pages/admin/CampusNetworkManager').then(module => ({ default: module.CampusNetworkManager })));
const ReportsManager = lazy(() => import('./pages/admin/ReportsManager').then(module => ({ default: module.ReportsManager })));
const AuditManager = lazy(() => import('./pages/admin/AuditManager').then(module => ({ default: module.AuditManager })));
const Timetable = lazy(() => import('./pages/staff/Timetable').then(module => ({ default: module.Timetable })));
const Attendance = lazy(() => import('./pages/staff/Attendance').then(module => ({ default: module.Attendance })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const AcademicManager = lazy(() => import('./pages/admin/AcademicManager').then(module => ({ default: module.AcademicManager })));
const AttendanceManager = lazy(() => import('./pages/admin/AttendanceManager').then(module => ({ default: module.AttendanceManager })));
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard').then(module => ({ default: module.StudentDashboard })));
const StudentMC = lazy(() => import('./pages/student/StudentMC').then(module => ({ default: module.StudentMC })));
const StudentContact = lazy(() => import('./pages/student/StudentContact').then(module => ({ default: module.StudentContact })));
const UserProfilePage = lazy(() => import('./components/UserProfilePage').then(module => ({ default: module.UserProfilePage })));
const UserSettingsPage = lazy(() => import('./components/UserSettingsPage').then(module => ({ default: module.UserSettingsPage })));
// Public pages (information page, portal choice, page not found) are separate downloads, so signed-in pages never load their scenes.
const PublicHome = lazy(() => import('./pages/public/PublicHome').then(module => ({ default: module.PublicHome })));
const PortalChoice = lazy(() => import('./pages/public/PortalChoice').then(module => ({ default: module.PortalChoice })));
const ACCOUNT_TABS = ['profile', 'profile_security', 'settings'];

const TAB_ROUTES: Record<string, string> = {
  profile: 'account/profile',
  profile_security: 'account/security',
  settings: 'account/settings',
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
  student: new Set([...ACCOUNT_TABS, 'student_dashboard', 'student_timetable', 'student_mc', 'student_contact']),
  lecturer: new Set([...ACCOUNT_TABS, 'dashboard', 'timetable', 'attendance', 'analytics', 'risk', 'course_announcements', 'chatbot']),
  admin: new Set([...ACCOUNT_TABS, 'admin_dashboard', 'admin_students', 'admin_staff', 'admin_academic', 'admin_timetable', 'admin_attendance', 'admin_network', 'admin_announcements', 'admin_reports', 'admin_reports_feedback', 'admin_reports_mc', 'admin_audit']),
};

const DEFAULT_TABS = { student: 'student_dashboard', lecturer: 'dashboard', admin: 'admin_dashboard' } as const;

function tabFromLocation(): string | null {
  const pathRoute = window.location.pathname.replace(/^\/+|\/+$/g, '');
  // Keep old bookmarked hash links working once, then writeTabLocation migrates them.
  const hashRoute = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  const route = pathRoute || hashRoute;
  return ROUTE_TABS[route] || null;
}

const TIMETABLE_TABS = new Set(['timetable', 'student_timetable', 'admin_timetable']);

/**
 * The system skeleton of one app page. One map for every wait: a tab change, the page's code loading, and a refresh while the saved session
 * is being checked. It is chosen from the address alone and draws only grey shapes, so nothing private shows before the server confirms.
 */
function pageSkeleton(tab: string) {
  switch (tab) {
    case 'dashboard': return <ShimmerDashboard />;
    case 'student_dashboard': return <ShimmerStudentDashboard />;
    case 'timetable':
    case 'student_timetable':
    case 'admin_timetable': return <ShimmerTimetable admin={tab === 'admin_timetable'} />;
    case 'attendance': return <ShimmerAttendance />;
    case 'analytics': return <ShimmerAnalytics />;
    case 'risk': return <ShimmerAtRisk />;
    case 'chatbot': return <ShimmerChatbot />;
    case 'admin_academic': return <ShimmerAcademics />;
    case 'admin_network': return <ShimmerCampusNetwork />;
    case 'settings':
    case 'profile':
    case 'profile_security':
      return <div role="status" aria-label="Loading account page" aria-busy="true" className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">{tab === 'settings' ? <ShimmerSettingsModal /> : <ShimmerProfileModal />}</div>;
    case 'course_announcements':
    case 'admin_dashboard':
    case 'admin_attendance':
    case 'admin_students':
    case 'admin_staff':
    case 'admin_announcements':
    case 'admin_reports':
    case 'admin_reports_feedback':
    case 'admin_reports_mc':
    case 'admin_audit': return <ShimmerAdminPanel />;
    default: return <ShimmerPage />;
  }
}

/** While a refreshed app page waits for the server to confirm the saved session: a plain frame (no names, links or controls) around that page's skeleton. */
const RestoringPage: React.FC<{ tab: string }> = ({ tab }) => (
  <div data-restoring-page={tab} className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
    <div aria-hidden="true" className="hidden w-64 shrink-0 space-y-4 border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:block">
      <div className="h-10 w-36 rounded-xl shimmer-placeholder" />
      {Array.from({ length: 7 }, (_, index) => <div key={index} className="h-9 rounded-xl shimmer-placeholder" />)}
    </div>
    <div className="min-w-0 flex-1">
      <div aria-hidden="true" className="flex h-16 items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-9 w-9 rounded-full shimmer-placeholder" /><div className="h-9 w-32 rounded-xl shimmer-placeholder" />
      </div>
      <div className="p-4 sm:p-6 lg:p-8">{pageSkeleton(tab)}</div>
    </div>
  </div>
);

function writeTabLocation(tab: string, replace = false) {
  const route = TAB_ROUTES[tab];
  if (!route) return;
  // A chosen programme, course or semester belongs to its own timetable page only; any other destination starts clean.
  const params = new URLSearchParams(window.location.search);
  if (tabFromLocation() !== tab) TIMETABLE_PARAMS.forEach(key => params.delete(key));
  const search = params.toString();
  const nextUrl = `/${route}${search ? `?${search}` : ''}`;
  window.history[replace ? 'replaceState' : 'pushState']({ tab }, '', nextUrl);
}

const DashboardContent: React.FC = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const [currentTab, setCurrentTab] = useState(() => tabFromLocation() || 'dashboard');
  const [tabLoading, setTabLoading] = useState(false);
  const leaveGuard = useRef<(() => Promise<boolean>) | null>(null);
  const navigating = useRef(false);
  const registerLeaveGuard = useCallback((guard: (() => Promise<boolean>) | null) => {
    leaveGuard.current = guard;
  }, []);

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
    } else if (!loading && !isSignInPath(window.location.pathname)) {
      // Signed out on an app page: the address becomes the sign-in page ("/" is the public information page now).
      window.history.replaceState({}, '', '/login');
    }
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    const restoreLocation = async () => {
      const requestedTab = tabFromLocation();
      const nextTab = requestedTab && ROLE_TABS[user.role].has(requestedTab)
        ? requestedTab
        : DEFAULT_TABS[user.role];
      if (nextTab !== currentTab && leaveGuard.current) {
        if (navigating.current) {
          writeTabLocation(currentTab, true);
          return;
        }
        navigating.current = true;
        const allowed = await leaveGuard.current();
        navigating.current = false;
        if (!allowed) {
          writeTabLocation(currentTab);
          return;
        }
      }
      setTabLoading(false);
      setCurrentTab(nextTab);
      if (requestedTab !== nextTab) writeTabLocation(nextTab, true);
    };
    window.addEventListener('popstate', restoreLocation);
    return () => {
      window.removeEventListener('popstate', restoreLocation);
    };
  }, [user, currentTab]);

  useEffect(() => {
    if (user?.role === 'lecturer') {
      recordRecentStaffPage(user.user_id, currentTab);
    }
  }, [currentTab, user]);

  // Resolves true once `tab` is the current tab, false when navigation was refused or cancelled (e.g. unsaved-form guard).
  const handleTabChange = async (tab: string): Promise<boolean> => {
    if (!user || !ROLE_TABS[user.role].has(tab) || navigating.current) return false;
    if (tab === currentTab) {
      // The sidebar's Timetable always starts again (an admin's programme and course choice included), even from inside a semester.
      if (TIMETABLE_TABS.has(tab) && hasTimetableParams()) resetTimetableRoute();
      return true;
    }
    navigating.current = true;
    const allowed = !leaveGuard.current || await leaveGuard.current();
    navigating.current = false;
    if (!allowed) return false;
    setTabLoading(false);
    setCurrentTab(tab);
    if (tabFromLocation() !== tab) writeTabLocation(tab);
    return true;
  };

  // Checking a saved session. A refreshed app page shows that page's own skeleton (from the address only, nothing private); the sign-in
  // address, or a browser with no saved session at all, shows the sign-in shape.
  if (loading) {
    const tab = tabFromLocation();
    return tab && sessionStorage.getItem('auth_token') ? <RestoringPage tab={tab} /> : <ShimmerLogin />;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<ShimmerLogin />}>
        <Login />
      </Suspense>
    );
  }

  const renderActiveTab = () => {
    if (tabLoading) return pageSkeleton(currentTab);

    switch (currentTab) {
      case 'profile':
      case 'profile_security':
        return <UserProfilePage key={user?.user_id} onClose={() => handleTabChange(DEFAULT_TABS[user!.role])} initialTab={currentTab === 'profile_security' ? 'security' : 'profile'} />;
      case 'settings':
        return <UserSettingsPage key={user?.user_id} onClose={() => handleTabChange(DEFAULT_TABS[user!.role])} registerLeaveGuard={registerLeaveGuard} />;
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
        return <StudentDashboard onNavigate={handleTabChange} />;
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
      <Suspense fallback={pageSkeleton(currentTab)}>
        {renderActiveTab()}
      </Suspense>
    </MainLayout>
  );
};

import { DialogProvider } from './context/DialogContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ErrorPage } from './pages/public/ErrorPage';

/** "/" is the public information page, "/portal" the Student or Staff choice, "/login" and every app page the existing app, anything else not found. */
function useSurface() {
  const read = () => surfaceFor(window.location.pathname, window.location.hash, ROUTE_TABS);
  const [surface, setSurface] = useState(read);
  useEffect(() => {
    const update = () => setSurface(read());
    window.addEventListener('popstate', update);
    window.addEventListener(ROUTE_EVENT, update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener(ROUTE_EVENT, update); };
  }, []);
  return surface;
}

const PublicFallback = () => <div role="status" aria-label="Loading" className="min-h-screen bg-slate-50" />;

function Shell() {
  const surface = useSurface();
  // Read by the sign-in/sign-out code, which must not move the address while a public page is showing.
  useEffect(() => { document.documentElement.dataset.surface = surface; }, [surface]);
  if (surface === 'app') return <DashboardContent />;
  return (
    <Suspense fallback={<PublicFallback />}>
      {surface === 'public' ? <PublicHome /> : surface === 'portal' ? <PortalChoice /> : surface === 'error' ? <ErrorPage code={Number(window.location.pathname.split('/').pop())} /> : <ErrorPage code={404} />}
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <DialogProvider>
        <AppErrorBoundary>
          <Shell />
        </AppErrorBoundary>
      </DialogProvider>
    </AuthProvider>
  );
}

export default App;
