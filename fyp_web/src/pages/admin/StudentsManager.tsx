import { TextInput } from '../../components/LimitedTextField';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../../services/api';
import type { AdminStudent } from '../../services/api';
import { swalSuccess, swalError, swalConfirmDelete } from '../../utils/swal';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  Mail,
  User,
  Key,
  Hash,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { ShimmerTableSkeleton } from '../../components/Shimmer';
import { FaceResetDialog } from '../../components/FaceResetDialog';
import { StudentDetailsDialog } from '../../components/StudentDetailsDialog';

export const StudentsManager: React.FC = () => {
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [faceStudent, setFaceStudent] = useState<AdminStudent | null>(null);
  const [detailsStudent, setDetailsStudent] = useState<AdminStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  // Modal control
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const mutationPending = useRef(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    fetchStudents();
  }, [page, searchQuery]);

  const handleSearchChange = (val: string) => {
    if (mutationPending.current) return;
    setSearchQuery(val);
    setPage(1);
  };

  const fetchStudents = async (silent = false) => {
    if (mutationPending.current) return;
    const version = ++requestVersion.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const skip = (page - 1) * limit;
      const res = await apiService.adminGetStudents(skip, limit, searchQuery.trim());
      if (version !== requestVersion.current) return;
      setStudents(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      if (version !== requestVersion.current) return;
      setError('Failed to fetch student registry. Please ensure backend is running.');
      console.error(err);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    if (mutationPending.current) return;
    setName('');
    setEmail('');
    setPassword('');
    setStudentCode('');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (student: AdminStudent) => {
    if (mutationPending.current) return;
    setSelectedStudent(student);
    setName(student.name);
    setEmail(student.email);
    setPassword(''); // leave blank for no change
    setStudentCode(student.student_code);
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);
    try {
      await apiService.adminCreateStudent({
        email,
        password,
        name,
        student_code: studentCode
      });
      setIsCreateOpen(false);
      fetchStudents();
      await swalSuccess('Student Registered', `${name} has been added to the registry.`);
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to register student account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || mutationPending.current) return;
    const previous = selectedStudent;
    const optimistic = !password.trim();
    mutationPending.current = true;
    requestVersion.current++;
    setFormError(null);
    setFormSubmitting(true);
    if (optimistic) {
      setLoading(false);
      setStudents(rows => rows.map(row => row.id === previous.id ? { ...row, ...{ email, name, student_code: studentCode } } : row));
      setIsEditOpen(false);
    }
    try {
      await apiService.adminUpdateStudent(previous.id, { ...{ email, name, student_code: studentCode }, password: password.trim() ? password : undefined });
      setIsEditOpen(false);
      mutationPending.current = false;
      setFormSubmitting(false);
      void fetchStudents(true);
      await swalSuccess('Profile Updated', `${name}'s profile has been saved.`);
    } catch (err: any) {
      if (optimistic) {
        setStudents(rows => rows.map(row => row.id === previous.id ? previous : row));
        await swalError('Save Failed', err.response?.data?.detail || 'The previous profile has been restored.');
      } else setFormError(err.response?.data?.detail || 'Failed to update account.');
    } finally {
      mutationPending.current = false;
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (studentId: number | string, studentName: string) => {
    if (mutationPending.current) return;
    const isConfirmed = await swalConfirmDelete(
      studentName,
      'This will cascadingly delete their enrolments, face embeddings, attendance records, and risk logs.'
    );
    if (!isConfirmed) return;
    try {
      await apiService.adminDeleteStudent(studentId);
      fetchStudents();
      await swalSuccess('Student Deleted', `${studentName} has been removed from the registry.`);
    } catch (err: any) {
      await swalError('Deletion Failed', err.response?.data?.detail || 'Failed to delete student account.');
    }
  };

  const filteredStudents = students.map(s => ({
    ...s,
    name: s.name || '',
    student_code: s.student_code || '',
    email: s.email || ''
  }));

  return (
    <div className="space-y-6">
      {detailsStudent && <StudentDetailsDialog student={detailsStudent} onClose={() => setDetailsStudent(null)} />}
      {faceStudent && <FaceResetDialog student={faceStudent} onClose={() => setFaceStudent(null)} onSaved={() => {
        requestVersion.current++;
        setStudents(previous => previous.map(student => student.id === faceStudent.id ? { ...student, is_face_registered: false } : student));
        void fetchStudents(true);
      }} />}
      {formSubmitting && !isCreateOpen && !isEditOpen && <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700">Saving changes… Pending server confirmation.</p>}
      {/* Top Header Card */}
      <div className="uipro-card bg-white/75 backdrop-blur-md relative overflow-hidden">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2.5">
              <Users className="h-5.5 w-5.5 text-brand-blue" />
              Students
            </h2>
            <p className="text-xs text-slate-500 font-sans">
              Manage student profiles and accounts.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="uipro-button uipro-button-primary shrink-0 self-start md:self-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </button>
        </div>
      </div>

      {/* Controls & Table Container */}
      <div className="uipro-card space-y-4">
        {/* Search Toolbar */}
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <TextInput showCounter={false}
            type="text"
            placeholder="Search by name, student code, or email..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full uipro-input !pl-10"
          />
        </div>

        {/* Directory Output */}
        {loading ? (
          <ShimmerTableSkeleton
            headers={['Student Name', 'Student Code', 'Email', 'Face Status', 'Actions']}
            rows={6}
            showPagination={true}
          />
        ) : error ? (
          <div className="py-12 text-center text-danger-red font-sans text-xs bg-danger-red-light border border-danger-red/10 rounded-xl">
            {error}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-sans text-xs border border-dashed border-slate-200 rounded-xl">
            No matching students found.
          </div>
        ) : (
          <div className="min-w-0">
            <div className="overflow-x-auto [scroll-padding-inline:1.5rem]">
            <table className="w-full min-w-[860px] text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Student Code</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Face Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{student.name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{student.student_code}</td>
                    <td className="py-3.5 px-4 text-slate-500">{student.email}</td>
                    <td className="py-3.5 px-4">
                      {student.is_face_registered ? (
                        <span className="uipro-badge uipro-badge-success">
                          <CheckCircle className="h-3 w-3 mr-1" /> Registered
                        </span>
                      ) : (
                        <span className="uipro-badge uipro-badge-warning">
                          <XCircle className="h-3 w-3 mr-1" /> Not Registered
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex flex-nowrap gap-2 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
                        {student.is_face_registered && <button type="button" onClick={() => setFaceStudent(student)} aria-label={`Reset face for ${student.name}`} className="px-3 py-2 bg-blue-50 text-brand-blue border border-blue-100 rounded-lg text-xs font-semibold hover:bg-blue-100">Reset face</button>}
                        <button type="button" onClick={() => setDetailsStudent(student)} aria-label={`View details for ${student.name}`} title="View details" className="p-2 bg-slate-50 hover:bg-brand-blue-light hover:text-brand-blue rounded-lg border border-slate-100 transition-all text-slate-500 cursor-pointer"><Eye className="h-3.5 w-3.5" /></button>
                        <button
                          onClick={() => handleOpenEdit(student)}
                          title="Edit profile"
                          className="p-2 bg-slate-50 hover:bg-brand-blue-light hover:text-brand-blue rounded-lg border border-slate-100 transition-all text-slate-500 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(student.id, student.name)}
                          title="Delete student"
                          className="p-2 bg-slate-50 hover:bg-danger-red-light hover:text-danger-red rounded-lg border border-slate-100 transition-all text-slate-500 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {/* Pagination Controls: outside the horizontally scrolling table area */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500 mt-4">
              <div>
                Showing <span className="font-bold text-slate-700">{totalCount > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
                <span className="font-bold text-slate-700">{Math.min(page * limit, totalCount)}</span> of{' '}
                <span className="font-bold text-slate-700">{totalCount}</span> registered students
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                  className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  First
                </button>
                <button
                  type="button"
                  disabled={page === 1}
onClick={() => { if (!mutationPending.current) setPage(p => Math.max(p - 1, 1)); }}
                  className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-slate-655">
                  Page <span className="font-bold text-slate-800">{page}</span> of <span className="font-bold text-slate-800">{Math.max(1, Math.ceil(totalCount / limit))}</span>
                </span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(totalCount / limit)}
onClick={() => { if (!mutationPending.current) setPage(p => p + 1); }}
                  className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
                <button
                  type="button"
                  disabled={page >= Math.ceil(totalCount / limit)}
                  onClick={() => setPage(Math.max(1, Math.ceil(totalCount / limit)))}
                  className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Dialog: CREATE STUDENT */}
      {isCreateOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsCreateOpen(false)} />
          
          <div className="max-w-md w-full uipro-card bg-white relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-brand-blue" />
                Register Student Profile
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-danger-red-light border border-danger-red/10 rounded-xl flex gap-2.5 text-xs text-danger-red font-sans">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3 font-sans text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Full Name</label>
                <div className="relative">
                  <User className="!-mt-2 absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <TextInput
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Student Code (ST-ID)</label>
                <div className="relative">
                  <Hash className="!-mt-2 absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <TextInput
                    type="text"
                    required
                    pattern="ST[0-9]{7}"
                    title="ST followed by 7 digits, e.g. ST2510091"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    placeholder="e.g. ST2510091"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Email Address</label>
                <div className="relative">
                  <Mail className="!-mt-2 absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <TextInput
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. tp065432@student.school.edu"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Account Password</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 uipro-button uipro-button-secondary py-3.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 uipro-button uipro-button-primary py-3.5 flex items-center justify-center"
                >
                  {formSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Dialog: EDIT STUDENT */}
      {isEditOpen && selectedStudent && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsEditOpen(false)} />
          
          <div className="max-w-md w-full uipro-card bg-white relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                <Edit2 className="h-4.5 w-4.5 text-brand-blue" />
                Edit Student Profile
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-danger-red-light border border-danger-red/10 rounded-xl flex gap-2.5 text-xs text-danger-red font-sans">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEdit} className="space-y-3 font-sans text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Full Name</label>
                <div className="relative">
                  <User className="!-mt-2 absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <TextInput
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Student Code (ST-ID)</label>
                <div className="relative">
                  <Hash className="!-mt-2 absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <TextInput
                    type="text"
                    required
                    pattern="ST[0-9]{7}"
                    title="ST followed by 7 digits, e.g. ST2510091"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    placeholder="e.g. ST2510091"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Email Address</label>
                <div className="relative">
                  <Mail className="!-mt-2 absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <TextInput
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. tp065432@student.school.edu"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Change Password (leave blank if unchanged)</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="flex-1 uipro-button uipro-button-secondary py-3.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 uipro-button uipro-button-primary py-3.5 flex items-center justify-center"
                >
                  {formSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
