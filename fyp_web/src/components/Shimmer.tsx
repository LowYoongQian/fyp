import React from 'react';

// Single line shimmer text placeholder
export const ShimmerText: React.FC<{ width?: string; height?: string; className?: string }> = ({
  width = 'w-full',
  height = 'h-3',
  className = ''
}) => {
  return (
    <div className={`shimmer-placeholder rounded-md ${width} ${height} ${className}`} />
  );
};

// Single circle shimmer placeholder (avatar)
export const ShimmerCircle: React.FC<{ size?: string; className?: string }> = ({
  size = 'w-10 h-10',
  className = ''
}) => {
  return (
    <div className={`shimmer-placeholder rounded-full ${size} ${className}`} />
  );
};

// Card skeleton placeholder
export const ShimmerCard: React.FC = () => {
  return (
    <div className="uipro-card bg-white p-5 space-y-4">
      <div className="flex items-center gap-3">
        <ShimmerCircle size="w-12 h-12" />
        <div className="space-y-2 flex-grow">
          <ShimmerText width="w-1/3" height="h-4" />
          <ShimmerText width="w-1/4" height="h-3" />
        </div>
      </div>
      <ShimmerText width="w-full" height="h-3.5" />
      <ShimmerText width="w-5/6" height="h-3.5" />
      <div className="pt-2 border-t border-slate-100 flex justify-between">
        <ShimmerText width="w-1/4" height="h-3" />
        <ShimmerText width="w-1/5" height="h-3" />
      </div>
    </div>
  );
};

// Table rows shimmer placeholder helper
export const ShimmerTableRows: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
          <div className="flex items-center gap-3 flex-grow">
            <ShimmerCircle size="w-8 h-8" />
            <div className="space-y-1.5 flex-grow">
              <ShimmerText width="w-1/4" height="h-3.5" />
              <ShimmerText width="w-12" height="h-2.5" />
            </div>
          </div>
          <div className="flex gap-12 shrink-0">
            <ShimmerText width="w-16" height="h-3" />
            <ShimmerText width="w-20" height="h-5" className="rounded-full" />
            <ShimmerText width="w-24" height="h-6" className="rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Table skeleton placeholder
export const ShimmerTable: React.FC = () => {
  return (
    <div className="uipro-card bg-white p-6 space-y-6">
      <div className="flex justify-between items-center pb-3 border-b border-slate-150/70">
        <ShimmerText width="w-1/4" height="h-5" />
        <ShimmerText width="w-24" height="h-8" />
      </div>
      <ShimmerTableRows rows={4} />
    </div>
  );
};

// Timetable schedule skeleton placeholder
export const ShimmerTimetable: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Timetable Header / Note */}
      <div className="bg-sky-50/50 border border-sky-100/50 rounded-xl p-4 flex gap-3 shadow-xs">
        <ShimmerCircle size="w-5 h-5 shrink-0" />
        <div className="space-y-2 flex-grow">
          <ShimmerText width="w-12" height="h-3" />
          <ShimmerText width="w-2/3" height="h-3.5" />
        </div>
      </div>

      {/* Week & Campus Banner */}
      <div className="uipro-card bg-white/75 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 flex-grow">
          <ShimmerText width="w-1/4" height="h-6" />
          <ShimmerText width="w-1/3" height="h-3.5" />
          <div className="pt-2">
            <ShimmerText width="w-48" height="h-8" className="rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ShimmerText width="w-20" height="h-8" className="rounded-lg" />
          <ShimmerText width="w-28" height="h-8" className="rounded-lg" />
        </div>
      </div>

      {/* Grid Container */}
      <div className="space-y-4">
        <ShimmerText width="w-64" height="h-4" />

        <div className="uipro-card bg-white/75 overflow-x-auto p-0 border border-slate-200 shadow-premium">
          <div className="min-w-[1280px]">
            {/* Swapped Timetable Grid Layout */}
            <div className="grid grid-cols-[120px_repeat(14,_minmax(80px,_1fr))] border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-600">
              {/* Top Left Day/Time Cell */}
              <div className="row-span-2 border-r border-b border-slate-200 flex flex-col items-center justify-center p-3">
                <ShimmerText width="w-12" height="h-3" />
                <ShimmerText width="w-8" height="h-3" className="mt-1" />
              </div>

              {/* Top Row Time Slots */}
              {Array.from({ length: 14 }).map((_, idx) => (
                <div key={idx} className="py-2 border-r border-slate-200/70 border-b border-slate-100/50 flex items-center justify-center">
                  <ShimmerText width="w-10" height="h-3" />
                </div>
              ))}

              {/* Bottom Row Time Slots */}
              {Array.from({ length: 14 }).map((_, idx) => (
                <div key={idx} className="py-2 border-r border-slate-200/70 border-b border-slate-200 flex items-center justify-center">
                  <ShimmerText width="w-10" height="h-3" />
                </div>
              ))}
            </div>

            {/* Timetable Rows (Days of the week) */}
            <div className="divide-y divide-slate-200 bg-white">
              {Array.from({ length: 7 }).map((_, rowIdx) => {
                return (
                  <div
                    key={rowIdx}
                    className="grid grid-cols-[120px_repeat(14,_minmax(80px,_1fr))] min-h-[110px] relative"
                  >
                    {/* Left Column Day Label */}
                    <div className="border-r border-slate-200 bg-slate-55/30 px-3 py-4 flex flex-col items-center justify-center gap-2 text-center">
                      <ShimmerText width="w-12" height="h-4" />
                      <ShimmerText width="w-16" height="h-3.5" />
                    </div>

                    {/* 14 Background Empty Slots */}
                    {Array.from({ length: 14 }).map((_, i) => (
                      <div key={i} className="border-r border-slate-150/45" />
                    ))}

                    {/* Overlay Event Shimmers at indexes to look like populated classes */}
                    {rowIdx === 0 && (
                      <>
                        <div style={{ gridColumnStart: 2, gridColumnEnd: 'span 2', gridRow: 1, zIndex: 10 }} className="p-1.5 h-full">
                          <div className="h-full rounded-lg bg-slate-100 border border-slate-200 p-2.5 flex flex-col justify-between shimmer-placeholder" />
                        </div>
                        <div style={{ gridColumnStart: 4, gridColumnEnd: 'span 2', gridRow: 1, zIndex: 10 }} className="p-1.5 h-full">
                          <div className="h-full rounded-lg bg-slate-100 border border-slate-200 p-2.5 flex flex-col justify-between shimmer-placeholder" />
                        </div>
                      </>
                    )}
                    {rowIdx === 1 && (
                      <div style={{ gridColumnStart: 3, gridColumnEnd: 'span 2', gridRow: 1, zIndex: 10 }} className="p-1.5 h-full">
                        <div className="h-full rounded-lg bg-slate-100 border border-slate-200 p-2.5 flex flex-col justify-between shimmer-placeholder" />
                      </div>
                    )}
                    {rowIdx === 3 && (
                      <div style={{ gridColumnStart: 5, gridColumnEnd: 'span 2', gridRow: 1, zIndex: 10 }} className="p-1.5 h-full">
                        <div className="h-full rounded-lg bg-slate-100 border border-slate-200 p-2.5 flex flex-col justify-between shimmer-placeholder" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Full Page Skeleton (Generic Fallback)
export const ShimmerPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="uipro-card bg-white p-6 flex flex-col md:flex-row justify-between gap-4">
        <div className="space-y-2 flex-grow">
          <ShimmerText width="w-1/4" height="h-6" />
          <ShimmerText width="w-1/2" height="h-3.5" />
        </div>
        <ShimmerText width="w-32" height="h-10" />
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ShimmerTable />
        </div>
        <div className="space-y-6">
          <ShimmerCard />
          <ShimmerCard />
        </div>
      </div>
    </div>
  );
};

// Dashboard Specific Skeleton
export const ShimmerDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Top Section Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Profile Card */}
        <div className="xl:col-span-4 uipro-card bg-white p-6 space-y-4">
          <div className="flex items-center gap-4">
            <ShimmerCircle size="w-16 h-16 rounded-2xl" />
            <div className="space-y-2 flex-grow">
              <ShimmerText width="w-2/3" height="h-5" />
              <ShimmerText width="w-1/3" height="h-3" />
            </div>
          </div>
          <ShimmerText width="w-full" height="h-3" />
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <ShimmerText width="w-1/2" height="h-3" />
            <ShimmerText width="w-2/3" height="h-3" />
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="xl:col-span-5 grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="uipro-card bg-white p-5 flex flex-col justify-between h-32">
              <div className="flex justify-between items-center">
                <ShimmerText width="w-1/2" height="h-3.5" />
                <ShimmerCircle size="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <ShimmerText width="w-2/3" height="h-6" />
                <ShimmerText width="w-1/2" height="h-2.5" />
              </div>
            </div>
          ))}
        </div>

        {/* Shortcuts Card */}
        <div className="xl:col-span-3 uipro-card bg-white p-5 space-y-4">
          <div className="pb-2.5 border-b border-slate-100">
            <ShimmerText width="w-1/3" height="h-4" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ShimmerText key={i} height="h-8" className="rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Session Actions (Span 2) */}
        <div className="lg:col-span-2 uipro-card bg-white p-6 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <ShimmerCircle size="w-8 h-8" />
            <ShimmerText width="w-1/4" height="h-4" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <ShimmerText width="w-1/3" height="h-3" />
              <ShimmerText height="h-10" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <ShimmerText width="w-1/3" height="h-3" />
              <div className="flex gap-2">
                <ShimmerText height="h-10" className="rounded-xl flex-grow" />
                <ShimmerText height="h-10" className="rounded-xl flex-grow" />
                <ShimmerText height="h-10" className="rounded-xl flex-grow" />
              </div>
            </div>
            <ShimmerText height="h-10" className="rounded-xl" />
          </div>
        </div>

        {/* Right Side: Performance Gauge, Announcements (Span 1) */}
        <div className="space-y-6">
          <div className="uipro-card bg-white p-5 flex flex-col items-center space-y-4">
            <ShimmerText width="w-1/2" height="h-4" className="self-start" />
            <ShimmerCircle size="w-32 h-20 rounded-t-full" />
            <ShimmerText width="w-1/4" height="h-5" />
            <ShimmerText width="w-2/3" height="h-3" />
          </div>

          <div className="uipro-card bg-white p-5 space-y-4">
            <ShimmerText width="w-1/3" height="h-4" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-3 bg-slate-50/50 rounded-xl space-y-2 border border-slate-100">
                  <ShimmerText width="w-3/4" height="h-4.5" />
                  <ShimmerText width="w-full" height="h-3.5" />
                  <ShimmerText width="w-1/4" height="h-2.5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Attendance Specific Skeleton
export const ShimmerAttendance: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="uipro-card bg-white p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2 flex-grow">
          <ShimmerText width="w-1/4" height="h-6" />
          <ShimmerText width="w-1/2" height="h-3.5" />
        </div>
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 w-72">
          <ShimmerText width="w-1/4" height="h-3" />
          <ShimmerText width="w-1/4" height="h-3" />
          <ShimmerText width="w-1/4" height="h-3" />
        </div>
      </div>

      {/* Grid: Filters and Table */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Filters Card */}
        <div className="uipro-card bg-white p-5 space-y-4">
          <ShimmerText width="w-1/2" height="h-4" />
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <ShimmerText width="w-1/3" height="h-2.5" />
              <ShimmerText height="h-9" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <ShimmerText width="w-1/3" height="h-2.5" />
              <div className="space-y-2">
                <ShimmerText height="h-9" className="rounded-xl" />
                <ShimmerText height="h-9" className="rounded-xl" />
                <ShimmerText height="h-9" className="rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Student List Table */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200/50 rounded-2xl p-4">
            <ShimmerText width="w-48" height="h-8" className="rounded-xl" />
            <ShimmerText width="w-32" height="h-3.5" />
          </div>

          <div className="uipro-card bg-white p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-100 grid grid-cols-5 gap-4">
              <ShimmerText height="h-3" />
              <ShimmerText height="h-3" />
              <ShimmerText height="h-3" />
              <ShimmerText height="h-3" />
              <ShimmerText height="h-3" className="justify-self-end" />
            </div>
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-5 gap-4 items-center py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3 col-span-1">
                    <ShimmerCircle size="w-8 h-8" />
                    <div className="space-y-1.5 flex-grow">
                      <ShimmerText width="w-24" height="h-3" />
                      <ShimmerText width="w-12" height="h-2" />
                    </div>
                  </div>
                  <ShimmerText width="w-8" height="h-3" className="justify-self-center" />
                  <ShimmerText width="w-16" height="h-5" className="rounded-full justify-self-center" />
                  <ShimmerText width="w-20" height="h-5" className="rounded-full justify-self-center" />
                  <div className="flex gap-2 justify-self-end">
                    <ShimmerCircle size="w-7 h-7" className="rounded-lg" />
                    <ShimmerCircle size="w-7 h-7" className="rounded-lg" />
                    <ShimmerCircle size="w-7 h-7" className="rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Analytics Specific Skeleton
export const ShimmerAnalytics: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <ShimmerText width="w-48" height="h-6" />
          <ShimmerText width="w-72" height="h-3.5" />
        </div>
        <ShimmerText width="w-44" height="h-10" className="rounded-xl" />
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="uipro-card flex items-center gap-4 bg-white/70 animate-pulse-slow">
            <ShimmerCircle size="w-12 h-12 rounded-xl" />
            <div className="space-y-2 flex-grow">
              <ShimmerText width="w-2/3" height="h-2.5" />
              <ShimmerText width="w-1/2" height="h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trend Area Chart placeholder */}
        <div className="lg:col-span-2 uipro-card bg-white/70 p-6 space-y-4 h-96 flex flex-col justify-between">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <ShimmerText width="w-1/3" height="h-4" />
            <ShimmerText width="w-20" height="h-3" />
          </div>
          <div className="flex-grow w-full flex items-end gap-3 pt-6 pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-grow flex flex-col items-center gap-2 h-full justify-end">
                <div className="shimmer-placeholder rounded-t-lg w-full" style={{ height: `${20 + i * 8}%` }} />
                <ShimmerText width="w-6" height="h-2.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Security Audit Pie Chart placeholder */}
        <div className="uipro-card bg-white/70 p-6 flex flex-col justify-between h-96">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <ShimmerText width="w-1/2" height="h-4" />
            <ShimmerText width="w-12" height="h-3" />
          </div>
          <div className="flex justify-center items-center py-6">
            <div className="w-36 h-36 rounded-full border-8 border-slate-100 flex items-center justify-center relative">
              <div className="space-y-1 text-center">
                <ShimmerText width="w-10" height="h-4" className="mx-auto" />
                <ShimmerText width="w-12" height="h-2" className="mx-auto" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-md shimmer-placeholder" />
                  <ShimmerText width="w-24" height="h-3" />
                </div>
                <ShimmerText width="w-8" height="h-3" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekday heatmap rates & data export */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 uipro-card bg-white/70 p-6 space-y-4 h-72 flex flex-col justify-between">
          <ShimmerText width="w-1/4" height="h-4" />
          <div className="flex-grow w-full flex items-end gap-6 pt-6 pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-grow flex flex-col items-center gap-2 h-full justify-end">
                <div className="shimmer-placeholder rounded-t-lg w-full" style={{ height: `${40 + (i % 3) * 15}%` }} />
                <ShimmerText width="w-8" height="h-2.5" />
              </div>
            ))}
          </div>
        </div>

        <div className="uipro-card bg-white/70 p-6 flex flex-col justify-between h-72">
          <div className="space-y-2">
            <ShimmerText width="w-1/2" height="h-4" />
            <ShimmerText width="w-full" height="h-10" className="mt-2" />
          </div>
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
            <ShimmerCircle size="w-8 h-8 rounded-lg" />
            <div className="space-y-1.5 flex-grow min-w-0">
              <ShimmerText width="w-2/3" height="h-3" />
              <ShimmerText width="w-1/2" height="h-2" />
            </div>
          </div>
          <ShimmerText height="h-10" className="rounded-xl" />
        </div>
      </div>
    </div>
  );
};

// At-Risk Specific Skeleton
export const ShimmerAtRisk: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Overview Banner */}
      <div className="uipro-card bg-white/75 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2 flex-grow">
          <ShimmerText width="w-1/3" height="h-6" />
          <ShimmerText width="w-3/4" height="h-3.5" />
        </div>
        <ShimmerText width="w-40" height="h-10" className="rounded-xl shrink-0" />
      </div>

      {/* Main Grid: At-Risk Table vs Dispatch Logs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* At-Risk Students Panel */}
        <div className="xl:col-span-2 uipro-card bg-white/70 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-slate-100">
            <ShimmerText width="w-1/3" height="h-4" />
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 w-64">
              <ShimmerText height="h-6" className="rounded-lg" />
            </div>
          </div>

          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-3 flex-grow">
                  <ShimmerCircle size="w-10 h-10" />
                  <div className="space-y-1.5 flex-grow">
                    <ShimmerText width="w-1/4" height="h-3.5" />
                    <ShimmerText width="w-12" height="h-2.5" />
                  </div>
                </div>
                <div className="flex items-center gap-8 shrink-0">
                  <ShimmerText width="w-16" height="h-3" />
                  <ShimmerText width="w-20" height="h-5" className="rounded-full" />
                  <ShimmerText width="w-24" height="h-8" className="rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dispatch Logs Side Panel */}
        <div className="uipro-card bg-white/70 p-6 space-y-4 flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-100">
            <ShimmerText width="w-1/2" height="h-4" />
          </div>
          <div className="space-y-4 flex-grow pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center">
                  <ShimmerText width="w-1/3" height="h-3" />
                  <ShimmerText width="w-12" height="h-2" />
                </div>
                <ShimmerText width="w-full" height="h-3.5" />
                <ShimmerText width="w-1/2" height="h-2.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Chatbot Specific Skeleton
export const ShimmerChatbot: React.FC = () => {
  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col bg-white/75 backdrop-blur-md border border-slate-100 rounded-2xl shadow-premium overflow-hidden">
      {/* Panel Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-3">
          <ShimmerCircle size="w-9 h-9 rounded-xl" />
          <div className="space-y-1">
            <ShimmerText width="w-32" height="h-4.5" />
            <ShimmerText width="w-24" height="h-2.5" />
          </div>
        </div>
        <ShimmerText width="w-24" height="h-5" className="rounded-full" />
      </div>

      {/* Message Area */}
      <div className="flex-grow p-6 space-y-6 overflow-y-auto bg-slate-50/20">
        {/* System Message */}
        <div className="flex gap-3 max-w-[80%]">
          <ShimmerCircle size="w-8 h-8" />
          <div className="p-4 bg-white border border-slate-100 rounded-2xl rounded-tl-none space-y-2 w-96">
            <ShimmerText width="w-full" height="h-3" />
            <ShimmerText width="w-5/6" height="h-3" />
            <ShimmerText width="w-2/3" height="h-3" />
          </div>
        </div>

        {/* User Message */}
        <div className="flex gap-3 max-w-[80%] ml-auto flex-row-reverse">
          <ShimmerCircle size="w-8 h-8" />
          <div className="p-4 bg-brand-blue border border-transparent rounded-2xl rounded-tr-none space-y-2 w-72">
            <ShimmerText width="w-full" height="h-3" className="bg-white/20 animate-pulse" />
            <ShimmerText width="w-1/2" height="h-3" className="bg-white/20 animate-pulse" />
          </div>
        </div>

        {/* System Message with SQL block */}
        <div className="flex gap-3 max-w-[80%]">
          <ShimmerCircle size="w-8 h-8" />
          <div className="space-y-3">
            <div className="p-4 bg-white border border-slate-100 rounded-2xl rounded-tl-none space-y-2 w-80">
              <ShimmerText width="w-full" height="h-3" />
              <ShimmerText width="w-1/3" height="h-3" />
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2 w-[450px]">
              <ShimmerText width="w-1/3" height="h-3" />
              <div className="h-16 rounded-lg bg-white border border-slate-150 p-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 w-32 rounded-full shimmer-placeholder shrink-0" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-1.5 flex items-center h-14">
          <ShimmerText width="w-1/2" height="h-4" className="ml-3" />
          <ShimmerCircle size="w-9 h-9" className="rounded-lg ml-auto mr-1" />
        </div>
      </div>
    </div>
  );
};

// Admin Specific Skeleton
export const ShimmerAdminPanel: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="uipro-card bg-white p-6 space-y-2">
        <ShimmerText width="w-1/4" height="h-6" />
        <ShimmerText width="w-1/2" height="h-3.5" />
      </div>

      {/* Tab bar */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 max-w-md w-72">
        <div className="w-full h-9 rounded-lg shimmer-placeholder" />
      </div>

      {/* Forms & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Creation Form */}
        <div className="uipro-card bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShimmerCircle size="w-8 h-8" />
            <ShimmerText width="w-1/3" height="h-4" />
          </div>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <ShimmerText width="w-1/4" height="h-3" />
              <ShimmerText height="h-10" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <ShimmerText width="w-1/4" height="h-3" />
              <ShimmerText height="h-10" className="rounded-xl" />
            </div>
            <ShimmerText height="h-10" className="rounded-xl pt-2" />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="lg:col-span-2 uipro-card bg-white p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between">
            <ShimmerText width="w-1/4" height="h-4" />
            <ShimmerText width="w-16" height="h-3" />
          </div>
          <div className="p-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0 px-4">
                <div className="flex items-center gap-3 flex-grow">
                  <ShimmerCircle size="w-8 h-8" />
                  <div className="space-y-1.5 flex-grow">
                    <ShimmerText width="w-1/4" height="h-3.5" />
                    <ShimmerText width="w-12" height="h-2.5" />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <ShimmerText width="w-12" height="h-5" className="rounded-full" />
                  <ShimmerCircle size="w-6 h-6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Table Skeleton with Headers & Shimmer Rows + Shimmer Pagination Bar
export const ShimmerTableSkeleton: React.FC<{
  headers?: string[];
  columns?: number;
  rows?: number;
  showPagination?: boolean;
}> = ({
  headers,
  columns = 5,
  rows = 6,
  showPagination = true,
}) => {
  const colCount = headers ? headers.length : columns;

  return (
    <div className="w-full space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          {headers && (
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                {headers.map((head, idx) => (
                  <th key={idx} className={`py-3 px-4 ${idx === headers.length - 1 ? 'text-right' : ''}`}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-100/50">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/30 transition-colors">
                {Array.from({ length: colCount }).map((_, cIdx) => {
                  const isLast = cIdx === colCount - 1;
                  const isFirst = cIdx === 0;
                  const isBadgeCol = cIdx === 3;

                  return (
                    <td key={cIdx} className={`py-3.5 px-4 ${isLast ? 'text-right' : ''}`}>
                      {isLast ? (
                        <div className="inline-flex gap-2 justify-end">
                          <ShimmerText width="w-8" height="h-8" className="rounded-lg" />
                          <ShimmerText width="w-8" height="h-8" className="rounded-lg" />
                        </div>
                      ) : isFirst ? (
                        <div className="space-y-1">
                          <ShimmerText width="w-36" height="h-3.5" />
                          <ShimmerText width="w-20" height="h-2.5" />
                        </div>
                      ) : isBadgeCol ? (
                        <ShimmerText width="w-20" height="h-5" className="rounded-full" />
                      ) : (
                        <ShimmerText width={cIdx % 2 === 0 ? 'w-28' : 'w-40'} height="h-3" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs font-semibold mt-4">
          <div className="flex items-center gap-2">
            <ShimmerText width="w-56" height="h-3.5" />
          </div>
          <div className="flex items-center gap-3">
            <ShimmerText width="w-14" height="h-7" className="rounded-lg" />
            <ShimmerText width="w-16" height="h-7" className="rounded-lg" />
            <ShimmerText width="w-20" height="h-3.5" />
            <ShimmerText width="w-14" height="h-7" className="rounded-lg" />
            <ShimmerText width="w-14" height="h-7" className="rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
};

