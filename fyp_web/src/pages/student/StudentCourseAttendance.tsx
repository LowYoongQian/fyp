import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, MapPin, Printer, RefreshCw } from 'lucide-react';
import { apiService } from '../../services/api';
import type { StudentAttendanceSession } from '../../services/api';
import { swalError, swalSuccess } from '../../utils/swal';

type Props = {
  courseCode: string;
  courseName: string;
  onBack: () => void;
};

const PAGE_SIZE = 8;

const paginationItems = (total: number, current: number): Array<number | string> => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 'end-gap', total];
  if (current >= total - 3) return [1, 'start-gap', total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'start-gap', current - 1, current, current + 1, 'end-gap', total];
};

const value = (raw: unknown) => String(raw ?? '').trim() || '—';

const dateTime = (raw: string | null) => {
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const normaliseStatus = (status: unknown): 'present' | 'absent' | 'leave' => {
  const normal = String(status ?? '').trim().toLowerCase().replaceAll(' ', '_');
  if (normal === 'present' || normal === 'verified') return 'present';
  if (normal === 'leave' || normal === 'on_leave' || normal === 'excused') return 'leave';
  return 'absent';
};

const statusStyle = (status: unknown) => {
  const normal = normaliseStatus(status);
  if (normal === 'present') return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800';
  if (normal === 'leave') return 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
  return 'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800';
};

const statusLabel = (status: unknown) => {
  const normal = normaliseStatus(status);
  if (normal === 'leave') return 'On Leave';
  return normal === 'present' ? 'Present' : 'Absent';
};

const sessionMinutes = (row: StudentAttendanceSession) => {
  if (!row.opened_at || !row.closed_at) return 0;
  const start = new Date(row.opened_at).getTime();
  const end = new Date(row.closed_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / 60000;
};

export const StudentCourseAttendance: React.FC<Props> = ({ courseCode, courseName, onBack }) => {
  const [rows, setRows] = useState<StudentAttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [renderVersion, setRenderVersion] = useState(0);
  const [printing, setPrinting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.studentGetAttendanceSessions();
      const courseRows = data.filter(
        row => row.course_code.toUpperCase() === courseCode.toUpperCase(),
      );
      setCurrentPage(1);
      setRows(courseRows);
      setRenderVersion(version => version + 1);
    } catch {
      setRows([]);
      setRenderVersion(version => version + 1);
      setError('Could not load records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [courseCode]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const firstRow = (page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(firstRow, firstRow + PAGE_SIZE);
  const counts = rows.reduce(
    (totals, row) => {
      totals[normaliseStatus(row.status)] += 1;
      return totals;
    },
    { present: 0, absent: 0, leave: 0 },
  );
  const minutes = rows.reduce(
    (totals, row) => {
      totals[normaliseStatus(row.status)] += sessionMinutes(row);
      return totals;
    },
    { present: 0, absent: 0, leave: 0 },
  );
  const countedMinutes = minutes.present + minutes.leave + minutes.absent;
  const attendanceRate = countedMinutes > 0
    ? ((minutes.present + minutes.leave) / countedMinutes) * 100
    : 0;

  const handlePrint = async () => {
    if (printing || rows.length === 0) return;
    setPrinting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const clean = (raw: unknown) => value(raw).normalize('NFKD').replace(/[^\x20-\x7E]/g, '').trim();
      const columns = [14, 25, 68, 108, 138, 165, 213];
      const drawHeader = (continued = false) => {
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 297, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.text(`${courseCode} Attendance${continued ? ' - Continued' : ''}`, 14, 14);
        doc.setFontSize(9);
        doc.text(`${clean(courseName)}  |  Overall: ${attendanceRate.toFixed(1)}%`, 14, 22);
        doc.setFillColor(241, 245, 249);
        doc.rect(10, 36, 277, 10, 'F');
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(7);
        ['NO.', 'CLASS DATE / TIME', 'STAFF', 'ROLE', 'STATUS', 'TAKEN BY / TIME', 'LOCATION / NETWORK'].forEach((label, index) => doc.text(label, columns[index], 42));
      };
      drawHeader();
      let y = 54;
      rows.forEach((row, index) => {
        if (y > 187) {
          doc.addPage('a4', 'landscape');
          drawHeader(true);
          y = 54;
        }
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(10, y - 5, 277, 17, 'F');
        }
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        const cells = [
          `${index + 1}`,
          `${dateTime(row.opened_at)}\nEnds ${dateTime(row.closed_at)}`,
          clean(row.staff_name),
          `${clean(row.staff_role)}\n${clean(row.class_group)}`,
          statusLabel(row.status),
          `${clean(row.taken_by)}\n${dateTime(row.taken_at)}`,
          `${clean(row.room)}\nNetwork: ${clean(row.network_ip)} | Device: ${clean(row.device_ip)}`,
        ];
        const widths = [8, 38, 35, 25, 22, 43, 70];
        cells.forEach((cell, cellIndex) => doc.text(doc.splitTextToSize(clean(cell), widths[cellIndex]).slice(0, 2), columns[cellIndex], y));
        y += 17;
      });
      const pages = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
        doc.setPage(pageNumber);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text('Smart Attendance System', 14, 202);
        doc.text(`Page ${pageNumber} of ${pages}`, 283, 202, { align: 'right' });
      }
      doc.save(`${courseCode.toLowerCase()}-attendance-records.pdf`);
      void swalSuccess('Print successful', 'PDF downloaded.');
    } catch {
      void swalError('Print failed', 'Try again.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="uipro-card border border-slate-200 bg-white/90 p-5 shadow-premium dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onBack} aria-label="Back to timetable" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-brand-blue dark:border-slate-700 dark:text-slate-300 dark:hover:bg-blue-950/40">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue">Attendance Records</p>
              <h1 className="truncate text-xl font-black text-slate-900 dark:text-white">{courseCode}</h1>
              <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{courseName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePrint} disabled={loading || printing || rows.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Printer className="h-4 w-4" /> {printing ? 'Printing...' : 'Print'}
            </button>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-brand-blue disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
        <div
          key={`attendance-summary-${renderVersion}-${rows.length}-${counts.present}-${counts.absent}-${counts.leave}`}
          className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {[
            ['Present', counts.present, 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'],
            ['Absent', counts.absent, 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'],
            ['On Leave', counts.leave, 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'],
            ['Overall Rate', `${attendanceRate.toFixed(1)}%`, 'border-blue-200 bg-blue-50 text-brand-blue dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'],
          ].map(([label, count, color]) => (
            <div key={String(label)} className={`rounded-2xl border p-3 sm:p-4 ${color}`}>
              <div className="text-xl font-black">{count}</div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="uipro-card overflow-hidden border border-slate-200 bg-white shadow-premium dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="overflow-hidden" aria-label="Loading attendance records">
            <div className="flex h-12 min-w-[900px] items-center gap-8 border-b border-slate-200 bg-slate-50 px-5 dark:border-slate-800 dark:bg-slate-800/70">
              {[48, 180, 110, 80, 90, 150, 180].map((width, index) => (
                <div key={index} style={{ width }} className="h-2.5 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              ))}
            </div>
            <div className="space-y-0 px-5">
              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex h-[76px] min-w-[900px] items-center gap-8 border-b border-slate-100 dark:border-slate-800">
                  {[48, 180, 110, 80, 90, 150, 180].map((width, cellIndex) => (
                    <div key={cellIndex} style={{ width }} className="shrink-0 space-y-2">
                      <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                      {cellIndex > 0 && <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-5 py-20 text-center">
            <CalendarDays className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{error}</p>
            <button type="button" onClick={() => void load()} className="rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white">Try Again</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-20 text-center">
            <CalendarDays className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No attendance records</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-4 text-center">No.</th>
                  <th className="px-4 py-4">Class Date & Time</th>
                  <th className="px-4 py-4">Staff</th>
                  <th className="px-4 py-4">Role</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Taken By / Time</th>
                  <th className="px-4 py-4">Location / Network</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 dark:divide-slate-800 dark:text-slate-200">
                {pageRows.map((row, index) => (
                  <tr key={String(row.session_id)} className="align-top transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20">
                    <td className="px-4 py-4 text-center font-black text-slate-400">{firstRow + index + 1}</td>
                    <td className="px-4 py-4"><div className="font-bold">{dateTime(row.opened_at)}</div><div className="mt-1 text-[10px] text-slate-400">Ends {dateTime(row.closed_at)}</div></td>
                    <td className="px-4 py-4 font-bold">{value(row.staff_name)}</td>
                    <td className="px-4 py-4"><div className="font-bold">{value(row.staff_role)}</div><div className="mt-1 text-[10px] text-slate-400">{value(row.class_group)}</div></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ring-inset ${statusStyle(row.status)}`}>{statusLabel(row.status)}</span></td>
                    <td className="px-4 py-4"><div className="font-bold">{value(row.taken_by)}</div><div className="mt-1 text-[10px] text-slate-400">{dateTime(row.taken_at)}</div></td>
                    <td className="px-4 py-4"><div className="flex items-center gap-1.5 font-bold"><MapPin className="h-3.5 w-3.5 text-brand-blue" />{value(row.room)}</div><div className="mt-1 text-[10px] text-slate-500">Network: {value(row.network_ip)}</div><div className="text-[10px] text-slate-500">Device: {value(row.device_ip)}</div></td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-[11px] font-semibold text-slate-500 sm:text-left dark:text-slate-400">
                Showing {firstRow + 1}–{Math.min(firstRow + PAGE_SIZE, rows.length)} of {rows.length}
              </p>
              <nav className="flex items-center justify-center gap-1.5" aria-label="Attendance pages">
                <button
                  type="button"
                  onClick={() => setCurrentPage(value => Math.max(1, value - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {paginationItems(totalPages, page).map(item => typeof item === 'number' ? (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      aria-current={item === page ? 'page' : undefined}
                      aria-label={`Page ${item}`}
                      className={`h-9 min-w-9 rounded-xl px-2 text-xs font-extrabold transition ${item === page ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-brand-blue dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item} className="flex h-9 min-w-6 items-center justify-center text-xs font-bold text-slate-400">…</span>
                  ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage(value => Math.min(totalPages, value + 1))}
                  disabled={page === totalPages}
                  aria-label="Next page"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
