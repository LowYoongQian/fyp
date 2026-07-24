import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfileModal } from './UserProfileModal';
import { UserSettingsModal } from './UserSettingsModal';
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
  Check
} from 'lucide-react';
import { swalSuccess } from '../utils/swal';

interface MainLayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  currentTab,
  setCurrentTab,
  children
}) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  
  // Profile slide-up popover menu & modal states
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = () => {
    setIsLoggingOut(true);
    setIsProfileMenuOpen(false);
    swalSuccess('Successfully Logged Out', 'Your session has ended. Redirecting to login portal...');
    
    setTimeout(() => {
      logout();
    }, 950);
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
        { id: 'admin_dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'admin_students', label: 'Students', icon: Users },
        { id: 'admin_staff', label: 'Staff', icon: Briefcase },
        { id: 'admin_academic', label: 'Academics', icon: BookOpen },
        { id: 'admin_attendance', label: 'Attendance', icon: UserCheck },
        { id: 'admin_network', label: 'Network Security', icon: ShieldAlert },
        { id: 'admin_announcements', label: 'Announcements', icon: Megaphone }
      ]
    : user?.role === 'student'
      ? [
          { id: 'student_dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'student_timetable', label: 'Timetable', icon: Calendar },
          { id: 'chatbot', label: 'AI Assistant', icon: MessageSquareCode }
        ]
      : [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'timetable', label: 'Timetable', icon: Calendar },
          { id: 'attendance', label: 'Attendance', icon: UserCheck },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'risk', label: 'At-Risk Students', icon: AlertTriangle },
          { id: 'chatbot', label: 'AI Assistant', icon: MessageSquareCode }
        ];

  const currentItem = navItems.find(item => item.id === currentTab);
  const currentTabLabel = currentItem ? currentItem.label : 'Dashboard';
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
        <div className={`flex h-20 shrink-0 items-center border-b border-slate-100 transition-all ${
          collapsed ? 'justify-center px-0' : 'justify-between px-6'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-blue-light rounded-xl text-brand-blue shadow-sm shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="animate-in fade-in duration-200">
                <h1 className="font-display font-bold text-sm tracking-tight text-slate-800 uppercase leading-none">SmartAttendance</h1>
                <span className="text-[9px] font-sans font-semibold text-brand-blue uppercase tracking-wider block mt-1">
                  {portalName}
                </span>
              </div>
            )}
          </div>
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
                  onClick={() => { setIsProfileMenuOpen(false); setIsProfileModalOpen(true); }}
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
                  <span>Account settings</span>
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
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-y-auto z-10">
        {/* Top Header */}
        <header
          style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
          className="flex h-20 shrink-0 items-center justify-between px-6 border-b backdrop-blur-md sticky top-0 z-30"
        >
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
            <div className="flex items-center gap-2 text-[9px] font-sans font-bold bg-success-green-light border border-success-green/10 py-1.5 px-3 rounded-full text-success-green uppercase tracking-wider shadow-xs">
              <span className="w-1.5 h-1.5 bg-success-green rounded-full animate-ping" />
              <span>Network Active</span>
            </div>
          </div>
        </header>

        {/* View Injector */}
        <main className="flex-grow p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Account Settings & Profile Modals */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialEmail={user?.email}
        initialRole={user?.role}
      />

      <UserSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Full-Screen Logout Shimmer Overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md animate-in fade-in duration-200 space-y-4">
          <div className="p-4 bg-brand-blue-light rounded-2xl text-brand-blue animate-bounce shadow-md">
            <ShieldAlert className="h-9 w-9" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="font-display font-bold text-sm text-slate-900">Successfully Logged Out</h3>
            <p className="text-xs text-slate-500 font-sans">Clearing session credentials and redirecting to portal...</p>
          </div>
          {/* Animated Shimmer Bar */}
          <div className="w-56 h-1.5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/60">
            <div className="h-full bg-brand-blue rounded-full animate-pulse w-full shimmer-placeholder" />
          </div>
        </div>
      )}
    </div>
  );
};
