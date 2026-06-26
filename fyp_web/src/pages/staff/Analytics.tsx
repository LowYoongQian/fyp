import React, { useState } from 'react';
import { useDialog } from '../../context/DialogContext';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Calendar, BarChart3, TrendingUp, ShieldAlert, Award, FileSpreadsheet, ChevronDown } from 'lucide-react';

export const Analytics: React.FC = () => {
  const { alert: customAlert } = useDialog();
  const [selectedCourse, setSelectedCourse] = useState('CSE-401');
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);

  // Trend data
  const trendData = [
    { week: 'W1', 'CSE-401': 95, 'CSE-402': 90, 'CSE-305': 88 },
    { week: 'W2', 'CSE-401': 92, 'CSE-402': 88, 'CSE-305': 85 },
    { week: 'W3', 'CSE-401': 88, 'CSE-402': 85, 'CSE-305': 82 },
    { week: 'W4', 'CSE-401': 91, 'CSE-402': 86, 'CSE-305': 89 },
    { week: 'W5', 'CSE-401': 85, 'CSE-402': 80, 'CSE-305': 81 },
    { week: 'W6', 'CSE-401': 78, 'CSE-402': 75, 'CSE-305': 76 },
    { week: 'W7', 'CSE-401': 83, 'CSE-402': 82, 'CSE-305': 80 },
    { week: 'W8', 'CSE-401': 90, 'CSE-402': 89, 'CSE-305': 92 },
  ];

  // Security Verification Audit stats (WiFi & Liveness)
  const auditData = [
    { name: 'WiFi + Liveness Pass', value: 85, color: '#10b981' }, // Success Green
    { name: 'WiFi Subnet Only', value: 10, color: '#3b82f6' },   // Brand Blue
    { name: 'Manual Overrides', value: 5, color: '#94a3b8' },     // Slate Muted
  ];

  // Day of week attendance heatmap bar chart
  const weekdayData = [
    { day: 'Mon', rate: 92 },
    { day: 'Tue', rate: 88 },
    { day: 'Wed', rate: 94 },
    { day: 'Thu', rate: 82 },
    { day: 'Fri', rate: 76 },
  ];

  const averageRate = selectedCourse === 'CSE-401' ? 88 : selectedCourse === 'CSE-402' ? 84 : 83;

  return (
    <div className="space-y-8">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-display font-bold text-slate-800">
            Analytics & Intelligence Insights
          </h2>
          <p className="text-xs text-slate-500">
            Class engagement rates, trend slopes, and verification auditing logs
          </p>
        </div>

        {/* Course Filter */}
        <div className="relative">
          {isCourseDropdownOpen && (
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setIsCourseDropdownOpen(false)} 
            />
          )}
          
          <div className="relative z-40">
            <button
              type="button"
              onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
              className="bg-white border border-slate-200 rounded-xl py-2 px-4 text-slate-700 text-xs font-semibold focus:border-brand-blue focus:outline-none shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <span>
                {selectedCourse === 'CSE-401' ? 'Advanced AI (CSE-401)' : selectedCourse === 'CSE-402' ? 'Deep Learning (CSE-402)' : 'Mobile Apps (CSE-305)'}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            
            {isCourseDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in duration-100">
                {[
                  { value: 'CSE-401', label: 'Advanced AI (CSE-401)' },
                  { value: 'CSE-402', label: 'Deep Learning (CSE-402)' },
                  { value: 'CSE-305', label: 'Mobile Apps (CSE-305)' }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSelectedCourse(opt.value);
                      setIsCourseDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-xs text-slate-700 hover:bg-brand-blue hover:text-white transition-all border-b border-slate-100 last:border-b-0 ${
                      selectedCourse === opt.value ? 'bg-slate-50 font-bold' : ''
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="uipro-card flex items-center gap-4 bg-white/70">
          <div className="p-3 bg-brand-blue-light rounded-xl text-brand-blue shadow-xs">
            <TrendingUp className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Average Attendance</span>
            <span className="text-xl font-bold font-mono text-slate-800">{averageRate}%</span>
          </div>
        </div>

        <div className="uipro-card flex items-center gap-4 bg-white/70">
          <div className="p-3 bg-brand-blue-light rounded-xl text-brand-blue shadow-xs">
            <Award className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Highest Attendance</span>
            <span className="text-xl font-bold font-mono text-slate-800">95% <span className="text-[10px] font-normal text-slate-400 font-sans">W1</span></span>
          </div>
        </div>

        <div className="uipro-card flex items-center gap-4 bg-white/70">
          <div className="p-3 bg-danger-red-light rounded-xl text-danger-red shadow-xs">
            <ShieldAlert className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">At-Risk Enrolments</span>
            <span className="text-xl font-bold font-mono text-slate-800">2 <span className="text-[10px] font-normal text-slate-400 font-sans">students</span></span>
          </div>
        </div>

        <div className="uipro-card flex items-center gap-4 bg-white/70">
          <div className="p-3 bg-success-green-light rounded-xl text-success-green shadow-xs">
            <Calendar className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Classes Completed</span>
            <span className="text-xl font-bold font-mono text-slate-800">8 / 14</span>
          </div>
        </div>
      </div>

      {/* Charts Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 uipro-card space-y-4 bg-white/70">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4.5 w-4.5 text-brand-blue" />
              <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider">Weekly Attendance Trends</h3>
            </div>
            <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wide">Sem 2 - 2026</span>
          </div>
          <div className="h-72 w-full text-[10px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" stroke="#94a3b8" />
                <YAxis domain={[50, 100]} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px -2px rgba(148, 163, 184, 0.12)' }}
                  labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey={selectedCourse}
                  stroke="#2563eb"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRate)"
                  name="Rate %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Security Audit Pie Chart */}
        <div className="uipro-card space-y-4 flex flex-col justify-between bg-white/70">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider">Verification Audit Logs</h3>
            <span className="text-[10px] text-success-green font-sans font-bold uppercase tracking-wider">Secured</span>
          </div>

          <div className="h-44 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={auditData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {auditData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center font-sans">
              <span className="text-xl font-bold text-slate-800">95%</span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">Verified</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs font-sans">
            {auditData.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-md" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-500 font-semibold">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Weekday heatmap rates & data export */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Heatmap/Bar chart */}
        <div className="lg:col-span-2 uipro-card space-y-4 bg-white/70">
          <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider">Weekday Heatmap Rates</h3>
          <div className="h-56 w-full text-[10px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis domain={[0, 100]} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '12px' }}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="Rate %">
                  {weekdayData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.rate > 90 ? '#10B981' : entry.rate > 80 ? '#2563EB' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Report compiler card */}
        <div className="uipro-card flex flex-col justify-between space-y-4 bg-white/70">
          <div>
            <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider">Report Compiler</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Compile and download physical attendance spreadsheets formatted for registry submissions. Select date scopes or course groups.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 text-brand-blue flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">CSE-401_Weeks_1-8.xlsx</p>
              <p className="text-[10px] font-sans font-semibold text-slate-400 mt-0.5">COMPILING COMPLETE · 14.2 KB</p>
            </div>
          </div>

          <button
            onClick={() => customAlert('Export spreadsheet compiled. Saving spreadsheet to Downloads...', 'Report Compiler')}
            className="w-full uipro-button uipro-button-primary"
          >
            Compile & Download Report
          </button>
        </div>

      </div>
    </div>
  );
};
