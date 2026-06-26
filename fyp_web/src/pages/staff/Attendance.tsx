import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { Course, ActiveSession } from '../../services/api';
import { Search, Calendar, ChevronDown, Check, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface DailyAttendanceRecord {
  studentId: number;
  studentName: string;
  studentCode: string;
  studentEmail: string;
  classGroup: string;
  status: 'pending' | 'present' | 'absent';
  markedAt?: string;
  deviceIp?: string;
}

export const Attendance: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [enrolments, setEnrolments] = useState<any[]>([]);
  
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('G1');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real Class Sessions State
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // Attendance records state
  const [records, setRecords] = useState<DailyAttendanceRecord[]>([]);
  const [copiedStudentId, setCopiedStudentId] = useState<number | null>(null);

  const getAvailableGroupsForCourse = (courseId: string): string[] => {
    if (!courseId) return ['G1'];
    const inUse = Array.from(new Set(
      enrolments
        .filter(e => e.course_id.toString() === courseId)
        .map(e => e.class_group)
    )).filter((g: any) => g && g.startsWith('G')) as string[];

    if (!inUse.includes('G1')) {
      inUse.push('G1');
    }

    const manualKey = `sas_manual_groups_${courseId}`;
    try {
      const storedManual = JSON.parse(localStorage.getItem(manualKey) || '[]');
      storedManual.forEach((g: string) => {
        if (!inUse.includes(g)) {
          inUse.push(g);
        }
      });
    } catch (e) {
      console.error(e);
    }

    inUse.sort((a, b) => {
      const numA = parseInt(a.replace('G', '')) || 1;
      const numB = parseInt(b.replace('G', '')) || 1;
      return numA - numB;
    });

    const highestGroup = inUse[inUse.length - 1];
    const count = enrolments.filter(e => e.course_id.toString() === courseId && e.class_group === highestGroup).length;
    if (count >= 25) {
      const highestNum = parseInt(highestGroup.replace('G', '')) || 1;
      const nextGroup = `G${highestNum + 1}`;
      if (!inUse.includes(nextGroup)) {
        inUse.push(nextGroup);
      }
    }

    return inUse;
  };

  // Reset selectedGroup to G1 or check validity when course or enrolments change
  useEffect(() => {
    if (!selectedCourseId) return;
    const available = getAvailableGroupsForCourse(selectedCourseId);
    if (selectedGroup !== 'All' && !available.includes(selectedGroup)) {
      setSelectedGroup('G1');
    }
  }, [selectedCourseId, enrolments]);

  // Load initial courses, students, and enrolments
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [coursesList, studentsList, enrolmentsList] = await Promise.all([
          apiService.getCourses(),
          apiService.getStudents(),
          apiService.getEnrolments()
        ]);
        setCourses(coursesList);
        setStudents(studentsList);
        setEnrolments(enrolmentsList);
      } catch (err) {
        console.error("Failed to load initial data in Attendance:", err);
      }
    };
    loadInitialData();
  }, []);

  // Fetch real class sessions from backend when course changes
  useEffect(() => {
    const loadSessions = async () => {
      if (!selectedCourseId) {
        setSessions([]);
        setSelectedSessionId('');
        return;
      }
      setLoadingSessions(true);
      try {
        const data = await apiService.getCourseSessions(Number(selectedCourseId));
        setSessions(data);
      } catch (err) {
        console.error("Failed to load sessions:", err);
      } finally {
        setLoadingSessions(false);
      }
    };
    loadSessions();
  }, [selectedCourseId]);

  const getLocalDateString = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return '';
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      return '';
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  const getFormattedDateStr = (year: number, monthIndex: number, day: number) => {
    const tempDate = new Date(year, monthIndex, day);
    const yyyy = tempDate.getFullYear();
    const mm = String(tempDate.getMonth() + 1).padStart(2, '0');
    const dd = String(tempDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();
    
    const days = [];
    
    // Previous month's days offset
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: prevTotalDays - i,
        isCurrentMonth: false,
        dateStr: getFormattedDateStr(year, month - 1, prevTotalDays - i)
      });
    }
    
    // Current month's days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        dateStr: getFormattedDateStr(year, month, i)
      });
    }
    
    // Next month's days leading to 42 cells grid
    const gridTotal = 42;
    const nextDaysCount = gridTotal - days.length;
    for (let i = 1; i <= nextDaysCount; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        dateStr: getFormattedDateStr(year, month + 1, i)
      });
    }
    
    return days;
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDay = (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsCalendarOpen(false);
  };

  // Filter sessions by selectedGroup and selectedDate, and auto-select most recent
  const groupSessions = React.useMemo(() => {
    let filtered = sessions.filter(s => s.class_group === selectedGroup);
    if (selectedDate) {
      filtered = filtered.filter(s => {
        const localDate = getLocalDateString(s.opened_at);
        return localDate === selectedDate;
      });
    }
    return filtered;
  }, [sessions, selectedGroup, selectedDate]);

  useEffect(() => {
    if (groupSessions.length > 0) {
      // Auto select the first (most recent) session
      setSelectedSessionId(groupSessions[0].id.toString());
    } else {
      setSelectedSessionId('');
    }
  }, [groupSessions]);

  // Load attendance records when selected session changes
  useEffect(() => {
    if (!selectedSessionId) {
      setRecords([]);
      return;
    }
    
    const loadAttendance = async () => {
      try {
        const data = await apiService.getSessionAttendance(Number(selectedSessionId));
        
        // Map student records
        const mapped = data.attendance_list.map(s => {
          const studentDetail = students.find(stud => stud.id === s.student_id);
          const email = studentDetail ? studentDetail.email : '';
          
          let finalStatus: 'pending' | 'present' | 'absent' = 'pending';
          if (s.status === 'present') {
            finalStatus = 'present';
          } else if (s.status === 'absent') {
            finalStatus = data.is_open ? 'pending' : 'absent';
          } else {
            finalStatus = data.is_open ? 'pending' : 'absent';
          }
          
          return {
            studentId: s.student_id,
            studentName: s.student_name,
            studentCode: s.student_code,
            studentEmail: email,
            classGroup: data.class_group,
            status: finalStatus,
            markedAt: s.marked_at || undefined,
            deviceIp: s.source_ip || undefined,
          };
        });
        
        setRecords(mapped);
      } catch (err) {
        console.error("Failed to load session attendance:", err);
      }
    };
    
    loadAttendance();
  }, [selectedSessionId, students]);

  const handleMarkPresent = async (studentId: number) => {
    if (!selectedSessionId) return;
    try {
      await apiService.updateLecturerAttendance(Number(selectedSessionId), studentId, 'present');
      setRecords(prev => prev.map(r => {
        if (r.studentId === studentId) {
          return {
            ...r,
            status: 'present' as const,
            markedAt: new Date().toISOString(),
            deviceIp: 'Staff Override'
          };
        }
        return r;
      }));
    } catch (err) {
      console.error("Failed to override attendance present:", err);
    }
  };

  const handleMarkAbsent = async (studentId: number) => {
    if (!selectedSessionId) return;
    try {
      await apiService.updateLecturerAttendance(Number(selectedSessionId), studentId, 'absent');
      const currentSession = sessions.find(s => s.id.toString() === selectedSessionId);
      const isOpen = currentSession ? currentSession.is_open : false;
      
      setRecords(prev => prev.map(r => {
        if (r.studentId === studentId) {
          return {
            ...r,
            status: isOpen ? ('pending' as const) : ('absent' as const),
            markedAt: undefined,
            deviceIp: undefined
          };
        }
        return r;
      }));
    } catch (err) {
      console.error("Failed to override attendance absent:", err);
    }
  };

  const handleSelectAllToggle = async () => {
    if (!selectedSessionId) return;
    const allPresent = filteredRecords.length > 0 && filteredRecords.every(r => r.status === 'present');
    const nextStatus = allPresent ? 'absent' : 'present';
    
    try {
      // Call update API for each student concurrently
      await Promise.all(filteredRecords.map(r => 
        apiService.updateLecturerAttendance(Number(selectedSessionId), r.studentId, nextStatus)
      ));
      
      const currentSession = sessions.find(s => s.id.toString() === selectedSessionId);
      const isOpen = currentSession ? currentSession.is_open : false;
      
      setRecords(prev => prev.map(r => {
        const isFiltered = filteredRecords.some(fr => fr.studentId === r.studentId);
        if (isFiltered) {
          return {
            ...r,
            status: nextStatus === 'present' 
              ? ('present' as const) 
              : isOpen ? ('pending' as const) : ('absent' as const),
            markedAt: nextStatus === 'present' ? new Date().toISOString() : undefined,
            deviceIp: nextStatus === 'present' ? 'Staff Override' : undefined
          };
        }
        return r;
      }));
    } catch (err) {
      console.error("Failed to toggle all attendance:", err);
    }
  };

  const handleCopyEmail = (email: string, studentId: number) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedStudentId(studentId);
    setTimeout(() => {
      setCopiedStudentId(null);
    }, 2000);
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return dateStr;
      }
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Filter list by search query
  const filteredRecords = records.filter(r => 
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.studentCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: records.length,
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent').length,
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="uipro-card bg-white/75 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="h-5.5 w-5.5 text-brand-blue" />
            Daily Attendance Management
          </h2>
          <p className="text-xs text-slate-500">
            View real student check-in records and perform manual verification overrides directly in the database.
          </p>
        </div>

        {/* Stats summary banner */}
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 text-xs font-semibold text-slate-650">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success-green animate-pulse" />
            <span>Present: <strong className="text-slate-800">{stats.present}</strong></span>
          </div>
          <div className="w-[1px] h-4 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-danger-red" />
            <span>Absent: <strong className="text-slate-800">{stats.absent}</strong></span>
          </div>
          <div className="w-[1px] h-4 bg-slate-200" />
          <span>Total: <strong className="text-slate-800">{stats.total}</strong></span>
        </div>
      </div>

      {/* Control Roster Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Left Side: Filters Card */}
        <div className={`uipro-card bg-white p-5 space-y-4 relative ${isCourseDropdownOpen || isSessionDropdownOpen || isCalendarOpen ? 'z-50' : 'z-10'}`}>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100">
            Class Roster Filters
          </h3>

          <div className="space-y-3 font-sans">
            {/* Course select */}
            <div className="space-y-1 relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject Course</label>
              
              {isCourseDropdownOpen && (
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsCourseDropdownOpen(false)} 
                />
              )}
              
              <div className={`relative ${isCourseDropdownOpen ? 'z-50' : 'z-45'}`}>
                <button
                  type="button"
                  onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
                  className="w-full py-2.5 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100/50 transition-all cursor-pointer"
                >
                  <span className="truncate">
                    {courses.find(c => c.id.toString() === selectedCourseId)
                      ? `${courses.find(c => c.id.toString() === selectedCourseId)?.course_code} - ${courses.find(c => c.id.toString() === selectedCourseId)?.course_name}`
                      : '---Select Subject Course---'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                </button>
                
                {isCourseDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg z-50 animate-in fade-in duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourseId('');
                        setIsCourseDropdownOpen(false);
                      }}
                      className={`group w-full text-left px-4 py-2.5 text-xs text-slate-500 hover:bg-brand-blue hover:text-white transition-all flex flex-col gap-0.5 border-b border-slate-100 last:border-b-0 cursor-pointer ${
                        selectedCourseId === '' ? 'bg-slate-50 font-bold text-brand-blue' : ''
                      }`}
                    >
                      <span className="font-semibold group-hover:text-white/90">---Select Subject Course---</span>
                    </button>
                    {courses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCourseId(c.id.toString());
                          setIsCourseDropdownOpen(false);
                        }}
                        className={`group w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-brand-blue hover:text-white transition-all flex flex-col gap-0.5 border-b border-slate-100 last:border-b-0 cursor-pointer ${
                          selectedCourseId === c.id.toString() ? 'bg-slate-50 font-bold' : ''
                        }`}
                      >
                        <span className="font-semibold font-mono text-brand-blue group-hover:text-white/90 transition-colors">{c.course_code}</span>
                        <span className="text-[10px] text-slate-500 group-hover:text-white/80 transition-colors truncate">{c.course_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Group select */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Class Group</label>
              <div className="flex flex-col gap-1.5">
                {['All', ...getAvailableGroupsForCourse(selectedCourseId)].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGroup(g)}
                    className={`w-full text-left py-2 px-3.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      selectedGroup === g
                        ? 'bg-brand-blue-light border-brand-blue/20 text-brand-blue'
                        : 'bg-slate-50 border-slate-200/50 text-slate-500 hover:bg-slate-100/30'
                    }`}
                  >
                    {g === 'All' ? 'Full Lecture Session' : `Group ${g.replace('G', '')}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar Date Filter */}
            {selectedCourseId && (
              <div className="space-y-1 relative pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Session Date</label>
                
                {isCalendarOpen && (
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsCalendarOpen(false)} 
                  />
                )}

                <div className={`relative ${isCalendarOpen ? 'z-50' : 'z-45'}`}>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                    className="w-full py-2.5 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100/50 transition-all cursor-pointer"
                  >
                    <span className="truncate flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-450 shrink-0" />
                      {selectedDate
                        ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                        : '---Select Session Date---'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {selectedDate && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate('');
                          }}
                          className="p-0.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                          title="Clear date"
                        >
                          <X className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    </div>
                  </button>

                  {isCalendarOpen && (
                    <div className="absolute left-0 right-0 mt-1.5 p-3.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl z-50 animate-in fade-in duration-100 font-sans w-full min-w-[250px]">
                      {/* Calendar Header */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-xs font-bold text-slate-700">
                          {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Weekdays */}
                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                          <div key={d} className="py-0.5">{d}</div>
                        ))}
                      </div>

                      {/* Days Grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {renderCalendar().map((cell, idx) => {
                          const isSelected = cell.dateStr === selectedDate;
                          const isToday = cell.dateStr === getFormattedDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                          
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectDay(cell.dateStr)}
                              className={`py-1.5 text-center text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                                !cell.isCurrentMonth
                                  ? 'text-slate-300 hover:bg-slate-50/50'
                                  : isSelected
                                    ? 'bg-brand-blue text-white shadow-sm font-bold scale-105'
                                    : isToday
                                      ? 'bg-brand-blue-light/50 border border-brand-blue/30 text-brand-blue hover:bg-brand-blue/10'
                                      : 'text-slate-650 hover:bg-slate-100/70 hover:text-slate-800'
                              }`}
                            >
                              {cell.day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Session select */}
            {selectedCourseId && (
              <div className="space-y-1 relative pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Class Session Log</label>
                
                {isSessionDropdownOpen && (
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsSessionDropdownOpen(false)} 
                  />
                )}
                
                <div className={`relative ${isSessionDropdownOpen ? 'z-50' : 'z-45'}`}>
                  <button
                    type="button"
                    onClick={() => setIsSessionDropdownOpen(!isSessionDropdownOpen)}
                    className="w-full py-2.5 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100/50 transition-all cursor-pointer"
                  >
                    <span className="truncate">
                      {groupSessions.find(s => s.id.toString() === selectedSessionId)
                        ? `${new Date(groupSessions.find(s => s.id.toString() === selectedSessionId)!.opened_at!).toLocaleDateString()} (${groupSessions.find(s => s.id.toString() === selectedSessionId)!.is_open ? 'Active' : 'Closed'})`
                        : loadingSessions
                          ? 'Loading Sessions...'
                          : '--- No Session Found ---'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                  </button>
                  
                  {isSessionDropdownOpen && groupSessions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg z-50 animate-in fade-in duration-100">
                      {groupSessions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSessionId(s.id.toString());
                            setIsSessionDropdownOpen(false);
                          }}
                          className={`group w-full text-left px-4 py-2.5 text-xs text-slate-705 hover:bg-brand-blue hover:text-white transition-all flex flex-col gap-0.5 border-b border-slate-100 last:border-b-0 cursor-pointer ${
                            selectedSessionId === s.id.toString() ? 'bg-slate-50 font-bold' : ''
                          }`}
                        >
                          <span className="font-semibold text-slate-800 group-hover:text-white transition-colors">
                            Session Date: {new Date(s.opened_at!).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] text-slate-500 group-hover:text-white/80 transition-colors">
                            Opened: {new Date(s.opened_at!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · {s.is_open ? 'Active' : 'Closed'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Student List Table (Span 3) */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Roster Controls Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200/50 rounded-2xl p-4">
            {/* Search */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search student code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand-blue transition-all"
              />
            </div>
            
            <div className="text-[10px] font-semibold text-slate-400 font-sans uppercase tracking-wider">
               Roster Date: {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {/* Student Table */}
          <div className="uipro-card bg-white overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {/* 1. Checkbox */}
                    <th className="py-4 px-6 text-center w-16">
                      <label className="inline-flex items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!selectedSessionId}
                          checked={filteredRecords.length > 0 && filteredRecords.every(r => r.status === 'present')}
                          onChange={handleSelectAllToggle}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                          filteredRecords.length > 0 && filteredRecords.every(r => r.status === 'present')
                            ? 'bg-brand-blue border-brand-blue text-white shadow-xs scale-105'
                            : 'bg-slate-50 border-slate-200 text-transparent hover:border-slate-350 hover:bg-slate-100/50'
                        }`}>
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      </label>
                    </th>
                    {/* 2. Student ID */}
                    <th className="py-4 px-6">Student ID</th>
                    {/* 3. Student Info */}
                    <th className="py-4 px-6">Student Info</th>
                    {/* 4. Class Session */}
                    <th className="py-4 px-6 text-center">Class Session</th>
                    {/* 5. Check-in Time */}
                    <th className="py-4 px-6 text-center">Check-in Time</th>
                    {/* 6. Device IP */}
                    <th className="py-4 px-6 text-center">Device IP</th>
                    {/* 7. Status */}
                    <th className="py-4 px-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                  {selectedCourseId === '' ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold uppercase tracking-wider">
                        Please select a subject course to view the attendance roster.
                      </td>
                    </tr>
                  ) : selectedSessionId === '' ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400/80 font-semibold uppercase tracking-wider p-6">
                        <div className="flex flex-col items-center gap-2">
                          <AlertTriangle className="h-6 w-6 text-amber-500" />
                          {selectedDate ? (
                            <>
                              <span>No class sessions found on {new Date(selectedDate + 'T00:00:00').toLocaleDateString()}.</span>
                              <span className="text-[10px] text-slate-400 normal-case font-medium">Try choosing a different date or clear the filter.</span>
                            </>
                          ) : (
                            <>
                              <span>No class sessions found for this course group.</span>
                              <span className="text-[10px] text-slate-400 normal-case font-medium">Please launch an active session from the dashboard first.</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold uppercase tracking-wider">
                        No students match this query.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => {
                      const isPresent = record.status === 'present';
                      const selectedCourse = courses.find(c => c.id.toString() === selectedCourseId);
                      const currentSession = sessions.find(s => s.id.toString() === selectedSessionId);
                      
                      const openedDateStr = currentSession?.opened_at
                        ? new Date(currentSession.opened_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        : '';
                      const day = selectedCourse?.schedule_day || 'N/A';
                      const start = selectedCourse?.schedule_start ? selectedCourse.schedule_start.substring(0, 5) : '';
                      const end = selectedCourse?.schedule_end ? selectedCourse.schedule_end.substring(0, 5) : '';
                      const scheduleStr = start && end ? `${day} ${start}-${end}` : day;
                      const sessionDateTimeStr = openedDateStr ? `${openedDateStr} (${scheduleStr})` : scheduleStr;

                      let statusBadgeClass = '';
                      let statusText = '';
                      if (record.status === 'present') {
                        statusBadgeClass = 'bg-emerald-50 text-emerald-600 border border-emerald-200/50';
                        statusText = 'Present';
                      } else if (record.status === 'absent') {
                        statusBadgeClass = 'bg-rose-50 text-rose-600 border border-rose-200/50';
                        statusText = 'Absent';
                      } else {
                        statusBadgeClass = 'bg-amber-50 text-amber-600 border border-amber-200/50';
                        statusText = 'Pending';
                      }

                      return (
                        <tr key={record.studentId} className="hover:bg-slate-50/50 transition-colors">
                          {/* 1. Checkbox Status */}
                          <td className="py-4 px-6 text-center">
                            <label className="inline-flex items-center justify-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isPresent}
                                onChange={() => isPresent ? handleMarkAbsent(record.studentId) : handleMarkPresent(record.studentId)}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                                isPresent
                                  ? 'bg-brand-blue border-brand-blue text-white shadow-xs scale-105'
                                  : 'bg-slate-50 border-slate-200 text-transparent hover:border-slate-350 hover:bg-slate-100/50'
                              }`}>
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              </div>
                            </label>
                          </td>

                          {/* 2. Student ID */}
                          <td className="py-4 px-6 font-mono font-semibold text-slate-500">
                            {record.studentCode}
                          </td>

                          {/* 3. Student Info (Name, Hover Tooltip, Click to Copy) */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-brand-blue border border-slate-200/50 flex items-center justify-center font-bold">
                                {record.studentName.charAt(0).toUpperCase()}
                              </div>
                              <div className="relative group inline-block">
                                <span
                                  onClick={() => handleCopyEmail(record.studentEmail, record.studentId)}
                                  className="font-extrabold text-slate-800 leading-tight hover:text-brand-blue transition-colors cursor-pointer"
                                >
                                  {record.studentName}
                                </span>
                                {/* Tooltip */}
                                <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block z-10 bg-slate-800 text-white text-[9.5px] rounded-lg px-2.5 py-1.5 shadow-md whitespace-nowrap font-sans font-medium transition-opacity">
                                  {copiedStudentId === record.studentId ? 'Copied email!' : `Click to copy: ${record.studentEmail || 'No email'}`}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 4. Class Session */}
                          <td className="py-4 px-6 text-center font-semibold text-slate-500">
                            {sessionDateTimeStr}
                          </td>

                          {/* 5. Check-in Time */}
                          <td className="py-4 px-6 text-center font-mono text-slate-600">
                            {formatDateTime(record.markedAt)}
                          </td>

                          {/* 6. Device IP */}
                          <td className="py-4 px-6 text-center font-mono text-slate-500">
                            {isPresent ? (record.deviceIp || 'Staff Manual') : '—'}
                          </td>

                          {/* 7. Status */}
                          <td className="py-4 px-6 text-center">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 font-bold uppercase tracking-wider text-[9px] ${statusBadgeClass}`}>
                                {statusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
