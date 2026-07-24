import React, { useState, useEffect } from 'react';
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
  RefreshCw,
  FolderOpen,
  Briefcase
} from 'lucide-react';
import { ShimmerTableSkeleton } from '../../components/Shimmer';

type SubTab = 'programmes' | 'courses' | 'staff' | 'students';

export const AcademicManager: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('programmes');
  const [loading, setLoading] = useState(true);

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

  // Form states - Course
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseCreditHours, setCourseCreditHours] = useState('3');
  const [courseProgId, setCourseProgId] = useState('');
  const [isCourseProgDropdownOpen, setIsCourseProgDropdownOpen] = useState(false);

  // Form states - Staff Assignment
  const [assignLecturerId, setAssignLecturerId] = useState('');
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignRole, setAssignRole] = useState<'Lecturer' | 'Tutor' | 'Practical'>('Lecturer');
  const [isAssignStaffDropdownOpen, setIsAssignStaffDropdownOpen] = useState(false);
  const [isAssignCourseDropdownOpen, setIsAssignCourseDropdownOpen] = useState(false);
  const [isAssignRoleDropdownOpen, setIsAssignRoleDropdownOpen] = useState(false);

  // Form states - Student Programme
  const [studProgId, setStudProgId] = useState('');
  const [selectedStudentIdForProg, setSelectedStudentIdForProg] = useState('');
  const [isStudProgDropdownOpen, setIsStudProgDropdownOpen] = useState(false);
  const [isProgSelectDropdownOpen, setIsProgSelectDropdownOpen] = useState(false);

  // Form states - Student Enrolment
  const [enrolStudentId, setEnrolStudentId] = useState('');
  const [enrolCourseId, setEnrolCourseId] = useState('');
  const [enrolGroup, setEnrolGroup] = useState('G1');
  const [enrolSemester, setEnrolSemester] = useState('2026-Semester 1');
  const [isEnrolStudentDropdownOpen, setIsEnrolStudentDropdownOpen] = useState(false);
  const [isEnrolCourseDropdownOpen, setIsEnrolCourseDropdownOpen] = useState(false);
  const [isEnrolGroupDropdownOpen, setIsEnrolGroupDropdownOpen] = useState(false);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [sList, stList, pList, cList, aList, eList] = await Promise.all([
        apiService.adminGetStudents(),
        apiService.adminGetStaff(),
        apiService.adminGetProgrammes(),
        apiService.adminGetCourses(),
        apiService.adminGetAssignments(),
        apiService.adminGetEnrolments()
      ]);
      setStudents(sList.items);
      setStaff(stList.items);
      setProgrammes(pList);
      setCourses(cList);
      setAssignments(aList);
      setEnrolments(eList);
    } catch (err) {
      console.error("Failed to load academic data:", err);
    } finally {
      setLoading(false);
    }
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
    if (!progName || !progCode) return;
    try {
      await apiService.adminCreateProgramme({ name: progName, code: progCode });
      setProgName('');
      setProgCode('');
      loadAllData();
      await swalSuccess('Programme Registered', 'Study programme added successfully.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleDeleteProgramme = async (id: number) => {
    const isConfirmed = await swalConfirm(
      'Delete Programme?',
      'Deleting this programme will set all student and course associations to NULL.',
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
        programme_id: courseProgId ? Number(courseProgId) : null
      });
      setCourseName('');
      setCourseCode('');
      setCourseCreditHours('3');
      setCourseProgId('');
      loadAllData();
      await swalSuccess('Course Created', 'Course module provisioned successfully.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleDeleteCourse = async (id: number) => {
    const isConfirmed = await swalConfirm(
      'Delete Course?',
      'This will cascadingly remove all student enrolments in this course.',
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
        course_id: Number(assignCourseId),
        lecturer_id: Number(assignLecturerId),
        role: assignRole
      });
      setAssignLecturerId('');
      setAssignCourseId('');
      loadAllData();
      await swalSuccess('Staff Assigned', 'Academic staff role assigned to course successfully.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    const isConfirmed = await swalConfirm('Remove this role assignment?', undefined, 'Yes, remove it');
    if (!isConfirmed) return;
    try {
      await apiService.adminDeleteAssignment(id);
      loadAllData();
      await swalSuccess('Assignment Removed', 'Staff role assignment has been unlinked.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleAssignStudentProgramme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentIdForProg) return;
    try {
      await apiService.adminAssignStudentProgramme(
        Number(selectedStudentIdForProg),
        studProgId ? Number(studProgId) : null
      );
      setSelectedStudentIdForProg('');
      setStudProgId('');
      loadAllData();
      await swalSuccess('Programme Allocated', 'Student study programme assigned successfully.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleAddEnrolment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrolStudentId || !enrolCourseId) return;
    try {
      await apiService.adminCreateEnrolment({
        student_id: Number(enrolStudentId),
        course_id: Number(enrolCourseId),
        semester: enrolSemester,
        class_group: enrolGroup
      });
      setEnrolStudentId('');
      setEnrolCourseId('');
      loadAllData();
      await swalSuccess('Enrolment Created', 'Student enrolled in course successfully.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

  const handleDeleteEnrolment = async (id: number) => {
    const isConfirmed = await swalConfirm('Drop this course enrolment?', undefined, 'Yes, drop it');
    if (!isConfirmed) return;
    try {
      await apiService.adminDeleteEnrolment(id);
      loadAllData();
      await swalSuccess('Enrolment Dropped', 'Student course enrolment removed.');
    } catch (err: any) {
      await swalError('Error', err.response?.data?.detail || err.message || 'Operation failed');
    }
  };

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
          className="flex items-center gap-2 py-2 px-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          Sync Records
        </button>
      </div>

      {/* Primary Sub-Tabs */}
      <div className="flex bg-slate-150/50 p-1 rounded-xl border border-slate-200/50 max-w-lg text-xs font-sans">
        {[
          { id: 'programmes', label: 'Programmes', icon: Layers },
          { id: 'courses', label: 'Courses', icon: BookOpen },
          { id: 'staff', label: 'Staff Roles', icon: Briefcase },
          { id: 'students', label: 'Student Allocation', icon: UserCheck }
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
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
            <form onSubmit={handleAddProgramme} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Programme Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BCSF"
                  value={progCode}
                  onChange={e => setProgCode(e.target.value.toUpperCase())}
                  className="w-full uipro-input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Programme Description Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bachelor of Computer Science (Honours)"
                  value={progName}
                  onChange={e => setProgName(e.target.value)}
                  className="w-full uipro-input"
                />
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
                <input
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
                <input
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
                    type="button"
                    onClick={() => setIsCourseProgDropdownOpen(!isCourseProgDropdownOpen)}
                    className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                  >
                    <span className="truncate">
                      {programmes.find(p => p.id.toString() === courseProgId)
                        ? `${programmes.find(p => p.id.toString() === courseProgId)?.code} - ${programmes.find(p => p.id.toString() === courseProgId)?.name}`
                        : '-- Select Programme (Optional) --'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                  </button>
                  {isCourseProgDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                      <button
                        type="button"
                        onClick={() => {
                          setCourseProgId('');
                          setIsCourseProgDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        -- None --
                      </button>
                      {programmes.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setCourseProgId(p.id.toString());
                            setIsCourseProgDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-brand-blue hover:text-white flex flex-col gap-0.5 border-b border-slate-100 last:border-0"
                        >
                          <span className="font-semibold">{p.code}</span>
                          <span className="text-[10px] text-slate-400 truncate hover:text-white">{p.name}</span>
                        </button>
                      ))}
                    </div>
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
                    type="button"
                    onClick={() => setIsAssignStaffDropdownOpen(!isAssignStaffDropdownOpen)}
                    className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                  >
                    <span className="truncate">
                      {staff.find(s => s.id.toString() === assignLecturerId)
                        ? `${staff.find(s => s.id.toString() === assignLecturerId)?.name} (${staff.find(s => s.id.toString() === assignLecturerId)?.staff_id})`
                        : '-- Select Lecturer --'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                  {isAssignStaffDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                      {staff.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setAssignLecturerId(s.id.toString());
                            setIsAssignStaffDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs hover:bg-brand-blue hover:text-white flex flex-col border-b border-slate-100 last:border-0"
                        >
                          <span className="font-semibold text-slate-800 hover:text-white">{s.name}</span>
                          <span className="text-[10px] text-slate-400 hover:text-white">{s.staff_id}</span>
                        </button>
                      ))}
                    </div>
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
                    type="button"
                    onClick={() => setIsAssignCourseDropdownOpen(!isAssignCourseDropdownOpen)}
                    className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                  >
                    <span className="truncate">
                      {courses.find(c => c.id.toString() === assignCourseId)
                        ? `${courses.find(c => c.id.toString() === assignCourseId)?.course_code} - ${courses.find(c => c.id.toString() === assignCourseId)?.course_name}`
                        : '-- Select Course --'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                  {isAssignCourseDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                      {courses.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setAssignCourseId(c.id.toString());
                            setIsAssignCourseDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-brand-blue hover:text-white flex flex-col border-b border-slate-100 last:border-0"
                        >
                          <span className="font-semibold text-brand-blue hover:text-white font-mono">{c.course_code}</span>
                          <span className="text-[10px] text-slate-500 truncate hover:text-white">{c.course_name}</span>
                        </button>
                      ))}
                    </div>
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
                    type="button"
                    onClick={() => setIsAssignRoleDropdownOpen(!isAssignRoleDropdownOpen)}
                    className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                  >
                    <span>{assignRole}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                  {isAssignRoleDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                      {['Lecturer', 'Tutor', 'Practical'].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setAssignRole(r as any);
                            setIsAssignRoleDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-brand-blue hover:text-white border-b border-slate-100 last:border-0"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" className="w-full uipro-button uipro-button-primary mt-2">
                Allocate Staff Assignment
              </button>
            </form>
          )}

          {activeSubTab === 'students' && (
            <div className="space-y-6">
              {/* Form 1: Allocate Student to Program */}
              <form onSubmit={handleAssignStudentProgramme} className="space-y-4 border-b border-slate-100 pb-5 text-xs">
                <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">Allocate Study Programme</h4>
                
                {/* Student Select */}
                <div className="space-y-1 relative">
                  <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Select Student</label>
                  {isStudProgDropdownOpen && (
                    <div className="fixed inset-0 z-30" onClick={() => setIsStudProgDropdownOpen(false)} />
                  )}
                  <div className={`relative ${isStudProgDropdownOpen ? 'z-50' : 'z-20'}`}>
                    <button
                      type="button"
                      onClick={() => setIsStudProgDropdownOpen(!isStudProgDropdownOpen)}
                      className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                    >
                      <span className="truncate">
                        {students.find(s => s.id.toString() === selectedStudentIdForProg)
                          ? `${students.find(s => s.id.toString() === selectedStudentIdForProg)?.name} (${students.find(s => s.id.toString() === selectedStudentIdForProg)?.student_code})`
                          : '-- Select Student --'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    </button>
                    {isStudProgDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                        {students.filter(s => s.programme_id === null || s.programme_id === undefined).length === 0 ? (
                          <div className="px-4 py-3 text-xs text-slate-400 text-center">No unallocated students available</div>
                        ) : (
                          students.filter(s => s.programme_id === null || s.programme_id === undefined).map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedStudentIdForProg(s.id.toString());
                                setIsStudProgDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs hover:bg-brand-blue hover:text-white flex flex-col border-b border-slate-100 last:border-0"
                            >
                              <span className="font-semibold text-slate-800 hover:text-white">{s.name}</span>
                              <span className="text-[10px] text-slate-400 hover:text-white font-mono">{s.student_code}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Program Select */}
                <div className="space-y-1 relative">
                  <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Study Programme</label>
                  {isProgSelectDropdownOpen && (
                    <div className="fixed inset-0 z-30" onClick={() => setIsProgSelectDropdownOpen(false)} />
                  )}
                  <div className={`relative ${isProgSelectDropdownOpen ? 'z-50' : 'z-10'}`}>
                    <button
                      type="button"
                      onClick={() => setIsProgSelectDropdownOpen(!isProgSelectDropdownOpen)}
                      className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                    >
                      <span className="truncate">
                        {programmes.find(p => p.id.toString() === studProgId)
                          ? `${programmes.find(p => p.id.toString() === studProgId)?.code} - ${programmes.find(p => p.id.toString() === studProgId)?.name}`
                          : '-- Select Programme --'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    </button>
                    {isProgSelectDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                        <button
                          type="button"
                          onClick={() => {
                            setStudProgId('');
                            setIsProgSelectDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0"
                        >
                          -- None / Remove Programme --
                        </button>
                        {programmes.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setStudProgId(p.id.toString());
                              setIsProgSelectDropdownOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-brand-blue hover:text-white flex flex-col border-b border-slate-100 last:border-0"
                          >
                            <span className="font-semibold">{p.code}</span>
                            <span className="text-[10px] text-slate-400 hover:text-white truncate">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button type="submit" className="w-full uipro-button uipro-button-primary mt-1">
                  Save Track Allocation
                </button>
              </form>

              {/* Form 2: Enroll Student in specific Course Module */}
              <form onSubmit={handleAddEnrolment} className="space-y-4 text-xs">
                <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">Enroll Student in Course</h4>

                {/* Student Select */}
                <div className="space-y-1 relative">
                  <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Select Student</label>
                  {isEnrolStudentDropdownOpen && (
                    <div className="fixed inset-0 z-30" onClick={() => setIsEnrolStudentDropdownOpen(false)} />
                  )}
                  <div className={`relative ${isEnrolStudentDropdownOpen ? 'z-50' : 'z-30'}`}>
                    <button
                      type="button"
                      onClick={() => setIsEnrolStudentDropdownOpen(!isEnrolStudentDropdownOpen)}
                      className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                    >
                      <span className="truncate">
                        {students.find(s => s.id.toString() === enrolStudentId)
                          ? `${students.find(s => s.id.toString() === enrolStudentId)?.name} (${students.find(s => s.id.toString() === enrolStudentId)?.student_code})`
                          : '-- Select Student --'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    </button>
                    {isEnrolStudentDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                        {students.filter(s => {
                          if (!enrolCourseId) return true;
                          return !enrolments.some(e => e.student_id === s.id && e.course_id.toString() === enrolCourseId);
                        }).length === 0 ? (
                          <div className="px-4 py-3 text-xs text-slate-400 text-center">
                            {!enrolCourseId ? 'No students available' : 'All students are already enrolled'}
                          </div>
                        ) : (
                          students.filter(s => {
                            if (!enrolCourseId) return true;
                            return !enrolments.some(e => e.student_id === s.id && e.course_id.toString() === enrolCourseId);
                          }).map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setEnrolStudentId(s.id.toString());
                                setIsEnrolStudentDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-xs hover:bg-brand-blue hover:text-white flex flex-col border-b border-slate-100 last:border-0"
                            >
                              <span className="font-semibold text-slate-800 hover:text-white">{s.name}</span>
                              <span className="text-[10px] text-slate-400 hover:text-white font-mono">{s.student_code}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Course Select */}
                <div className="space-y-1 relative">
                  <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Select Course Module</label>
                  {isEnrolCourseDropdownOpen && (
                    <div className="fixed inset-0 z-30" onClick={() => setIsEnrolCourseDropdownOpen(false)} />
                  )}
                  <div className={`relative ${isEnrolCourseDropdownOpen ? 'z-50' : 'z-20'}`}>
                    <button
                      type="button"
                      onClick={() => setIsEnrolCourseDropdownOpen(!isEnrolCourseDropdownOpen)}
                      className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50"
                    >
                      <span className="truncate">
                        {courses.find(c => c.id.toString() === enrolCourseId)
                          ? `${courses.find(c => c.id.toString() === enrolCourseId)?.course_code} - ${courses.find(c => c.id.toString() === enrolCourseId)?.course_name}`
                          : '-- Select Course --'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    </button>
                    {isEnrolCourseDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                        {courses.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setEnrolCourseId(c.id.toString());
                              setIsEnrolCourseDropdownOpen(false);
                              // Auto-select first available non-full group
                              const availGroups = getAvailableGroupsForCourse(c.id.toString());
                              const avail = availGroups.find(g => {
                                const count = enrolments.filter(e => e.course_id === c.id && e.class_group === g.value).length;
                                return count < 25;
                              });
                              if (avail) {
                                setEnrolGroup(avail.value);
                              } else if (availGroups.length > 0) {
                                setEnrolGroup(availGroups[availGroups.length - 1].value);
                              }
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-brand-blue hover:text-white flex flex-col border-b border-slate-100 last:border-0"
                          >
                            <span className="font-semibold text-brand-blue hover:text-white font-mono">{c.course_code}</span>
                            <span className="text-[10px] text-slate-500 truncate hover:text-white">{c.course_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Group Selector */}
                <div className="space-y-1 relative">
                  <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Class Tutorial Group</label>
                  {isEnrolGroupDropdownOpen && (
                    <div className="fixed inset-0 z-30" onClick={() => setIsEnrolGroupDropdownOpen(false)} />
                  )}
                  <div className={`relative ${isEnrolGroupDropdownOpen ? 'z-50' : 'z-10'}`}>
                    <button
                      type="button"
                      disabled={!enrolCourseId}
                      onClick={() => setIsEnrolGroupDropdownOpen(!isEnrolGroupDropdownOpen)}
                      className="w-full uipro-input py-2 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50 disabled:opacity-50"
                    >
                      <span>
                        {enrolGroup === 'G1' && 'Group 1'}
                        {enrolGroup === 'G2' && 'Group 2'}
                        {enrolGroup === 'G3' && 'Group 3'}
                        {enrolGroup === 'G4' && 'Group 4'}
                        {enrolGroup === 'G5' && 'Group 5'}
                        {!enrolGroup && '-- Select Group --'}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    </button>
                    {isEnrolGroupDropdownOpen && enrolCourseId && (
                      <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                        {getAvailableGroupsForCourse(enrolCourseId).map(g => {
                          const count = enrolments.filter(e => e.course_id.toString() === enrolCourseId && e.class_group === g.value).length;
                          const isFull = count >= 25;
                          return (
                            <button
                              key={g.value}
                              type="button"
                              disabled={isFull}
                              onClick={() => {
                                setEnrolGroup(g.value);
                                setIsEnrolGroupDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-xs flex justify-between items-center border-b border-slate-100 last:border-0 ${
                                isFull 
                                  ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                  : 'hover:bg-brand-blue hover:text-white text-slate-700'
                              }`}
                            >
                              <span>{g.label}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isFull ? 'bg-danger-red-light text-danger-red' : 'bg-slate-100 text-slate-500'}`}>
                                {count} / 25 {isFull ? '(Full)' : ''}
                              </span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={handleCreateNewGroup}
                          className="w-full text-center px-4 py-2.5 text-xs font-bold text-brand-blue hover:bg-brand-blue-light border-t border-slate-100 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create New Group
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Semester Term</label>
                  <input
                    type="text"
                    required
                    value={enrolSemester}
                    onChange={e => setEnrolSemester(e.target.value)}
                    className="w-full uipro-input"
                  />
                </div>

                <button type="submit" className="w-full uipro-button uipro-button-primary mt-1">
                  Enroll Student
                </button>
              </form>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Database Ledger List */}
        <div className="lg:col-span-2 uipro-card bg-white p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <FolderOpen className="h-5 w-5 text-brand-blue" />
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800">
                {activeSubTab === 'programmes' && 'Programmes'}
                {activeSubTab === 'courses' && 'Courses'}
                {activeSubTab === 'staff' && 'Staff Assignments'}
                {activeSubTab === 'students' && 'Student Enrollments'}
              </h3>
            </div>

            {loading ? (
              <div className="p-4">
                <ShimmerTableSkeleton rows={4} showPagination={false} />
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[500px] pr-1 space-y-3">
                {/* 1. Programmes Tab Ledger */}
                {activeSubTab === 'programmes' && (
                  programmes.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">No programmes configured.</div>
                  ) : (
                    programmes.map(p => (
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
                  courses.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">No courses registered.</div>
                  ) : (
                    courses.map(c => (
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
                  assignments.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">No staff assignments configured.</div>
                  ) : (
                    assignments.map(a => (
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
                  students.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">No students found.</div>
                  ) : (
                    students.map(s => {
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
          </div>
        </div>

      </div>
    </div>
  );
};
