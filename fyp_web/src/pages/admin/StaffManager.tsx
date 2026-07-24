import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { AdminStaff } from '../../services/api';
import { swalSuccess, swalError, swalConfirmDelete } from '../../utils/swal';
import {
  Briefcase,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Mail,
  User,
  Key,
  Hash,
  Loader2,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { ShimmerTableSkeleton } from '../../components/Shimmer';

export const StaffManager: React.FC = () => {
  const [staffList, setStaffList] = useState<AdminStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  // Modal controls
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<AdminStaff | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffId, setStaffId] = useState('');
  const [role, setRole] = useState('Lecturer');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, [page]);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const skip = (page - 1) * limit;
      const res = await apiService.adminGetStaff(skip, limit);
      setStaffList(res.items);
      setTotalCount(res.total);
    } catch (err: any) {
      setError('Failed to fetch lecturer staff registry. Please ensure backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setName('');
    setEmail('');
    setPassword('');
    setStaffId('');
    setRole('Lecturer');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (staff: AdminStaff) => {
    setSelectedStaff(staff);
    setName(staff.name);
    setEmail(staff.email);
    setPassword(''); // leave blank for no change
    setStaffId(staff.staff_id);
    setRole(staff.role || 'Lecturer');
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);
    try {
      await apiService.adminCreateStaff({
        email,
        password,
        name,
        staff_id: staffId,
        role
      });
      setIsCreateOpen(false);
      fetchStaff();
      await swalSuccess('Staff Registered', `${name} has been added to the lecturer directory.`);
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to register lecturer account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setFormError(null);
    setFormSubmitting(true);
    try {
      await apiService.adminUpdateStaff(selectedStaff.id, {
        email,
        password: password.trim() ? password : undefined,
        name,
        staff_id: staffId,
        role
      });
      setIsEditOpen(false);
      fetchStaff();
      await swalSuccess('Profile Updated', `${name}'s profile has been saved.`);
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to update lecturer account.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (staffRecordId: number, staffName: string) => {
    const isConfirmed = await swalConfirmDelete(
      staffName,
      'This will cascadingly delete all their courses, schedules, and active check-in sessions.'
    );
    if (!isConfirmed) return;
    try {
      await apiService.adminDeleteStaff(staffRecordId);
      fetchStaff();
      await swalSuccess('Staff Deleted', `${staffName} has been removed from the directory.`);
    } catch (err: any) {
      await swalError('Deletion Failed', err.response?.data?.detail || 'Failed to delete staff account.');
    }
  };

  const filteredStaff = staffList.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.staff_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="uipro-card bg-white/75 backdrop-blur-md relative overflow-hidden">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2.5">
              <Briefcase className="h-5.5 w-5.5 text-brand-blue" />
              Staff
            </h2>
            <p className="text-xs text-slate-500 font-sans">
              Manage staff profiles and accounts.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="uipro-button uipro-button-primary shrink-0 self-start md:self-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
          </button>
        </div>
      </div>

      {/* Controls & Table Container */}
      <div className="uipro-card space-y-4">
        {/* Search Toolbar */}
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, staff ID, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full uipro-input !pl-10"
          />
        </div>

        {/* Directory Output */}
        {loading ? (
          <ShimmerTableSkeleton
            headers={['Staff Name', 'Staff ID', 'Email', 'Role', 'Actions']}
            rows={6}
            showPagination={true}
          />
        ) : error ? (
          <div className="py-12 text-center text-danger-red font-sans text-xs bg-danger-red-light border border-danger-red/10 rounded-xl">
            {error}
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-sans text-xs border border-dashed border-slate-200 rounded-xl">
            No matching staff found in the directory.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Staff Name</th>
                  <th className="py-3 px-4">Staff ID</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{staff.name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{staff.staff_id}</td>
                    <td className="py-3.5 px-4 text-slate-500">{staff.email}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium capitalize">{staff.role || 'Lecturer'}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleOpenEdit(staff)}
                          title="Edit staff profile"
                          className="p-2 bg-slate-50 hover:bg-brand-blue-light hover:text-brand-blue rounded-lg border border-slate-100 transition-all text-slate-500 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(staff.id, staff.name)}
                          title="Delete staff account"
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
            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs font-semibold text-slate-500 mt-4">
              <div>
                Showing <span className="font-bold text-slate-700">{totalCount > 0 ? (page - 1) * limit + 1 : 0}</span> to{' '}
                <span className="font-bold text-slate-700">{Math.min(page * limit, totalCount)}</span> of{' '}
                <span className="font-bold text-slate-700">{totalCount}</span> registered staff
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
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
                  onClick={() => setPage(p => p + 1)}
                  className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Dialog: CREATE STAFF */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
          
          <div className="max-w-md w-full uipro-card bg-white relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                <Briefcase className="h-4.5 w-4.5 text-brand-blue" />
                Register Staff Profile
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
                <label className="font-semibold text-slate-600">Staff Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Arthur Pendragon"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Staff ID</label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    placeholder="e.g. STF-0092"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. arthur@staff.school.edu"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Staff Role</label>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full uipro-input !pl-10 pr-10 appearance-none bg-white cursor-pointer font-semibold text-slate-700"
                  >
                    <option value="Lecturer">Lecturer</option>
                    <option value="Tutor">Tutor</option>
                    <option value="Lecturer, Tutor">Lecturer, Tutor</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
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
                  {formSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: EDIT STAFF */}
      {isEditOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsEditOpen(false)} />
          
          <div className="max-w-md w-full uipro-card bg-white relative z-10 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                <Edit2 className="h-4.5 w-4.5 text-brand-blue" />
                Edit Staff Profile
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
                <label className="font-semibold text-slate-600">Staff Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Arthur Pendragon"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Staff ID</label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    placeholder="e.g. STF-0092"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. arthur@staff.school.edu"
                    className="w-full uipro-input !pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Staff Role</label>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full uipro-input !pl-10 pr-10 appearance-none bg-white cursor-pointer font-semibold text-slate-700"
                  >
                    <option value="Lecturer">Lecturer</option>
                    <option value="Tutor">Tutor</option>
                    <option value="Lecturer, Tutor">Lecturer, Tutor</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
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
        </div>
      )}
    </div>
  );
};
