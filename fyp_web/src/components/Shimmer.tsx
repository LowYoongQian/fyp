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

// Timetable skeletons: the picker, the semester list, the selected semester's page and its grid
// One loading region: a single "Loading ..." status for assistive technology, with every placeholder hidden from it and the content marked busy.
export const LoadingRegion: React.FC<{ label: string; className?: string; outerClassName?: string; children: React.ReactNode }> = ({ label, className = '', outerClassName, children }) => (
  <div role="status" aria-busy="true" aria-label={label.replace(/…$/, '')} className={outerClassName}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className={className}>{children}</div>
  </div>
);

const TIMETABLE_CARD = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 sm:p-6';

/** The admin's two selectors (Programme, Course) with their heading and help line. */
export const ShimmerTimetablePicker: React.FC = () => (
  <section className={`${TIMETABLE_CARD} space-y-4`}>
    <div className="space-y-2"><ShimmerText width="w-32" height="h-6" /><ShimmerText width="w-56" height="h-3.5" /></div>
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1].map(index => <div key={index} className="space-y-1.5"><ShimmerText width="w-20" height="h-3" /><ShimmerText height="h-11" className="rounded-xl" /></div>)}
    </div>
  </section>
);

/** The pending Course control alone, while its programme's courses load. */
export const ShimmerSelect: React.FC<{ label: string }> = ({ label }) => (
  <LoadingRegion label={label} className="space-y-1.5"><ShimmerText width="w-20" height="h-3" /><ShimmerText height="h-11" className="rounded-xl" /></LoadingRegion>
);

/** The semester rows of a list card: the same columns as SemesterList. */
export const ShimmerSemesterRows: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-1">
    <div className="hidden gap-3 border-b border-slate-200 px-3 pb-2 dark:border-slate-800 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_11rem]">
      {[0, 1, 2, 3, 4, 5, 6].map(index => <ShimmerText key={index} width={index === 6 ? 'w-16 justify-self-end' : 'w-14'} height="h-2.5" />)}
    </div>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="grid grid-cols-2 items-start gap-3 border-b border-slate-100 px-3 py-4 last:border-0 dark:border-slate-800 md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_11rem]">
        <div className="col-span-2 space-y-2 md:col-span-1"><ShimmerText width="w-3/4" height="h-4" /><ShimmerText width="w-1/3" height="h-2.5" /></div>
        <ShimmerText width="w-4/5" height="h-3.5" /><ShimmerText width="w-20" height="h-3.5" /><ShimmerText width="w-20" height="h-3.5" /><ShimmerText width="w-6" height="h-3.5" />
        <ShimmerText width="w-20" height="h-6" className="rounded-full" />
        <div className="col-span-2 md:col-span-1 md:justify-self-end"><ShimmerText width="w-full md:w-36" height="h-10" className="rounded-xl" /></div>
      </div>
    ))}
  </div>
);

/** A whole semester-list card (heading, help line, rows) for a list that is still loading. */
export const ShimmerSemesterList: React.FC = () => (
  <section className={`${TIMETABLE_CARD} space-y-5`}>
    <div className="flex items-start gap-3 border-b border-slate-200 pb-5 dark:border-slate-800">
      <ShimmerText width="w-10" height="h-10" className="shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2"><ShimmerText width="w-48" height="h-5" /><ShimmerText width="w-64" height="h-3" /></div>
    </div>
    <ShimmerSemesterRows />
  </section>
);

/** The weekly grid of one semester: weekday headings, the time column and empty rows. */
export const ShimmerTimetableGrid: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <div className="w-full rounded-xl border border-slate-200 px-2 pb-2.5 dark:border-slate-800">
    <div className="overflow-hidden pb-2">
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[80px_repeat(7,_minmax(0,1fr))] items-center gap-1 border-b border-slate-200 py-2.5 dark:border-slate-800">
          <ShimmerText width="w-10" height="h-2.5" className="mx-auto" />
          {Array.from({ length: 7 }).map((_, index) => <ShimmerText key={index} height="h-8" className="mx-1 rounded-lg" />)}
        </div>
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="grid h-[72px] grid-cols-[80px_repeat(7,_minmax(0,1fr))] divide-x divide-slate-100 border-b border-slate-100 last:border-0 dark:divide-slate-800 dark:border-slate-800">
            <div className="flex justify-end pr-3 pt-2"><ShimmerText width="w-8" height="h-2.5" /></div>
            {Array.from({ length: 7 }).map((__, column) => <div key={column} className="p-1">{row === 1 && column === 2 ? <ShimmerText height="h-full" className="rounded-lg" /> : null}</div>)}
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** A selected semester's whole page while access is checked: heading with Back, the toolbar card and the grid. No course content is drawn. */
export const ShimmerTimetableDetail: React.FC = () => (
  <div className="space-y-5 sm:space-y-6">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-blue-200/80 bg-white p-4 dark:border-blue-900/70 dark:bg-slate-900">
      <ShimmerText width="w-24" height="h-10" className="rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2"><ShimmerText width="w-48" height="h-4" /><ShimmerText width="w-2/3" height="h-3" /></div>
    </div>
    <div className={TIMETABLE_CARD}>
      <div className="mb-5 flex flex-col gap-5 border-b border-slate-200 pb-5 dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3.5">
          <ShimmerText width="w-14" height="h-14" className="shrink-0 rounded-xl" />
          <div className="space-y-2"><ShimmerText width="w-44" height="h-5" /><ShimmerText width="w-56" height="h-3" /></div>
        </div>
        <div className="flex flex-wrap gap-2.5"><ShimmerText width="w-64" height="h-10" className="rounded-xl" /><ShimmerText width="w-36" height="h-10" className="rounded-xl" /><ShimmerText width="w-24" height="h-10" className="rounded-xl" /></div>
      </div>
      <ShimmerTimetableGrid />
    </div>
  </div>
);

/** The page fallback for Timetable (lazy import or first access check): the shape of whichever view the address asks for. */
export const ShimmerTimetable: React.FC<{ admin?: boolean }> = ({ admin = false }) => {
  const params = new URLSearchParams(window.location.search);
  const semester = params.has('semester') && (!admin || (params.has('programme') && params.has('course')));
  return (
    <LoadingRegion label="Loading timetable…" className="space-y-5">
      {semester ? <ShimmerTimetableDetail />
        : admin ? <><ShimmerTimetablePicker />{params.has('programme') && params.has('course') && <ShimmerSemesterList />}</>
        : <ShimmerSemesterList />}
    </LoadingRegion>
  );
};

const academicsForm = (fields: number) => (
  <div className="uipro-card space-y-4 bg-white/80 p-5">
    <div className="flex items-center gap-2 border-b border-slate-100 pb-3"><ShimmerCircle size="w-5 h-5" /><ShimmerText width="w-1/2" height="h-3.5" /></div>
    <div className="space-y-4 pt-1">
      {Array.from({ length: fields }).map((_, index) => <div key={index} className="space-y-1.5"><ShimmerText width="w-1/3" height="h-2.5" /><ShimmerText height="h-10" className="rounded-xl" /></div>)}
      <ShimmerText height="h-10" className="rounded-xl" />
    </div>
  </div>
);

/** Academics before its first data arrives: heading with Sync, the five tabs, then the active tab's form and list in their real proportions. */
export const ShimmerAcademics: React.FC<{ tab?: string }> = ({ tab = 'programmes' }) => (
  <LoadingRegion label="Loading academics…" className="space-y-6">
    <div className="uipro-card flex flex-col items-start justify-between gap-4 bg-white/75 p-6 sm:flex-row sm:items-center">
      <div className="space-y-2"><ShimmerText width="w-40" height="h-6" /><ShimmerText width="w-72 max-w-full" height="h-3" /></div>
      <ShimmerText width="w-36" height="h-10" className="rounded-xl" />
    </div>
    <div className="flex max-w-2xl flex-wrap gap-1 rounded-xl border border-slate-200/50 p-1">
      {Array.from({ length: 5 }).map((_, index) => <ShimmerText key={index} width="flex-grow basis-24" height="h-9" className="rounded-lg" />)}
    </div>
    {tab === 'semesters' ? (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="uipro-card space-y-5 p-6">
          <div className="flex items-center gap-2"><ShimmerCircle size="w-5 h-5" /><ShimmerText width="w-1/2" height="h-4" /></div>
          {[0, 1, 2].map(index => <div key={index} className="space-y-2"><ShimmerText width="w-1/3" height="h-3" /><ShimmerText height="h-11" className="rounded-xl" /></div>)}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3"><ShimmerText height="h-12" className="rounded-lg" /><ShimmerText height="h-12" className="rounded-lg" /></div>
          <ShimmerText height="h-11" className="rounded-xl" />
        </div>
        <div className="uipro-card space-y-4 p-6 lg:col-span-2">
          <div className="flex items-center justify-between"><ShimmerText width="w-40" height="h-4" /><ShimmerCircle size="w-4 h-4" /></div>
          {[0, 1, 2].map(index => (
            <div key={index} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 p-5 sm:flex-row">
              <div className="space-y-2"><ShimmerText width="w-48" height="h-4" /><ShimmerText width="w-56" height="h-3" /><ShimmerText width="w-64" height="h-3" /><ShimmerText width="w-16" height="h-5" className="rounded-full" /></div>
              <ShimmerText width="w-20" height="h-9" className="rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {academicsForm(tab === 'students' ? 4 : tab === 'staff' ? 3 : 2)}
        <div className="uipro-card flex flex-col justify-between bg-white p-5 lg:col-span-2">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2"><ShimmerCircle size="w-5 h-5" /><div className="space-y-1.5"><ShimmerText width="w-28" height="h-3.5" /><ShimmerText width="w-16" height="h-2.5" /></div></div>
              <ShimmerText width="w-full sm:w-72" height="h-10" className="rounded-xl" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between rounded-xl border border-slate-200/50 p-3.5">
                  <div className="space-y-1.5"><ShimmerText width="w-16" height="h-3.5" /><ShimmerText width="w-40" height="h-3" /></div>
                  <ShimmerCircle size="w-8 h-8" className="rounded-lg" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <ShimmerText width="w-32" height="h-3" />
            <div className="flex items-center gap-2"><ShimmerText width="w-24" height="h-9" className="rounded-lg" /><ShimmerText width="w-20" height="h-3" /><ShimmerText width="w-16" height="h-9" className="rounded-lg" /></div>
          </div>
        </div>
      </div>
    )}
  </LoadingRegion>
);

/** The semester cards of Academics → Semesters while that list loads. */
export const ShimmerSemesterCards: React.FC = () => (
  <LoadingRegion label="Loading semesters…" className="space-y-4">
    {[0, 1].map(index => (
      <div key={index} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 p-5 sm:flex-row">
        <div className="space-y-2"><ShimmerText width="w-48" height="h-4" /><ShimmerText width="w-56" height="h-3" /><ShimmerText width="w-64" height="h-3" /><ShimmerText width="w-16" height="h-5" className="rounded-full" /></div>
        <ShimmerText width="w-20" height="h-9" className="rounded-xl" />
      </div>
    ))}
  </LoadingRegion>
);

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

        {/* Right Side: Performance Gauge, Class Overview, Announcements (Span 1) */}
        <div className="space-y-6">
          <div className="uipro-card bg-white p-5 flex flex-col items-center space-y-4">
            <ShimmerText width="w-1/2" height="h-4" className="self-start" />
            <ShimmerCircle size="w-32 h-20 rounded-t-full" />
            <ShimmerText width="w-1/4" height="h-5" />
            <ShimmerText width="w-2/3" height="h-3" />
          </div>

          {/* Class Overview Card */}
          <div className="uipro-card bg-white p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <ShimmerText width="w-1/2" height="h-4" />
              <ShimmerCircle size="w-8 h-8" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex h-14 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80">
                  <ShimmerText width="w-6" height="h-4" />
                  <ShimmerText width="w-10" height="h-2" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex min-h-[68px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <ShimmerText width="w-14" height="h-2.5" />
                      <ShimmerText width="w-16" height="h-3.5" className="rounded-md" />
                    </div>
                    <ShimmerText width="w-3/4" height="h-3" />
                    <ShimmerText width="w-1/3" height="h-2" />
                  </div>
                  <ShimmerText width="w-[54px]" height="h-8" className="shrink-0 rounded-lg" />
                </div>
              ))}
            </div>
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
    <div className="space-y-6" aria-busy="true" aria-label="Loading attendance analytics">
      <span className="sr-only" role="status">Loading attendance analytics</span>
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <ShimmerText width="w-48" height="h-6" />
          <ShimmerText width="w-72" height="h-3.5" />
        </div>
        <ShimmerText width="w-44" height="h-10" className="rounded-xl" />
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="uipro-card flex items-center gap-4 bg-white/80">
            <ShimmerCircle size="w-12 h-12 rounded-xl" />
            <div className="space-y-2 flex-grow">
              <ShimmerText width="w-2/3" height="h-2.5" />
              <ShimmerText width="w-1/2" height="h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Block */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Trend Area Chart placeholder */}
        <div className="uipro-card flex h-96 flex-col justify-between space-y-4 bg-white/80 p-6 xl:col-span-2">
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
        <div className="uipro-card flex h-96 flex-col justify-between bg-white/80 p-6">
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

      {/* Weekday rates and class groups */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="uipro-card flex h-72 flex-col justify-between space-y-4 bg-white/80 p-6 xl:col-span-2">
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

        <div className="uipro-card h-72 bg-white/80 p-6">
          <div className="border-b border-slate-100 pb-4">
            <ShimmerText width="w-1/2" height="h-4" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <ShimmerText width="w-14" height="h-3" />
                  <ShimmerText width="w-12" height="h-6" className="rounded-full" />
                </div>
                <div className="mt-3 flex gap-4">
                  <ShimmerText width="w-20" height="h-2.5" />
                  <ShimmerText width="w-28" height="h-2.5" />
                </div>
              </div>
            ))}
            </div>
        </div>
      </div>
    </div>
  );
};

// At-Risk skeleton: the real page's heading and action, four summary cards, risk register (filters, table, pagination) and dispatch log.
const AT_RISK_CARD = 'rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900';
export const ShimmerAtRisk: React.FC = () => (
  <LoadingRegion label="Loading at-risk students…" className="space-y-6">
    <div className={`${AT_RISK_CARD} flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center`}>
      <div className="flex-grow space-y-2.5">
        <ShimmerText width="w-2/5" height="h-6" />
        <ShimmerText width="w-1/2" height="h-3.5" />
      </div>
      <ShimmerText width="w-48" height="h-10" className="shrink-0 rounded-xl" />
    </div>

    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map(index => (
        <div key={index} className={`${AT_RISK_CARD} flex items-center gap-4 p-5`}>
          <ShimmerText width="w-11" height="h-11" className="shrink-0 rounded-xl" />
          <div className="flex-grow space-y-2"><ShimmerText width="w-10" height="h-6" /><ShimmerText width="w-24" height="h-2.5" /></div>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className={`${AT_RISK_CARD} flex flex-col justify-between overflow-hidden xl:col-span-2`}>
        <div>
          <div className="space-y-4 border-b border-slate-100 p-5 dark:border-slate-800/80">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3"><ShimmerText width="w-40" height="h-4" /><ShimmerText width="w-20" height="h-5" className="rounded-full" /></div>
              <ShimmerText width="w-64" height="h-8" className="rounded-xl" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ShimmerText width="w-64" height="h-9" className="rounded-xl" />
              <div className="flex gap-2.5"><ShimmerText width="w-40" height="h-9" className="rounded-xl" /><ShimmerText width="w-28" height="h-9" className="rounded-xl" /></div>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            <div className="flex items-center gap-6 bg-slate-50/70 px-5 py-3.5 dark:bg-slate-800/40">
              {['w-16', 'w-14', 'w-20', 'w-16', 'w-28'].map((width, index) => <ShimmerText key={index} width={width} height="h-2.5" />)}
            </div>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-6 px-5 py-3.5">
                <div className="space-y-1.5"><ShimmerText width="w-32" height="h-3.5" /><ShimmerText width="w-16" height="h-2.5" /></div>
                <ShimmerText width="w-16" height="h-3.5" />
                <ShimmerText width="w-12" height="h-3.5" />
                <ShimmerText width="w-16" height="h-5" className="rounded-full" />
                <ShimmerText width="w-40" height="h-3.5" className="hidden md:block" />
                <ShimmerText width="w-16" height="h-7" className="rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800/80 sm:flex-row">
          <ShimmerText width="w-48" height="h-3" />
          <div className="flex gap-1">{[0, 1, 2, 3].map(index => <ShimmerText key={index} width="w-7" height="h-7" className="rounded-lg" />)}</div>
        </div>
      </div>

      <div className={`${AT_RISK_CARD} space-y-4 p-5`}>
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5 dark:border-slate-800">
          <ShimmerText width="w-8" height="h-8" className="rounded-lg" /><ShimmerText width="w-36" height="h-3.5" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map(index => (
            <div key={index} className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center justify-between"><ShimmerText width="w-1/3" height="h-3" /><ShimmerText width="w-12" height="h-2.5" /></div>
              <ShimmerText width="w-full" height="h-3.5" /><ShimmerText width="w-1/2" height="h-2.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </LoadingRegion>
);

// Chat skeleton: the tools sidebar, open-chat tabs, thread header, message area and composer, in the loaded screen's own layout.
export const ShimmerChatbot: React.FC = () => (
  <LoadingRegion label="Loading AI Assistant…" outerClassName="flex min-h-0 w-full flex-1"
    className="relative flex h-full min-h-0 min-w-0 w-full flex-1 overflow-hidden bg-white dark:bg-slate-950">
    <div className="flex w-14 shrink-0 flex-col gap-3 border-r border-slate-200 bg-slate-50 px-2 py-3 dark:border-slate-800 dark:bg-slate-900">
      <ShimmerText width="w-full" height="h-10" className="rounded-xl" />
      <div className="space-y-1 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[0, 1, 2].map(index => <ShimmerText key={index} width="w-full" height="h-10" className="rounded-xl" />)}
      </div>
      <div className="mt-auto border-t border-slate-200 pt-3 dark:border-slate-800"><ShimmerText width="w-full" height="h-10" className="rounded-xl" /></div>
    </div>

    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex border-b border-slate-200 bg-slate-100 px-2 pt-2 dark:border-slate-700 dark:bg-slate-800">
          <ShimmerText width="w-48" height="h-10" className="rounded-b-none rounded-t-xl" />
        </div>
        <div className="px-4 py-2"><ShimmerText width="w-72" height="h-2.5" /></div>
      </div>

      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-3">
          <ShimmerText width="w-9" height="h-9" className="shrink-0 rounded-xl" />
          <div className="space-y-2"><ShimmerText width="w-44" height="h-3.5" /><ShimmerText width="w-56" height="h-2.5" /></div>
        </div>
        <ShimmerText width="w-44" height="h-6" className="hidden rounded-full sm:block" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-slate-50/20 p-6 dark:bg-slate-950/20">
        <div className="flex max-w-[85%] gap-3">
          <ShimmerCircle size="w-8 h-8 shrink-0" />
          <div className="w-full max-w-4xl space-y-2.5 rounded-2xl rounded-tl-none border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <ShimmerText width="w-full" height="h-3" />
            <ShimmerText width="w-11/12" height="h-3" />
            <ShimmerText width="w-2/5" height="h-3" />
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-3 border-t border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex gap-2 overflow-hidden pb-1">
          <ShimmerText width="w-56" height="h-7" className="shrink-0 rounded-full" />
          <ShimmerText width="w-64" height="h-7" className="shrink-0 rounded-full" />
          <ShimmerText width="w-72" height="h-7" className="hidden shrink-0 rounded-full md:block" />
          <ShimmerText width="w-64" height="h-7" className="hidden shrink-0 rounded-full xl:block" />
        </div>
        <div className="flex h-14 items-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ShimmerText width="w-2/5" height="h-3" className="ml-3" />
          <ShimmerText width="w-9" height="h-9" className="ml-auto mr-1 shrink-0 rounded-lg" />
        </div>
      </div>
    </div>
  </LoadingRegion>
);

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

// Network Security page: every part mirrors the real card it stands in for, so nothing jumps when the data arrives.
export const ShimmerNetworkHeader: React.FC = () => (
  <div className="uipro-card bg-white/75 backdrop-blur-md">
    <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div className="space-y-2"><ShimmerText width="w-44" height="h-6" /><ShimmerText width="w-80 max-w-full" height="h-3" /></div>
      <div className="flex items-center gap-2"><ShimmerText width="w-24" height="h-9" className="rounded-xl" /><ShimmerText width="w-28" height="h-9" className="rounded-xl" /></div>
    </div>
  </div>
);

/** The security-mode banner: icon tile, mode name with badge, one explanation line and the mode button. */
export const ShimmerNetworkMode: React.FC = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <ShimmerText width="w-11" height="h-11" className="shrink-0 rounded-xl" />
        <div className="space-y-2"><div className="flex items-center gap-2"><ShimmerText width="w-40" height="h-4" /><ShimmerText width="w-16" height="h-4" className="rounded-full" /></div><ShimmerText width="w-72 max-w-full" height="h-3" /></div>
      </div>
      <ShimmerText width="w-44" height="h-9" className="shrink-0 rounded-xl" />
    </div>
  </div>
);

/** The detected-connection card: status row, Wi-Fi tile, address lines and the whitelist button. */
export const ShimmerNetworkDetection: React.FC = () => (
  <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/90 p-4">
    <div className="flex items-center justify-between"><ShimmerText width="w-32" height="h-3" /><ShimmerText width="w-16" height="h-5" className="rounded" /></div>
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div className="flex items-center gap-3">
        <ShimmerText width="w-12" height="h-12" className="shrink-0 rounded-xl" />
        <div className="space-y-2"><ShimmerText width="w-56 max-w-full" height="h-4" /><ShimmerText width="w-72 max-w-full" height="h-3" /><ShimmerText width="w-48 max-w-full" height="h-2.5" /></div>
      </div>
      <ShimmerText width="w-40" height="h-9" className="shrink-0 rounded-xl" />
    </div>
  </div>
);

/** The four verification toggles, as the rows they will be. */
export const ShimmerNetworkRules: React.FC = () => (
  <div className="grid gap-3 md:grid-cols-2">
    {[0, 1, 2, 3].map(index => (
      <div key={index} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3.5">
        <div className="space-y-2"><ShimmerText width="w-40" height="h-3.5" /><ShimmerText width="w-56 max-w-full" height="h-2.5" /></div>
        <ShimmerText width="w-6" height="h-6" className="shrink-0 rounded-full" />
      </div>
    ))}
  </div>
);

/** The whole page, for the lazy import and any wait before the page's own parts exist. One status for assistive technology. */
export const ShimmerCampusNetwork: React.FC = () => (
  <LoadingRegion label="Loading network security…" className="space-y-6">
    <ShimmerNetworkHeader />
    <ShimmerNetworkMode />
    <div className="uipro-card space-y-4 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3"><ShimmerText width="w-9" height="h-9" className="rounded-xl" /><div className="space-y-2"><ShimmerText width="w-40" height="h-4" /><ShimmerText width="w-32" height="h-2.5" /></div></div>
      <ShimmerNetworkDetection />
    </div>
    <div className="uipro-card space-y-4 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2"><div className="space-y-2"><ShimmerText width="w-36" height="h-4" /><ShimmerText width="w-48" height="h-2.5" /></div><ShimmerText width="w-28" height="h-9" className="rounded-xl" /></div>
      <ShimmerNetworkRules />
    </div>
    <div className="uipro-card space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2"><div className="space-y-2"><ShimmerText width="w-40" height="h-4" /><ShimmerText width="w-52" height="h-2.5" /></div><ShimmerText width="w-64 max-w-full" height="h-9" className="rounded-xl" /></div>
      <ShimmerTableSkeleton headers={['Permission', 'Connection Name', 'Wi-Fi SSID', 'BSSID / MAC', 'Protocol / Subnet', 'Location', 'Actions']} rows={5} showPagination={false} />
    </div>
  </LoadingRegion>
);

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

// Profile Modal Shimmer Skeleton
export const ShimmerProfileModal: React.FC = () => {
  return (
    <div className="space-y-4 font-sans text-xs animate-in fade-in duration-200">
      {/* Avatar Header Shimmer */}
      <div className="flex items-center gap-4 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
        <ShimmerCircle size="w-14 h-14" />
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <ShimmerText width="w-32" height="h-4" />
            <ShimmerText width="w-16" height="h-4" className="rounded-full" />
          </div>
          <ShimmerText width="w-48" height="h-3" />
          <ShimmerText width="w-24" height="h-2.5" />
        </div>
      </div>

      {/* Info Rows Shimmer */}
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="p-3 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5 flex-grow">
              <ShimmerCircle size="w-4 h-4 shrink-0" />
              <ShimmerText width="w-36" height="h-3.5" />
            </div>
            <ShimmerText width="w-20" height="h-5" className="rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
};

// Settings Modal Shimmer Skeleton
export const ShimmerSettingsModal: React.FC = () => {
  return (
    <div className="space-y-4 font-sans text-xs animate-in fade-in duration-200">
      {/* Theme Section Shimmer */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
        <ShimmerText width="w-32" height="h-4" />
        <div className="grid grid-cols-3 gap-2 pt-1">
          <ShimmerText width="w-full" height="h-8" className="rounded-xl" />
          <ShimmerText width="w-full" height="h-8" className="rounded-xl" />
          <ShimmerText width="w-full" height="h-8" className="rounded-xl" />
        </div>
        <ShimmerText width="w-full" height="h-8" className="rounded-xl mt-2" />
      </div>

      {/* Notifications Section Shimmer */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
        <div className="flex justify-between items-center">
          <ShimmerText width="w-40" height="h-4" />
          <ShimmerText width="w-9" height="h-5" className="rounded-full" />
        </div>
        <div className="space-y-2 pt-1">
          <ShimmerText width="w-full" height="h-8" className="rounded-lg" />
          <ShimmerText width="w-full" height="h-8" className="rounded-lg" />
          <ShimmerText width="w-full" height="h-8" className="rounded-lg" />
        </div>
      </div>

      {/* Security Section Shimmer */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex justify-between items-center">
        <ShimmerText width="w-44" height="h-4" />
        <ShimmerText width="w-9" height="h-5" className="rounded-full" />
      </div>
    </div>
  );
};


/** True from 8 pm to 5 am in campus time, so the sign-in placeholder matches the sky the real page is about to show. */
const campusNight = () => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', hour12: false }).format(new Date())) % 24;
  return hour >= 20 || hour < 5;
};

/** The sign-in page while it, or the saved-session check, is loading: the real card's shape (logo, title, two fields, buttons, portal switch) and nothing from the signed-in app. */
export const ShimmerLogin: React.FC = () => (
  <div className={`flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 ${campusNight() ? 'bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900' : 'bg-gradient-to-b from-sky-400 via-sky-200 to-emerald-100'} dark:bg-gradient-to-b dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900`}>
    <LoadingRegion label="Loading sign-in…" outerClassName="w-full max-w-md" className="uipro-card w-full space-y-6 border border-white/60 bg-white/85 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/85">
      <div className="flex flex-col items-center space-y-3">
        <div className="shimmer-placeholder h-36 w-36 rounded-full sm:h-44 sm:w-44 md:h-48 md:w-48" />
        <ShimmerText width="w-72 max-w-full" height="h-8" />
        <ShimmerText width="w-28" height="h-6" className="rounded-full" />
      </div>
      <div className="space-y-4">
        {[0, 1].map(index => <div key={index} className="space-y-1.5"><ShimmerText width="w-24" height="h-3" /><ShimmerText height="h-11" className="rounded-xl" /></div>)}
        <div className="flex gap-3"><ShimmerText height="h-11" className="flex-1 rounded-xl" /><ShimmerText width="w-14" height="h-11" className="rounded-xl" /></div>
        <div className="flex items-center justify-between"><ShimmerText width="w-28" height="h-3.5" /><ShimmerText width="w-28" height="h-3.5" /></div>
      </div>
      <div className="border-t border-slate-100 pt-5 dark:border-slate-800"><ShimmerText height="h-11" className="rounded-xl" /></div>
    </LoadingRegion>
  </div>
);

/** Student dashboard skeleton: the real page's banner, three summary cards, notices, three chart cards and course list, built from the system shimmer. */
const STUDENT_CARD = 'uipro-card rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900/60';
export const ShimmerStudentDashboard: React.FC = () => (
  <LoadingRegion label="Loading your dashboard…" className="space-y-6 pb-12">
    {/* Next step */}
    <div className={`${STUDENT_CARD} flex items-center gap-3 p-4`}>
      <ShimmerCircle size="h-10 w-10 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2"><ShimmerText width="w-1/4" height="h-4" /><ShimmerText width="w-2/3" height="h-3" /></div>
    </div>
    {/* Welcome banner */}
    <div className={`${STUDENT_CARD} space-y-3 p-6`}>
      <ShimmerText width="w-32" height="h-6" className="rounded-full" />
      <ShimmerText width="w-1/2" height="h-8" />
      <div className="space-y-2"><ShimmerText width="w-2/5" height="h-3" /><ShimmerText width="w-1/3" height="h-3" /></div>
    </div>
    {/* Three summary cards */}
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {[0, 1, 2].map(index => (
        <div key={index} className={`${STUDENT_CARD} flex items-center justify-between p-5`}>
          <div className="min-w-0 flex-1 space-y-2"><ShimmerText width="w-1/2" height="h-2.5" /><ShimmerText width="w-1/3" height="h-8" /><ShimmerText width="w-2/3" height="h-2.5" /></div>
          <ShimmerCircle size="h-11 w-11 rounded-xl" />
        </div>
      ))}
    </div>
    {/* Notices */}
    <div className={`${STUDENT_CARD} p-5`}>
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <ShimmerCircle size="h-4 w-4" /><div className="space-y-1.5"><ShimmerText width="w-28" height="h-3.5" /><ShimmerText width="w-44" height="h-2.5" /></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {[0, 1].map(index => (
          <div key={index} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <ShimmerText width="w-16" height="h-4" className="rounded-full" /><ShimmerText width="w-3/4" height="h-3.5" /><ShimmerText width="w-full" height="h-3" /><ShimmerText width="w-5/6" height="h-3" />
          </div>
        ))}
      </div>
    </div>
    {/* Analytics */}
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between"><ShimmerText width="w-44" height="h-3.5" /><ShimmerText width="w-36" height="h-6" className="rounded-full" /></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={`${STUDENT_CARD} space-y-3 p-5 lg:col-span-2`}>
          <div className="space-y-2"><ShimmerText width="w-1/2" height="h-4" /><ShimmerText width="w-4/5" height="h-2.5" /></div>
          <ShimmerText height="h-60" className="rounded-xl" />
        </div>
        <div className={`${STUDENT_CARD} flex flex-col justify-between space-y-3 p-5`}>
          <div className="space-y-2"><ShimmerText width="w-2/3" height="h-4" /><ShimmerText width="w-1/2" height="h-2.5" /></div>
          <div className="flex h-44 items-center justify-center"><ShimmerCircle size="h-36 w-36" /></div>
          <div className="grid grid-cols-2 gap-2"><ShimmerText width="w-16" height="h-2.5" /><ShimmerText width="w-20" height="h-2.5" /><ShimmerText width="w-14" height="h-2.5" /></div>
        </div>
      </div>
      <div className={`${STUDENT_CARD} space-y-3 p-5`}>
        <div className="space-y-2"><ShimmerText width="w-1/3" height="h-4" /><ShimmerText width="w-1/2" height="h-2.5" /></div>
        <ShimmerText height="h-48" className="rounded-xl" />
      </div>
    </div>
    {/* Courses and guidelines */}
    <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <ShimmerText width="w-44" height="h-3.5" />
        {[0, 1].map(index => (
          <div key={index} className={`${STUDENT_CARD} flex items-center justify-between rounded-xl p-4`}>
            <div className="max-w-[70%] flex-1 space-y-2">
              <div className="flex items-center gap-2"><ShimmerText width="w-16" height="h-4" className="rounded-md" /><ShimmerText width="w-14" height="h-2.5" /></div>
              <ShimmerText width="w-3/4" height="h-3.5" /><ShimmerText width="w-1/2" height="h-2.5" />
            </div>
            <div className="space-y-2"><ShimmerText width="w-16" height="h-2.5" /><ShimmerText width="w-12" height="h-1.5" className="rounded-full" /></div>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <ShimmerText width="w-40" height="h-3.5" />
        <div className={`${STUDENT_CARD} space-y-3 p-5`}>
          <ShimmerText width="w-1/2" height="h-3" />
          {[0, 1, 2, 3].map(index => <ShimmerText key={index} width={index % 2 ? 'w-5/6' : 'w-full'} height="h-3" />)}
        </div>
      </div>
    </div>
  </LoadingRegion>
);
