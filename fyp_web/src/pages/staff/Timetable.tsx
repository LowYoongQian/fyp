import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Printer, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import { swalError, swalSuccess } from '../../utils/swal';
import type { Course } from '../../services/api';

const AttendancePieChart: React.FC<{ percentage: number }> = ({ percentage }) => {
  // Under 80% is red, under 90% is yellow, 90% and above is green
  let strokeColor = 'stroke-emerald-500'; // Green
  let textColorClass = 'text-emerald-600';

  if (percentage < 80) {
    strokeColor = 'stroke-rose-500'; // Red
    textColorClass = 'text-rose-600';
  } else if (percentage < 90) {
    strokeColor = 'stroke-amber-500'; // Yellow
    textColorClass = 'text-amber-500';
  }

  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center font-bold font-sans select-none shrink-0">
      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 40 40">
        {/* Background circle */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          className="stroke-slate-100 fill-none"
          strokeWidth="3.5"
        />
        {/* Foreground progress circle */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          className={`${strokeColor} fill-none transition-all duration-300`}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      {/* Centered text in the middle of the pie chart */}
      <span className={`absolute text-[9px] font-black tracking-tighter ${textColorClass}`}>
        {Math.round(percentage)}%
      </span>
    </div>
  );
};

interface TimetableEvent {
  id: number | string;
  meetingId?: number | string;   // class_meetings row id — present for admin, enables editing
  courseCode: string;
  courseName: string;
  group: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string; // "08:00"
  endTime: string;   // "10:00"
  room: string;
  lecturerName: string;
  type: 'normal' | 'replacement' | 'clashed';
}

const DAY_NAMES: TimetableEvent['day'][] =
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// GET /admin/timetable has no ORDER BY, and Postgres moves an updated row to the
// end of the heap — so the edited row jumped to the bottom of the table and the
// old position showed a DIFFERENT row, reading as "my edit did not apply".
// Display order is a display concern, so it is decided here, not by the scan order.
const byDayThenStart = (a: TimetableEvent, b: TimetableEvent) =>
  DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day) ||
  a.startTime.localeCompare(b.startTime);

const SEMESTER_START = new Date('2026-06-15T00:00:00');
const SEMESTER_END = new Date('2026-09-20T23:59:59');

// The grid only covers the teaching day, 08:00–22:00 (14 one-hour columns).
const GRID_START_HOUR = 8;
const GRID_END_HOUR = 22;
const WINDOW_START = GRID_START_HOUR * 60;
const WINDOW_END = GRID_END_HOUR * 60;

const toMinutes = (t?: string | null): number => {
  const [h, m] = (t || '').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const TIME_SLOTS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => {
  const h = GRID_START_HOUR + i;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { start: `${pad(h)}:00`, end: `${pad(h + 1)}:00` };
});

// One shared column definition — the header and the day rows must not drift
// apart. minmax(0,1fr) lets the 14 hours shrink to fit the viewport, so a
// desktop needs no horizontal scrollbar. Narrower than GRID_MIN_W the shrinking
// is capped instead (see GRID_MIN_W) and the wrapper scrolls.
const GRID_COLS = 'grid grid-cols-[76px_repeat(14,_minmax(0,1fr))]';

// 14 hours plus the day label cannot be legible on a phone: at 375px each hour
// would get ~21px. Below lg the grid keeps this width and its wrapper scrolls;
// from lg up the cap is released so the grid still fits the viewport exactly.
const GRID_MIN_W = 'min-w-[1000px] lg:min-w-0';

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getCurrentWeekNumber = (): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < SEMESTER_START) return 1;
  if (today > SEMESTER_END) return 14;
  
  const dayOffset = Math.floor((today.getTime() - SEMESTER_START.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(dayOffset / 7) + 1;
  return Math.min(14, Math.max(1, weekNum));
};

export const Timetable: React.FC = () => {
  const { user } = useAuth();
  const { alert: customAlert } = useDialog();
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [studentCourses, setStudentCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TimetableEvent | null>(null);
  const [editForm, setEditForm] = useState({ day: 'Monday', start: '08:00', end: '10:00', room: '' });
  const [saving, setSaving] = useState(false);

  const openEdit = (ev: TimetableEvent) => {
    setEditForm({ day: ev.day, start: ev.startTime, end: ev.endTime, room: ev.room });
    setEditing(ev);
  };

  const saveEdit = async () => {
    if (!editing?.meetingId) return;
    setSaving(true);
    try {
      await apiService.adminUpdateTimetableSlot(editing.meetingId, editForm);
      setEditing(null);
      await loadTimetable();
      // Toast, not a modal alert: the alert blocked the thread on a click before
      // the user could see the table it was reporting on.
      swalSuccess('Timetable slot updated', `${editForm.day} ${editForm.start}-${editForm.end}`);
    } catch (err: any) {
      swalError('Failed to update slot', err.response?.data?.detail || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setSelectedWeekNum(getCurrentWeekNumber());
  }, []);

  useEffect(() => {
    loadTimetable();
  }, [user]);

  const loadTimetable = async () => {
    setLoading(true);
    try {
      let mappedEvents: TimetableEvent[] = [];

      if (user?.role === 'admin') {
        const adminTimetable = await apiService.adminGetTimetable();
        mappedEvents = adminTimetable.map((slot: any) => ({
          id: slot.id,
          meetingId: slot.meeting_id,
          courseCode: slot.course_code,
          courseName: slot.course_name,
          group: slot.role || 'Lecture',
          day: (slot.schedule_day as any) || 'Monday',
          startTime: slot.schedule_start || '08:00',
          endTime: slot.schedule_end || '10:00',
          room: slot.schedule_room || 'Main Hall A',
          lecturerName: slot.lecturer_name || 'TBA',
          type: 'normal'
        }));

      } else if (user?.role === 'student') {
        const studentCoursesData = await apiService.studentGetCourses();
        setStudentCourses(studentCoursesData);
        mappedEvents = studentCoursesData.map(course => ({
          id: course.id,
          courseCode: course.course_code,
          courseName: course.course_name,
          group: course.role || 'Lecture',
          day: (course.schedule_day as any) || 'Monday',
          startTime: course.schedule_start || '08:00',
          endTime: course.schedule_end || '10:00',
          room: course.schedule_room || 'Main Hall A',
          lecturerName: course.lecturer_name || 'TBA',
          type: 'normal'
        }));

      } else {
        const lecturerTimetable = await apiService.getLecturerTimetable();
        mappedEvents = lecturerTimetable.map(slot => ({
          id: slot.id,
          courseCode: slot.course_code,
          courseName: slot.course_name,
          group: slot.role || 'Lecture',
          day: (slot.schedule_day as any) || 'Monday',
          startTime: slot.schedule_start || '08:00',
          endTime: slot.schedule_end || '10:00',
          room: slot.schedule_room || 'Main Hall A',
          lecturerName: slot.lecturer_name || 'TBA',
          type: 'normal'
        }));
      }

      setEvents(mappedEvents.sort(byDayThenStart));
    } catch (err) {
      console.error("Failed to load timetable events:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDaysForWeek = (weekNum: number) => {
    return DAY_NAMES.map((name, index) => {
      const dateOfCurrentDay = new Date(SEMESTER_START);
      dateOfCurrentDay.setDate(SEMESTER_START.getDate() + (weekNum - 1) * 7 + index);
      const dateStr = formatDate(dateOfCurrentDay);
      
      const dayObj: { name: string; label: string; date: string; holiday?: string } = {
        name,
        label: DAY_LABELS[index],
        date: dateStr
      };
      
      if (dateStr === '2026-06-17') {
        dayObj.holiday = 'Awal Muharram';
      }
      
      return dayObj;
    });
  };

  const days = getDaysForWeek(selectedWeekNum);

  const format12Hour = (timeStr?: string | null) => {
    if (!timeStr) return '';
    try {
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr);
      const m = parseInt(mStr);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const displayM = String(m).padStart(2, '0');
      return `${displayH}:${displayM} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  const getDurationStr = (start?: string | null, end?: string | null, role?: string | null) => {
    if (!start || !end) return '';
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const dur = (eh * 60 + em - (sh * 60 + sm)) / 60;
      const hrStr = dur === 1 ? 'hour' : 'hours';
      return `( ${role || 'Class'}: ${dur.toFixed(1)} ${hrStr} )`;
    } catch (e) {
      return '';
    }
  };

  const groupedCourses = React.useMemo(() => {
    if (user?.role !== 'student' || studentCourses.length === 0) return [];
    
    const groups: {
      [key: string]: {
        courseId: number | string;
        courseCode: string;
        courseName: string;
        attendanceRate: number;
        slots: {
          day: string;
          startTime: string;
          endTime: string;
          role: string;
          lecturerName: string;
        }[];
      };
    } = {};
    
    studentCourses.forEach(c => {
      const code = c.course_code;
      if (!groups[code]) {
        groups[code] = {
          courseId: c.course_id || c.id,
          courseCode: c.course_code,
          courseName: c.course_name,
          attendanceRate: c.attendance_rate !== undefined && c.attendance_rate !== null ? c.attendance_rate : 100.0,
          slots: []
        };
      }
      
      if (c.schedule_day && c.schedule_start && c.schedule_end) {
        groups[code].slots.push({
          day: c.schedule_day,
          startTime: c.schedule_start,
          endTime: c.schedule_end,
          role: c.role || 'Lecture',
          lecturerName: c.lecturer_name || 'TBA'
        });
      }
    });
    
    return Object.values(groups);
  }, [studentCourses, user]);

  const timeSlots = TIME_SLOTS;

  // Which columns this class occupies. Bounded to the grid it renders into: an
  // unbounded value produced a NEGATIVE grid line, and CSS counts those back
  // from the END of the row, so a 02:00 class landed on top of the 18:00 one.
  // The 08:00–22:00 window itself is enforced on the write path
  // (PUT /admin/timetable), so this bound only ever catches a violated invariant.
  const getGridPlacement = (startTime: string, endTime: string) => {
    const start = Math.min(Math.max(toMinutes(startTime), WINDOW_START), WINDOW_END - 60);
    const end = Math.min(Math.max(toMinutes(endTime), start + 60), WINDOW_END);
    return {
      gridStart: Math.round((start - WINDOW_START) / 60) + 2,
      gridSpan: Math.max(1, Math.round((end - start) / 60))
    };
  };

  const getEventsForDay = (dayName: string) => {
    return events.filter(e => e.day === dayName);
  };

  // Overlapping classes get their own lane (sub-row) so neither is hidden behind
  // the other. Lanes are packed left to right: an event reuses the first lane
  // whose previous event has already ended.
  const layoutDayEvents = (dayEvents: TimetableEvent[]) => {
    const lanes: number[] = [];
    const placed = dayEvents
      .map(ev => ({ ev, ...getGridPlacement(ev.startTime, ev.endTime) }))
      .sort((a, b) => a.gridStart - b.gridStart || a.gridSpan - b.gridSpan)
      .map(p => {
        let lane = lanes.findIndex(freeFrom => freeFrom <= p.gridStart);
        if (lane === -1) lane = lanes.length;
        lanes[lane] = p.gridStart + p.gridSpan;
        return { ...p, lane };
      });
    return { placed, laneCount: Math.max(1, lanes.length) };
  };

  const getEventStyles = (type: 'normal' | 'replacement' | 'clashed') => {
    switch (type) {
      case 'clashed':
        return 'bg-red-800 text-white border-red-950 hover:bg-red-900 focus:ring-red-700/50';
      case 'replacement':
        return 'bg-amber-700 text-white border-amber-850 hover:bg-amber-800 focus:ring-amber-600/50';
      case 'normal':
      default:
        return 'bg-emerald-700 text-white border-emerald-900 hover:bg-emerald-800 focus:ring-emerald-600/50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Timetable Header / Note */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3 text-xs text-sky-700 shadow-sm">
        <AlertTriangle className="h-4.5 w-4.5 text-sky-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold uppercase tracking-wider block">Note:</span>
          <span>Please approach your faculty for further assistance if there is any missing/clashed/incorrect class timetable.</span>
        </div>
      </div>

      {/* Week & Campus Banner */}
      <div className={`uipro-card bg-white/75 relative flex flex-col md:flex-row md:items-center justify-between gap-4 ${isWeekDropdownOpen ? 'z-50' : 'z-10'}`}>
        <div className="space-y-2">
          <h2 className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">
            Kuala Lumpur Campus
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            202605 Semester (Monday, 2026-06-15 – Sunday, 2026-09-20)
          </p>
          
          {/* Week Selector Dropdown */}
          <div className="pt-2">
            {isWeekDropdownOpen && (
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setIsWeekDropdownOpen(false)} 
              />
            )}
            
            <div className={`relative inline-block ${isWeekDropdownOpen ? 'z-50' : 'z-45'}`}>
              <button
                type="button"
                onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
                className="min-w-[220px] py-1.5 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100/50 transition-all cursor-pointer"
              >
                <span className="truncate">
                  Week {selectedWeekNum} : {(() => {
                    const monday = new Date(SEMESTER_START);
                    monday.setDate(SEMESTER_START.getDate() + (selectedWeekNum - 1) * 7);
                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    return `${formatDate(monday)} ~ ${formatDate(sunday)}`;
                  })()}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
              </button>
              
              {isWeekDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 max-h-60 overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in duration-100">
                  {Array.from({ length: 14 }, (_, i) => {
                    const w = i + 1;
                    const monday = new Date(SEMESTER_START);
                    monday.setDate(SEMESTER_START.getDate() + (w - 1) * 7);
                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          setSelectedWeekNum(w);
                          setIsWeekDropdownOpen(false);
                        }}
                        className={`group w-full text-left px-4 py-2 text-xs text-slate-750 hover:bg-brand-blue hover:text-white transition-all flex flex-col gap-0.5 border-b border-slate-100 last:border-b-0 cursor-pointer ${
                          selectedWeekNum === w ? 'bg-slate-50 font-bold' : ''
                        }`}
                      >
                        <span className="font-semibold group-hover:text-white/90 transition-colors">Week {w}</span>
                        <span className="text-[10px] text-slate-500 group-hover:text-white/80 transition-colors truncate">
                          {formatDate(monday)} ~ {formatDate(sunday)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buttons on Right */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => customAlert('Preparing print layout... (Simulated PDF download)', 'Print Timetable')}
            className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200/50 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-650 cursor-pointer transition-all"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          
          <div className="flex items-center gap-1 bg-white border border-slate-200 shadow-2xs p-1 rounded-lg">
            <button 
              onClick={() => setSelectedWeekNum(prev => Math.max(1, prev - 1))}
              disabled={selectedWeekNum <= 1}
              className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-650 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[11px] font-bold text-slate-600 px-2.5 shrink-0">Prev / Next</span>
            <button 
              onClick={() => setSelectedWeekNum(prev => Math.min(14, prev + 1))}
              disabled={selectedWeekNum >= 14}
              className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-650 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
          Semester Timetable By Week & Date :
        </h3>
        {loading ? (
          <div className="uipro-card bg-white/75 p-20 flex flex-col justify-center items-center gap-3 text-slate-400 font-sans text-xs border border-slate-200">
            <Loader2 className="h-8 w-8 text-brand-blue animate-spin" />
            <span>Synchronizing academic schedules...</span>
          </div>
        ) : (
          <div className="uipro-card bg-white/75 p-5 border border-slate-200 shadow-premium">
            <div className="w-full overflow-x-auto">
              <div className={`w-full ${GRID_MIN_W} rounded-xl border border-slate-150 overflow-hidden`}>
              {/* Swapped Timetable Grid Layout */}
              <div className={`${GRID_COLS} border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-600`}>

                {/* Top Left Day/Time Cell */}
                <div className="row-span-2 border-r border-b border-slate-200 flex flex-col items-center justify-center p-2 text-[10px] font-bold text-slate-450 uppercase tracking-wider leading-tight">
                  <div>Day /</div>
                  <div>Time</div>
                </div>

                {/* Top Row Time Slots — 24-hour, so 12:00 is followed by 13:00 */}
                {timeSlots.map((slot, idx) => (
                  <div key={idx} className="py-1.5 border-r border-slate-200/70 border-b border-slate-100/50 flex items-center justify-center font-mono text-[10px]">
                    {slot.start}
                  </div>
                ))}

                {/* Bottom Row Time Slots */}
                {timeSlots.map((slot, idx) => (
                  <div key={idx} className="py-1.5 border-r border-slate-200/70 border-b border-slate-200 flex items-center justify-center font-mono text-[10px] text-slate-400">
                    {slot.end}
                  </div>
                ))}
              </div>

              {/* Timetable Rows (Days of the week) */}
              <div className="divide-y divide-slate-200 bg-white">
                {days.map((day) => {
                  const { placed, laneCount } = layoutDayEvents(getEventsForDay(day.name));
                  return (
                    <div
                      key={day.name}
                      className={`${GRID_COLS} relative`}
                      style={{ gridAutoRows: 'minmax(132px, auto)' }}
                    >
                      {/* Left Column Day Label */}
                      <div
                        style={{
                          gridColumnStart: 1,
                          gridRow: `1 / span ${laneCount}`,
                        }}
                        className="border-r border-slate-200 bg-slate-50/50 px-1.5 py-3 flex flex-col items-center justify-center text-center"
                      >
                        <span className="font-extrabold text-slate-800 text-sm leading-tight">{day.label}</span>
                        <span className="text-[9px] text-slate-450 font-semibold font-sans tracking-tight mt-0.5">{day.date}</span>
                        {day.holiday && (
                          <span className="text-[8px] font-bold text-red-500 uppercase tracking-tight leading-tight mt-1 animate-pulse">
                            {day.holiday}
                          </span>
                        )}
                      </div>

                      {/* 14 Background Empty Slots, spanning every lane of the day */}
                      {timeSlots.map((_, i) => (
                        <div
                          key={i}
                          style={{
                            gridColumnStart: i + 2,
                            gridRow: `1 / span ${laneCount}`,
                          }}
                          className={`border-r border-slate-150/45 ${
                            day.holiday ? 'bg-red-500/[0.015]' : ''
                          }`}
                        />
                      ))}

                      {/* Events. Overlapping ones sit in separate lanes, so none is hidden. */}
                      {placed.map(({ ev: event, gridStart, gridSpan, lane }) => {
                        return (
                          <div
                            key={event.id}
                            style={{
                              gridColumnStart: gridStart,
                              gridColumnEnd: `span ${gridSpan}`,
                              gridRow: lane + 1,
                              zIndex: 10,
                            }}
                            className="p-0.5 h-full"
                          >
                            <div
                              className={`h-full rounded-md border px-1 py-1 flex flex-col justify-between gap-1 transition-all duration-200 cursor-pointer shadow-sm select-none ${getEventStyles(event.type)}`}
                            >
                              <div className="space-y-0.5">
                                {/* The code already carries the type in "(P)", so a PRACTICAL
                                    badge beside it spent half the line width on the same fact. */}
                                <div className="text-[9px] font-black font-mono tracking-wider opacity-90">
                                  {event.courseCode} ({event.group === 'Replacement' ? 'R' : event.group.charAt(0)})
                                </div>
                                {/* No line-clamp: a clamp is an upper bound, so the row could
                                    never grow to fit the name. gridAutoRows is minmax(_, auto),
                                    so letting the name wrap makes the row taller instead. */}
                                <h4 className="text-[10.5px] font-extrabold leading-snug text-white break-words">
                                  {event.courseName}
                                </h4>
                              </div>

                              {/* One field per line. Sharing a line halved an already ~60px
                                  column, which is what cut "Theatre 2" down to "Theatr...". */}
                              <div className="space-y-0.5 text-[8.5px] opacity-90 font-medium pt-0.5 border-t border-white/10">
                                <div className="font-mono">{event.startTime} - {event.endTime}</div>
                                <div className="truncate">{event.room}</div>
                                <div className="truncate font-semibold">
                                  {event.lecturerName.split(' ').slice(1).join(' ')}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Timetable Colors Legend */}
      <div className="uipro-card bg-white/75 p-5">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-150">
          Timetable Classification Legend
        </h4>
        <div className="flex flex-wrap items-center gap-6 pt-3 text-xs font-semibold text-slate-650">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-700 border border-emerald-900" />
            <span>Normal Class</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-amber-700 border border-amber-800" />
            <span>Replacement Class</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-red-800 border border-red-900" />
            <span>Clashed Class / Class on Public Holiday</span>
          </div>
        </div>
      </div>

      {/* Semester Timetable By Course Table */}
      {user?.role === 'student' && (
        <div className="uipro-card bg-white/75 p-5 border border-slate-200 shadow-premium space-y-4">
          <h3 className="text-xs font-bold text-slate-705 uppercase tracking-wider pb-3 border-b border-slate-100">
            Semester Timetable By Course :
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 w-1/3">Course</th>
                  <th className="py-3 px-4">Day & Time (Duration)</th>
                  <th className="py-3 px-4">Lecturer/Instructor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150/50 text-xs text-slate-700 bg-white">
                {groupedCourses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 font-semibold uppercase tracking-wider">
                      No enrolled courses found.
                    </td>
                  </tr>
                ) : (
                  groupedCourses.map((c, index) => (
                    <tr key={c.courseCode} className="hover:bg-slate-50/30 transition-colors align-top">
                      <td className="py-4 px-4 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <AttendancePieChart percentage={c.attendanceRate} />
                          <span className="font-extrabold text-slate-800 font-mono tracking-wider">{c.courseCode}</span>
                          <span className="font-bold text-slate-650">{c.courseName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 space-y-2">
                        {c.slots.length === 0 ? (
                          <div className="text-slate-400 font-bold italic">
                            Course Without Class ( Project/Industrial Training Class )
                          </div>
                        ) : (
                          c.slots.map((s, idx) => (
                            <div key={idx} className="font-semibold text-slate-600">
                              <span className="font-extrabold text-slate-700">{s.day.substring(0, 3)}</span>
                              <span> , </span>
                              <span>{format12Hour(s.startTime)} - {format12Hour(s.endTime)}</span>
                              <span className="text-slate-400 ml-1.5 font-medium">{getDurationStr(s.startTime, s.endTime, s.role)}</span>
                            </div>
                          ))
                        )}
                      </td>
                      <td className="py-4 px-4 space-y-2">
                        {c.slots.length === 0 ? (
                          <div className="font-bold text-slate-700">
                            {studentCourses.find(sc => sc.course_code === c.courseCode)?.lecturer_name || 'TBA'}
                          </div>
                        ) : (
                          Array.from(new Set(c.slots.map(s => s.lecturerName))).map((instructor, idx) => (
                            <div key={idx} className="font-bold text-slate-700">
                              {instructor}
                            </div>
                          ))
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="uipro-card bg-white/75 p-5 border border-slate-200 shadow-premium space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-3 border-b border-slate-100">
            Manage Class Times :
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Day & Time</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150/50 text-xs text-slate-700 bg-white">
                {events.map(ev => (
                  <tr key={ev.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-extrabold font-mono tracking-wider">{ev.courseCode}</span>
                      <span className="font-bold text-slate-500 ml-2">{ev.courseName}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold">{ev.group}</td>
                    <td className="py-3 px-4 font-semibold">{ev.day.substring(0, 3)} {ev.startTime}-{ev.endTime}</td>
                    <td className="py-3 px-4 font-semibold">{ev.room}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => openEdit(ev)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-[11px] font-bold hover:bg-slate-700 transition-colors">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-800">
              Edit {editing.group} — {editing.courseCode}
            </h3>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase">Day</span>
                <select value={editForm.day} onChange={e => setEditForm({ ...editForm, day: e.target.value })}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="text-xs font-bold text-slate-500 uppercase">Start</span>
                  <input type="time" min="08:00" max="21:00" value={editForm.start}
                    onChange={e => setEditForm({ ...editForm, start: e.target.value })}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
                </label>
                <label className="flex-1">
                  <span className="text-xs font-bold text-slate-500 uppercase">End</span>
                  <input type="time" min="09:00" max="22:00" value={editForm.end}
                    onChange={e => setEditForm({ ...editForm, end: e.target.value })}
                    className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase">Room</span>
                <input type="text" value={editForm.room} onChange={e => setEditForm({ ...editForm, room: e.target.value })}
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} disabled={saving}
                className="px-4 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100">Cancel</button>
              <button onClick={saveEdit} disabled={saving}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
