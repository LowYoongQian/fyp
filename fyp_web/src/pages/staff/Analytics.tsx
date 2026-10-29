import { FloatingPanel } from '../../components/FloatingPanel';
import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, BookOpen, CalendarCheck, ChevronDown, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { apiService } from '../../services/api';
import type { AnalyticsOverview } from '../../services/api';
import { ShimmerAnalytics } from '../../components/Shimmer';

const COLORS = ['#10b981', '#3b82f6', '#94a3b8'];
const pct = (value?: number | null) => value == null ? '—' : `${value.toFixed(1)}%`;
const Empty = ({ text }: { text: string }) => <div className="flex h-full items-center justify-center text-center text-xs font-medium text-slate-400">{text}</div>;

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [courseId, setCourseId] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiService.getAnalyticsOverview(courseId || undefined).then(result => {
      if (!active) return;
      setData(result);
      setError('');
      if (!courseId && result.selected_course_id) setCourseId(String(result.selected_course_id));
    }).catch(() => active && setError('Unable to load analytics right now.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [courseId]);

  const selected = data?.courses.find(course => String(course.id) === String(data.selected_course_id));
  const weekly = useMemo(() => data?.weekly.map(item => ({ ...item, label: new Date(`${item.week}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })) ?? [], [data]);
  const verificationTotal = data?.verification.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const verified = data?.verification.slice(0, 2).reduce((sum, item) => sum + item.count, 0) ?? 0;

  if (loading && !data) return <ShimmerAnalytics />;
  if (error && !data) return <div className="uipro-card flex min-h-64 flex-col items-center justify-center text-center"><AlertTriangle className="h-8 w-8 text-rose-500"/><p className="mt-3 text-sm font-bold">Analytics unavailable</p><p className="mt-1 text-xs text-slate-500">{error}</p></div>;

  const summary = data?.summary ?? {};
  const cards = [
    { label: 'Average attendance', value: pct(summary.average_attendance), note: 'Completed classes', icon: TrendingUp, tone: 'bg-blue-50 text-brand-blue' },
    { label: 'Enrolled students', value: summary.enrolled_students ?? 0, note: 'Unique students', icon: Users, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'At-risk students', value: summary.at_risk_students ?? 0, note: 'Medium or high risk', icon: ShieldCheck, tone: 'bg-rose-50 text-rose-600' },
    { label: 'Classes completed', value: `${summary.completed_classes ?? 0} / ${summary.tracked_classes ?? 0}`, note: 'Excludes cancellations', icon: CalendarCheck, tone: 'bg-amber-50 text-amber-600' },
  ];

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div><h2 className="text-2xl font-display font-bold text-slate-900">Attendance Analytics</h2><p className="mt-1 text-xs text-slate-500">Live course performance for classes assigned to your account.</p></div>
      <div className="relative"><button type="button" onClick={() => setOpen(value => !value)} className="inline-flex min-w-64 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-xs font-bold text-slate-700 shadow-sm"><span className="truncate">{selected ? `${selected.code} · ${selected.name}` : 'No assigned courses'}</span><ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}/></button>
        {open && <FloatingPanel className="absolute right-0 z-50 mt-2 w-full min-w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">{data?.courses.map(course => <button key={course.id} type="button" onClick={() => { setCourseId(String(course.id)); setOpen(false); }} className={`w-full rounded-lg px-3 py-2.5 text-left text-xs hover:bg-blue-50 ${String(course.id) === courseId ? 'bg-blue-50 text-brand-blue' : 'text-slate-700'}`}><strong className="block">{course.code}</strong><span className="mt-0.5 block text-[10px] text-slate-500">{course.name}</span></button>)}</FloatingPanel>}
      </div>
    </header>

    {!data?.courses.length ? <div className="uipro-card py-16 text-center text-sm text-slate-500">No courses are assigned to this account.</div> : <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(item => <div key={item.label} className="uipro-card flex items-center gap-4 bg-white/80"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.tone}`}><item.icon className="h-5 w-5"/></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p><p className="mt-1 text-xl font-black text-slate-900">{item.value}</p><p className="text-[10px] text-slate-500">{item.note}</p></div></div>)}</div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="uipro-card xl:col-span-2"><Title icon={BarChart3} text="Weekly attendance trend" note={`${weekly.length} calendar weeks · through today`}/><div className="mt-4 h-72">{weekly.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={weekly} margin={{ top: 8, right: 12, left: -20 }}><defs><linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.22}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="label" tick={{ fontSize: 10 }}/><YAxis domain={[0, 100]} tick={{ fontSize: 10 }}/><Tooltip formatter={(value, name) => name === 'rate' ? [`${value}%`, 'Attendance'] : [value, name === 'classes' ? 'Completed classes' : 'Tracked classes']}/><Area type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={2.5} fill="url(#rateFill)" connectNulls={false}/><Area type="monotone" dataKey="tracked_classes" stroke="transparent" fill="transparent"/><Area type="monotone" dataKey="classes" stroke="transparent" fill="transparent"/></AreaChart></ResponsiveContainer> : <Empty text="Complete a class to begin the weekly trend."/>}</div><p className="mt-2 text-[10px] text-slate-500">Weeks without a line have no completed attendance yet; unresolved classes are not treated as 0%.</p></section>
        <section className="uipro-card"><Title text="Check-in verification"/><div className="relative mt-3 h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.verification} dataKey="count" innerRadius={53} outerRadius={70} paddingAngle={verificationTotal ? 3 : 0}>{data.verification.map((_, index) => <Cell key={index} fill={COLORS[index]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-xl">{verificationTotal ? Math.round(verified * 100 / verificationTotal) : 0}%</strong><span className="text-[9px] font-bold uppercase text-slate-400">verified</span></div></div><div className="space-y-2">{data.verification.map((item, index) => <div key={item.name} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="flex items-center gap-2 font-semibold text-slate-600"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index] }}/>{item.name}</span><strong>{item.count}</strong></div>)}</div></section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="uipro-card xl:col-span-2"><Title text="Attendance by weekday"/><div className="mt-4 h-56">{data.weekdays.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.weekdays} margin={{ top: 8, right: 12, left: -20 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="day" tick={{ fontSize: 10 }}/><YAxis domain={[0, 100]} tick={{ fontSize: 10 }}/><Tooltip formatter={value => [`${value}%`, 'Attendance']}/><Bar dataKey="rate" radius={[6, 6, 0, 0]}>{data.weekdays.map(item => <Cell key={item.day} fill={(item.rate ?? 0) >= 80 ? '#2563eb' : '#ef4444'}/>)}</Bar></BarChart></ResponsiveContainer> : <Empty text="No completed class data by weekday yet."/>}</div></section>
        <section className="uipro-card"><Title icon={BookOpen} text="Class groups"/><div className="mt-4 space-y-3">{data.groups.length ? data.groups.map(group => <div key={group.group} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between"><strong className="text-xs">{group.group}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${(group.attendance_rate ?? 0) >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{pct(group.attendance_rate)}</span></div><div className="mt-2 flex gap-4 text-[10px] text-slate-500"><span>{group.students} students</span><span>{group.completed_classes} completed classes</span></div></div>) : <Empty text="No enrolled class groups."/>}</div></section>
      </div>
    </>}
  </div>;
};

const Title = ({ icon: Icon, text, note }: { icon?: React.ElementType; text: string; note?: string }) => <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div className="flex items-center gap-2">{Icon && <Icon className="h-4 w-4 text-brand-blue"/>}<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{text}</h3></div>{note && <span className="text-[10px] font-semibold text-slate-400">{note}</span>}</div>;
