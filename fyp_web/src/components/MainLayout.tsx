import React from 'react';
import { useAuth } from '../context/AuthContext';
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
  BookOpen
} from 'lucide-react';

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
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false); // Collapsible sidebar state

  const navItems = user?.role === 'admin'
    ? [
        { id: 'admin_dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'admin_students', label: 'Students', icon: Users },
        { id: 'admin_staff', label: 'Staff', icon: Briefcase },
        { id: 'admin_academic', label: 'Academic Manager', icon: BookOpen },
        { id: 'admin_attendance', label: 'Attendance', icon: UserCheck },
        { id: 'admin_network', label: 'Network Security', icon: ShieldAlert },
        { id: 'admin_announcements', label: 'Announcements', icon: Megaphone }
      ]
    : user?.role === 'student'
      ? [
          { id: 'student_dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'student_timetable', label: 'My Timetable', icon: Calendar },
          { id: 'chatbot', label: 'NL AI Chatbot', icon: MessageSquareCode }
        ]
      : [
          { id: 'dashboard', label: 'Lecturer Dashboard', icon: LayoutDashboard },
          { id: 'timetable', label: 'Lecturer Timetable', icon: Calendar },
          { id: 'attendance', label: 'Attendance', icon: UserCheck },
          { id: 'analytics', label: 'Analytics Insights', icon: BarChart3 },
          { id: 'risk', label: 'At-Risk & Alerts', icon: AlertTriangle },
          { id: 'chatbot', label: 'NL AI Chatbot', icon: MessageSquareCode }
        ];

  const filteredItems = navItems;

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden relative">
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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white/95 border-r border-slate-200/50 backdrop-blur-md transition-all duration-300 lg:static lg:translate-x-0 relative ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-20' : 'w-72'}`}
      >
        {/* Collapse Sidebar Button (visible on desktop only) */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute top-8 -right-3.5 z-50 h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer transition-all"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* Branding */}
        <div className={`flex h-20 items-center border-b border-slate-100 transition-all ${
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
                  {user?.role === 'admin' ? 'Admin Console' : user?.role === 'student' ? 'Student Console' : 'Lecturer Console'}
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
          {filteredItems.map(item => {
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
                    ? 'bg-brand-blue-light text-brand-blue border-brand-blue/10 shadow-sm'
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

        {/* Sidebar Footer / User Profile */}
        <div className={`p-4 border-t border-slate-100 bg-white/40 transition-all ${
          collapsed ? 'flex flex-col items-center gap-4' : ''
        }`}>
          {collapsed ? (
            <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-brand-blue shadow-xs" title={user?.email}>
              <User className="h-4.5 w-4.5" />
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl mb-3 animate-in fade-in duration-200">
              <div className="p-2 bg-brand-blue-light rounded-lg text-brand-blue shadow-xs">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate font-headline">
                  {user?.role === 'admin' ? 'Administrator' : user?.role === 'student' ? 'Student' : 'Lecturer'}
                </p>
                <p className="text-[10px] text-slate-450 truncate mt-0.5">{user?.email}</p>
              </div>
            </div>
          )}
          
          <button
            onClick={logout}
            title={collapsed ? "Sign Out" : undefined}
            className={`uipro-button uipro-button-secondary cursor-pointer flex items-center justify-center transition-all ${
              collapsed ? 'p-2.5 w-10 h-10 rounded-xl' : 'w-full py-2.5 text-xs'
            }`}
          >
            <LogOut className={`h-4 w-4 ${collapsed ? '' : 'mr-2'}`} />
            {!collapsed && <span className="animate-in fade-in duration-200">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-grow flex flex-col min-w-0 overflow-y-auto z-10">
        {/* Top Header */}
        <header className="flex h-20 items-center justify-between px-6 border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-500 hover:text-slate-800 p-2 rounded-xl bg-white border border-slate-200 shadow-sm"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">
                System Overview // {currentTab.toUpperCase()}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[9px] font-sans font-bold bg-success-green-light border border-success-green/10 py-1.5 px-3 rounded-full text-success-green uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-success-green rounded-full animate-ping" />
              <span>Verdy-Network Online</span>
            </div>
          </div>
        </header>

        {/* View Injector */}
        <main className="flex-grow p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
