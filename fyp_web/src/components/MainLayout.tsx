import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfileModal } from './UserProfileModal';
import { UserSettingsModal } from './UserSettingsModal';
import sasLogo from '../assets/saslogo.png';
import {
  LayoutDashboard,
  BarChart3,
  AlertTriangle,
  MessageSquareCode,
  LogOut,
  User,
  ShieldAlert,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  UserCheck,
  Users,
  Briefcase,
  Megaphone,
  BookOpen,
  Home,
  Settings,
  ChevronsUpDown,
  Check,
  FileText,
  MessageSquare,
  ChevronDown,
  FileCheck
} from 'lucide-react';
import { closeSwal } from '../utils/swal';
import { clearApiCache } from '../services/api';
import { t } from '../i18n/i18n';

interface MainLayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isLoading?: boolean;
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  currentTab,
  setCurrentTab,
  isLoading = false,
  children
}) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(
    currentTab.startsWith('admin_reports')
  );

  useEffect(() => {
    if (currentTab.startsWith('admin_reports')) {
      setIsReportsOpen(true);
    }
  }, [currentTab]);
  
  // Profile slide-up popover menu & modal states
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<'profile' | 'security'>('profile');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const openProfile = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: 'profile' | 'security' }>).detail;
      setProfileInitialTab(detail?.tab || 'profile');
      setIsProfileMenuOpen(false);
      setIsProfileModalOpen(true);
    };
    window.addEventListener('open-user-profile', openProfile);
    return () => window.removeEventListener('open-user-profile', openProfile);
  }, []);

  const handleLogout = () => {
    // Immediately destroy session tokens so refreshing the page (F5 / Ctrl+F5) CANNOT cancel logout
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_session_expires_at');
    window.history.replaceState({}, '', window.location.pathname);
    clearApiCache();
    setIsLoggingOut(true);
    setIsProfileMenuOpen(false);
  };

  const handleLogoutAnimationComplete = () => {
    closeSwal();
    logout();
    window.location.reload();
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  const navItems = user?.role === 'admin'
    ? [
        { id: 'admin_dashboard', label: t('common.dashboard', 'en'), icon: LayoutDashboard },
        { id: 'admin_students', label: t('admin.studentsManager', 'en'), icon: Users },
        { id: 'admin_staff', label: t('admin.staffManager', 'en'), icon: Briefcase },
        { id: 'admin_academic', label: t('admin.academicManager', 'en'), icon: BookOpen },
        { id: 'admin_timetable', label: t('common.timetable', 'en'), icon: Calendar },
        { id: 'admin_attendance', label: t('common.attendance', 'en'), icon: UserCheck },
        { id: 'admin_network', label: t('admin.networkSecurity', 'en'), icon: ShieldAlert },
        { id: 'admin_announcements', label: t('admin.announcements', 'en'), icon: Megaphone },
        { id: 'admin_reports', label: 'Reports', icon: FileText },
        { id: 'admin_audit', label: 'Audit Logs', icon: ShieldAlert }
      ]
    : user?.role === 'student'
      ? [
          { id: 'student_dashboard', label: t('common.dashboard', 'en'), icon: LayoutDashboard },
          { id: 'student_timetable', label: t('common.timetable', 'en'), icon: Calendar },
          { id: 'student_mc', label: 'Medical Leave', icon: FileText },
          { id: 'student_contact', label: t('student.contactAdmin', 'en'), icon: MessageSquare }
        ]
      : [
          { id: 'dashboard', label: t('common.dashboard', 'en'), icon: LayoutDashboard },
          { id: 'timetable', label: t('common.timetable', 'en'), icon: Calendar },
          { id: 'attendance', label: t('common.attendance', 'en'), icon: UserCheck },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'risk', label: 'At-Risk Students', icon: AlertTriangle },
          { id: 'course_announcements', label: 'Course Notices', icon: Megaphone },
          { id: 'chatbot', label: 'AI Assistant', icon: MessageSquareCode }
        ];

  const currentItem = navItems.find(item => item.id === currentTab);
  const currentTabLabel = currentItem ? currentItem.label : t('common.dashboard', 'en');
  const portalName = user?.role === 'admin' ? 'Admin Portal' : user?.role === 'student' ? 'Student Portal' : 'Staff Portal';

  return (
    <div
      className="h-screen flex overflow-hidden relative transition-colors duration-200"
      style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text-primary)' }}
    >
      {/* Animated Background Blobs */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      {/* Mobile Sidebar Toggle Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
        className={`fixed lg:sticky top-0 inset-y-0 left-0 h-screen z-50 flex flex-col border-r backdrop-blur-md transition-all duration-300 shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'w-20' : 'w-72'}`}
      >
        {/* Collapse Sidebar Button (visible on desktop only) */}
        <button
          type="button"
          onClick={() => { setCollapsed(!collapsed); setIsProfileMenuOpen(false); }}
          className="hidden lg:flex absolute top-8 -right-3.5 z-50 h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer transition-all"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* Branding */}
        <div className={`flex h-24 shrink-0 items-center border-b border-slate-100 transition-all ${
          collapsed ? 'justify-center px-0' : 'justify-between px-5'
        }`}>
          <button
            type="button"
            onClick={() => {
              setCurrentTab(user?.role === 'admin' ? 'admin_dashboard' : user?.role === 'student' ? 'student_dashboard' : 'dashboard');
              setSidebarOpen(false);
            }}
            title="Go to Home Dashboard"
            className="flex items-center gap-3 cursor-pointer group text-left focus:outline-none"
          >
            <img
              src={sasLogo}
              alt="SmartAttendance Logo"
              className={`${collapsed ? 'h-12 w-12' : 'h-16 w-16'} object-contain drop-shadow-md shrink-0 group-hover:scale-108 active:scale-95 transition-transform duration-200`}
            />
            {!collapsed && (
              <div className="animate-in fade-in duration-200">
                <h1 className="font-display font-bold text-sm tracking-tight text-slate-800 dark:text-slate-100 uppercase leading-none group-hover:text-brand-blue transition-colors">SmartAttendance</h1>
                <span className="text-[9.5px] font-sans font-bold text-brand-blue dark:text-blue-400 uppercase tracking-wider block mt-1.5">
                  {portalName}
                </span>
              </div>
            )}
          </button>
          {!collapsed && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;

            if (item.id === 'admin_reports') {
              const isReportsActive = currentTab.startsWith('admin_reports');
              return (
                <div key={item.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReportsOpen(!isReportsOpen);
                      if (!currentTab.startsWith('admin_reports')) {
                        setCurrentTab('admin_reports_feedback');
                      }
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center justify-between rounded-xl text-xs font-semibold tracking-wide transition-all duration-155 cursor-pointer border ${
                      collapsed ? 'justify-center p-3' : 'px-4 py-3'
                    } ${
                      isReportsActive
                        ? 'bg-brand-blue-light text-brand-blue border-brand-blue/10 shadow-sm font-bold'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${isReportsActive ? 'text-brand-blue' : 'text-slate-400'}`} />
                      {!collapsed && (
                        <span className="animate-in fade-in duration-200 truncate">{item.label}</span>
                      )}
                    </div>
                    {!collapsed && (
                      <ChevronDown
                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                          isReportsOpen ? 'rotate-180 text-brand-blue' : ''
                        }`}
                      />
                    )}
                  </button>

                  {/* Accordion Dropdown Sub-Items */}
                  {isReportsOpen && !collapsed && (
                    <div className="pl-9 pr-2 space-y-1 font-sans animate-in slide-in-from-top-2 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTab('admin_reports_feedback');
                          setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                          currentTab === 'admin_reports_feedback' || currentTab === 'admin_reports'
                            ? 'bg-blue-50/90 dark:bg-blue-500/10 text-brand-blue dark:text-blue-400 font-bold'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Feedback Reports</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTab('admin_reports_mc');
                          setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                          currentTab === 'admin_reports_mc'
                            ? 'bg-blue-50/90 dark:bg-blue-500/10 text-brand-blue dark:text-blue-400 font-bold'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <FileCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Medical Leave</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setSidebarOpen(false);
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-xl text-xs font-semibold tracking-wide transition-all duration-155 cursor-pointer border ${
                  collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'
                } ${
                  active
                    ? 'bg-brand-blue-light text-brand-blue border-brand-blue/10 shadow-sm font-bold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-transparent'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${active ? 'text-brand-blue' : 'text-slate-400'}`} />
                {!collapsed && (
                  <span className="animate-in fade-in duration-200 truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile Card & Slide-up Menu */}
        <div
          ref={popoverRef}
          style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
          className="p-4 border-t transition-all shrink-0 relative"
        >
          {/* Slide-up Popover Menu */}
          {isProfileMenuOpen && (
            <div
              style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
              className={`absolute bottom-full mb-3 backdrop-blur-md border rounded-2xl shadow-2xl z-50 p-2 text-xs font-sans animate-in slide-in-from-bottom-3 fade-in duration-200 ${
              collapsed ? 'left-3 w-60' : 'left-4 right-4'
            }`}>
              {/* Menu items */}
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => { setIsProfileMenuOpen(false); setProfileInitialTab('profile'); setIsProfileModalOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors font-medium cursor-pointer"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  <span>View profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setIsProfileMenuOpen(false); setIsSettingsModalOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors font-medium cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  <span>{t('common.settings', 'en')}</span>
                </button>
              </div>

              {/* Account details box */}
              <div className="mt-2 pt-2 border-t border-slate-100 px-1">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block px-2 pb-1.5">Active Account</span>
                <div className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="relative shrink-0">
                    <div className="p-2 bg-brand-blue-light rounded-xl text-brand-blue">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 text-xs truncate">
                      {user?.role === 'admin' ? 'Administrator' : user?.role === 'student' ? 'Student' : 'Lecturer'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <Check className="h-4 w-4 text-brand-blue shrink-0" />
                </div>
              </div>
            </div>
          )}

          {/* Profile Card Button */}
          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                title={`Account (${user?.email})`}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer relative ${
                  isProfileMenuOpen
                    ? 'bg-brand-blue-light border-brand-blue/30 text-brand-blue shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-brand-blue'
                }`}
              >
                <User className="h-4.5 w-4.5" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              </button>

              <button
                type="button"
                onClick={handleLogout}
                title="Sign Out"
                className="w-10 h-10 rounded-xl bg-white hover:bg-danger-red-light border border-slate-200 text-slate-500 hover:text-danger-red flex items-center justify-center transition-all cursor-pointer shadow-xs"
              >
                <LogOut className="h-4 w-4 shrink-0" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                  isProfileMenuOpen
                    ? 'bg-brand-blue-light/70 border-brand-blue/20 shadow-sm'
                    : 'bg-slate-50/90 hover:bg-slate-100/80 border-slate-200/80'
                }`}
              >
                <div className="relative shrink-0">
                  <div className="p-2 bg-brand-blue-light rounded-lg text-brand-blue shadow-xs group-hover:scale-105 transition-transform">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {user?.role === 'admin' ? 'Administrator' : user?.role === 'student' ? 'Student' : 'Lecturer'}
                  </p>
                  <p className="text-[10px] text-slate-450 truncate mt-0.5">{user?.email}</p>
                </div>
                <ChevronsUpDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isProfileMenuOpen ? 'rotate-180 text-brand-blue' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <LogOut className="h-4 w-4 text-slate-500" />
                <span>{t('common.logout', 'en')}</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-y-auto z-10 relative">
        {/* Top Header */}
        <header
          style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
          className="flex h-20 shrink-0 items-center justify-between px-6 border-b backdrop-blur-md sticky top-0 z-30 relative"
        >
          {/* Material UI Indeterminate Blue Linear Progress Bar at the bottom border line of Header (Between Header & Body) */}
          {isLoading && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-100/60 dark:bg-slate-800/80 overflow-hidden pointer-events-none z-40">
              <div className="mui-linear-bar1 h-full bg-brand-blue shadow-sm" />
              <div className="mui-linear-bar2 h-full bg-sky-400 shadow-sm" />
            </div>
          )}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-500 hover:text-slate-800 p-2 rounded-xl bg-white border border-slate-200 shadow-sm cursor-pointer"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            
            <div className="flex items-center gap-2 text-xs font-sans text-slate-500">
              <button
                type="button"
                onClick={() => setCurrentTab(user?.role === 'admin' ? 'admin_dashboard' : user?.role === 'student' ? 'student_dashboard' : 'dashboard')}
                title="Go to Dashboard"
                className="flex items-center gap-1 hover:text-brand-blue text-slate-500 transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-100/70"
              >
                <Home className="h-4 w-4 text-slate-400 hover:text-brand-blue shrink-0" />
              </button>
              <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />
              <span className="font-bold text-brand-blue bg-brand-blue-light px-2.5 py-1 rounded-lg border border-brand-blue/10">
                {currentTabLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Network Active badge removed */}
          </div>
        </header>

        {/* View Injector */}
        <main className={currentTab === 'chatbot'
          ? 'flex min-h-0 w-full flex-1'
          : 'flex-grow p-6 lg:p-8 max-w-7xl w-full mx-auto'
        }>
          {children}
        </main>
      </div>

      {/* Account Settings & Profile Modals */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialEmail={user?.email}
        initialRole={user?.role}
        initialTab={profileInitialTab}
      />

      <UserSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Full-Screen Logout Transition Overlay */}
      {isLoggingOut && (
        <LogoutTransitionOverlay onComplete={handleLogoutAnimationComplete} />
      )}
    </div>
  );
};

interface LogoutTransitionOverlayProps {
  onComplete: () => void;
}

const LogoutTransitionOverlay: React.FC<LogoutTransitionOverlayProps> = ({ onComplete }) => {
  // Use lazy useState initialization so startTime is created ONCE on mount and preserved across re-renders
  const [startTime] = useState<number>(() => Date.now());
  const [progress, setProgress] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<string>('1.5');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const DURATION_MS = 1500; // 1.5 seconds total

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / DURATION_MS) * 100));
      const sec = Math.max(0, (DURATION_MS - elapsed) / 1000).toFixed(1);

      setProgress(pct);
      setRemainingSec(sec);

      if (elapsed >= DURATION_MS) {
        clearInterval(timer);
        onCompleteRef.current();
      }
    }, 30);

    return () => clearInterval(timer);
  }, [startTime]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl animate-in fade-in duration-200 space-y-6">
      <img
        src={sasLogo}
        alt="SmartAttendance Logo"
        className="h-36 w-36 sm:h-44 sm:w-44 md:h-48 md:w-48 object-contain drop-shadow-2xl animate-bounce"
      />
      <div className="text-center space-y-1.5">
        <h3 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Successfully Logged Out</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">Clearing session credentials and redirecting to portal...</p>
      </div>

      {/* Semantic UI Progress Component with Smart Attendance System Brand Styling */}
      <div className="ui progress active indicating w-72 sm:w-80 space-y-2.5" data-percent={progress}>
        {/* Track Container */}
        <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative border border-slate-200/80 dark:border-slate-700/80 shadow-inner p-0.5">
          {/* Active Gradient Bar with Semantic UI Pulse Overlay */}
          <div
            className="bar h-full bg-gradient-to-r from-brand-blue via-sky-400 to-emerald-400 rounded-full transition-all duration-75 ease-out shadow-sm relative overflow-hidden"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Semantic UI Progress Label Row */}
        <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-600 dark:text-slate-300 px-0.5">
          <span className="flex items-center gap-1 text-brand-blue dark:text-blue-400">
            <span>Progress:</span>
            <span key={`pct-${progress}`}>{progress}%</span>
          </span>
          <span key={`sec-${remainingSec}`} className="text-slate-500 dark:text-slate-400 font-medium">
            {remainingSec} sec remaining
          </span>
        </div>
      </div>
    </div>
  );
};
