import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Printer, AlertTriangle, Loader2, ChevronDown, Search, Filter, CalendarX2, GraduationCap, BookOpen, X, Pencil, CalendarDays, Check, FileText, Download, CheckCircle2, Move } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
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
  classGroup?: string | null;
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
type PrintStatus = 'ready' | 'preparing' | 'rendering' | 'downloading' | 'success' | 'error';

interface TimetableDragState {
  eventId: number | string;
  pointerStartX: number;
  pointerStartY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  cardWidth: number;
  durationMinutes: number;
  targetDayIndex: number;
  targetStartMinutes: number;
  targetEndMinutes: number;
  translateX: number;
  translateY: number;
  isInsideGrid: boolean;
  isSettling: boolean;
  moved: boolean;
}

const minutesToTime = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, minutes));
  return `${String(Math.floor(safeMinutes / 60)).padStart(2, '0')}:${String(safeMinutes % 60).padStart(2, '0')}`;
};

const getRequestError = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object') return fallback;
  const response = (error as { response?: { data?: { detail?: unknown } } }).response;
  return typeof response?.data?.detail === 'string' ? response.data.detail : fallback;
};

export const Timetable: React.FC = () => {
  const { user } = useAuth();
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
  const [isDayDropdownOpen, setIsDayDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hoveredEventId, setHoveredEventId] = useState<number | string | null>(null);
  const [isLineHovered, setIsLineHovered] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [printStatus, setPrintStatus] = useState<PrintStatus>('ready');
  const [printProgress, setPrintProgress] = useState(0);
  const [successCountdown, setSuccessCountdown] = useState(3);
  const [dragState, setDragState] = useState<TimetableDragState | null>(null);
  const [dragSavingIds, setDragSavingIds] = useState<Set<number | string>>(() => new Set());
  const scheduleGridRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<TimetableDragState | null>(null);
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const suppressCardClickRef = useRef(false);
  const moveVersionsRef = useRef<Map<string, number>>(new Map());
  const moveQueuesRef = useRef<Map<string, Promise<void>>>(new Map());
  const confirmedPositionsRef = useRef<Map<string, Pick<TimetableEvent, 'day' | 'startTime' | 'endTime'>>>(new Map());

  useEffect(() => () => {
    if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
  }, []);

  useEffect(() => {
    if (!isPrintOpen || printStatus !== 'success') return;
    const deadline = Date.now() + 3000;
    setSuccessCountdown(3);
    const countdownTimer = window.setInterval(() => {
      const timeLeft = deadline - Date.now();
      if (timeLeft <= 0) {
        setIsPrintOpen(false);
        return;
      }
      setSuccessCountdown(Math.max(1, Math.ceil(timeLeft / 1000)));
    }, 100);
    return () => {
      window.clearInterval(countdownTimer);
    };
  }, [isPrintOpen, printStatus]);

  useEffect(() => {
    if (!isPrintOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && printStatus !== 'preparing' && printStatus !== 'rendering' && printStatus !== 'downloading') {
        setIsPrintOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isPrintOpen, printStatus]);

  useEffect(() => {
    if (!editing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        setIsDayDropdownOpen(false);
        setEditing(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [editing, saving]);

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
    // Remove the event's elevated hover layer before mounting the dialog. Without
    // this, the pointer remains over the card and its z-100 preview can sit above
    // the old z-50 modal for one or more renders.
    setHoveredEventId(null);
    setIsLineHovered(false);
    setEditForm({ day: ev.day, start: ev.startTime, end: ev.endTime, room: ev.room });
    setIsDayDropdownOpen(false);
    setEditing(ev);
  };

  const saveEdit = async () => {
    if (!editing?.meetingId) return;
    setSaving(true);
    try {
      await apiService.adminUpdateTimetableSlot(editing.meetingId, editForm);
      setEditing(null);
      await loadTimetable();
      swalSuccess(
        'Timetable slot updated',
        `${editing.classGroup || 'All groups'} · ${editForm.day} ${editForm.start}-${editForm.end}`
      );
    } catch (err: any) {
      swalError('Failed to update slot', err.response?.data?.detail || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadTimetable();
  }, [user]);

  const loadTimetable = async (showLoader = true) => {
    if (showLoader) setLoading(true);
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
            classGroup: slot.class_group ?? null,
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
            classGroup: slot.class_group ?? null,
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
          classGroup: course.class_group ?? null,
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
          classGroup: slot.class_group ?? null,
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
      if (showLoader) setLoading(false);
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

  const updateDragPosition = (clientX: number, clientY: number) => {
    const current = dragStateRef.current;
    const grid = scheduleGridRef.current;
    if (!current || !grid) return;

    const bounds = grid.getBoundingClientRect();
    const dayWidth = (bounds.width - 80) / 7;
    if (dayWidth <= 0) return;

    const freeTranslateX = clientX - current.pointerStartX;
    const freeTranslateY = clientY - current.pointerStartY;
    const cardLeft = clientX - current.grabOffsetX;
    const cardCenterX = cardLeft + current.cardWidth / 2;
    const cardTop = clientY - current.grabOffsetY;
    const cardCenterY = cardTop + (current.durationMinutes / 60 * HOURLY_ROW_HEIGHT) / 2;
    const isInsideGrid = cardCenterX >= bounds.left + 80 && cardCenterX <= bounds.right
      && cardCenterY >= bounds.top && cardCenterY <= bounds.bottom;
    const targetDayIndex = Math.max(0, Math.min(6, Math.floor((cardCenterX - bounds.left - 80) / dayWidth)));
    const rawTop = cardTop - bounds.top;
    const rawMinutes = 8 * 60 + (rawTop / HOURLY_ROW_HEIGHT) * 60;
    // The card follows the pointer freely. Five-minute precision is applied only
    // to the proposed landing time shown to the user and committed on release.
    const landingMinutes = Math.round(rawMinutes / 5) * 5;
    const latestStart = 22 * 60 - current.durationMinutes;
    const targetStartMinutes = Math.max(8 * 60, Math.min(latestStart, landingMinutes));
    const moved = current.moved || Math.hypot(
      clientX - current.pointerStartX,
      clientY - current.pointerStartY
    ) > 5;

    const next: TimetableDragState = {
      ...current,
      targetDayIndex,
      targetStartMinutes,
      targetEndMinutes: targetStartMinutes + current.durationMinutes,
      translateX: freeTranslateX,
      translateY: freeTranslateY,
      isInsideGrid,
      isSettling: false,
      moved,
    };
    dragStateRef.current = next;
    setDragState(next);
  };

  const handleClassPointerDown = (pointerEvent: React.PointerEvent<HTMLDivElement>, timetableEvent: TimetableEvent) => {
    if (user?.role !== 'admin' || !timetableEvent.meetingId || pointerEvent.button !== 0) return;
    const grid = scheduleGridRef.current;
    if (!grid) return;

    const moveKey = String(timetableEvent.meetingId);
    if (!moveQueuesRef.current.has(moveKey)) {
      confirmedPositionsRef.current.set(moveKey, {
        day: timetableEvent.day,
        startTime: timetableEvent.startTime,
        endTime: timetableEvent.endTime,
      });
    }

    pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
    pointerEvent.preventDefault();
    setHoveredEventId(null);
    setIsLineHovered(false);

    const cardBounds = pointerEvent.currentTarget.getBoundingClientRect();
    const startMinutes = toMinutes(timetableEvent.startTime);
    const endMinutes = toMinutes(timetableEvent.endTime);
    const state: TimetableDragState = {
      eventId: timetableEvent.id,
      pointerStartX: pointerEvent.clientX,
      pointerStartY: pointerEvent.clientY,
      grabOffsetX: pointerEvent.clientX - cardBounds.left,
      grabOffsetY: pointerEvent.clientY - cardBounds.top,
      cardWidth: cardBounds.width,
      durationMinutes: Math.max(30, endMinutes - startMinutes),
      targetDayIndex: Math.max(0, DAY_NAMES.indexOf(timetableEvent.day)),
      targetStartMinutes: startMinutes,
      targetEndMinutes: endMinutes,
      translateX: 0,
      translateY: 0,
      isInsideGrid: true,
      isSettling: false,
      moved: false,
    };
    dragStateRef.current = state;
    setDragState(state);
  };

  const handleClassPointerMove = (pointerEvent: React.PointerEvent<HTMLDivElement>, timetableEvent: TimetableEvent) => {
    if (dragStateRef.current?.eventId !== timetableEvent.id) return;
    pointerEvent.preventDefault();
    pendingPointerRef.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const point = pendingPointerRef.current;
      if (point) updateDragPosition(point.x, point.y);
    });
  };

  const handleClassPointerCancel = () => {
    if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    pendingPointerRef.current = null;
    dragStateRef.current = null;
    setDragState(null);
  };

  const handleClassPointerUp = async (pointerEvent: React.PointerEvent<HTMLDivElement>, timetableEvent: TimetableEvent) => {
    if (dragStateRef.current?.eventId !== timetableEvent.id) return;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    updateDragPosition(pointerEvent.clientX, pointerEvent.clientY);
    const completedDrag = dragStateRef.current;
    pendingPointerRef.current = null;
    if (!completedDrag?.moved || !timetableEvent.meetingId) {
      dragStateRef.current = null;
      setDragState(null);
      return;
    }

    suppressCardClickRef.current = true;
    window.setTimeout(() => { suppressCardClickRef.current = false; }, 80);
    if (!completedDrag.isInsideGrid) {
      dragStateRef.current = null;
      setDragState(null);
      return;
    }
    const nextDay = DAY_NAMES[completedDrag.targetDayIndex];
    const nextStart = minutesToTime(completedDrag.targetStartMinutes);
    const nextEnd = minutesToTime(completedDrag.targetEndMinutes);
    if (nextDay === timetableEvent.day && nextStart === timetableEvent.startTime && nextEnd === timetableEvent.endTime) {
      dragStateRef.current = null;
      setDragState(null);
      return;
    }

    const gridBounds = scheduleGridRef.current?.getBoundingClientRect();
    if (gridBounds) {
      const dayWidth = (gridBounds.width - 80) / 7;
      const originDayIndex = Math.max(0, DAY_NAMES.indexOf(timetableEvent.day));
      const originTop = ((toMinutes(timetableEvent.startTime) - 8 * 60) / 60) * HOURLY_ROW_HEIGHT;
      const targetTop = ((completedDrag.targetStartMinutes - 8 * 60) / 60) * HOURLY_ROW_HEIGHT;
      const settlingDrag: TimetableDragState = {
        ...completedDrag,
        translateX: (completedDrag.targetDayIndex - originDayIndex) * dayWidth,
        translateY: targetTop - originTop,
        isSettling: true,
      };
      dragStateRef.current = settlingDrag;
      setDragState(settlingDrag);
      await new Promise<void>(resolve => window.setTimeout(resolve, 170));
    }
    dragStateRef.current = null;
    setDragState(null);

    setEvents(current => current.map(item => item.id === timetableEvent.id ? {
      ...item,
      day: nextDay,
      startTime: nextStart,
      endTime: nextEnd,
    } : item).sort(byDayThenStart));
    setSelectedDateStr(days[completedDrag.targetDayIndex]?.date || selectedDateStr);
    setDragSavingIds(current => new Set(current).add(timetableEvent.id));
    const moveKey = String(timetableEvent.meetingId);
    const moveVersion = (moveVersionsRef.current.get(moveKey) || 0) + 1;
    moveVersionsRef.current.set(moveKey, moveVersion);
    const earlierMove = moveQueuesRef.current.get(moveKey) || Promise.resolve();
    const request = earlierMove.catch(() => undefined).then(async () => {
      await apiService.adminUpdateTimetableSlot(timetableEvent.meetingId!, {
        day: nextDay,
        start: nextStart,
        end: nextEnd,
        room: timetableEvent.room,
      });
    });
    moveQueuesRef.current.set(moveKey, request);
    try {
      await request;
      confirmedPositionsRef.current.set(moveKey, { day: nextDay, startTime: nextStart, endTime: nextEnd });
      if (moveVersionsRef.current.get(moveKey) === moveVersion) {
        void swalSuccess('Class moved', `${nextDay} · ${format12Hour(nextStart)}-${format12Hour(nextEnd)}`);
      }
    } catch (err: unknown) {
      if (moveVersionsRef.current.get(moveKey) === moveVersion) {
        const confirmed = confirmedPositionsRef.current.get(moveKey);
        if (confirmed) {
          setEvents(current => current.map(item => item.id === timetableEvent.id ? {
            ...item,
            ...confirmed,
          } : item).sort(byDayThenStart));
        }
        void swalError('Move rejected', getRequestError(err, 'Slot unavailable.'));
      }
    } finally {
      if (moveQueuesRef.current.get(moveKey) === request) moveQueuesRef.current.delete(moveKey);
      if (moveVersionsRef.current.get(moveKey) === moveVersion) {
        setDragSavingIds(current => {
          const next = new Set(current);
          next.delete(timetableEvent.id);
          return next;
        });
      }
    }
  };

  const openPrintPreview = () => {
    if (user?.role === 'admin' && !selectedProgramme && !selectedCourseCode) {
      void swalError('Select timetable', 'Choose a filter.');
      return;
    }
    setPrintStatus('ready');
    setPrintProgress(0);
    setSuccessCountdown(3);
    setIsPrintOpen(true);
  };

  const animatePrintProgress = (from: number, to: number, duration: number) => new Promise<void>(resolve => {
    const startedAt = performance.now();
    const updateProgress = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setPrintProgress(Math.round(from + (to - from) * eased));
      if (elapsed < 1) {
        window.requestAnimationFrame(updateProgress);
      } else {
        resolve();
      }
    };
    window.requestAnimationFrame(updateProgress);
  });

  const handlePrintTimetable = async () => {
    if (printStatus === 'preparing' || printStatus === 'rendering' || printStatus === 'downloading') return;

    const cleanPdfText = (value: string) => value
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();

    try {
      setPrintStatus('preparing');
      setPrintProgress(0);
      await animatePrintProgress(0, 18, 360);

      const { jsPDF } = await import('jspdf');
      await animatePrintProgress(18, 36, 300);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      const weekStart = days[0]?.fullDateObj;
      const weekEnd = days[6]?.fullDateObj;
      const dateRange = weekStart && weekEnd
        ? `${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${weekEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
        : `Week ${selectedWeekNum}`;
      const filterLabel = user?.role === 'admin'
        ? `${selectedProgrammeLabel} | ${selectedCourseLabel}`
        : `${user?.email || 'My timetable'}`;
      const printableEvents = [...displayedEvents].sort(byDayThenStart);
      const rowHeight = 14;
      const startY = 52;
      const bottomY = 190;
      let y = startY;

      const drawHeader = (continued = false) => {
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 297, 32, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(continued ? 'Class Timetable - Continued' : 'Class Timetable', 14, 15);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Semester 1, 2026  |  Week ${selectedWeekNum}  |  ${dateRange}`, 14, 23);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(cleanPdfText(filterLabel).slice(0, 100), 14, 41);

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(14, 45, 269, 8, 1.5, 1.5, 'F');
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(7.5);
        doc.text('DAY', 17, 50.5);
        doc.text('TIME', 45, 50.5);
        doc.text('COURSE', 82, 50.5);
        doc.text('TYPE', 167, 50.5);
        doc.text('ROOM', 199, 50.5);
        doc.text('LECTURER', 241, 50.5);
        y = startY + 4;
      };

      drawHeader();
      setPrintStatus('rendering');
      await animatePrintProgress(36, 48, 260);

      if (printableEvents.length === 0) {
        doc.setDrawColor(203, 213, 225);
        doc.setLineDashPattern([2, 2], 0);
        doc.roundedRect(14, 62, 269, 48, 3, 3, 'S');
        doc.setLineDashPattern([], 0);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('No classes scheduled', 148.5, 82, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('This timetable has no class entries for the selected week.', 148.5, 91, { align: 'center' });
      } else {
        printableEvents.forEach((event, index) => {
          if (y + rowHeight > bottomY) {
            doc.addPage('a4', 'landscape');
            drawHeader(true);
          }

          if (index % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(14, y - 3, 269, rowHeight, 'F');
          }

          const group = event.group.toLowerCase();
          const accent: [number, number, number] = group.includes('tutor')
            ? [16, 185, 129]
            : group.includes('practic') || group.includes('lab')
              ? [168, 85, 247]
              : [14, 165, 233];
          doc.setFillColor(...accent);
          doc.roundedRect(14, y - 3, 1.5, rowHeight, 0.7, 0.7, 'F');
          doc.setTextColor(30, 41, 59);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.text(event.day.slice(0, 3), 18, y + 3);
          doc.text(`${format12Hour(event.startTime)} -`, 45, y + 1.5);
          doc.text(format12Hour(event.endTime), 45, y + 6);
          doc.text(cleanPdfText(event.courseCode).slice(0, 18), 82, y + 1.5);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          const courseLines = doc.splitTextToSize(cleanPdfText(event.courseName), 78).slice(0, 2);
          doc.text(courseLines, 82, y + 6);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          const typeAndGroup = event.classGroup ? `${event.group} (${event.classGroup})` : event.group;
          doc.text(cleanPdfText(typeAndGroup).slice(0, 24), 167, y + 3);
          doc.setFont('helvetica', 'normal');
          doc.text(doc.splitTextToSize(cleanPdfText(event.room), 36).slice(0, 2), 199, y + 2);
          doc.text(doc.splitTextToSize(cleanPdfText(event.lecturerName), 39).slice(0, 2), 241, y + 2);
          y += rowHeight;
        });
      }

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 198, 283, 198);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text('Smart Attendance System', 14, 204);
        doc.text(`Page ${page} of ${pageCount}`, 283, 204, { align: 'right' });
      }

      doc.setProperties({
        title: `Class Timetable - Week ${selectedWeekNum}`,
        subject: dateRange,
        author: 'Smart Attendance System',
        creator: 'Smart Attendance System'
      });
      await animatePrintProgress(48, 82, 520);

      setPrintStatus('downloading');
      await animatePrintProgress(82, 94, 280);
      const pdfBlob = doc.output('blob');
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `class-timetable-week-${selectedWeekNum}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      await animatePrintProgress(94, 100, 300);

      setPrintProgress(100);
      setPrintStatus('success');
      void swalSuccess('Print successful', 'PDF downloaded.');
    } catch (error) {
      console.error('Failed to create timetable PDF:', error);
      setPrintStatus('error');
      setPrintProgress(0);
      void swalError('Print failed', 'Try again.');
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
      ev.group.toLowerCase().includes(q) ||
      (ev.classGroup || '').toLowerCase().includes(q)
    );
  };

  const printCopy: Record<PrintStatus, { title: string; text: string }> = {
    ready: { title: 'PDF ready', text: 'Review the preview, then print.' },
    preparing: { title: 'Preparing PDF', text: 'Setting up your timetable.' },
    rendering: { title: 'Creating PDF', text: 'Adding classes and details.' },
    downloading: { title: 'Saving PDF', text: 'Sending the file to Downloads.' },
    success: { title: 'Print successful', text: 'Your PDF is downloaded.' },
    error: { title: 'Print failed', text: 'Please try again.' }
  };
  const isPrinting = printStatus === 'preparing' || printStatus === 'rendering' || printStatus === 'downloading';
  const previewEvents = displayedEvents.slice(0, 6);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Timetable Header / Note */}
      <div className="flex gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/80 p-4 text-sm text-blue-900 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-100">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-blue shadow-sm ring-1 ring-blue-100 dark:bg-blue-950 dark:ring-blue-900">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <span className="block text-xs font-extrabold uppercase tracking-wider">Timetable assistance</span>
          <span className="block text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">Contact your faculty if a class is missing, clashes with another class, or contains incorrect details.</span>
        </div>
      </div>

      {/* Admin Programme & Course Selection Category Bar */}
      {user?.role === 'admin' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3 text-xs font-extrabold text-slate-800 dark:text-slate-100">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-brand-blue shadow-sm dark:border-blue-900 dark:bg-blue-950/70 dark:text-blue-300">
              <Filter className="h-4.5 w-4.5" />
            </div>
            <div>
              <span className="block text-sm font-extrabold text-slate-900 dark:text-white">Filter timetable</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Choose a programme and course to narrow the schedule</span>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-[minmax(240px,320px)_minmax(240px,320px)_auto]">
            {/* Custom Programme Dropdown */}
            <div className="relative min-w-0">
              <button
                key={`prog-btn-${selectedProgramme}`}
                type="button"
                onClick={() => {
                  setIsProgDropdownOpen(!isProgDropdownOpen);
                  setIsCourseDropdownOpen(false);
                }}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-slate-50 px-3.5 py-2.5 text-left text-xs font-bold text-slate-800 shadow-sm transition-all hover:border-blue-300 hover:bg-white dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-800 ${
                  isProgDropdownOpen
                    ? 'border-brand-blue bg-white ring-2 ring-blue-500/15 dark:border-blue-400' 
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
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isProgDropdownOpen ? 'rotate-180 text-brand-blue' : ''}`} />
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
                            ? 'bg-brand-blue text-white font-extrabold shadow-sm'
                            : 'text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-brand-blue dark:hover:text-blue-300'
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
                                ? 'bg-brand-blue text-white font-extrabold shadow-sm'
                                : 'text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-brand-blue dark:hover:text-blue-300'
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
            <div className="relative min-w-0">
              <button
                key={`course-btn-${selectedCourseCode}`}
                type="button"
                onClick={() => {
                  setIsCourseDropdownOpen(!isCourseDropdownOpen);
                  setIsProgDropdownOpen(false);
                }}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-slate-50 px-3.5 py-2.5 text-left text-xs font-bold text-slate-800 shadow-sm transition-all hover:border-blue-300 hover:bg-white dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-800 ${
                  isCourseDropdownOpen
                    ? 'border-brand-blue bg-white ring-2 ring-blue-500/15 dark:border-blue-400' 
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
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isCourseDropdownOpen ? 'rotate-180 text-brand-blue' : ''}`} />
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
                            ? 'bg-brand-blue text-white font-extrabold shadow-sm'
                            : 'text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-brand-blue dark:hover:text-blue-300'
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
                            ? 'bg-brand-blue text-white font-extrabold shadow-sm'
                            : 'text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-brand-blue dark:hover:text-blue-300'
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
                                ? 'bg-brand-blue text-white font-extrabold shadow-sm'
                                : 'text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-brand-blue dark:hover:text-blue-300'
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
                className="min-h-11 rounded-xl px-4 py-2 text-xs font-extrabold text-brand-blue transition-colors hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/50 sm:col-span-2 xl:col-span-1"
              >
                Clear filters
              </button>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Main Timetable Card Container */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        
        {/* Integrated Header Bar (Matching Reference Layout) */}
        <div className="mb-5 flex flex-col gap-5 border-b border-slate-200 pb-5 dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
          
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
          <div className="flex w-full flex-wrap items-center gap-2.5 xl:w-auto xl:justify-end">
            
            {/* Search Input with Auto Suggestions */}
            <div className="relative w-full sm:w-auto">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="Search course, teacher, room..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-xs font-semibold text-slate-800 shadow-sm transition-all placeholder:text-slate-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:w-64"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
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
            <div className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={handlePrevDay}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-all hover:bg-white hover:text-brand-blue hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-700"
                title="Previous Day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                key={`today-nav-btn-${selectedDateStr}`}
                type="button"
                onClick={handleToday}
                className={`h-8 rounded-lg px-3 text-xs font-bold transition-all ${
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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-all hover:bg-white hover:text-brand-blue hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-700"
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
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-slate-800 shadow-sm transition-all hover:border-blue-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80"
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
                                ? 'bg-brand-blue text-white font-extrabold shadow-sm'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700/70 hover:text-brand-blue dark:hover:text-blue-300'
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
              onClick={openPrintPreview}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-blue-300 hover:bg-white hover:text-brand-blue dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
            >
              <Printer className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Print</span>
            </button>

          </div>
        </div>

        {user?.role === 'admin' && (selectedProgramme || selectedCourseCode) && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs dark:border-blue-900/60 dark:bg-blue-950/30">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-blue shadow-sm dark:bg-blue-950 dark:text-blue-300">
                <Move className="h-4 w-4" />
              </div>
              <div>
                <p className="font-extrabold text-slate-800 dark:text-slate-100">Drag to reschedule</p>
                <p className="mt-0.5 font-medium text-slate-500 dark:text-slate-400">Move freely. The card centre chooses the day on release.</p>
              </div>
            </div>
            {dragSavingIds.size > 0 && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-bold text-brand-blue shadow-sm dark:bg-slate-900 dark:text-blue-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving {dragSavingIds.size}
              </span>
            )}
          </div>
        )}

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
          <div key={`week-grid-${selectedWeekNum}`} className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="min-w-[920px]">

                {/* Top Day Headers (7 Columns: Mon - Sun) */}
                <div className="sticky top-0 z-20 grid grid-cols-[80px_repeat(7,_minmax(0,1fr))] border-b border-slate-200 bg-white px-0 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    GMT+8
                  </div>
                  {days.map((day) => {
                    const isSelectedDay = day.date === selectedDateStr;
                    return (
                      <button 
                        key={`header-${day.date}`} 
                        type="button"
                        onClick={() => setSelectedDateStr(day.date)}
                        className={`mx-1 flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-all select-none whitespace-nowrap ${
                          isSelectedDay 
                            ? 'bg-blue-600 text-white font-black shadow-sm'
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
                <div ref={scheduleGridRef} className={`relative grid grid-cols-[80px_repeat(7,_minmax(0,1fr))] divide-x divide-slate-100 dark:divide-slate-800 ${dragState ? 'select-none' : ''}`}>

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
                        className={`relative divide-y divide-slate-100 dark:divide-slate-800 transition-colors duration-200 ${
                          dragState?.isInsideGrid && dragState.targetDayIndex === DAY_NAMES.indexOf(day.name)
                            ? 'bg-blue-100/75 ring-2 ring-inset ring-brand-blue/35 dark:bg-blue-950/55 '
                            : ''
                        }${
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
                          const isDragging = dragState?.eventId === ev.id;
                          const isSavingDrag = dragSavingIds.has(ev.id);
                          const isHovered = !dragState && editing === null && hoveredEventId === ev.id;

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
                                transform: isDragging ? `translate3d(${dragState.translateX}px, ${dragState.translateY}px, 0) scale(1.035)` : 'translate3d(0, 0, 0) scale(1)',
                                transition: isDragging
                                  ? dragState.isSettling
                                    ? 'transform 170ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 170ms ease'
                                    : 'box-shadow 160ms ease, opacity 160ms ease'
                                  : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease',
                                touchAction: user?.role === 'admin' ? 'none' : 'auto',
                                willChange: isDragging ? 'transform' : 'auto',
                              }}
                              className={`absolute p-0.5 ${isDragging ? `z-[160] cursor-grabbing drop-shadow-2xl ${dragState.isInsideGrid ? 'opacity-95' : 'opacity-75'}` : isHovered ? 'z-[100]' : 'z-10'}`}
                              onMouseEnter={() => {
                                if (!editing && !dragState) setHoveredEventId(ev.id);
                              }}
                              onMouseLeave={() => setHoveredEventId(null)}
                              onPointerDown={(pointerEvent) => handleClassPointerDown(pointerEvent, ev)}
                              onPointerMove={(pointerEvent) => handleClassPointerMove(pointerEvent, ev)}
                              onPointerUp={(pointerEvent) => void handleClassPointerUp(pointerEvent, ev)}
                              onPointerCancel={handleClassPointerCancel}
                              onClick={() => {
                                if (!suppressCardClickRef.current && user?.role === 'admin' && ev.meetingId) openEdit(ev);
                              }}
                              aria-label={`${ev.courseCode} ${ev.group} ${ev.classGroup || 'all groups'}, ${ev.day} ${format12Hour(ev.startTime)} to ${format12Hour(ev.endTime)}${user?.role === 'admin' ? '. Drag to reschedule.' : ''}`}
                            >
                              {/* Simple Pastel Container Card */}
                              <div
                                className={`group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-lg border p-2.5 shadow-sm transition-[box-shadow,filter] duration-200 ${isDragging ? 'cursor-grabbing ring-2 ring-white/90 shadow-2xl brightness-[1.03] dark:ring-slate-700' : user?.role === 'admin' && ev.meetingId ? 'cursor-grab hover:shadow-md' : 'cursor-default'} ${palette.bg} ${palette.border} ${
                                  isSearchActive
                                    ? isMatched
                                      ? 'opacity-100 ring-2 ring-sky-500 scale-[1.01]'
                                      : 'opacity-30 grayscale-[30%]'
                                    : 'opacity-100'
                                }`}
                              >
                                {isDragging && (
                                  <div className="absolute inset-x-1 top-1 z-20 flex justify-center pointer-events-none">
                                    <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black text-white shadow-lg backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150 ${dragState.isInsideGrid ? 'bg-slate-950/90' : 'bg-rose-600/95'}`}>
                                      <Move className="h-2.5 w-2.5" />
                                      {dragState.isInsideGrid
                                        ? `${DAY_NAMES[dragState.targetDayIndex].slice(0, 3)} · ${format12Hour(minutesToTime(dragState.targetStartMinutes))}`
                                        : 'Release to cancel'}
                                    </span>
                                  </div>
                                )}
                                {isSavingDrag && (
                                  <span className="absolute bottom-1 right-1 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-brand-blue shadow-md dark:bg-slate-900/90 dark:text-blue-300" title="Saving change">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  </span>
                                )}
                                <div className="space-y-0.5">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`text-[11px] tracking-wide ${palette.title}`}>
                                      {ev.courseCode}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {ev.classGroup && (
                                        <span className={`rounded px-1 py-0.5 text-[8px] font-black leading-none ${palette.badge}`}>
                                          {ev.classGroup}
                                        </span>
                                      )}
                                      <span className={`w-1.5 h-1.5 rounded-full ${palette.dot}`} />
                                    </div>
                                  </div>
                                  <h4 className={`truncate text-[10.5px] leading-snug ${palette.text}`}>
                                    {ev.courseName}
                                  </h4>
                                </div>

                                <div className="flex items-center justify-between text-[9.5px] font-medium opacity-95">
                                  <span className={`px-1.5 py-0.5 rounded-md font-mono ${palette.badge}`}>
                                    {format12Hour(ev.startTime)}
                                  </span>
                                </div>

                                {/* Floating Hover Popover / Tooltip with Authentic Frosted Glassmorphism Effect */}
                                {isHovered && !editing && (
                                  <div 
                                    className={`absolute w-80 bg-white/55 dark:bg-slate-900/65 text-slate-900 dark:text-white rounded-2xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] border border-white/80 dark:border-white/20 backdrop-blur-xl z-[100] animate-in fade-in zoom-in-95 duration-150 pointer-events-none ${positionClass} ${alignClass}`}
                                  >
                                    <div className="space-y-3">
                                      {/* Top Row: Course Code & Role Tag */}
                                      <div className="flex items-center justify-between border-b border-slate-900/10 dark:border-white/10 pb-2">
                                        <span className="font-extrabold text-xs text-sky-700 dark:text-sky-300 font-mono tracking-tight">
                                          {ev.courseCode} · {ev.group}{ev.classGroup ? ` · ${ev.classGroup}` : ' · All groups'}
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
                                        <div className="flex items-center gap-2.5 whitespace-nowrap">
                                          <div className="flex min-w-[95px] shrink-0 items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                            <span className="text-xs">👥</span>
                                            <span>Students:</span>
                                          </div>
                                          <span className="text-xs font-extrabold text-brand-blue dark:text-blue-300">
                                            {ev.classGroup || 'All groups'}
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h4 className="border-b border-slate-200 pb-3 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:text-slate-300">
          Timetable legend
        </h4>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-md bg-sky-100 border border-sky-400 shadow-2xs" />
            <span className="font-bold text-slate-700 dark:text-slate-300">Lecture</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-md bg-emerald-100 border border-emerald-400 shadow-2xs" />
            <span className="font-bold text-slate-700 dark:text-slate-300">Tutorial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-md bg-purple-100 border border-purple-400 shadow-2xs" />
            <span className="font-bold text-slate-700 dark:text-slate-300">Practical / Lab</span>
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
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Manage class times</h3>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Select a class to update its day, time, or room.</p>
            </div>
            <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-brand-blue dark:bg-blue-950/60 dark:text-blue-300">{displayedEvents.length} classes</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4">Day & Time</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-xs text-slate-700 dark:divide-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {displayedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                      No class slots to manage. Please select a programme and course category above.
                    </td>
                  </tr>
                ) : (
                  displayedEvents.map(ev => (
                    <tr key={ev.id} className="transition-colors hover:bg-blue-50/40 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <span className="font-extrabold font-mono tracking-wider">{ev.courseCode}</span>
                        <span className="font-bold text-slate-500 dark:text-slate-400 ml-2">{ev.courseName}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold">{ev.group}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-extrabold ${ev.classGroup ? 'bg-blue-50 text-brand-blue dark:bg-blue-950/60 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {ev.classGroup || 'All groups'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold">{ev.day.substring(0, 3)} {ev.startTime}-{ev.endTime}</td>
                      <td className="py-3 px-4 font-semibold">{ev.room}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => openEdit(ev)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-blue px-3 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md">
                          <Pencil className="h-3.5 w-3.5" />
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

      {isPrintOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
          onClick={() => !isPrinting && setIsPrintOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-timetable-title"
            className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl transition-[max-width] duration-500 dark:border-slate-700 dark:bg-slate-900 ${printStatus === 'success' ? 'max-w-md' : 'max-w-3xl'}`}
            onClick={event => event.stopPropagation()}
          >
            {printStatus === 'success' ? (
              <div className="flex min-h-[440px] flex-col items-center justify-center px-6 py-10 text-center animate-in fade-in zoom-in-95 duration-500 sm:px-10">
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/15 [animation-duration:1.8s]" />
                  <div className="absolute inset-2 rounded-full bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-950/60 dark:ring-emerald-900" />
                  <CheckCircle2 className="relative h-14 w-14 text-emerald-500 animate-in zoom-in-50 duration-500" strokeWidth={2.2} />
                </div>
                <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Download complete</p>
                <h3 id="print-timetable-title" className="mt-2 text-2xl font-black leading-tight text-slate-900 dark:text-white">
                  Download Week {selectedWeekNum} timetable successful
                </h3>
                <p className="mt-3 max-w-xs text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  Your PDF is saved in Downloads.
                </p>

                <div className="mt-7 flex min-w-60 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/50" aria-live="assertive" aria-atomic="true">
                  <div key={`count-${successCountdown}`} className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black tabular-nums text-brand-blue shadow-sm ring-1 ring-slate-200 animate-in zoom-in-75 fade-in duration-200 dark:bg-slate-800 dark:text-blue-300 dark:ring-slate-700">
                    {successCountdown}
                  </div>
                  <span key={`count-text-${successCountdown}`} className="text-xs font-bold text-slate-600 animate-in fade-in slide-in-from-bottom-1 duration-200 dark:text-slate-300">
                    Closing in {successCountdown} {successCountdown === 1 ? 'second' : 'seconds'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPrintOpen(false)}
                  className="mt-7 h-11 min-w-36 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:text-brand-blue hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-blue-300"
                >
                  Close now
                </button>
              </div>
            ) : (
              <>
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${printStatus === 'error' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-blue-50 text-brand-blue dark:bg-blue-950/60 dark:text-blue-300'}`}>
                  {isPrinting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0" aria-live="polite">
                  <h3 id="print-timetable-title" className="text-base font-extrabold text-slate-900 dark:text-white sm:text-lg">
                    {printCopy[printStatus].title}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                    {printCopy[printStatus].text}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintOpen(false)}
                disabled={isPrinting}
                aria-label="Close PDF preview"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/95 p-3 shadow-inner sm:p-5">
                <div className="mx-auto min-h-[285px] max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
                  <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-4 text-white sm:px-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-100">PDF Preview</p>
                        </div>
                        <h4 className="mt-1 text-base font-black sm:text-lg">Class Timetable</h4>
                        <p className="mt-0.5 text-[10px] font-semibold text-blue-100 sm:text-xs">Semester 1, 2026 · Week {selectedWeekNum}</p>
                      </div>
                      <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold backdrop-blur-sm">{displayedEvents.length} classes</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 p-4 sm:p-5">
                    {user?.role === 'admin' && (
                      <p className="truncate border-b border-slate-100 pb-2.5 text-[10px] font-bold text-slate-500">
                        {selectedProgrammeLabel} · {selectedCourseLabel}
                      </p>
                    )}
                    {previewEvents.length === 0 ? (
                      <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-center">
                        <CalendarX2 className="h-7 w-7 text-slate-300" />
                        <p className="mt-2 text-xs font-extrabold text-slate-600">No classes scheduled</p>
                        <p className="mt-1 text-[10px] text-slate-400">The PDF will show an empty timetable.</p>
                      </div>
                    ) : (
                      previewEvents.map(event => (
                        <div key={`pdf-preview-${event.id}`} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="text-center">
                            <p className="text-[10px] font-black uppercase text-brand-blue">{event.day.slice(0, 3)}</p>
                            <p className="mt-0.5 text-[8px] font-bold text-slate-400">{format12Hour(event.startTime)}</p>
                          </div>
                          <div className="min-w-0 border-l border-slate-200 pl-3">
                            <p className="truncate text-[10px] font-black text-slate-800">{event.courseCode} · {event.courseName}</p>
                            <p className="mt-0.5 truncate text-[9px] font-medium text-slate-500">{event.group} · {event.classGroup || 'All groups'} · {event.room} · {event.lecturerName}</p>
                          </div>
                          <p className="hidden text-[9px] font-bold text-slate-500 sm:block">{format12Hour(event.endTime)}</p>
                        </div>
                      ))
                    )}
                    {displayedEvents.length > previewEvents.length && (
                      <p className="text-center text-[9px] font-bold text-slate-400">+{displayedEvents.length - previewEvents.length} more in PDF</p>
                    )}
                  </div>
                </div>
              </div>

              {isPrinting && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 animate-in fade-in slide-in-from-bottom-2 duration-300 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="mb-2 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">{printCopy[printStatus].title}</span>
                  <span key={printProgress} className="min-w-10 text-right font-black tabular-nums text-brand-blue animate-in fade-in duration-100 dark:text-blue-300">{printProgress}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-label="PDF progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={printProgress}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 transition-[width] duration-150 ease-out"
                    style={{ width: `${printProgress}%` }}
                  />
                </div>
              </div>}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsPrintOpen(false)}
                disabled={isPrinting}
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePrintTimetable}
                disabled={isPrinting}
                className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-xl bg-brand-blue px-6 text-sm font-extrabold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl disabled:cursor-wait disabled:translate-y-0 disabled:opacity-70"
              >
                {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isPrinting ? `${printProgress}%` : printStatus === 'error' ? 'Try again' : 'Print'}
              </button>
            </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {editing && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm isolate" onClick={() => !saving && setEditing(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-class-time-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand-blue dark:bg-blue-950/60 dark:text-blue-300"><CalendarDays className="h-5 w-5" /></div>
                <div>
                  <h3 id="edit-class-time-title" className="text-sm font-extrabold text-slate-900 dark:text-white">Edit class time</h3>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{editing.courseCode} · {editing.group}</p>
                  <span className="mt-2 inline-flex rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-brand-blue dark:bg-blue-950/60 dark:text-blue-300">
                    Students: {editing.classGroup || 'All groups'}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setEditing(null)} disabled={saving} aria-label="Close edit dialog" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5 text-sm">
              <div className="relative">
                <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Day</span>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={isDayDropdownOpen}
                  onClick={() => setIsDayDropdownOpen(!isDayDropdownOpen)}
                  className={`mt-1.5 flex h-11 w-full items-center justify-between rounded-xl border px-3.5 text-left text-sm font-semibold text-slate-800 shadow-sm transition-all dark:bg-slate-800 dark:text-white ${
                    isDayDropdownOpen
                      ? 'border-brand-blue bg-white ring-2 ring-blue-500/15 dark:border-blue-400'
                      : 'border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-white dark:border-slate-700'
                  }`}
                >
                  <span>{editForm.day}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isDayDropdownOpen ? 'rotate-180 text-brand-blue' : ''}`} />
                </button>
                {isDayDropdownOpen && (
                  <div role="listbox" className="absolute left-0 right-0 z-30 mt-2 space-y-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                      const isSelected = editForm.day === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setEditForm({ ...editForm, day });
                            setIsDayDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                            isSelected
                              ? 'bg-brand-blue text-white shadow-sm'
                              : 'text-slate-700 hover:bg-blue-50 hover:text-brand-blue dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{day}</span>
                          {isSelected && <Check className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex-1">
                  <span className="text-xs font-bold text-slate-500 uppercase">Start</span>
                  <input type="time" min="08:00" max="21:00" value={editForm.start}
                    onChange={e => setEditForm({ ...editForm, start: e.target.value })}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </label>
                <label className="flex-1">
                  <span className="text-xs font-bold text-slate-500 uppercase">End</span>
                  <input type="time" min="09:00" max="22:00" value={editForm.end}
                    onChange={e => setEditForm({ ...editForm, end: e.target.value })}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase">Room</span>
                <input type="text" value={editForm.room} onChange={e => setEditForm({ ...editForm, room: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
              <button onClick={() => setEditing(null)} disabled={saving}
                className="h-10 rounded-xl px-4 text-slate-600 font-bold hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={saveEdit} disabled={saving}
                className="h-10 rounded-xl bg-brand-blue px-5 text-white font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
