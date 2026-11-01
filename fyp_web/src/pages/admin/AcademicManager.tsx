import { TextInput } from '../../components/LimitedTextField';
import { SemestersPanel } from '../../components/SemestersPanel';
import { FloatingPanel } from '../../components/FloatingPanel';
import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../../services/api';
import type { Student, AdminStaff, Programme, Course, CourseStaffAssignment, Enrolment } from '../../services/api';
import { swalSuccess, swalError, swalConfirm } from '../../utils/swal';
import {
  Layers,
  BookOpen,
  UserCheck,
  GraduationCap,
  Plus,
  Trash2,
  ChevronDown,
  Check,
  RefreshCw,
  FolderOpen,
  Briefcase,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CalendarDays
} from 'lucide-react';
import { ShimmerAcademics } from '../../components/Shimmer';

/** A bespoke picker's open list in the CustomDropdown look: pale selected and hover rows, rounded and padded, the scrollbar inside the rounded shell. */
const MenuPanel: React.FC<{ footer?: React.ReactNode; children: React.ReactNode }> = ({ footer, children }) => (
  <FloatingPanel clip className="absolute left-0 right-0 mt-1.5 flex flex-col rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 dark:border-slate-800 dark:bg-slate-900">
    <div className="custom-scrollbar min-h-0 max-h-52 space-y-0.5 overflow-y-auto pr-0.5">{children}</div>
    {footer && <div className="mt-1 shrink-0 border-t border-slate-100 pt-1 dark:border-slate-800">{footer}</div>}
  </FloatingPanel>
);

const MenuOption: React.FC<{ primary: string; secondary?: string; aside?: React.ReactNode; label?: string; selected?: boolean; disabled?: boolean; mono?: boolean; secondaryMono?: boolean; onSelect: () => void }> = ({ primary, secondary, aside, label, selected = false, disabled = false, mono = false, secondaryMono = false, onSelect }) => (
  <button type="button" disabled={disabled} aria-current={selected ? 'true' : undefined} aria-label={label ?? (secondary ? `${primary}, ${secondary}` : undefined)} onClick={onSelect}
    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${disabled ? 'cursor-not-allowed text-slate-400 dark:text-slate-500' : 'cursor-pointer'} ${selected
      ? 'bg-blue-50/90 text-brand-blue dark:bg-blue-500/10 dark:text-blue-400'
      : disabled ? '' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'}`}>
    <span className="flex min-w-0 flex-col">
      <span className={`truncate font-bold ${mono ? 'font-mono' : ''}`}>{primary}</span>
      {secondary && <span className={`truncate text-[10px] font-medium ${secondaryMono ? 'font-mono' : ''} ${selected ? 'text-blue-700/80 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>{secondary}</span>}
    </span>
    {aside}
    {selected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-blue dark:text-blue-400" />}
  </button>
);

type ApiFailure = { response?: { status: number; data?: { detail?: string } } };
type SubTab = 'programmes' | 'courses' | 'staff' | 'students' | 'semesters';
const LEDGER_PAGE_SIZE = 6;

export const AcademicManager: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('programmes');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);   // the first load has settled: later loads (Sync, after a save) keep the page and its drafts
  const [loadFailed, setLoadFailed] = useState(false);
  const [coursesFailed, setCoursesFailed] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState<Record<SubTab, string>>({ programmes: '', courses: '', staff: '', students: '', semesters: '' });
  const [ledgerPage, setLedgerPage] = useState<Record<SubTab, number>>({ programmes: 1, courses: 1, staff: 1, students: 1, semesters: 1 });

  // States
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<CourseStaffAssignment[]>([]);
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);

  // Form states - Programme
  const [progName, setProgName] = useState('');
  const [progCode, setProgCode] = useState('');
  const [programmeErrors, setProgrammeErrors] = useState<{ code?: string; name?: string }>({});

  // Form states - Course
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseCreditHours, setCourseCreditHours] = useState('3');
  const [courseProgId, setCourseProgId] = useState('');
  const [courseProgLabel, setCourseProgLabel] = useState('');
  const [isCourseProgDropdownOpen, setIsCourseProgDropdownOpen] = useState(false);

  // Form states - Staff Assignment
  const [assignLecturerId, setAssignLecturerId] = useState('');
  const [assignLecturerLabel, setAssignLecturerLabel] = useState('');
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignCourseLabel, setAssignCourseLabel] = useState('');
  const [assignRole, setAssignRole] = useState<'Lecturer' | 'Tutor' | 'Practical'>('Lecturer');
  const [isAssignStaffDropdownOpen, setIsAssignStaffDropdownOpen] = useState(false);
  const [isAssignCourseDropdownOpen, setIsAssignCourseDropdownOpen] = useState(false);
  const [isAssignRoleDropdownOpen, setIsAssignRoleDropdownOpen] = useState(false);

  // Form states - Student Programme
  const [studProgId, setStudProgId] = useState('');
  const [studProgLabel, setStudProgLabel] = useState('');
  const [selectedStudentIdForProg, setSelectedStudentIdForProg] = useState('');
  const [selectedStudentLabelForProg, setSelectedStudentLabelForProg] = useState('');
  const [isStudProgDropdownOpen, setIsStudProgDropdownOpen] = useState(false);
  const [isProgSelectDropdownOpen, setIsProgSelectDropdownOpen] = useState(false);

  // Form states - Student Enrolment
  const [enrolStudentId, setEnrolStudentId] = useState('');
  const [enrolStudentLabel, setEnrolStudentLabel] = useState('');
  const [enrolCourseId, setEnrolCourseId] = useState('');
  const [enrolCourseLabel, setEnrolCourseLabel] = useState('');
  const [enrolGroup, setEnrolGroup] = useState('G1');
  const [enrolSemester, setEnrolSemester] = useState('2026-Semester 1');
  const [isEnrolStudentDropdownOpen, setIsEnrolStudentDropdownOpen] = useState(false);
  const [isEnrolCourseDropdownOpen, setIsEnrolCourseDropdownOpen] = useState(false);
  const [isEnrolGroupDropdownOpen, setIsEnrolGroupDropdownOpen] = useState(false);
  const [savingStudentAllocation, setSavingStudentAllocation] = useState(false);
  const savingAllocationRef = useRef(false);

  const loadAllData = async () => {
    setLoading(true);
    // Each list loads and applies on its own: one failing request must not blank the others (a missing course list used to hide the programmes too).
    const track = <T,>(request: Promise<T>, apply: (value: T) => void) => request.then(apply).then(() => true, (error: unknown) => {
      console.error("Failed to load academic data:", error);
      return false;
    });
    const results = await Promise.all([
      track(apiService.adminGetStudents(), value => setStudents(value.items)),
      track(apiService.adminGetStaff(), value => setStaff(value.items)),
      track(apiService.adminGetProgrammes(), setProgrammes),
      track(apiService.adminGetCourses(), setCourses),
      track(apiService.adminGetAssignments(), setAssignments),
      track(apiService.adminGetEnrolments(), setEnrolments),
    ]);
    setLoadFailed(results.includes(false));
    setCoursesFailed(!results[3]);
    setLoading(false);
    setLoaded(true);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const getAvailableGroupsForCourse = (courseId: string): { value: string; label: string }[] => {
    const inUse = Array.from(new Set(
      enrolments
        .filter(e => e.course_id.toString() === courseId)
        .map(e => e.class_group)
    )).filter(g => g.startsWith('G'));

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

    return inUse.map(g => ({
      value: g,
      label: `Group ${g.replace('G', '')}`
    }));
  };

  const handleCreateNewGroup = () => {
    if (!enrolCourseId) return;
    const currentGroups = getAvailableGroupsForCourse(enrolCourseId);
    const highestGroup = currentGroups[currentGroups.length - 1].value;
    const highestNum = parseInt(highestGroup.replace('G', '')) || 1;
    const nextGroup = `G${highestNum + 1}`;
    
    const manualKey = `sas_manual_groups_${enrolCourseId}`;
    try {
      const storedManual = JSON.parse(localStorage.getItem(manualKey) || '[]');
      if (!storedManual.includes(nextGroup)) {
        storedManual.push(nextGroup);
        localStorage.setItem(manualKey, JSON.stringify(storedManual));
      }
    } catch (e) {
      console.error(e);
    }
    
    setEnrolGroup(nextGroup);
    setIsEnrolGroupDropdownOpen(false);
  };

  // CRUD Actions
  const handleAddProgramme = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { code?: string; name?: string } = {};
    if (!progCode.trim()) nextErrors.code = 'Code required';
    if (!progName.trim()) nextErrors.name = 'Name required';
    setProgrammeErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await apiService.adminCreateProgramme({ name: progName.trim(), code: progCode.trim() });
      setProgName('');
      setProgCode('');
      setProgrammeErrors({});
      loadAllData();
      await swalSuccess('Programme Registered', 'Study programme added successfully.');
    } catch (err: any) {
      const detail = String(err.response?.data?.detail || err.message || '').toLowerCase();
      if (err.response?.status === 409 || detail.includes('exist') || detail.includes('duplicate')) {
        setProgrammeErrors({ code: 'Code exists' });
      } else if (err.response?.status === 422) {
        await swalError('Invalid data', 'Check fields.');
      } else {
        await swalError('Save failed', 'Try again.');
      }
    }
  };

  const handleDeleteProgramme = async (id: number | string) => {
    const isConfirmed = await swalConfirm(
      'Delete Programme?',
      'Students and courses in this programme will be left without a programme.',
      'Yes, delete it'
    );
    if (!isConfirmed) return;
    try {
      await apiService.adminDeleteProgramme(id);
      loadAllData();
      await swalSuccess('Programme Deleted', 'Programme removed successfully.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName || !courseCode) return;
    try {
      await apiService.adminCreateCourse({
        course_name: courseName,
        course_code: courseCode,
        credit_hours: parseFloat(courseCreditHours) || 3.0,
        lecturer_id: null,
        programme_id: courseProgId || null
      });
      setCourseName('');
      setCourseCode('');
      setCourseCreditHours('3');
      setCourseProgId('');
      setCourseProgLabel('');
      loadAllData();
      await swalSuccess('Course Created', 'Course module provisioned successfully.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleDeleteCourse = async (id: number | string) => {
    const isConfirmed = await swalConfirm(
      'Delete Course?',
      'All student enrolments in this course will also be removed.',
      'Yes, delete it'
    );
    if (!isConfirmed) return;
    try {
      await apiService.adminDeleteCourse(id);
      loadAllData();
      await swalSuccess('Course Deleted', 'Course and enrolments removed.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignLecturerId || !assignCourseId) return;
    try {
      await apiService.adminCreateAssignment({
        course_id: assignCourseId,
        lecturer_id: assignLecturerId,
        role: assignRole
      });
      setAssignLecturerId('');
      setAssignLecturerLabel('');
      setAssignCourseId('');
      setAssignCourseLabel('');
      loadAllData();
      await swalSuccess('Staff Assigned', 'Academic staff role assigned to course successfully.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleDeleteAssignment = async (id: number | string) => {
    const isConfirmed = await swalConfirm('Remove this role assignment?', '', 'Yes, remove it');
    if (!isConfirmed) return;
    try {
      await apiService.adminDeleteAssignment(id);
      loadAllData();
      await swalSuccess('Assignment Removed', 'Staff role assignment has been unlinked.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleSaveStudentAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAllocationRef.current) return;   // a second click while the first save is still running (a ref: state only updates after the next render)
    if (!selectedStudentIdForProg || !studProgId || !enrolStudentId || !enrolCourseId || !enrolGroup || !enrolSemester.trim()) {
      await swalError('Incomplete Allocation', 'Select a student, programme, course, group and semester first.');
      return;
    }
    if (selectedStudentIdForProg !== enrolStudentId) {
      await swalError('Different Students', 'The programme and the course must be saved for the same student.');
      return;
    }
    const allocation = { student_id: enrolStudentId, programme_id: studProgId, course_id: enrolCourseId, semester: enrolSemester.trim(), class_group: enrolGroup };
    savingAllocationRef.current = true;
    setSavingStudentAllocation(true);
    let notice: () => Promise<unknown>;
    let refresh = true;   // a plain refusal changed nothing, so only a save or an unconfirmed attempt reads the lists again
    try {
      let saved;
      try {
        saved = await apiService.adminSaveStudentAllocation(allocation);
      } catch (err) {
        if ((err as ApiFailure).response && (err as ApiFailure).response!.status < 500) throw err;   // the system answered: that is the real reason
        saved = await apiService.adminSaveStudentAllocation(allocation);   // lost answer: repeating is safe, it says "already saved" if the first try went through
      }
      setSelectedStudentIdForProg('');
      setSelectedStudentLabelForProg('');
      setStudProgId('');
      setStudProgLabel('');
      setEnrolStudentId('');
      setEnrolStudentLabel('');
      setEnrolCourseId('');
      setEnrolCourseLabel('');
      notice = () => saved.programme_changed || saved.enrolled
        ? swalSuccess('Allocation Saved', 'The programme allocation and course enrolment were saved successfully.')
        : swalSuccess('Already Saved', 'This allocation was already saved. Nothing changed.');
    } catch (err) {
      const answer = (err as ApiFailure).response;
      refresh = !(answer && answer.status < 500);
      notice = refresh
        ? () => swalError('Could Not Confirm', "The connection failed, so we can't tell if this was saved. The lists were refreshed; please check them before trying again. What you entered is kept.")
        : () => swalError('Error', answer?.data?.detail || 'Operation failed');
    }
    // Free the button before the lists and the toast: neither may keep "Saving Allocation..." on screen.
    savingAllocationRef.current = false;
    setSavingStudentAllocation(false);
    if (refresh) await loadAllData();
    await notice();
  };

  const chooseAllocationStudent = (student: Student) => {
    // One student for both parts of the form, so the programme can never go to one student and the course to another.
    const label = `${student.name} (${student.student_code})`;
    setSelectedStudentIdForProg(String(student.id));
    setSelectedStudentLabelForProg(label);
    setEnrolStudentId(String(student.id));
    setEnrolStudentLabel(label);
  };

  const handleDeleteEnrolment = async (id: number | string) => {
    const isConfirmed = await swalConfirm('Drop this course enrolment?', '', 'Yes, drop it');
    if (!isConfirmed) return;
    try {
      await apiService.adminDeleteEnrolment(id);
      loadAllData();
      await swalSuccess('Enrolment Dropped', 'Student course enrolment removed.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const selectedProgrammeStudent = students.find(
    student => String(student.id) === selectedStudentIdForProg
  );
  const selectedEnrolmentStudent = students.find(
    student => String(student.id) === enrolStudentId
  );
  const selectedProgrammeStudentDisplay = selectedStudentLabelForProg || (
    selectedProgrammeStudent
      ? `${selectedProgrammeStudent.name} (${selectedProgrammeStudent.student_code})`
      : '-- Select Student --'
  );
  const selectedEnrolmentStudentDisplay = enrolStudentLabel || (
    selectedEnrolmentStudent
      ? `${selectedEnrolmentStudent.name} (${selectedEnrolmentStudent.student_code})`
      : '-- Select Student --'
  );
  const courseProgrammeDisplay = courseProgLabel || (() => {
    const programme = programmes.find(item => String(item.id) === courseProgId);
    return programme
      ? `${programme.code} - ${programme.name}`
      : '-- Select Programme (Optional) --';
  })();
  const assignmentLecturerDisplay = assignLecturerLabel || (() => {
    const lecturer = staff.find(item => String(item.id) === assignLecturerId);
    return lecturer
      ? `${lecturer.name} (${lecturer.staff_id})`
      : '-- Select Lecturer --';
  })();
  const assignmentCourseDisplay = assignCourseLabel || (() => {
    const course = courses.find(item => String(item.id) === assignCourseId);
    return course
      ? `${course.course_code} - ${course.course_name}`
      : '-- Select Course --';
  })();
  const studyProgrammeDisplay = studProgLabel || (() => {
    const programme = programmes.find(item => String(item.id) === studProgId);
    return programme ? `${programme.code} - ${programme.name}` : '-- Select Programme --';
  })();
  const enrolCourseDisplay = enrolCourseLabel || (() => {
    const course = courses.find(item => String(item.id) === enrolCourseId);
    return course ? `${course.course_code} - ${course.course_name}` : '-- Select Course --';
  })();
  const enrolGroupDisplay = enrolGroup.startsWith('G')
    ? `Group ${enrolGroup.slice(1)}`
    : enrolGroup || '-- Select Group --';

  const activeSearch = ledgerSearch[activeSubTab].trim().toLowerCase();
  const includesSearch = (...values: unknown[]) =>
    !activeSearch || values.some(value => String(value ?? '').toLowerCase().includes(activeSearch));
  const filteredProgrammes = programmes.filter(p => includesSearch(p.code, p.name));
  const filteredCourses = courses.filter(c => includesSearch(c.course_code, c.course_name, c.programme_name, c.credit_hours));
  const filteredAssignments = assignments.filter(a => includesSearch(a.lecturer_name, a.course_code, a.course_name, a.role));
  const filteredStudents = students.filter(s => {
    const programme = programmes.find(p => p.id === s.programme_id);
    const studentEnrolments = enrolments.filter(e => e.student_id === s.id);
    return includesSearch(
      s.name,
      s.student_code,
      programme?.code,
      programme?.name,
      ...studentEnrolments.flatMap(e => [e.course_code, e.course_name, e.class_group])
    );
  });
  const activeTotal = activeSubTab === 'programmes' ? filteredProgrammes.length
    : activeSubTab === 'courses' ? filteredCourses.length
    : activeSubTab === 'staff' ? filteredAssignments.length
    : filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(activeTotal / LEDGER_PAGE_SIZE));
  const activePage = Math.min(ledgerPage[activeSubTab], totalPages);
  const pageStart = (activePage - 1) * LEDGER_PAGE_SIZE;
  const pagedProgrammes = filteredProgrammes.slice(pageStart, pageStart + LEDGER_PAGE_SIZE);
  const pagedCourses = filteredCourses.slice(pageStart, pageStart + LEDGER_PAGE_SIZE);
  const pagedAssignments = filteredAssignments.slice(pageStart, pageStart + LEDGER_PAGE_SIZE);
  const pagedStudents = filteredStudents.slice(pageStart, pageStart + LEDGER_PAGE_SIZE);

  const updateLedgerSearch = (value: string) => {
    setLedgerSearch(current => ({ ...current, [activeSubTab]: value }));
    setLedgerPage(current => ({ ...current, [activeSubTab]: 1 }));
  };

  const changeLedgerPage = (page: number) => {
    setLedgerPage(current => ({ ...current, [activeSubTab]: Math.max(1, Math.min(page, totalPages)) }));
  };

  // Before the first data arrives the whole page is a skeleton of its real layout; after that only a refresh indicator shows, so a draft is never wiped.
  if (loading && !loaded) return <ShimmerAcademics tab={activeSubTab} />;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="uipro-card bg-white/75 backdrop-blur-md relative overflow-hidden p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        <div className="space-y-1">
          <h2 className="text-xl font-display font-extrabold text-slate-800 flex items-center gap-2">
            <GraduationCap className="h-5.5 w-5.5 text-brand-blue" />
            Academics
          </h2>
          <p className="text-xs text-slate-400">
            Manage programmes, courses, staff, and student enrollments.
          </p>
        </div>
        <button
          onClick={loadAllData}
          disabled={loading}
          aria-busy={loading}
          className="flex items-center gap-2 py-2 px-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          Sync Records
        </button>
      </div>

      {loadFailed && !loading && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-700">
        <span>Some records could not be loaded. These lists may be incomplete.</span>
        <button type="button" onClick={loadAllData} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold"><RefreshCw className="h-3.5 w-3.5" />Retry</button>
      </div>}

      {/* Primary Sub-Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-150/50 p-1 rounded-xl border border-slate-200/50 max-w-2xl text-xs font-sans">
        {[
          { id: 'programmes', label: 'Programmes', icon: Layers },
          { id: 'courses', label: 'Courses', icon: BookOpen },
          { id: 'staff', label: 'Staff Roles', icon: Briefcase },
          { id: 'students', label: 'Student Allocation', icon: UserCheck },
          { id: 'semesters', label: 'Semesters', icon: CalendarDays }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SubTab)}
              className={`flex-grow py-2 px-3 rounded-lg font-semibold tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeSubTab === tab.id ? 'bg-white text-slate-900 shadow-sm border border-slate-205/50' : 'text-slate-500 hover:text-slate-950'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Form and Grid Area */}
      {activeSubTab === 'semesters' ? <SemestersPanel programmes={programmes} courses={courses} onSaved={loadAllData} coursesLoading={loading} coursesError={coursesFailed} onRetryCourses={loadAllData} onOpenCourses={() => setActiveSubTab('courses')} /> : <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Input Form */}
        <div className="uipro-card bg-white/80 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Plus className="h-4.5 w-4.5 text-brand-blue" />
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800">
              {activeSubTab === 'programmes' && 'Register Programme'}
              {activeSubTab === 'courses' && 'Create Course Scope'}
              {activeSubTab === 'staff' && 'Assign Staff Role'}
              {activeSubTab === 'students' && 'Allocate Student Track'}
            </h3>
          </div>

          {activeSubTab === 'programmes' && (
            <form noValidate onSubmit={handleAddProgramme} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Programme Code</label>
                <TextInput
                  type="text"
                  placeholder="e.g. BCSF"
                  value={progCode}
                  onChange={e => {
                    setProgCode(e.target.value.toUpperCase());
                    if (programmeErrors.code) setProgrammeErrors(current => ({ ...current, code: undefined }));
                  }}
                  aria-invalid={Boolean(programmeErrors.code)}
                  aria-describedby={programmeErrors.code ? 'programme-code-error' : undefined}
                  className={`w-full uipro-input ${programmeErrors.code ? '!border-rose-400 !ring-2 !ring-rose-100' : ''}`}
                />
                {programmeErrors.code && (
                  <p id="programme-code-error" role="alert" className="flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                    <AlertCircle className="h-3 w-3" /> {programmeErrors.code}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Programme Description Name</label>
                <TextInput
                  type="text"
                  placeholder="e.g. Bachelor of Computer Science (Honours)"
                  value={progName}
                  onChange={e => {
                    setProgName(e.target.value);
                    if (programmeErrors.name) setProgrammeErrors(current => ({ ...current, name: undefined }));
                  }}
                  aria-invalid={Boolean(programmeErrors.name)}
                  aria-describedby={programmeErrors.name ? 'programme-name-error' : undefined}
                  className={`w-full uipro-input ${programmeErrors.name ? '!border-rose-400 !ring-2 !ring-rose-100' : ''}`}
                />
                {programmeErrors.name && (
                  <p id="programme-name-error" role="alert" className="flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                    <AlertCircle className="h-3 w-3" /> {programmeErrors.name}
                  </p>
                )}
              </div>
              <button type="submit" className="w-full uipro-button uipro-button-primary mt-2">
                Save Programme
              </button>
            </form>
          )}

          {activeSubTab === 'courses' && (
            <form onSubmit={handleAddCourse} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Course Code</label>
                <TextInput
                  type="text"
                  required
                  placeholder="e.g. CS-202"
                  value={courseCode}
                  onChange={e => setCourseCode(e.target.value.toUpperCase())}
                  className="w-full uipro-input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Course Title</label>
                <TextInput
                  type="text"
                  required
                  placeholder="e.g. Database Management Systems"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  className="w-full uipro-input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Credit Hours</label>
                <input
                  type="number"
                  required
                  min="0.5"
                  max="12"
                  step="0.5"
                  placeholder="e.g. 3"
                  value={courseCreditHours}
                  onChange={e => setCourseCreditHours(e.target.value)}
                  className="w-full uipro-input"
                />
              </div>
              <div className="space-y-1 relative">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Linked Study Programme</label>
                {isCourseProgDropdownOpen && (
                  <div className="fixed inset-0 z-30" onClick={() => setIsCourseProgDropdownOpen(false)} />
                )}
                <div className={`relative ${isCourseProgDropdownOpen ? 'z-50' : 'z-10'}`}>
                  <button
                    key={`course-programme-trigger-${courseProgId}`}
                    type="button"
                    onClick={() => setIsCourseProgDropdownOpen(!isCourseProgDropdownOpen)}
                    className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                  >
                    <span key={`course-programme-label-${courseProgId}`} className="truncate">
                      {courseProgrammeDisplay}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                  </button>
                  {isCourseProgDropdownOpen && (
                    <MenuPanel>
                      <MenuOption primary="-- None --" selected={!courseProgId} onSelect={() => { setCourseProgId(''); setCourseProgLabel(''); setIsCourseProgDropdownOpen(false); }} />
                      {programmes.map(p => (
                        <MenuOption key={p.id} primary={p.code} secondary={p.name} selected={courseProgId === p.id.toString()}
                          onSelect={() => { setCourseProgId(p.id.toString()); setCourseProgLabel(`${p.code} - ${p.name}`); setIsCourseProgDropdownOpen(false); }} />
                      ))}
                    </MenuPanel>
                  )}
                </div>
              </div>
              <button type="submit" className="w-full uipro-button uipro-button-primary mt-2">
                Save Course Scope
              </button>
            </form>
          )}

          {activeSubTab === 'staff' && (
            <form onSubmit={handleAddAssignment} className="space-y-4 font-sans text-xs">
              {/* Staff Dropdown */}
              <div className="space-y-1 relative">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Select Lecturer/Staff</label>
                {isAssignStaffDropdownOpen && (
                  <div className="fixed inset-0 z-30" onClick={() => setIsAssignStaffDropdownOpen(false)} />
                )}
                <div className={`relative ${isAssignStaffDropdownOpen ? 'z-50' : 'z-20'}`}>
                  <button
                    key={`assignment-lecturer-trigger-${assignLecturerId}`}
                    type="button"
                    onClick={() => setIsAssignStaffDropdownOpen(!isAssignStaffDropdownOpen)}
                    className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                  >
                    <span key={`assignment-lecturer-label-${assignLecturerId}`} className="truncate">
                      {assignmentLecturerDisplay}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                  {isAssignStaffDropdownOpen && (
                    <MenuPanel>
                      {staff.map(s => (
                        <MenuOption key={s.id} primary={s.name} secondary={s.staff_id} selected={assignLecturerId === s.id.toString()}
                          onSelect={() => { setAssignLecturerId(s.id.toString()); setAssignLecturerLabel(`${s.name} (${s.staff_id})`); setIsAssignStaffDropdownOpen(false); }} />
                      ))}
                    </MenuPanel>
                  )}
                </div>
              </div>

              {/* Course Dropdown */}
              <div className="space-y-1 relative">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Select Course Module</label>
                {isAssignCourseDropdownOpen && (
                  <div className="fixed inset-0 z-30" onClick={() => setIsAssignCourseDropdownOpen(false)} />
                )}
                <div className={`relative ${isAssignCourseDropdownOpen ? 'z-50' : 'z-10'}`}>
                  <button
                    key={`assignment-course-trigger-${assignCourseId}`}
                    type="button"
                    onClick={() => setIsAssignCourseDropdownOpen(!isAssignCourseDropdownOpen)}
                    className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                  >
                    <span key={`assignment-course-label-${assignCourseId}`} className="truncate">
                      {assignmentCourseDisplay}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                  {isAssignCourseDropdownOpen && (
                    <MenuPanel>
                      {courses.map(c => (
                        <MenuOption key={c.id} mono primary={c.course_code} secondary={c.course_name} selected={assignCourseId === c.id.toString()}
                          onSelect={() => { setAssignCourseId(c.id.toString()); setAssignCourseLabel(`${c.course_code} - ${c.course_name}`); setIsAssignCourseDropdownOpen(false); }} />
                      ))}
                    </MenuPanel>
                  )}
                </div>
              </div>

              {/* Role Select */}
              <div className="space-y-1 relative">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Assigned Role Type</label>
                {isAssignRoleDropdownOpen && (
                  <div className="fixed inset-0 z-30" onClick={() => setIsAssignRoleDropdownOpen(false)} />
                )}
                <div className={`relative ${isAssignRoleDropdownOpen ? 'z-50' : 'z-0'}`}>
                  <button
                    key={`assignment-role-trigger-${assignRole}`}
                    type="button"
                    onClick={() => setIsAssignRoleDropdownOpen(!isAssignRoleDropdownOpen)}
                    className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                  >
                    <span key={`assignment-role-label-${assignRole}`}>{assignRole}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                  {isAssignRoleDropdownOpen && (
                    <MenuPanel>
                      {(['Lecturer', 'Tutor', 'Practical'] as const).map(r => (
                        <MenuOption key={r} primary={r} selected={assignRole === r} onSelect={() => { setAssignRole(r); setIsAssignRoleDropdownOpen(false); }} />
                      ))}
                    </MenuPanel>
                  )}
                </div>
              </div>

              <button type="submit" className="w-full uipro-button uipro-button-primary mt-2">
                Allocate Staff Assignment
              </button>
            </form>
          )}

          {activeSubTab === 'students' && (
            <form onSubmit={handleSaveStudentAllocation} className="space-y-6">
              {/* Form 1: Allocate Student to Program */}
              <div className="space-y-4 border-b border-slate-200 pb-5 text-xs">
                <h4 className="font-extrabold text-slate-900 text-[10px] uppercase tracking-wider">Allocate Study Programme</h4>
                
                {/* Student Select */}
                <div className="space-y-1 relative">
                  <label className="text-slate-700 font-bold uppercase tracking-wider text-[9px]">Select Student</label>
                  {isStudProgDropdownOpen && (
                    <div className="fixed inset-0 z-30" onClick={() => setIsStudProgDropdownOpen(false)} />
                  )}
                  <div className={`relative ${isStudProgDropdownOpen ? 'z-50' : 'z-20'}`}>
                    <button
                      key={`programme-student-trigger-${selectedStudentIdForProg}`}
                      type="button"
                      onClick={() => setIsStudProgDropdownOpen(!isStudProgDropdownOpen)}
                      aria-expanded={isStudProgDropdownOpen}
                      className="w-full min-h-11 py-2.5 text-left flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 shadow-sm hover:border-brand-blue hover:bg-slate-100/50 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 transition-colors"
                    >
                      <span
                        key={`programme-student-label-${selectedStudentIdForProg}`}
                        className={`truncate ${selectedStudentIdForProg ? 'font-bold' : 'text-slate-600'}`}
                      >
                        {selectedProgrammeStudentDisplay}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isStudProgDropdownOpen ? 'rotate-180 text-brand-blue' : 'text-slate-500'}`} />
                    </button>
                    {isStudProgDropdownOpen && (
                      <MenuPanel>
                        {students.filter(s => s.programme_id === null || s.programme_id === undefined).length === 0 ? (
                          <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">No unallocated students available</div>
                        ) : (
                          students.filter(s => s.programme_id === null || s.programme_id === undefined).map(s => (
                            <MenuOption key={s.id} mono primary={s.name} secondary={s.student_code} selected={String(s.id) === selectedStudentIdForProg}
                              onSelect={() => { chooseAllocationStudent(s); setIsStudProgDropdownOpen(false); }} />
                          ))
                        )}
                      </MenuPanel>
                    )}
                  </div>
                </div>

                {/* Program Select */}
                <div className="space-y-1 relative">
                  <label className="text-slate-700 font-bold uppercase tracking-wider text-[9px]">Study Programme</label>
                  {isProgSelectDropdownOpen && (
                    <div className="fixed inset-0 z-30" onClick={() => setIsProgSelectDropdownOpen(false)} />
                  )}
                  <div className={`relative ${isProgSelectDropdownOpen ? 'z-50' : 'z-10'}`}>
                    <button
                      key={`study-programme-trigger-${studProgId}`}
                      type="button"
                      onClick={() => setIsProgSelectDropdownOpen(!isProgSelectDropdownOpen)}
                      className="w-full min-h-11 py-2.5 text-left flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold text-slate-700 shadow-sm hover:border-brand-blue hover:bg-slate-100/50 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 transition-colors"
                    >
                      <span key={`study-programme-label-${studProgId}`} className="truncate">
                        {studyProgrammeDisplay}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isProgSelectDropdownOpen ? 'rotate-180 text-brand-blue' : 'text-slate-500'}`} />
                    </button>
                    {isProgSelectDropdownOpen && (
                      <MenuPanel>
                        <MenuOption primary="-- None / Remove Programme --" selected={!studProgId} onSelect={() => { setStudProgId(''); setStudProgLabel(''); setIsProgSelectDropdownOpen(false); }} />
                        {programmes.map(p => (
                          <MenuOption key={p.id} primary={p.code} secondary={p.name} selected={studProgId === p.id.toString()}
                            onSelect={() => { setStudProgId(p.id.toString()); setStudProgLabel(`${p.code} - ${p.name}`); setIsProgSelectDropdownOpen(false); }} />
                        ))}
                      </MenuPanel>
                    )}
                  </div>
                </div>

              </div>

              {/* Form 2: Enroll Student in specific Course Module */}
              <div className="space-y-4 text-xs">
                <h4 className="font-extrabold text-slate-900 text-[10px] uppercase tracking-wider">Enroll Student in Course</h4>

                {/* Student Select */}
                <div className="space-y-1 relative">
                  <label className="text-slate-700 font-bold uppercase tracking-wider text-[9px]">Select Student</label>
                  {isEnrolStudentDropdownOpen && (
                    <div className="fixed inset-0 z-30" onClick={() => setIsEnrolStudentDropdownOpen(false)} />
                  )}
                  <div className={`relative ${isEnrolStudentDropdownOpen ? 'z-50' : 'z-30'}`}>
                    <button
                      key={`enrol-student-trigger-${enrolStudentId}`}
                      type="button"
                      onClick={() => setIsEnrolStudentDropdownOpen(!isEnrolStudentDropdownOpen)}
                      aria-expanded={isEnrolStudentDropdownOpen}
                      className="w-full min-h-11 py-2.5 text-left flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 shadow-sm hover:border-brand-blue hover:bg-slate-100/50 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 transition-colors"
                    >
                      <span
                        key={`enrol-student-label-${enrolStudentId}`}
                        className={`truncate ${enrolStudentId ? 'font-bold' : 'text-slate-600'}`}
                      >
                        {selectedEnrolmentStudentDisplay}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isEnrolStudentDropdownOpen ? 'rotate-180 text-brand-blue' : 'text-slate-500'}`} />
                    </button>
                    {isEnrolStudentDropdownOpen && (
                      <MenuPanel>
                        {students.filter(s => !enrolCourseId || !enrolments.some(e => e.student_id === s.id && e.course_id.toString() === enrolCourseId)).length === 0 ? (
                          <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                            {!enrolCourseId ? 'No students available' : 'All students are already enrolled'}
                          </div>
                        ) : (
                          students.filter(s => !enrolCourseId || !enrolments.some(e => e.student_id === s.id && e.course_id.toString() === enrolCourseId)).map(s => (
                            <MenuOption key={s.id} primary={s.name} secondary={s.student_code} secondaryMono selected={String(s.id) === enrolStudentId}
                              onSelect={() => { chooseAllocationStudent(s); setIsEnrolStudentDropdownOpen(false); }} />
                          ))
                        )}
                      </MenuPanel>
                    )}
                  </div>
                </div>

                {/* Course Select */}
                <div className="space-y-1 relative">
                  <label className="text-slate-700 font-bold uppercase tracking-wider text-[9px]">Select Course Module</label>
                  {isEnrolCourseDropdownOpen && (
                    <div className="fixed inset-0 z-30" onClick={() => setIsEnrolCourseDropdownOpen(false)} />
                  )}
                  <div className={`relative ${isEnrolCourseDropdownOpen ? 'z-50' : 'z-20'}`}>
                    <button
                      key={`enrol-course-trigger-${enrolCourseId}`}
                      type="button"
                      onClick={() => setIsEnrolCourseDropdownOpen(!isEnrolCourseDropdownOpen)}
                      className="w-full min-h-11 py-2.5 text-left flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold text-slate-700 shadow-sm hover:border-brand-blue hover:bg-slate-100/50 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 transition-colors"
                    >
                      <span key={`enrol-course-label-${enrolCourseId}`} className="truncate">
                        {enrolCourseDisplay}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isEnrolCourseDropdownOpen ? 'rotate-180 text-brand-blue' : 'text-slate-500'}`} />
                    </button>
                    {isEnrolCourseDropdownOpen && (
                      <MenuPanel>
                        {courses.map(c => (
                          <MenuOption key={c.id} mono primary={c.course_code} secondary={c.course_name} selected={enrolCourseId === c.id.toString()}
                            onSelect={() => {
                              setEnrolCourseId(c.id.toString());
                              setEnrolCourseLabel(`${c.course_code} - ${c.course_name}`);
                              setIsEnrolCourseDropdownOpen(false);
                              // Auto-select first available non-full group
                              const availGroups = getAvailableGroupsForCourse(c.id.toString());
                              const avail = availGroups.find(g => enrolments.filter(e => e.course_id === c.id && e.class_group === g.value).length < 25);
                              if (avail) {
                                setEnrolGroup(avail.value);
                              } else if (availGroups.length > 0) {
                                setEnrolGroup(availGroups[availGroups.length - 1].value);
                              }
                            }} />
                        ))}
                      </MenuPanel>
                    )}
                  </div>
                </div>

                {/* Group Selector */}
                <div className="space-y-1 relative">
                  <label className="text-slate-700 font-bold uppercase tracking-wider text-[9px]">Class Tutorial Group</label>
                  {isEnrolGroupDropdownOpen && (
                    <div className="fixed inset-0 z-30" onClick={() => setIsEnrolGroupDropdownOpen(false)} />
                  )}
                  <div className={`relative ${isEnrolGroupDropdownOpen ? 'z-50' : 'z-10'}`}>
                    <button
                      key={`enrol-group-trigger-${enrolGroup}`}
                      type="button"
                      disabled={!enrolCourseId}
                      onClick={() => setIsEnrolGroupDropdownOpen(!isEnrolGroupDropdownOpen)}
                      className="w-full min-h-11 py-2.5 text-left flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-semibold text-slate-700 shadow-sm hover:border-brand-blue hover:bg-slate-100/50 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none transition-colors"
                    >
                      <span key={`enrol-group-label-${enrolGroup}`}>{enrolGroupDisplay}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isEnrolGroupDropdownOpen ? 'rotate-180 text-brand-blue' : 'text-slate-500'}`} />
                    </button>
                    {isEnrolGroupDropdownOpen && enrolCourseId && (
                      <MenuPanel footer={
                        <button type="button" onClick={handleCreateNewGroup} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold text-brand-blue transition-colors hover:bg-blue-50/90 dark:text-blue-400 dark:hover:bg-blue-500/10">
                          <Plus className="h-3.5 w-3.5" />
                          Create New Group
                        </button>
                      }>
                        {getAvailableGroupsForCourse(enrolCourseId).map(g => {
                          const count = enrolments.filter(e => e.course_id.toString() === enrolCourseId && e.class_group === g.value).length;
                          const isFull = count >= 25;
                          return (
                            <MenuOption key={g.value} primary={g.label} label={`${g.label}, ${count} of 25${isFull ? ', full' : ''}`} disabled={isFull} selected={enrolGroup === g.value}
                              aside={<span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${isFull ? 'bg-danger-red-light text-danger-red' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{count} / 25 {isFull ? '(Full)' : ''}</span>}
                              onSelect={() => { setEnrolGroup(g.value); setIsEnrolGroupDropdownOpen(false); }} />
                          );
                        })}
                      </MenuPanel>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-700 font-bold uppercase tracking-wider text-[9px]">Semester Term</label>
                  <TextInput
                    type="text"
                    required
                    value={courses.find(c => String(c.id) === enrolCourseId)?.semester?.name || enrolSemester}
                    readOnly={!!courses.find(c => String(c.id) === enrolCourseId)?.semester}
                    onChange={e => setEnrolSemester(e.target.value)}
                    className="w-full uipro-input bg-white border-slate-300 text-slate-900 font-semibold shadow-sm"
                  />
                  {(() => {
                    const selected = courses.find(c => String(c.id) === enrolCourseId);
                    const term = selected?.semester;
                    if (!term) return null;
                    const ids = new Set(enrolments.filter(e => String(e.student_id) === enrolStudentId).map(e => String(e.course_id)));
                    const used = courses.filter(c => ids.has(String(c.id)) && c.semester_id === term.id).reduce((sum, c) => sum + (c.credit_hours || 0), 0);
                    return <p className="rounded-xl bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-700 dark:bg-blue-950 dark:text-blue-200">{used} / {term.max_student_credits} academic credits allocated · {term.start_date} – {term.end_date} · {term.status}</p>;
                  })()}
                </div>

                <button type="submit" disabled={savingStudentAllocation} className="w-full uipro-button uipro-button-primary mt-1 disabled:cursor-not-allowed disabled:opacity-60">
                  {savingStudentAllocation ? 'Saving Allocation...' : 'Save Student Allocation'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* RIGHT COLUMN: Database Ledger List */}
        <div className="lg:col-span-2 uipro-card bg-white p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-brand-blue" />
                <div>
                  <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800">
                    {activeSubTab === 'programmes' && 'Programmes'}
                    {activeSubTab === 'courses' && 'Courses'}
                    {activeSubTab === 'staff' && 'Staff Assignments'}
                    {activeSubTab === 'students' && 'Student Enrollments'}
                  </h3>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{activeTotal} result{activeTotal === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <TextInput showCounter={false}
                  type="search"
                  value={ledgerSearch[activeSubTab]}
                  onChange={event => updateLedgerSearch(event.target.value)}
                  placeholder={`Search ${activeSubTab === 'staff' ? 'assignments' : activeSubTab}...`}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/10"
                />
                {ledgerSearch[activeSubTab] && (
                  <button type="button" onClick={() => updateLedgerSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {(
              <div aria-busy={loading} className={`overflow-y-auto max-h-[500px] pr-1 space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
                {/* 1. Programmes Tab Ledger */}
                {activeSubTab === 'programmes' && (
                  filteredProgrammes.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">{activeSearch ? 'No programmes match your search.' : 'No programmes configured.'}</div>
                  ) : (
                    pagedProgrammes.map(p => (
                      <div key={p.id} className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-xl flex items-center justify-between hover:border-slate-300 transition-all">
                        <div className="space-y-0.5">
                          <span className="font-bold text-brand-blue font-mono text-xs block">{p.code}</span>
                          <span className="font-semibold text-slate-800 text-xs block">{p.name}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteProgramme(p.id)}
                          className="p-2 text-slate-400 hover:text-danger-red hover:bg-danger-red-light/20 rounded-lg transition-all cursor-pointer"
                          title="Delete Programme"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )
                )}

                {/* 2. Courses Tab Ledger */}
                {activeSubTab === 'courses' && (
                  filteredCourses.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">{activeSearch ? 'No courses match your search.' : 'No courses registered.'}</div>
                  ) : (
                    pagedCourses.map(c => (
                      <div key={c.id} className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-xl flex items-center justify-between hover:border-slate-300 transition-all">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 font-mono text-xs block">{c.course_code}</span>
                          <span className="font-semibold text-slate-700 text-xs block">{c.course_name}</span>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {c.credit_hours != null && (
                              <span className="text-[10px] text-brand-blue font-bold bg-brand-blue-light px-2 py-0.5 rounded-md inline-block">
                                {c.credit_hours} Credit Hrs
                              </span>
                            )}
                            {c.programme_name && (
                              <span className="text-[10px] text-slate-450 font-semibold bg-slate-200/50 px-2 py-0.5 rounded-md inline-block">
                                Prog: {c.programme_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCourse(c.id)}
                          className="p-2 text-slate-400 hover:text-danger-red hover:bg-danger-red-light/20 rounded-lg transition-all cursor-pointer"
                          title="Delete Course Scope"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )
                )}

                {/* 3. Staff Assignment Ledger */}
                {activeSubTab === 'staff' && (
                  filteredAssignments.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">{activeSearch ? 'No staff assignments match your search.' : 'No staff assignments configured.'}</div>
                  ) : (
                    pagedAssignments.map(a => (
                      <div key={a.id} className="p-3.5 bg-slate-50 border border-slate-200/50 rounded-xl flex items-center justify-between hover:border-slate-300 transition-all">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 text-xs block">{a.lecturer_name}</span>
                          <span className="text-[10.5px] text-slate-500 font-semibold block">
                            Course: <strong className="text-brand-blue font-mono">{a.course_code}</strong> - {a.course_name}
                          </span>
                          <span className={`uipro-badge scale-90 origin-left mt-1 ${
                            a.role === 'Lecturer' ? 'uipro-badge-primary' : a.role === 'Tutor' ? 'uipro-badge-success' : 'uipro-badge-warning'
                          }`}>
                            {a.role}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteAssignment(a.id)}
                          className="p-2 text-slate-400 hover:text-danger-red hover:bg-danger-red-light/20 rounded-lg transition-all cursor-pointer"
                          title="Remove assignment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )
                )}

                {/* 4. Student Allocations Ledger */}
                {activeSubTab === 'students' && (
                  filteredStudents.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">{activeSearch ? 'No students match your search.' : 'No students found.'}</div>
                  ) : (
                    pagedStudents.map(s => {
                      const studentProg = programmes.find(p => p.id === s.programme_id);
                      const studentEnrols = enrolments.filter(e => e.student_id === s.id);
                      return (
                        <div key={s.id} className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl space-y-3 hover:border-slate-300 transition-all">
                          <div className="flex justify-between items-start border-b border-slate-200/30 pb-2">
                            <div>
                              <span className="font-bold text-slate-800 text-xs block">{s.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono font-medium block mt-0.5">{s.student_code}</span>
                            </div>
                            <span className="text-[10.5px] font-bold text-brand-blue">
                              Track: {studentProg ? `${studentProg.code}` : 'Unallocated'}
                            </span>
                          </div>

                          {/* Enrolled Courses list */}
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Course Enrolments:</span>
                            {studentEnrols.length === 0 ? (
                              <div className="text-[10px] text-slate-400 italic font-medium pl-1">No courses enrolled yet.</div>
                            ) : (
                              <div className="grid grid-cols-1 gap-2">
                                {studentEnrols.map(e => (
                                  <div key={e.id} className="flex justify-between items-center p-2 bg-white border border-slate-150 rounded-lg text-[10.5px]">
                                    <div>
                                      <span className="font-bold font-mono text-brand-blue">{e.course_code}</span>
                                      <span className="text-slate-650 font-medium ml-1.5">{e.course_name}</span>
                                      <span className="text-[9.5px] text-slate-400 font-bold ml-2">[{e.class_group.startsWith('G') ? `Group ${e.class_group.replace('G', '')}` : e.class_group}]</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteEnrolment(e.id)}
                                      className="p-1 text-slate-400 hover:text-danger-red transition-all cursor-pointer"
                                      title="Drop course"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            )}

            {activeTotal > 0 && (
              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[11px] font-semibold text-slate-500">
                  Showing {pageStart + 1}–{Math.min(pageStart + LEDGER_PAGE_SIZE, activeTotal)} of {activeTotal}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changeLedgerPage(activePage - 1)}
                    disabled={activePage === 1}
                    className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 transition-all hover:border-brand-blue hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </button>
                  <span className="min-w-20 text-center text-[11px] font-bold text-slate-600">Page {activePage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => changeLedgerPage(activePage + 1)}
                    disabled={activePage === totalPages}
                    className="flex h-9 items-center gap-1 rounded-lg bg-brand-blue px-3 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>}
    </div>
  );
};
