import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Printer, AlertTriangle, Loader2, ChevronDown, Search, Filter, CalendarX2, GraduationCap, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { useDialog } from '../../context/DialogContext';
import { swalError, swalSuccess } from '../../utils/swal';
import type { Course, Programme } from '../../services/api';

const AttendancePieChart: React.FC<{ percentage: number }> = ({ percentage }) => {
  let strokeColor = 'stroke-emerald-500';
  let textColorClass = 'text-emerald-600';

  if (percentage < 80) {
    strokeColor = 'stroke-rose-500';
    textColorClass = 'text-rose-600';
  } else if (percentage < 90) {
    strokeColor = 'stroke-amber-500';
    textColorClass = 'text-amber-500';
  }

  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center font-bold font-sans select-none shrink-0">
      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={radius} className="stroke-slate-100 fill-none" strokeWidth="3.5" />
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
      <span className={`absolute text-[9px] font-black tracking-tighter ${textColorClass}`}>
        {Math.round(percentage)}%
      </span>
    </div>
  );
};

interface TimetableEvent {
  id: number | string;
  meetingId?: number | string;
  courseCode: string;
  courseName: string;
  group: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string;
  endTime: string;
  room: string;
  lecturerName: string;
  type: 'normal' | 'replacement' | 'clashed';
  programmeId?: number | string | null;
  programmeName?: string | null;
}

const DAY_NAMES: TimetableEvent['day'][] =
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const byDayThenStart = (a: TimetableEvent, b: TimetableEvent) =>
  DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day) ||
  a.startTime.localeCompare(b.startTime);

const SEMESTER_START = new Date('2026-06-15T00:00:00');
const SEMESTER_END = new Date('2026-09-20T23:59:59');

const toMinutes = (t?: string | null): number => {
  const [h, m] = (t || '').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getMalaysiaDate = (): Date => {
  try {
    const now = new Date();
    const msiaStr = now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" });
    const parsed = new Date(msiaStr);
    if (parsed < SEMESTER_START || parsed > SEMESTER_END) {
      return new Date('2026-08-05T00:00:00');
    }
    return parsed;
  } catch (e) {
    return new Date('2026-08-05T00:00:00');
  }
};

const getCurrentWeekNumber = (): number => {
  const today = getMalaysiaDate();
  today.setHours(0, 0, 0, 0);
  if (today < SEMESTER_START) return 1;
  if (today > SEMESTER_END) return 14;
  
  const dayOffset = Math.floor((today.getTime() - SEMESTER_START.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(dayOffset / 7) + 1;
  return Math.min(14, Math.max(1, weekNum));
};

const getWeekNumForDate = (dateObj: Date): number => {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  const start = new Date(SEMESTER_START);
  start.setHours(0, 0, 0, 0);
  if (d < start) return 1;
  const dayOffset = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(dayOffset / 7) + 1;
  return Math.min(14, Math.max(1, weekNum));
};

const getClassPalette = (group: string) => {
  const g = (group || '').trim().toLowerCase();
  if (g.startsWith('l') || g.includes('lecture')) {
    // Lecture: Light Blue with dark mode support
    return {
      bg: 'bg-sky-100/90 hover:bg-sky-200/95 dark:bg-sky-950/80 dark:hover:bg-sky-900/90 backdrop-blur-xs',
      border: 'border-sky-300 dark:border-sky-700',
      text: 'text-sky-950 dark:text-sky-100 font-bold',
      title: 'text-sky-950 dark:text-white font-black',
      badge: 'bg-sky-200/90 dark:bg-sky-900 text-sky-950 dark:text-sky-100 font-bold',
      dot: 'bg-sky-600 dark:bg-sky-400',
    };
  } else if (g.startsWith('t') || g.includes('tutor')) {
    // Tutorial: Light Dark Green / Soft Emerald with dark mode support
    return {
      bg: 'bg-emerald-100/90 hover:bg-emerald-200/95 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/90 backdrop-blur-xs',
      border: 'border-emerald-300 dark:border-emerald-700',
      text: 'text-emerald-950 dark:text-emerald-100 font-bold',
      title: 'text-emerald-950 dark:text-white font-black',
      badge: 'bg-emerald-200/90 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100 font-bold',
      dot: 'bg-emerald-600 dark:bg-emerald-400',
    };
  } else if (g.startsWith('p') || g.includes('practic') || g.includes('lab')) {
    // Practical: Purple with dark mode support
    return {
      bg: 'bg-purple-100/90 hover:bg-purple-200/95 dark:bg-purple-950/80 dark:hover:bg-purple-900/90 backdrop-blur-xs',
      border: 'border-purple-300 dark:border-purple-700',
      text: 'text-purple-950 dark:text-purple-100 font-bold',
      title: 'text-purple-950 dark:text-white font-black',
      badge: 'bg-purple-200/90 dark:bg-purple-900 text-purple-950 dark:text-purple-100 font-bold',
      dot: 'bg-purple-600 dark:bg-purple-400',
    };
  }
  // Default: Light Blue
  return {
    bg: 'bg-sky-100/90 hover:bg-sky-200/95 dark:bg-sky-950/80 dark:hover:bg-sky-900/90 backdrop-blur-xs',
    border: 'border-sky-300 dark:border-sky-700',
    text: 'text-sky-950 dark:text-sky-100 font-bold',
    title: 'text-sky-950 dark:text-white font-black',
    badge: 'bg-sky-200/90 dark:bg-sky-900 text-sky-950 dark:text-sky-100 font-bold',
    dot: 'bg-sky-600 dark:bg-sky-400',
  };
};

const HOURLY_ROW_HEIGHT = 72; // px height per hour slot

export const Timetable: React.FC = () => {
  const { user } = useAuth();
  const { alert: customAlert } = useDialog();
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => formatDate(getMalaysiaDate()));

  const selectedWeekNum = React.useMemo(() => {
    try {
      const d = new Date(selectedDateStr + 'T00:00:00');
      return getWeekNumForDate(d);
    } catch (e) {
      return getCurrentWeekNumber();
    }
  }, [selectedDateStr]);

  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [studentCourses, setStudentCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TimetableEvent | null>(null);
  const [editForm, setEditForm] = useState({ day: 'Monday', start: '08:00', end: '10:00', room: '' });
  const [saving, setSaving] = useState(false);
  const [hoveredEventId, setHoveredEventId] = useState<number | string | null>(null);
  const [isLineHovered, setIsLineHovered] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Admin Timetable Category Filters
  const [dbProgrammes, setDbProgrammes] = useState<Programme[]>([]);
  const [dbCourses, setDbCourses] = useState<Course[]>([]);
  const [selectedProgramme, setSelectedProgramme] = useState<string>('');
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  const [isProgDropdownOpen, setIsProgDropdownOpen] = useState(false);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);

  const [currentTimeState, setCurrentTimeState] = useState<Date>(getMalaysiaDate());

  useEffect(() => {
    // Update live Malaysia time every 5 seconds for smooth real-time tracking
    const timer = setInterval(() => {
      setCurrentTimeState(getMalaysiaDate());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleNextDay = () => {
    const current = new Date(selectedDateStr + 'T00:00:00');
    current.setDate(current.getDate() + 1);
    setSelectedDateStr(formatDate(current));
  };

  const handlePrevDay = () => {
    const current = new Date(selectedDateStr + 'T00:00:00');
    current.setDate(current.getDate() - 1);
    setSelectedDateStr(formatDate(current));
  };

  const handleToday = () => {
    const today = getMalaysiaDate();
    setSelectedDateStr(formatDate(today));
  };

  const handleSelectWeek = (w: number) => {
    try {
      const current = new Date(selectedDateStr + 'T00:00:00');
      // JS getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      // Convert to Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
      const dayOfWeekOffset = (current.getDay() + 6) % 7;
      
      const targetDate = new Date(SEMESTER_START);
      targetDate.setDate(SEMESTER_START.getDate() + (w - 1) * 7 + dayOfWeekOffset);
      setSelectedDateStr(formatDate(targetDate));
    } catch (e) {
      const monday = new Date(SEMESTER_START);
      monday.setDate(SEMESTER_START.getDate() + (w - 1) * 7);
      setSelectedDateStr(formatDate(monday));
    }
    setIsWeekDropdownOpen(false);
  };

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
      swalSuccess('Timetable slot updated', `${editForm.day} ${editForm.start}-${editForm.end}`);
    } catch (err: any) {
      swalError('Failed to update slot', err.response?.data?.detail || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadTimetable();
  }, [user]);

  const loadTimetable = async () => {
    setLoading(true);
    try {
      let mappedEvents: TimetableEvent[] = [];

      if (user?.role === 'admin') {
        try {
          const [programmesData, coursesData, adminTimetable] = await Promise.all([
            apiService.adminGetProgrammes(),
            apiService.adminGetCourses(),
            apiService.adminGetTimetable()
          ]);
          setDbProgrammes(programmesData || []);
          setDbCourses(coursesData || []);

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
            type: 'normal',
            programmeId: slot.programme_id,
            programmeName: slot.programme_name
          }));
        } catch (e) {
          console.error("Failed to load admin programmes/courses:", e);
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
            type: 'normal',
            programmeId: slot.programme_id,
            programmeName: slot.programme_name
          }));
        }

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
    const now = getMalaysiaDate();
    const todayStr = formatDate(now);

    return DAY_NAMES.map((name, index) => {
      const dateOfCurrentDay = new Date(SEMESTER_START);
      dateOfCurrentDay.setDate(SEMESTER_START.getDate() + (weekNum - 1) * 7 + index);
      const dateStr = formatDate(dateOfCurrentDay);
      const dayNum = dateOfCurrentDay.getDate();
      const monthShort = dateOfCurrentDay.toLocaleString('en-US', { month: 'short' });
      const dayNameShort = dateOfCurrentDay.toLocaleString('en-US', { weekday: 'short' });
      const isToday = dateStr === todayStr;
      
      const dayObj: { 
        name: TimetableEvent['day']; 
        label: string; 
        date: string; 
        dayNum: number; 
        monthShort: string;
        isToday: boolean; 
        fullDateObj: Date;
        holiday?: string 
      } = {
        name,
        label: dayNameShort,
        date: dateStr,
        dayNum,
        monthShort,
        isToday,
        fullDateObj: dateOfCurrentDay,
      };
      
      if (dateStr === '2026-06-17') {
        dayObj.holiday = 'Awal Muharram';
      }
      
      return dayObj;
    });
  };

  const days = getDaysForWeek(selectedWeekNum);

  // Derived unique available courses from real Supabase DB data
  const availableCourses = React.useMemo(() => {
    const map = new Map<string, string>();
    dbCourses.forEach(c => {
      if (c.course_code) {
        map.set(c.course_code, c.course_name || c.course_code);
      }
    });
    events.forEach(e => {
      if (e.courseCode) {
        map.set(e.courseCode, e.courseName || e.courseCode);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [dbCourses, events]);

  // Derived unique available programmes from real Supabase DB data
  const programmeOptions = React.useMemo(() => {
    const options: { id: string; label: string }[] = [];

    if (dbProgrammes && dbProgrammes.length > 0) {
      dbProgrammes.forEach(p => {
        options.push({
          id: String(p.id || p.code),
          label: p.name || p.code
        });
      });
    } else {
      const uniqueProgrammes = new Set<string>();
      events.forEach(e => {
        if (e.programmeName) {
          uniqueProgrammes.add(e.programmeName);
        }
      });
      Array.from(uniqueProgrammes).forEach(pName => {
        options.push({ id: pName, label: pName });
      });
    }

    if (options.length > 0) {
      options.push({ id: 'ALL', label: 'All Programmes' });
    }

    return options;
  }, [dbProgrammes, events]);

  // Filtered events based on role and selected programme / course
  const displayedEvents = React.useMemo(() => {
    if (user?.role !== 'admin') return events;

    // Default Admin State: if neither programme nor course is selected, return empty (shows "No preview timetable")
    if (!selectedProgramme && !selectedCourseCode) {
      return [];
    }

    let filtered = events;

    if (selectedProgramme && selectedProgramme !== 'ALL') {
      filtered = filtered.filter(e => {
        if (e.programmeId && String(e.programmeId) === selectedProgramme) return true;
        if (e.programmeName && e.programmeName === selectedProgramme) return true;
        const matchedProg = dbProgrammes.find(p => String(p.id) === selectedProgramme || p.code === selectedProgramme);
        if (matchedProg) {
          if (e.programmeName && e.programmeName.toLowerCase() === matchedProg.name.toLowerCase()) return true;
          if (matchedProg.code && e.courseCode.toUpperCase().startsWith(matchedProg.code.toUpperCase())) return true;
        }
        return false;
      });
    }

    if (selectedCourseCode && selectedCourseCode !== 'ALL') {
      filtered = filtered.filter(e => e.courseCode === selectedCourseCode);
    }

    return filtered;
  }, [events, user?.role, selectedProgramme, selectedCourseCode, dbProgrammes]);

  // Derived selected labels for exact display
  const selectedProgrammeLabel = React.useMemo(() => {
    if (selectedProgramme === 'ALL') return 'All Programmes';
    if (!selectedProgramme) return '-- Select Programme --';
    const found = programmeOptions.find(p => p.id === selectedProgramme);
    return found ? found.label : '-- Select Programme --';
  }, [selectedProgramme, programmeOptions]);

  const selectedCourseLabel = React.useMemo(() => {
    if (selectedCourseCode === 'ALL') return 'All Courses';
    if (!selectedCourseCode) return '-- Select Course --';
    const found = availableCourses.find(c => c.code === selectedCourseCode);
    return found ? `${found.code} - ${found.name}` : selectedCourseCode;
  }, [selectedCourseCode, availableCourses]);

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

  const hoursList = Array.from({ length: 14 }, (_, i) => 8 + i); // 8 AM to 9 PM

  // Calculate current time line offset strictly in Malaysia Time (Asia/Kuala_Lumpur, UTC+8)
  const currentMinutes = currentTimeState.getHours() * 60 + currentTimeState.getMinutes() + currentTimeState.getSeconds() / 60;
  const currentMinutesInGrid = currentMinutes - 8 * 60; // relative to 8 AM
  const currentLineTop = (currentMinutesInGrid / 60) * HOURLY_ROW_HEIGHT;
  const hStr = String(currentTimeState.getHours()).padStart(2, '0');
  const mStr = String(currentTimeState.getMinutes()).padStart(2, '0');
  const currentFormattedTime = format12Hour(`${hStr}:${mStr}`);
  const showCurrentTimeLine = currentMinutesInGrid >= 0 && currentMinutesInGrid <= 14 * 60;

  // Top Date Badge & Month Title: Synchronizes with active selectedDateStr
  const activeDateObj = React.useMemo(() => {
    try {
      return new Date(selectedDateStr + 'T00:00:00');
    } catch (e) {
      return currentTimeState;
    }
  }, [selectedDateStr, currentTimeState]);

  const activeMonthAbbrev = activeDateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const activeDayNum = activeDateObj.getDate();
  const activeMonthYearStr = activeDateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Full Semester Date Range from beginning of semester until end of semester (Jun 15, 2026 – Sep 20, 2026)
  const semesterStartStr = SEMESTER_START.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const semesterEndStr = SEMESTER_END.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fullSemesterRangeStr = `${semesterStartStr} – ${semesterEndStr}`;

  const matchesSearch = (ev: TimetableEvent) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      ev.courseCode.toLowerCase().includes(q) ||
      ev.courseName.toLowerCase().includes(q) ||
      ev.room.toLowerCase().includes(q) ||
      ev.lecturerName.toLowerCase().includes(q) ||
      ev.group.toLowerCase().includes(q)
    );
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

      {/* Admin Programme & Course Selection Category Bar */}
      {user?.role === 'admin' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-extrabold text-slate-800 dark:text-slate-100">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/80 border border-sky-100 dark:border-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-2xs shrink-0">
              <Filter className="h-4.5 w-4.5" />
            </div>
            <div>
              <span className="block font-bold text-slate-900 dark:text-white">Select Timetable Category</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Filter timetable schedule by programme and course</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Custom Programme Dropdown */}
            <div className="relative w-full sm:w-72 md:w-80">
              <button
                key={`prog-btn-${selectedProgramme}`}
                type="button"
                onClick={() => {
                  setIsProgDropdownOpen(!isProgDropdownOpen);
                  setIsCourseDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 text-xs font-bold px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border rounded-xl text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/80 cursor-pointer transition-all shadow-2xs ${
                  isProgDropdownOpen 
                    ? 'border-sky-500 ring-2 ring-sky-500/20 dark:border-sky-400' 
                    : 'border-slate-200 dark:border-slate-700'
                }`}
                title={selectedProgrammeLabel}
              >
                <div className="flex items-center gap-2 truncate">
                  <GraduationCap className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
                  <span key={`prog-text-${selectedProgramme}`} className="truncate">
                    {selectedProgrammeLabel}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ${isProgDropdownOpen ? 'rotate-180 text-sky-600' : ''}`} />
              </button>

              {/* Programme Floating Dropdown Menu */}
              {isProgDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProgDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 sm:w-80 mt-1.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 p-1.5 overflow-hidden">
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {/* Default Select Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProgramme('');
                          setIsProgDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                          selectedProgramme === ''
                            ? 'bg-sky-600 text-white font-extrabold shadow-sm'
                            : 'text-slate-800 dark:text-slate-100 hover:bg-sky-50 dark:hover:bg-slate-700/70 hover:text-sky-700 dark:hover:text-sky-300'
                        }`}
                      >
                        <span>-- Select Programme --</span>
                        {selectedProgramme === '' && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-2" />}
                      </button>

                      {/* Real Supabase Programme Options */}
                      {programmeOptions.map((prog) => {
                        const isSelected = selectedProgramme === prog.id;
                        return (
                          <button
                            key={prog.id}
                            type="button"
                            onClick={() => {
                              setSelectedProgramme(prog.id);
                              setIsProgDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-sky-600 text-white font-extrabold shadow-sm'
                                : 'text-slate-800 dark:text-slate-100 hover:bg-sky-50 dark:hover:bg-slate-700/70 hover:text-sky-700 dark:hover:text-sky-300'
                            }`}
                          >
                            <span className="truncate">{prog.label}</span>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Custom Course Dropdown */}
            <div className="relative w-full sm:w-72 md:w-80">
              <button
                key={`course-btn-${selectedCourseCode}`}
                type="button"
                onClick={() => {
                  setIsCourseDropdownOpen(!isCourseDropdownOpen);
                  setIsProgDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 text-xs font-bold px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border rounded-xl text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/80 cursor-pointer transition-all shadow-2xs ${
                  isCourseDropdownOpen 
                    ? 'border-sky-500 ring-2 ring-sky-500/20 dark:border-sky-400' 
                    : 'border-slate-200 dark:border-slate-700'
                }`}
                title={selectedCourseLabel}
              >
                <div className="flex items-center gap-2 truncate">
                  <BookOpen className="h-4 w-4 text-slate-400 dark:text-slate-400 shrink-0" />
                  <span key={`course-text-${selectedCourseCode}`} className="truncate">
                    {selectedCourseLabel}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0 ${isCourseDropdownOpen ? 'rotate-180 text-sky-600' : ''}`} />
              </button>

              {/* Course Floating Dropdown Menu */}
              {isCourseDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsCourseDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 sm:w-80 mt-1.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 p-1.5 overflow-hidden">
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {/* Default Select Course Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCourseCode('');
                          setIsCourseDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                          selectedCourseCode === ''
                            ? 'bg-sky-600 text-white font-extrabold shadow-sm'
                            : 'text-slate-800 dark:text-slate-100 hover:bg-sky-50 dark:hover:bg-slate-700/70 hover:text-sky-700 dark:hover:text-sky-300'
                        }`}
                      >
                        <span>-- Select Course --</span>
                        {selectedCourseCode === '' && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-2" />}
                      </button>

                      {/* All Courses Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCourseCode('ALL');
                          setIsCourseDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                          selectedCourseCode === 'ALL'
                            ? 'bg-sky-600 text-white font-extrabold shadow-sm'
                            : 'text-slate-800 dark:text-slate-100 hover:bg-sky-50 dark:hover:bg-slate-700/70 hover:text-sky-700 dark:hover:text-sky-300'
                        }`}
                      >
                        <span>All Courses</span>
                        {selectedCourseCode === 'ALL' && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-2" />}
                      </button>

                      {/* Dynamic Course Options */}
                      {availableCourses.map((c) => {
                        const isSelected = selectedCourseCode === c.code;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setSelectedCourseCode(c.code);
                              setIsCourseDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-sky-600 text-white font-extrabold shadow-sm'
                                : 'text-slate-800 dark:text-slate-100 hover:bg-sky-50 dark:hover:bg-slate-700/70 hover:text-sky-700 dark:hover:text-sky-300'
                            }`}
                          >
                            <div className="flex flex-col truncate pr-2">
                              <span className="font-extrabold font-mono tracking-wider">{c.code}</span>
                              <span className={`text-[11px] truncate ${isSelected ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
                                {c.name}
                              </span>
                            </div>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Clear Button */}
            {(selectedProgramme || selectedCourseCode) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedProgramme('');
                  setSelectedCourseCode('');
                  setIsProgDropdownOpen(false);
                  setIsCourseDropdownOpen(false);
                }}
                className="px-3 py-2 text-xs font-extrabold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Timetable Card Container */}
      <div className="uipro-card bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
        
        {/* Integrated Header Bar (Matching Reference Layout) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-200 dark:border-slate-800">
          
          {/* Left Section: Calendar Date Badge (AUG 3) + Month Title & Semester Subtitle */}
          <div className="flex items-center gap-3.5">
            {/* Calendar Date Badge */}
            <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs shrink-0 overflow-hidden">
              <div className="w-full bg-slate-200/80 dark:bg-slate-700 text-[10px] font-black font-mono text-slate-600 dark:text-slate-300 text-center py-0.5 uppercase tracking-wider">
                {activeMonthAbbrev}
              </div>
              <div className="text-lg font-black font-display text-slate-900 dark:text-white leading-tight">
                {activeDayNum}
              </div>
            </div>

            {/* Month Year Title & Semester Range Subtitle */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                  {activeMonthYearStr}
                </h2>
                {/* System Theme Blue Badge for Week */}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-sky-600 dark:bg-sky-500 text-white shadow-2xs">
                  Week {selectedWeekNum}
                </span>
              </div>
              
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {fullSemesterRangeStr}
              </p>
            </div>
          </div>

          {/* Right Section: Search with Auto Suggestions + Navigation (Today) + Week Dropdown */}
          <div className="flex items-center gap-3 flex-wrap">
            
            {/* Search Input with Auto Suggestions */}
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="Search course, teacher, room..."
                  className="w-48 sm:w-60 pl-9 pr-8 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Auto Suggestions Dropdown Menu */}
              {isSearchFocused && (
                <div className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in duration-150">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 pb-1 border-b border-slate-100 dark:border-slate-700">
                    Suggested Searches:
                  </div>

                  <div className="space-y-1">
                    <button
                      type="button"
                      onMouseDown={() => setSearchQuery('BMCS2073')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-700/60 flex items-center justify-between cursor-pointer"
                    >
                      <span>📘 <strong className="text-sky-600 dark:text-sky-400">BMCS2073</strong> - Security</span>
                      <span className="text-[9px] text-slate-400">Course</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={() => setSearchQuery('Dr. Low')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700/60 flex items-center justify-between cursor-pointer"
                    >
                      <span>👨‍🏫 <strong className="text-emerald-600 dark:text-emerald-400">Dr. Low</strong></span>
                      <span className="text-[9px] text-slate-400">Teacher</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={() => setSearchQuery('Lab 2')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-slate-700/60 flex items-center justify-between cursor-pointer"
                    >
                      <span>📍 <strong className="text-purple-600 dark:text-purple-400">Lab 2</strong> / Room</span>
                      <span className="text-[9px] text-slate-400">Venue</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={() => setSearchQuery('Lecture')}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-700/60 flex items-center justify-between cursor-pointer"
                    >
                      <span>🏷️ <strong className="text-amber-600 dark:text-amber-400">Lecture</strong> / Group</span>
                      <span className="text-[9px] text-slate-400">Group</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Control: [ ← ] [ Today ] [ → ] */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevDay}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-all"
                title="Previous Day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                key={`today-nav-btn-${selectedDateStr}`}
                type="button"
                onClick={handleToday}
                className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer border-x border-slate-200 dark:border-slate-700 rounded-lg ${
                  selectedDateStr === formatDate(getMalaysiaDate())
                    ? 'text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700'
                    : 'text-sky-600 dark:text-sky-400 bg-sky-50/90 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 font-extrabold shadow-2xs'
                }`}
                title={selectedDateStr === formatDate(getMalaysiaDate()) ? 'Current Date (Today)' : 'Click to return to Today'}
              >
                <span key={`btn-text-${selectedDateStr}`}>
                  {selectedDateStr === formatDate(getMalaysiaDate()) ? 'Today' : (() => {
                    try {
                      const d = new Date(selectedDateStr + 'T00:00:00');
                      return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
                    } catch (e) {
                      return 'Today';
                    }
                  })()}
                </span>
              </button>

              <button
                type="button"
                onClick={handleNextDay}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-all"
                title="Next Day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Week Dropdown View Button with System Theme Blue Active Style */}
            <div className="relative">
              <button
                key={`week-dropdown-btn-${selectedWeekNum}`}
                type="button"
                onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/80 cursor-pointer transition-all shadow-2xs"
              >
                <span key={`week-label-${selectedWeekNum}`}>Week {selectedWeekNum} View</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isWeekDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isWeekDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsWeekDropdownOpen(false)} />
                  {/* Outer Frame with Rounded Corners */}
                  <div className="absolute right-0 mt-1.5 w-64 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 p-1.5 overflow-hidden">
                    {/* Inner Scroll Container keeps scrollbar cleanly inside the frame */}
                    <div className="max-h-60 overflow-y-auto pr-1 space-y-1">
                      {Array.from({ length: 14 }, (_, i) => {
                        const w = i + 1;
                        const monday = new Date(SEMESTER_START);
                        monday.setDate(SEMESTER_START.getDate() + (w - 1) * 7);
                        const sunday = new Date(monday);
                        sunday.setDate(monday.getDate() + 6);
                        const isSelected = selectedWeekNum === w;

                        return (
                          <button
                            key={w}
                            type="button"
                            onClick={() => handleSelectWeek(w)}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-sky-600 text-white font-extrabold shadow-sm'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-700/70 hover:text-sky-700 dark:hover:text-sky-300'
                            }`}
                          >
                            <span className="font-semibold">Week {w}</span>
                            <span className={`text-[10px] ${isSelected ? 'text-white/90' : 'text-slate-400 dark:text-slate-400'}`}>
                              {formatDate(monday).substring(5)} ~ {formatDate(sunday).substring(5)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Print Button */}
            <button 
              type="button"
              onClick={() => customAlert('Preparing print layout... (Simulated PDF download)', 'Print Timetable')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-all shadow-2xs"
            >
              <Printer className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Print</span>
            </button>

          </div>
        </div>

        {/* Timetable Grid Schedule */}
        {loading ? (
          <div className="p-20 flex flex-col justify-center items-center gap-3 text-slate-400 font-sans text-xs">
            <Loader2 className="h-8 w-8 text-brand-blue animate-spin" />
            <span>Synchronizing academic schedules...</span>
          </div>
        ) : user?.role === 'admin' && !selectedProgramme && !selectedCourseCode ? (
          <div className="p-16 my-4 flex flex-col items-center justify-center text-center gap-4 bg-slate-50/60 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-xs">
              <CalendarX2 className="h-8 w-8" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                No preview timetable
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Please select a programme and course category above to preview and manage specific timetables.
              </p>
            </div>
          </div>
        ) : (
          <div key={`week-grid-${selectedWeekNum}`} className="w-full overflow-x-auto">
              <div className="min-w-[860px]">

                {/* Top Day Headers (7 Columns: Mon - Sun) */}
                <div className="grid grid-cols-[80px_repeat(7,_minmax(0,1fr))] border-b border-slate-200 pb-3">
                  <div className="text-xs font-bold text-slate-400 flex items-center justify-center">
                    GMT+8
                  </div>
                  {days.map((day) => {
                    const isSelectedDay = day.date === selectedDateStr;
                    return (
                      <button 
                        key={`header-${day.date}`} 
                        type="button"
                        onClick={() => setSelectedDateStr(day.date)}
                        className={`flex items-center justify-center gap-1 text-xs font-semibold py-1.5 px-3 rounded-full transition-all cursor-pointer select-none whitespace-nowrap ${
                          isSelectedDay 
                            ? 'bg-sky-100/90 dark:bg-sky-900/80 text-sky-950 dark:text-sky-100 font-black ring-1.5 ring-sky-400 dark:ring-sky-500 shadow-2xs scale-105' 
                            : day.isToday
                            ? 'bg-slate-200/90 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-extrabold ring-1 ring-slate-300 dark:ring-slate-600 hover:bg-sky-50'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="font-extrabold">{day.monthShort} {day.dayNum},</span>
                        <span className={`font-black ${isSelectedDay ? 'text-sky-950 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                          {day.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Weekly Grid Area with Time Rows */}
                <div className="relative grid grid-cols-[80px_repeat(7,_minmax(0,1fr))] divide-x divide-slate-100 dark:divide-slate-800">

                  {/* Current Time Indicator Line with Continuous Dashed Line and Dark Mode Sync */}
                  {showCurrentTimeLine && (
                    <div 
                      className="absolute left-[80px] right-0 z-30 flex items-center transition-all duration-700 ease-in-out group cursor-pointer"
                      style={{ top: `${currentLineTop}px` }}
                      onMouseEnter={() => setIsLineHovered(true)}
                      onMouseLeave={() => setIsLineHovered(false)}
                    >
                      {/* Continuous Dashed Line running across, passing directly through the dot/badge */}
                      <div className="absolute inset-x-0 border-b-2 border-dashed border-slate-900/80 dark:border-slate-100/90 group-hover:border-slate-900 dark:group-hover:border-white transition-colors pointer-events-none" />

                      {/* Live Dot & Smooth Animated Time Badge */}
                      <div className="relative flex items-center -ml-1.5 z-40">
                        {/* Default dot indicator when NOT hovered */}
                        <div 
                          className={`w-3.5 h-3.5 rounded-full bg-slate-900 dark:bg-slate-100 border-2 border-white dark:border-slate-900 shadow-md transition-all duration-300 ease-out flex items-center justify-center ${
                            isLineHovered ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-500 animate-pulse" />
                        </div>

                        {/* Animated Time Badge showing up smoothly on hover */}
                        <span 
                          className={`absolute left-0 inline-flex items-center gap-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-[9.5px] font-extrabold px-2.5 py-1 rounded-full shadow-xl transition-all duration-300 ease-out origin-left whitespace-nowrap ${
                            isLineHovered 
                              ? 'scale-100 opacity-100 translate-x-0' 
                              : 'scale-75 opacity-0 -translate-x-2 pointer-events-none'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-600 animate-pulse" />
                          {currentFormattedTime}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Left Time Column (8 AM to 9 PM) */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                    {hoursList.map((hour) => {
                      const ampm = hour >= 12 ? 'PM' : 'AM';
                      const displayH = hour % 12 === 0 ? 12 : hour % 12;
                      return (
                        <div 
                          key={hour} 
                          style={{ height: `${HOURLY_ROW_HEIGHT}px` }}
                          className="pr-3 pt-1.5 text-right font-mono text-[11px] font-medium text-slate-400 dark:text-slate-500"
                        >
                          {displayH} {ampm}
                        </div>
                      );
                    })}
                  </div>

                  {/* 7 Day Columns (Mon - Sun) */}
                  {days.map((day) => {
                    const isSelectedDay = day.date === selectedDateStr;
                    const dayEvents = displayedEvents.filter(e => e.day === day.name);

                    return (
                      <div 
                        key={`col-${day.date}`} 
                        className={`relative divide-y divide-slate-100 dark:divide-slate-800 transition-colors ${
                          isSelectedDay 
                            ? 'bg-sky-50/90 dark:bg-sky-950/40 border-x border-sky-100/60 dark:border-sky-900/30' 
                            : day.isToday 
                            ? 'bg-slate-100/80 dark:bg-slate-800/50 border-x border-slate-200/60 dark:border-slate-700/50' 
                            : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        {/* Background Hour Lines */}
                        {hoursList.map((hour) => (
                          <div key={hour} style={{ height: `${HOURLY_ROW_HEIGHT}px` }} className="w-full" />
                        ))}

                        {/* Events overlay inside Day column */}
                        {dayEvents.map((ev) => {
                          const palette = getClassPalette(ev.group);
                          const startMin = toMinutes(ev.startTime);
                          const endMin = toMinutes(ev.endTime);
                          const topPx = ((startMin - 8 * 60) / 60) * HOURLY_ROW_HEIGHT;
                          const durMin = Math.max(30, endMin - startMin);
                          const heightPx = (durMin / 60) * HOURLY_ROW_HEIGHT;
                          const isHovered = hoveredEventId === ev.id;

                          // Smart popover position to prevent clipping at top/left/right boundaries
                          const isTopSlot = startMin < 11 * 60; // 8 AM, 9 AM, 10 AM slots
                          const isFirstDay = day.name === 'Monday' || day.name === 'Tuesday';
                          const isLastDay = day.name === 'Sunday' || day.name === 'Saturday';

                          let alignClass = 'left-1/2 -translate-x-1/2';
                          let arrowAlignClass = 'left-1/2 -translate-x-1/2';

                          if (isFirstDay) {
                            alignClass = 'left-0 translate-x-0';
                            arrowAlignClass = 'left-6';
                          } else if (isLastDay) {
                            alignClass = 'right-0 translate-x-0 left-auto';
                            arrowAlignClass = 'right-6';
                          }

                          let positionClass = 'bottom-full mb-2.5';
                          let arrowClass = 'top-full border-t-white/60 dark:border-t-slate-900/70 border-t-8 border-x-8 border-x-transparent';

                          if (isTopSlot) {
                            positionClass = 'top-full mt-2.5';
                            arrowClass = 'bottom-full border-b-white/60 dark:border-b-slate-900/70 border-b-8 border-x-8 border-x-transparent';
                          }

                          const isSearchActive = searchQuery.trim() !== '';
                          const isMatched = !isSearchActive || matchesSearch(ev);

                          return (
                            <div
                              key={ev.id}
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                                left: '3px',
                                right: '3px',
                              }}
                              className={`absolute p-0.5 transition-all ${isHovered ? 'z-[100]' : 'z-10'}`}
                              onMouseEnter={() => setHoveredEventId(ev.id)}
                              onMouseLeave={() => setHoveredEventId(null)}
                              onClick={() => {
                                if (user?.role === 'admin' && ev.meetingId) openEdit(ev);
                              }}
                            >
                              {/* Simple Pastel Container Card */}
                              <div
                                className={`w-full h-full rounded-xl border p-2 flex flex-col justify-between transition-all duration-300 cursor-pointer shadow-2xs group relative ${palette.bg} ${palette.border} ${
                                  isSearchActive
                                    ? isMatched
                                      ? 'opacity-100 ring-2 ring-sky-500 scale-[1.01]'
                                      : 'opacity-30 grayscale-[30%]'
                                    : 'opacity-100'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`text-[10.5px] tracking-wide ${palette.title}`}>
                                      {ev.courseCode}
                                    </span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${palette.dot}`} />
                                  </div>
                                  <h4 className={`text-[10px] leading-tight truncate ${palette.text}`}>
                                    {ev.courseName}
                                  </h4>
                                </div>

                                <div className="flex items-center justify-between text-[9.5px] font-medium opacity-95">
                                  <span className={`px-1.5 py-0.5 rounded-md font-mono ${palette.badge}`}>
                                    {format12Hour(ev.startTime)}
                                  </span>
                                </div>

                                {/* Floating Hover Popover / Tooltip with Authentic Frosted Glassmorphism Effect */}
                                {isHovered && (
                                  <div 
                                    className={`absolute w-80 bg-white/55 dark:bg-slate-900/65 text-slate-900 dark:text-white rounded-2xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] border border-white/80 dark:border-white/20 backdrop-blur-xl z-[100] animate-in fade-in zoom-in-95 duration-150 pointer-events-none ${positionClass} ${alignClass}`}
                                  >
                                    <div className="space-y-3">
                                      {/* Top Row: Course Code & Role Tag */}
                                      <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-2">
                                        <span className="font-extrabold text-xs text-sky-700 dark:text-sky-300 font-mono tracking-tight">
                                          {ev.courseCode} ({ev.group})
                                        </span>
                                        <span className="text-[9.5px] font-bold uppercase tracking-wider bg-white/70 dark:bg-white/10 text-slate-800 dark:text-slate-200 px-2.5 py-0.5 rounded-md border border-white/90 dark:border-white/10 shadow-2xs backdrop-blur-xs">
                                          {ev.type}
                                        </span>
                                      </div>
                                      
                                      {/* Course Full Name */}
                                      <h5 className="font-extrabold text-xs text-slate-900 dark:text-white leading-snug">
                                        {ev.courseName}
                                      </h5>

                                      {/* Details List with Spacious Single-Line Alignment */}
                                      <div className="space-y-2 text-xs pt-1">
                                        <div className="flex items-center gap-2.5 whitespace-nowrap">
                                          <div className="flex items-center gap-1.5 min-w-[95px] shrink-0 text-slate-700 dark:text-slate-200 font-semibold text-[11px]">
                                            <span className="text-xs">🕒</span>
                                            <span>Time:</span>
                                          </div>
                                          <span className="font-bold font-mono text-amber-700 dark:text-amber-300 text-[11.5px]">
                                            {format12Hour(ev.startTime)} – {format12Hour(ev.endTime)}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2.5 whitespace-nowrap">
                                          <div className="flex items-center gap-1.5 min-w-[95px] shrink-0 text-slate-700 dark:text-slate-200 font-semibold text-[11px]">
                                            <span className="text-xs">📍</span>
                                            <span>Location:</span>
                                          </div>
                                          <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-xs">
                                            {ev.room}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2.5 whitespace-nowrap">
                                          <div className="flex items-center gap-1.5 min-w-[95px] shrink-0 text-slate-700 dark:text-slate-200 font-semibold text-[11px]">
                                            <span className="text-xs">👨‍🏫</span>
                                            <span>Lecturer:</span>
                                          </div>
                                          <span className="font-extrabold text-purple-700 dark:text-purple-300 text-xs truncate">
                                            {ev.lecturerName}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className={`absolute w-0 h-0 ${arrowClass} ${arrowAlignClass}`} />
                                  </div>
                                )}
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
          )}
        </div>

      {/* Timetable Colors Legend */}
      <div className="uipro-card bg-white/75 p-5 border border-slate-200">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-150">
          Class Type & Interactive Color Legend
        </h4>
        <div className="flex flex-wrap items-center gap-6 pt-3 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-md bg-sky-100 border border-sky-400 shadow-2xs" />
            <span className="font-bold text-sky-950">Lecture Class (Light Blue)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-md bg-emerald-100 border border-emerald-400 shadow-2xs" />
            <span className="font-bold text-emerald-950">Tutorial Class (Soft Green)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-md bg-purple-100 border border-purple-400 shadow-2xs" />
            <span className="font-bold text-purple-950">Practical / Lab (Purple)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] flex items-center justify-center font-bold">10</div>
            <span className="font-semibold text-slate-600">Today's Date Indicator</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 border-b-2 border-dotted border-slate-800" />
            <span className="font-semibold text-slate-600">Live Time Marker</span>
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
        <div className="uipro-card bg-white/75 dark:bg-slate-900/75 p-5 border border-slate-200 dark:border-slate-800 shadow-premium space-y-4 rounded-2xl">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider pb-3 border-b border-slate-100 dark:border-slate-800">
            Manage Class Times :
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Day & Time</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150/50 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900">
                {displayedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                      No class slots to manage. Please select a programme and course category above.
                    </td>
                  </tr>
                ) : (
                  displayedEvents.map(ev => (
                    <tr key={ev.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-extrabold font-mono tracking-wider">{ev.courseCode}</span>
                        <span className="font-bold text-slate-500 dark:text-slate-400 ml-2">{ev.courseName}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold">{ev.group}</td>
                      <td className="py-3 px-4 font-semibold">{ev.day.substring(0, 3)} {ev.startTime}-{ev.endTime}</td>
                      <td className="py-3 px-4 font-semibold">{ev.room}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => openEdit(ev)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-[11px] font-bold hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
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
