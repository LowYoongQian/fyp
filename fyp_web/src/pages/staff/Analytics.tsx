import { FloatingPanel } from '../../components/FloatingPanel';
import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, BookOpen, CalendarCheck, CalendarDays, Check, ChevronDown, Fingerprint, LineChart, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { apiService, clearApiCache } from '../../services/api';
import type { AnalyticsOverview } from '../../services/api';
import { ShimmerAnalytics } from '../../components/Shimmer';

// The attendance a class should reach; the colours and the dashed target lines all use it.
const TARGET = 80;
const VERIFY_COLORS = ['#10b981', '#3b82f6', '#94a3b8'];
const pct = (value?: number | null) => value == null ? '—' : `${value.toFixed(1)}%`;
/** Good (at or above target), watch (within 20 points of it) or poor. */
const tone = (rate?: number | null) => rate == null ? 'none' : rate >= TARGET ? 'good' : rate >= TARGET - 20 ? 'watch' : 'poor';
const TONE = {
  good: { bar: '#10b981', chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', meter: 'from-emerald-400 to-emerald-500' },
  watch: { bar: '#f59e0b', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', meter: 'from-amber-300 to-amber-500' },
  poor: { bar: '#ef4444', chip: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300', meter: 'from-rose-400 to-rose-500' },
  none: { bar: '#cbd5e1', chip: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', meter: 'from-slate-200 to-slate-300' },
} as const;
// Chart lines and labels follow the theme through CSS variables, so dark mode needs no second chart.
const CHART_THEME = '[--chart-grid:#e2e8f0] [--chart-tick:#94a3b8] dark:[--chart-grid:#1e293b] dark:[--chart-tick:#64748b]';
const AXIS = { fontSize: 10, fill: 'var(--chart-tick)' };

type WeekRow = AnalyticsOverview['weekly'][number] & { label: string };

/** A friendly empty panel: what is missing and what will fill it. */
const Empty = ({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-brand-blue ring-1 ring-blue-100 dark:from-blue-500/10 dark:to-indigo-500/10 dark:ring-blue-500/20"><Icon className="h-5 w-5" /></span>
    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</p>
    <p className="max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
  </div>
);

/** A thin meter that fills from the left; its width eases when the value changes. */
const Meter = ({ value, gradient, label }: { value: number; gradient: string; label: string }) => (
  <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
    <div className={`analytics-meter h-full rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

const WeekTip = ({ row }: { row?: WeekRow }) => row ? (
  <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
    <p className="font-bold text-slate-800 dark:text-slate-100">Week of {row.label}</p>
    <p className="mt-1 text-slate-600 dark:text-slate-300">Attendance <strong className="text-slate-900 dark:text-white">{row.rate == null ? 'no data' : `${row.rate}%`}</strong></p>
    <p className="text-slate-500 dark:text-slate-400">{row.classes} of {row.tracked_classes} classes completed</p>
  </div>
) : null;

export const Analytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [courseId, setCourseId] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Read once: chart animations are skipped for people who ask for less motion.
  const still = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiService.getAnalyticsOverview(courseId || undefined).then(result => {
      if (!active) return;
      setData(result);
      setError('');
      if (!courseId && result.selected_course_id) setCourseId(String(result.selected_course_id));
    }).catch(err => {
      if (!active) return;
      // The chosen course left the current semester while this page was open: go back to the current list.
      if (courseId && err?.response?.status === 403) { clearApiCache(); setCourseId(''); setData(null); return; }
      setError('Unable to load analytics right now.');
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [courseId]);

  const selected = data?.courses.find(course => String(course.id) === String(data.selected_course_id));
  const weekly = useMemo<WeekRow[]>(() => data?.weekly.map(item => ({ ...item, label: new Date(`${item.week}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })) ?? [], [data]);
  const verification = useMemo(() => {
    const items = data?.verification ?? [];
    const total = items.reduce((sum, item) => sum + item.count, 0);
    return { items, total, verified: items.slice(0, 2).reduce((sum, item) => sum + item.count, 0) };
  }, [data]);

  if (loading && !data) return <ShimmerAnalytics />;
  if (error && !data) return <div className="uipro-card flex min-h-64 flex-col items-center justify-center text-center"><AlertTriangle className="h-8 w-8 text-rose-500"/><p className="mt-3 text-sm font-bold">Analytics unavailable</p><p className="mt-1 text-xs text-slate-500">{error}</p></div>;

  const summary = data?.summary ?? {};
  const enrolled = summary.enrolled_students ?? 0, atRisk = summary.at_risk_students ?? 0;
  const completed = summary.completed_classes ?? 0, tracked = summary.tracked_classes ?? 0;
  const average = summary.average_attendance;
  const cards = [
    { label: 'Average attendance', value: pct(average), note: average == null ? 'No completed classes yet' : `Target ${TARGET}%`, icon: TrendingUp, accent: 'from-blue-500 to-indigo-500',
      meter: average == null ? null : { value: average, gradient: TONE[tone(average)].meter } },
    { label: 'Enrolled students', value: enrolled, note: 'Unique students', icon: Users, accent: 'from-emerald-500 to-teal-500', meter: null },
    { label: 'At-risk students', value: atRisk, note: enrolled ? `${Math.round(atRisk * 100 / enrolled)}% of enrolled · medium or high risk` : 'Medium or high risk', icon: ShieldCheck, accent: 'from-rose-500 to-pink-500',
      meter: enrolled ? { value: atRisk * 100 / enrolled, gradient: 'from-rose-400 to-rose-500' } : null },
    { label: 'Classes completed', value: `${completed} / ${tracked}`, note: 'Excludes cancellations', icon: CalendarCheck, accent: 'from-amber-500 to-orange-500',
      meter: tracked ? { value: completed * 100 / tracked, gradient: 'from-amber-300 to-amber-500' } : null },
  ];
  const hasTrend = weekly.some(week => week.rate != null);
  const hasWeekdays = (data?.weekdays ?? []).some(day => day.rate != null);
  const animation = { isAnimationActive: !still, animationDuration: 600 };

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-display font-bold text-slate-900 dark:text-white"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/20"><LineChart className="h-5 w-5" /></span>Attendance Analytics</h2>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Live course performance for classes assigned to your account.</p>
      </div>
      <div className="relative">
        {/* A custom shadow, not shadow-sm: the global dark rule repaints white shadow-sm buttons as solid blue, and this is a field. */}
        <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="inline-flex min-w-64 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-xs font-bold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:border-brand-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <span className="flex min-w-0 items-center gap-2"><BookOpen className="h-4 w-4 shrink-0 text-brand-blue" /><span className="truncate">{selected ? `${selected.code} · ${selected.name}` : 'No current courses'}</span></span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}/>
        </button>
        {open && <FloatingPanel className="absolute right-0 z-50 mt-2 w-full min-w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">{data?.courses.map(course => {
          const current = String(course.id) === courseId;
          return <button key={course.id} type="button" onClick={() => { setCourseId(String(course.id)); setOpen(false); }} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors hover:bg-sky-50 dark:hover:bg-slate-800 ${current ? 'bg-sky-50 text-brand-blue dark:bg-slate-800 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
            <span className="min-w-0"><strong className="block">{course.code}</strong><span className="mt-0.5 block truncate text-[10px] text-slate-500">{course.name}</span></span>{current && <Check className="h-4 w-4 shrink-0" />}
          </button>;
        })}</FloatingPanel>}
      </div>
    </header>

    {!data?.courses.length ? <div className="uipro-card py-16 text-center text-sm text-slate-500">You have no courses in the current semester.</div> : <>
      {/* Key figures: each card rises in a moment after the one before, with a meter where a share means something. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((item, index) => (
        <div key={item.label} className="analytics-rise uipro-card group relative overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0" style={{ animationDelay: `${index * 60}ms` }}>
          <span aria-hidden="true" className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${item.accent} opacity-[0.08] transition-opacity group-hover:opacity-[0.14]`} />
          <div className="flex items-start gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} text-white shadow-md`}><item.icon className="h-5 w-5"/></div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-white">{item.value}</p>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{item.note}</p>
            </div>
          </div>
          {item.meter && <div className="mt-3"><Meter value={item.meter.value} gradient={item.meter.gradient} label={`${item.label} meter`} /></div>}
        </div>
      ))}</div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="analytics-rise uipro-card xl:col-span-2" style={{ animationDelay: '240ms' }}>
          <Title icon={BarChart3} text="Weekly attendance trend" note={hasTrend ? `${weekly.length} calendar week${weekly.length === 1 ? '' : 's'} · through today` : undefined}/>
          <div className={`mt-4 h-72 ${CHART_THEME}`}>{hasTrend
            ? <ResponsiveContainer width="100%" height="100%" debounce={150}><AreaChart data={weekly} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}>
                <defs><linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.28}/><stop offset="100%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)"/>
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false}/>
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`}/>
                <ReferenceLine y={TARGET} stroke="#10b981" strokeDasharray="5 4" label={{ value: `Target ${TARGET}%`, position: 'insideTopRight', fontSize: 10, fill: '#10b981' }}/>
                <Tooltip cursor={{ stroke: '#93c5fd', strokeWidth: 1 }} content={({ active, payload }) => active ? <WeekTip row={payload?.[0]?.payload as WeekRow | undefined}/> : null}/>
                <Area type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={2.5} fill="url(#rateFill)" connectNulls={false}
                  dot={{ r: 3, fill: '#fff', stroke: '#2563eb', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} {...animation}/>
              </AreaChart></ResponsiveContainer>
            : <Empty icon={BarChart3} title="No completed classes yet" text="The weekly trend appears once a class has been completed and its attendance recorded."/>}</div>
          {hasTrend && <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">A week without a point has no completed attendance yet.</p>}
        </section>

        <section className="analytics-rise uipro-card" style={{ animationDelay: '300ms' }}>
          <Title icon={Fingerprint} text="Check-in verification"/>
          <div className="relative mt-3 h-44 [--chart-ring:#e2e8f0] dark:[--chart-ring:#1e293b]">
            <ResponsiveContainer width="100%" height="100%" debounce={150}><PieChart>
              {verification.total
                ? <Pie data={verification.items} dataKey="count" innerRadius={55} outerRadius={72} paddingAngle={3} cornerRadius={4} stroke="none" {...animation}>{verification.items.map((item, index) => <Cell key={item.name} fill={VERIFY_COLORS[index]}/>)}</Pie>
                : <Pie data={[{ name: 'none', count: 1 }]} dataKey="count" innerRadius={55} outerRadius={72} stroke="none" isAnimationActive={false}><Cell fill="var(--chart-ring, #e2e8f0)"/></Pie>}
              {verification.total > 0 && <Tooltip formatter={(value, name) => [value, name]}/>}
            </PieChart></ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {verification.total
                ? <><strong className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{Math.round(verification.verified * 100 / verification.total)}%</strong><span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">verified</span></>
                : <><strong className="text-sm font-bold text-slate-600 dark:text-slate-300">No check-ins yet</strong><span className="mt-0.5 text-[10px] text-slate-400">Shown once students check in</span></>}
            </div>
          </div>
          <div className="mt-2 space-y-2">{verification.items.map((item, index) => {
            const share = verification.total ? item.count * 100 / verification.total : 0;
            return <div key={item.name} className="rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: VERIFY_COLORS[index] }}/>{item.name}</span>
                <span className="tabular-nums"><strong className="text-slate-900 dark:text-white">{item.count}</strong>{verification.total > 0 && <span className="ml-1.5 text-[10px] text-slate-400">{Math.round(share)}%</span>}</span></div>
              {verification.total > 0 && <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700"><div className="analytics-meter h-full rounded-full" style={{ width: `${share}%`, backgroundColor: VERIFY_COLORS[index] }}/></div>}
            </div>;
          })}</div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="analytics-rise uipro-card xl:col-span-2" style={{ animationDelay: '360ms' }}>
          <Title icon={CalendarDays} text="Attendance by weekday" note={hasWeekdays ? `Target ${TARGET}%` : undefined}/>
          <div className={`mt-4 h-56 ${CHART_THEME}`}>{hasWeekdays
            ? <ResponsiveContainer width="100%" height="100%" debounce={150}><BarChart data={data.weekdays} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)"/>
                <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false}/>
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`}/>
                <ReferenceLine y={TARGET} stroke="#10b981" strokeDasharray="5 4"/>
                <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} formatter={(value, _name, item) => [value == null ? 'no data' : `${value}%`, `Attendance · ${(item?.payload as { classes?: number })?.classes ?? 0} classes`]}/>
                <Bar dataKey="rate" radius={[8, 8, 0, 0]} maxBarSize={48} {...animation}>{data.weekdays.map(item => <Cell key={item.day} fill={TONE[tone(item.rate)].bar}/>)}</Bar>
              </BarChart></ResponsiveContainer>
            : <Empty icon={CalendarDays} title="No weekday data yet" text="Each weekday’s attendance appears once its classes have been completed."/>}</div>
          {hasWeekdays && <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500 dark:text-slate-400">{(['good', 'watch', 'poor'] as const).map(key => <span key={key} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: TONE[key].bar }}/>{key === 'good' ? `${TARGET}% or more` : key === 'watch' ? `${TARGET - 20}–${TARGET - 1}%` : `Below ${TARGET - 20}%`}</span>)}</div>}
        </section>

        <section className="analytics-rise uipro-card" style={{ animationDelay: '420ms' }}>
          <Title icon={Users} text="Class groups"/>
          <div className="mt-4 space-y-3">{data.groups.length ? data.groups.map(group => {
            const look = TONE[tone(group.attendance_rate)];
            return <div key={group.group} className="rounded-xl border border-slate-200 p-3 transition-colors hover:border-blue-200 dark:border-slate-700 dark:hover:border-blue-500/40">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm text-slate-800 dark:text-slate-100">{group.group}</strong>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${look.chip}`}>{group.attendance_rate == null ? 'No data yet' : pct(group.attendance_rate)}</span>
              </div>
              <div className="mt-2"><Meter value={group.attendance_rate ?? 0} gradient={look.meter} label={`${group.group} attendance`} /></div>
              <div className="mt-2 flex gap-4 text-[10px] text-slate-500 dark:text-slate-400"><span><strong className="text-slate-700 dark:text-slate-200">{group.students}</strong> students</span><span><strong className="text-slate-700 dark:text-slate-200">{group.completed_classes}</strong> completed classes</span></div>
            </div>;
          }) : <div className="h-40"><Empty icon={Users} title="No class groups" text="Groups appear once students are enrolled in this course."/></div>}</div>
        </section>
      </div>
    </>}
  </div>;
};

const Title = ({ icon: Icon, text, note }: { icon?: React.ElementType; text: string; note?: string }) => (
  <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
    <div className="flex items-center gap-2">{Icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-brand-blue dark:bg-blue-500/10"><Icon className="h-4 w-4"/></span>}<h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{text}</h3></div>
    {note && <span className="text-[10px] font-semibold text-slate-400">{note}</span>}
  </div>
);
