import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { Course, Student, Enrolment } from '../../services/api';
import { Database, UserPlus, BookOpen, UserCheck, Plus, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import { swalSuccess, swalError } from '../../utils/swal';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'students' | 'courses' | 'enrolments'>('students');

  // Lists
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);

  // Form states - Student
  const [studentName, setStudentName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  
  // Form states - Course
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');

  // Form states - Enrolment
  const [enrolStudentId, setEnrolStudentId] = useState('');
  const [enrolCourseId, setEnrolCourseId] = useState('');
  const [enrolGroup, setEnrolGroup] = useState('G1');
  const [enrolSemester, setEnrolSemester] = useState('S2-2026');

  // Dropdown states
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsList, coursesList, enrolmentsList] = await Promise.all([
        apiService.getStudents(),
        apiService.getCourses(),
        apiService.getEnrolments()
      ]);
      setStudents(studentsList);
      setCourses(coursesList);
      setEnrolments(enrolmentsList);
    } catch (err) {
      console.error("Failed to load admin panel data:", err);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !studentCode) return;
    try {
      await apiService.adminCreateStudent({ name: studentName, student_code: studentCode });
      setStudentName('');
      setStudentCode('');
      await loadData();
      await swalSuccess('Student Created', 'Student profile registered in the registry database.');
    } catch (err: any) {
      await swalError('Error', err.message);
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName || !courseCode) return;
    try {
      await apiService.adminCreateCourse({ course_name: courseName, course_code: courseCode, lecturer_id: 1 });
      setCourseName('');
      setCourseCode('');
      await loadData();
      await swalSuccess('Course Created', 'Course module provisioned successfully.');
    } catch (err: any) {
      await swalError('Error', err.message);
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
      await loadData();
      await swalSuccess('Enrolment Created', 'Student successfully enrolled in the selected course.');
    } catch (err: any) {
      await swalError('Error', err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="uipro-card bg-white/75 backdrop-blur-md relative overflow-hidden">
        
        <div className="relative z-10 space-y-2">
          <h2 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
            <Database className="h-6 w-6 text-brand-blue" />
            Admin Registry Console
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed font-sans">
            Register new student identities, provision academic course modules, and allocate class groupings within the system.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 max-w-md text-xs font-sans">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex-grow py-2.5 px-4 rounded-lg font-semibold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'students' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-950'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Students
        </button>
        <button
          onClick={() => setActiveTab('courses')}
          className={`flex-grow py-2.5 px-4 rounded-lg font-semibold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'courses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-950'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Courses
        </button>
        <button
          onClick={() => setActiveTab('enrolments')}
          className={`flex-grow py-2.5 px-4 rounded-lg font-semibold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'enrolments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-950'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Enrolments
        </button>
      </div>

      {/* Dynamic Tab Content Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Creator Form */}
        <div className={`uipro-card space-y-5 relative ${
          isStudentDropdownOpen || isCourseDropdownOpen || isGroupDropdownOpen ? 'z-50' : 'z-10'
        }`}>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Plus className="h-4 w-4 text-brand-blue" />
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800">
              {activeTab === 'students' ? 'Register Student' : activeTab === 'courses' ? 'Create Course' : 'Enroll Student'}
            </h3>
          </div>

          {activeTab === 'students' && (
            <form onSubmit={handleAddStudent} className="space-y-4 font-sans">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Full Name</label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. Alice Tan"
                  className="w-full uipro-input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Student Code (TP-ID)</label>
                <input
                  type="text"
                  required
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="e.g. TP061234"
                  className="w-full uipro-input"
                />
              </div>
              <button
                type="submit"
                className="w-full uipro-button uipro-button-primary mt-2"
              >
                Create Student Profile
              </button>
            </form>
          )}

          {activeTab === 'courses' && (
            <form onSubmit={handleAddCourse} className="space-y-4 font-sans">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Course Name</label>
                <input
                  type="text"
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Deep Learning & Neural Networks"
                  className="w-full uipro-input"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Course Subject Code</label>
                <input
                  type="text"
                  required
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="e.g. CSE-402"
                  className="w-full uipro-input"
                />
              </div>
              <button
                type="submit"
                className="w-full uipro-button uipro-button-primary mt-2"
              >
                Create Course Module
              </button>
            </form>
          )}

          {activeTab === 'enrolments' && (
            <form onSubmit={handleAddEnrolment} className="space-y-4 font-sans">
              
              {/* Student Dropdown */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-600">Select Student</label>
                {isStudentDropdownOpen && (
                  <div className="fixed inset-0 z-30" onClick={() => setIsStudentDropdownOpen(false)} />
                )}
                <div className={`relative ${isStudentDropdownOpen ? 'z-50' : 'z-30'}`}>
                  <button
                    type="button"
                    onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
                    className="w-full uipro-input py-2.5 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50 transition-colors"
                  >
                    <span className="truncate">
                      {students.find(s => s.id.toString() === enrolStudentId)
                        ? `${students.find(s => s.id.toString() === enrolStudentId)?.name} (${students.find(s => s.id.toString() === enrolStudentId)?.student_code})`
                        : '-- Select Student --'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                  </button>
                  {isStudentDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg z-50 animate-in fade-in duration-100">
                      {students.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setEnrolStudentId(s.id.toString());
                            setIsStudentDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-brand-blue hover:text-white transition-all flex flex-col gap-0.5 border-b border-slate-100 last:border-b-0 ${
                            enrolStudentId === s.id.toString() ? 'bg-slate-50 font-bold' : ''
                          }`}
                        >
                          <span className="font-semibold text-slate-800 hover:text-inherit">{s.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{s.student_code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Course Dropdown */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-600">Select Course Module</label>
                {isCourseDropdownOpen && (
                  <div className="fixed inset-0 z-30" onClick={() => setIsCourseDropdownOpen(false)} />
                )}
                <div className={`relative ${isCourseDropdownOpen ? 'z-50' : 'z-20'}`}>
                  <button
                    type="button"
                    onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
                    className="w-full uipro-input py-2.5 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50 transition-colors"
                  >
                    <span className="truncate">
                      {courses.find(c => c.id.toString() === enrolCourseId)
                        ? `${courses.find(c => c.id.toString() === enrolCourseId)?.course_code} - ${courses.find(c => c.id.toString() === enrolCourseId)?.course_name}`
                        : '-- Select Course --'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                  </button>
                  {isCourseDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg z-50 animate-in fade-in duration-100">
                      {courses.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setEnrolCourseId(c.id.toString());
                            setIsCourseDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-brand-blue hover:text-white transition-all flex flex-col gap-0.5 border-b border-slate-100 last:border-b-0 ${
                            enrolCourseId === c.id.toString() ? 'bg-slate-50 font-bold' : ''
                          }`}
                        >
                          <span className="font-semibold font-mono text-brand-blue hover:text-inherit">{c.course_code}</span>
                          <span className="text-[10px] text-slate-500 truncate">{c.course_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Group Dropdown */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-slate-600">Class Group</label>
                {isGroupDropdownOpen && (
                  <div className="fixed inset-0 z-30" onClick={() => setIsGroupDropdownOpen(false)} />
                )}
                <div className={`relative ${isGroupDropdownOpen ? 'z-50' : 'z-10'}`}>
                  <button
                    type="button"
                    onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                    className="w-full uipro-input py-2.5 text-left flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs text-slate-700 hover:bg-slate-100/50 transition-colors"
                  >
                    <span>
                      {enrolGroup === 'G1' ? 'G1 - Tutorial 1' : 'G2 - Tutorial 2'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                  </button>
                  {isGroupDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg z-50 animate-in fade-in duration-100">
                      {[
                        { value: 'G1', label: 'G1 - Tutorial 1' },
                        { value: 'G2', label: 'G2 - Tutorial 2' }
                      ].map(g => (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => {
                            setEnrolGroup(g.value);
                            setIsGroupDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-xs text-slate-700 hover:bg-brand-blue hover:text-white transition-all border-b border-slate-100 last:border-b-0 ${
                            enrolGroup === g.value ? 'bg-slate-50 font-bold' : ''
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Active Semester</label>
                <input
                  type="text"
                  required
                  value={enrolSemester}
                  onChange={(e) => setEnrolSemester(e.target.value)}
                  placeholder="e.g. S2-2026"
                  className="w-full uipro-input"
                />
              </div>

              <button
                type="submit"
                className="w-full uipro-button uipro-button-primary mt-2"
              >
                Submit Enrolment
              </button>
            </form>
          )}
        </div>

        {/* Ledger Lists */}
        <div className="lg:col-span-2 uipro-card flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <Database className="h-5 w-5 text-brand-blue" />
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-800">
                {activeTab === 'students' ? 'Registered Student Profiles' : activeTab === 'courses' ? 'Active Course Scopes' : 'Active Enrolments Registry'}
              </h3>
            </div>

            <div className="overflow-y-auto max-h-[380px] pr-1 space-y-2">
              {activeTab === 'students' && students.length === 0 && (
                <div className="py-10 text-center text-slate-400 font-sans text-xs">No students registered.</div>
              )}
              {activeTab === 'students' && students.map(s => (
                <div key={s.id} className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition-all">
                  <div>
                    <span className="font-bold text-slate-800 block font-sans">{s.name}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block font-mono font-medium">{s.student_code}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-sans">
                    {s.is_face_registered ? (
                      <span className="uipro-badge uipro-badge-success">
                        <CheckCircle2 className="h-3 w-3" />
                        FACE VERIFIED
                      </span>
                    ) : (
                      <span className="uipro-badge uipro-badge-warning">
                        <XCircle className="h-3 w-3" />
                        NO SELFIE
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {activeTab === 'courses' && courses.length === 0 && (
                <div className="py-10 text-center text-slate-400 font-sans text-xs">No courses configured.</div>
              )}
              {activeTab === 'courses' && courses.map(c => (
                <div key={c.id} className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition-all">
                  <div>
                    <span className="font-bold text-brand-blue block font-mono text-xs">{c.course_code}</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block font-sans">{c.course_name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold bg-slate-200/50 px-2.5 py-1 rounded-lg border border-slate-200/80 font-mono">
                    STF-REF: {c.lecturer_id}
                  </span>
                </div>
              ))}

              {activeTab === 'enrolments' && enrolments.length === 0 && (
                <div className="py-10 text-center text-slate-400 font-sans text-xs">No enrolments created.</div>
              )}
              {activeTab === 'enrolments' && enrolments.map(e => {
                const student = students.find(s => s.id === e.student_id);
                const course = courses.find(c => c.id === e.course_id);
                return (
                  <div key={e.id} className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition-all">
                    <div>
                      <span className="font-bold text-slate-800 block font-sans">{student ? student.name : `Student ID: ${e.student_id}`}</span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">GROUP: {e.class_group}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold font-mono text-brand-blue block text-xs">{course ? course.course_code : 'N/A'}</span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono mt-0.5 block">{e.semester}</span>
                    </div>
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
