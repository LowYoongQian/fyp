import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../../services/api';
import type { Announcement, Programme, Course } from '../../services/api';
import { swalSuccess, swalError, swalConfirmDelete } from '../../utils/swal';
import {
  Megaphone,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  FileText,
  Calendar,
  ChevronDown,
  Upload,
  Image as ImageIcon,
  Clock,
  UserCheck
} from 'lucide-react';
import { ShimmerCard } from '../../components/Shimmer';

interface TargetPickerProps {
  scope: 'all' | 'programme' | 'course';
  setScope: (v: 'all' | 'programme' | 'course') => void;
  role: 'all' | 'students' | 'staff';
  setRole: (v: 'all' | 'students' | 'staff') => void;
  programmeCode: string;
  setProgrammeCode: (v: string) => void;
  courseCode: string;
  setCourseCode: (v: string) => void;
  programmes: Programme[];
  courses: Course[];
}

interface AnnouncementSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; description?: string }>;
  ariaLabel: string;
}

const AnnouncementSelect = <T extends string>({ value, onChange, options, ariaLabel }: AnnouncementSelectProps<T>) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value) || options[0];

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-xs font-semibold transition-all ${
          open
            ? 'border-brand-blue bg-white ring-4 ring-brand-blue/10 shadow-sm'
            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate text-slate-800">{selected?.label}</span>
          {selected?.description && <span className="mt-0.5 block truncate text-[10px] font-normal text-slate-400">{selected.description}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-brand-blue' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isSelected ? 'bg-brand-blue text-white' : 'text-slate-700 hover:bg-blue-50 hover:text-brand-blue'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{option.label}</span>
                  {option.description && (
                    <span className={`mt-0.5 block truncate text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{option.description}</span>
                  )}
                </span>
                {isSelected && <UserCheck className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) => message ? (
  <p id={id} role="alert" className="flex items-center gap-1 text-[10px] font-semibold text-rose-600">
    <AlertCircle className="h-3 w-3" /> {message}
  </p>
) : null;

interface AnnouncementFormValues {
  title: string;
  content: string;
  faculty: string;
  priority: 'High' | 'Medium' | 'Low';
  publisher: string;
  imageBase64: string | null;
  publishStart: string;
  publishEnd: string;
  targetScope: 'all' | 'programme' | 'course';
  targetRole: 'all' | 'students' | 'staff';
  targetProgrammeCode: string;
  targetCourseCode: string;
}

const announcementSnapshot = (values: AnnouncementFormValues) => JSON.stringify({
  ...values,
  title: values.title.trim(),
  content: values.content.trim(),
  publisher: values.publisher || 'ADMIN',
  imageBase64: values.imageBase64 || null,
  targetProgrammeCode: values.targetScope === 'programme' ? values.targetProgrammeCode : '',
  targetCourseCode: values.targetScope === 'course' ? values.targetCourseCode : '',
});

const TargetPicker: React.FC<TargetPickerProps> = ({
  scope, setScope, role, setRole, programmeCode, setProgrammeCode,
  courseCode, setCourseCode, programmes, courses,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div className="space-y-1">
      <label className="font-semibold text-slate-700">Who can see this?</label>
      <AnnouncementSelect
        ariaLabel="Who can see this notice"
        value={role}
        onChange={setRole}
        options={[
          { value: 'all', label: 'Everyone', description: 'Students and staff' },
          { value: 'students', label: 'Students only' },
          { value: 'staff', label: 'Staff only' },
        ]}
      />
    </div>
    <div className="space-y-1">
      <label className="font-semibold text-slate-700">Scope</label>
      <AnnouncementSelect
        ariaLabel="Notice scope"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'all', label: 'Whole campus' },
          { value: 'programme', label: 'One programme' },
          { value: 'course', label: 'One course' },
        ]}
      />
    </div>
    {scope === 'programme' && (
      <div className="space-y-1 sm:col-span-2 animate-in slide-in-from-top-2 duration-150">
        <label className="font-semibold text-slate-700">Target Programme</label>
        <AnnouncementSelect ariaLabel="Target programme" value={programmeCode} onChange={setProgrammeCode} options={programmes.map(p => ({ value: p.code, label: p.name, description: p.code }))} />
      </div>
    )}
    {scope === 'course' && (
      <div className="space-y-1 sm:col-span-2 animate-in slide-in-from-top-2 duration-150">
        <label className="font-semibold text-slate-700">Target Course</label>
        <AnnouncementSelect ariaLabel="Target course" value={courseCode} onChange={setCourseCode} options={courses.map(c => ({ value: c.course_code, label: c.course_name, description: c.course_code }))} />
      </div>
    )}
  </div>
);

export const AnnouncementManager: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal controls
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [faculty, setFaculty] = useState('All Faculties');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [publisher, setPublisher] = useState('ADMIN');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [publishStart, setPublishStart] = useState('');
  const [publishEnd, setPublishEnd] = useState('');
  const [targetScope, setTargetScope] = useState<'all' | 'programme' | 'course'>('all');
  const [targetRole, setTargetRole] = useState<'all' | 'students' | 'staff'>('all');
  const [targetProgrammeCode, setTargetProgrammeCode] = useState<string>('');
  const [targetCourseCode, setTargetCourseCode] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; content?: string; dates?: string }>({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const openingSnapshotRef = useRef<string>('');

  const currentFormValues = (): AnnouncementFormValues => ({
    title,
    content,
    faculty,
    priority,
    publisher,
    imageBase64,
    publishStart,
    publishEnd,
    targetScope,
    targetRole,
    targetProgrammeCode,
    targetCourseCode,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [annData, progData, courseData] = await Promise.all([
        apiService.adminGetAnnouncements(),
        apiService.adminGetProgrammes(),
        apiService.adminGetCourses()
      ]);
      setAnnouncements(annData);
      setProgrammes(progData);
      setCourses(courseData);
    } catch (err: any) {
      setError('Failed to fetch announcements or programmes. Please ensure backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const data = await apiService.adminGetAnnouncements();
      setAnnouncements(data);
    } catch (err: any) {
      console.error('Failed to reload announcements', err);
    }
  };

  const handleOpenCreate = () => {
    const initialValues: AnnouncementFormValues = {
      title: '',
      content: '',
      faculty: 'All Faculties',
      priority: 'Medium',
      publisher: 'ADMIN',
      imageBase64: null,
      publishStart: '',
      publishEnd: '',
      targetScope: 'all',
      targetRole: 'all',
      targetProgrammeCode: programmes[0]?.code || '',
      targetCourseCode: courses[0]?.course_code || '',
    };
    setTitle(initialValues.title);
    setContent(initialValues.content);
    setFaculty(initialValues.faculty);
    setPriority(initialValues.priority);
    setPublisher(initialValues.publisher);
    setImageBase64(initialValues.imageBase64);
    setPublishStart(initialValues.publishStart);
    setPublishEnd(initialValues.publishEnd);
    setTargetScope(initialValues.targetScope);
    setTargetRole(initialValues.targetRole);
    setTargetProgrammeCode(initialValues.targetProgrammeCode);
    setTargetCourseCode(initialValues.targetCourseCode);
    openingSnapshotRef.current = announcementSnapshot(initialValues);
    setFormError(null);
    setFieldErrors({});
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (ann: Announcement) => {
    const initialValues: AnnouncementFormValues = {
      title: ann.title,
      content: ann.content,
      faculty: ann.faculty || 'All Faculties',
      priority: ann.priority || 'Medium',
      publisher: ann.publisher || 'ADMIN',
      imageBase64: ann.image_base64 || null,
      publishStart: ann.publish_start ? ann.publish_start.substring(0, 16) : '',
      publishEnd: ann.publish_end ? ann.publish_end.substring(0, 16) : '',
      targetScope: ann.target_scope || 'all',
      targetRole: ann.target_role || 'all',
      targetProgrammeCode: ann.target_programme_code || (programmes[0]?.code || ''),
      targetCourseCode: ann.target_course_code || (courses[0]?.course_code || ''),
    };
    setSelectedAnnouncement(ann);
    setTitle(initialValues.title);
    setContent(initialValues.content);
    setFaculty(initialValues.faculty);
    setPriority(initialValues.priority);
    setPublisher(initialValues.publisher);
    setImageBase64(initialValues.imageBase64);
    setPublishStart(initialValues.publishStart);
    setPublishEnd(initialValues.publishEnd);
    setTargetScope(initialValues.targetScope);
    setTargetRole(initialValues.targetRole);
    setTargetProgrammeCode(initialValues.targetProgrammeCode);
    setTargetCourseCode(initialValues.targetCourseCode);
    openingSnapshotRef.current = announcementSnapshot(initialValues);
    setFormError(null);
    setFieldErrors({});
    setIsEditOpen(true);
  };

  const handleCloseWithDraftCheck = async (isEdit: boolean) => {
    const hasChanges = announcementSnapshot(currentFormValues()) !== openingSnapshotRef.current;
    
    if (hasChanges) {
      try {
        const payload = {
          title: title.trim() || 'Untitled Draft',
          content: content.trim(),
          faculty,
          department: 'All Departments',
          is_draft: true,
          priority,
          publisher: publisher || 'ADMIN',
          image_base64: imageBase64,
          publish_start: publishStart ? new Date(publishStart).toISOString() : null,
          publish_end: publishEnd ? new Date(publishEnd).toISOString() : null,
          target_scope: targetScope,
          target_role: targetRole,
          target_programme_code: targetScope === 'programme' ? targetProgrammeCode : null,
          target_course_code: targetScope === 'course' ? targetCourseCode : null
        };

        if (isEdit && selectedAnnouncement) {
          await apiService.adminUpdateAnnouncement(selectedAnnouncement.id, payload);
          await swalSuccess('Draft Updated', 'Your changes have been saved as a draft.');
        } else {
          await apiService.adminCreateAnnouncement(payload);
          await swalSuccess('Draft Saved', 'Your unfinished announcement was saved as a draft.');
        }
        fetchAnnouncements();
      } catch (err: any) {
        console.error('Failed to save draft on close', err);
        await swalError('Draft Save Failed', err.response?.data?.detail || 'Failed to auto-save draft.');
      }
    }
    
    if (isEdit) {
      setIsEditOpen(false);
    } else {
      setIsCreateOpen(false);
    }
  };

  // Drag and drop image handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setFormError("Image only");
      return;
    }
    // Limit to 2MB to keep DB storage light
    if (file.size > 2 * 1024 * 1024) {
      setFormError("Max 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageBase64(event.target.result as string);
        setFormError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = (isEdit: boolean) => {
    if (isEdit) {
      editFileInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const removeImage = () => {
    setImageBase64(null);
  };

  const handleSubmit = async (e: React.FormEvent, submitAsDraft: boolean) => {
    e.preventDefault();
    setFormError(null);

    const nextErrors: { title?: string; content?: string; dates?: string } = {};
    if (!title.trim()) nextErrors.title = 'Title required';
    if (!content.trim()) nextErrors.content = 'Content required';
    if (publishStart && publishEnd && new Date(publishEnd) <= new Date(publishStart)) {
      nextErrors.dates = 'Check dates';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setFormSubmitting(true);

    const payload = {
      title,
      content,
      faculty,
      department: 'All Departments',
      is_draft: submitAsDraft,
      priority,
      publisher: publisher || 'ADMIN',
      image_base64: imageBase64,
      publish_start: publishStart ? new Date(publishStart).toISOString() : null,
      publish_end: publishEnd ? new Date(publishEnd).toISOString() : null,
      target_scope: targetScope,
      target_role: targetRole,
      target_programme_code: targetScope === 'programme' ? targetProgrammeCode : null,
      target_course_code: targetScope === 'course' ? targetCourseCode : null
    };

    try {
      if (isEditOpen && selectedAnnouncement) {
        await apiService.adminUpdateAnnouncement(selectedAnnouncement.id, payload);
        setIsEditOpen(false);
        await swalSuccess(
          submitAsDraft ? 'Draft Saved' : 'Notice Published',
          submitAsDraft ? 'The announcement draft has been updated.' : 'Announcement has been published successfully.'
        );
      } else {
        await apiService.adminCreateAnnouncement(payload);
        setIsCreateOpen(false);
        await swalSuccess(
          submitAsDraft ? 'Draft Saved' : 'Notice Published',
          submitAsDraft ? 'The draft is saved and can be completed later.' : 'The announcement is now active and visible.'
        );
      }
      fetchAnnouncements();
    } catch {
      setFormError(isEditOpen ? 'Update failed' : 'Publish failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (announcementId: number | string, titleStr: string) => {
    const isConfirmed = await swalConfirmDelete(titleStr);
    if (!isConfirmed) return;
    try {
      await apiService.adminDeleteAnnouncement(announcementId);
      fetchAnnouncements();
      await swalSuccess('Notice Deleted', 'Announcement has been removed.');
    } catch (err: any) {
      await swalError('Deletion Failed', err.response?.data?.detail || 'Failed to delete announcement.');
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Sort announcements: High priority first, then Medium, then Low.
  // Within same priority, sort by created_at desc.
  const getSortedAnnouncements = () => {
    const weights = { High: 3, Medium: 2, Low: 1 };
    return [...announcements].sort((a, b) => {
      const weightA = weights[a.priority as keyof typeof weights] || 2;
      const weightB = weights[b.priority as keyof typeof weights] || 2;
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const sortedAnnouncements = getSortedAnnouncements();

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="uipro-card bg-white/75 backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2.5">
              <Megaphone className="h-5.5 w-5.5 text-brand-blue animate-bounce" />
              Announcements
            </h2>
            <p className="text-xs text-slate-500 font-sans">
              Create and publish notices for students and staff.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="uipro-button uipro-button-primary shrink-0 self-start md:self-auto hover:scale-102 active:scale-98 transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </button>
        </div>
      </div>

      {/* Directory Listings */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ShimmerCard />
            <ShimmerCard />
            <ShimmerCard />
            <ShimmerCard />
          </div>
        ) : error ? (
          <div className="uipro-card py-12 text-center text-danger-red font-sans text-xs bg-danger-red-light border border-danger-red/10 rounded-xl">
            {error}
          </div>
        ) : sortedAnnouncements.length === 0 ? (
          <div className="uipro-card py-16 text-center text-slate-400 font-sans text-xs border border-dashed border-slate-200 rounded-xl">
            No notices or announcements have been published yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sortedAnnouncements.map((ann) => (
              <div
                key={ann.id}
                className={`uipro-card relative group flex flex-col justify-between hover:shadow-lg hover:scale-[1.01] transition-all duration-300 overflow-hidden !p-0 ${
                  ann.is_draft ? 'border border-dashed border-amber-400/60 bg-amber-50/10' : ''
                }`}
              >
                {/* Optional Top Image */}
                {ann.image_base64 && (
                  <div className="w-full h-48 overflow-hidden relative bg-slate-100 border-b border-slate-100">
                    <img
                      src={ann.image_base64}
                      alt={ann.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
                    />
                    {ann.is_draft && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md bg-amber-500 text-white shadow-md flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Draft
                      </span>
                    )}
                    <span className="absolute top-3 right-3 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md shadow-md bg-brand-blue text-white">
                      Publisher: {ann.publisher || 'ADMIN'}
                    </span>
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3 font-sans text-xs">
                    {/* Tags and Badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!ann.image_base64 && (
                        <>
                          {ann.is_draft && (
                            <span className="uipro-badge bg-amber-100 text-amber-800 border border-amber-200 text-[9px] py-0.5 px-2 font-bold uppercase">
                              Draft
                            </span>
                          )}
                          <span className="uipro-badge text-[9px] py-0.5 px-2 font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                            Publisher: {ann.publisher || 'ADMIN'}
                          </span>
                        </>
                      )}
                      
                      {/* Target Audience Badge: scope × role */}
                      <span className="uipro-badge bg-slate-100 text-slate-700 border border-slate-200 text-[9px] py-0.5 px-2 font-medium flex items-center gap-1">
                        <UserCheck className="h-2.5 w-2.5" />
                        {(() => {
                          const roleLabel = ann.target_role === 'students' ? 'Students'
                            : ann.target_role === 'staff' ? 'Staff' : 'Everyone';
                          if (ann.target_scope === 'programme') return `${roleLabel} · ${ann.target_programme_code || '—'}`;
                          if (ann.target_scope === 'course') return `${roleLabel} · ${ann.target_course_code || '—'}`;
                          return `${roleLabel} · All`;
                        })()}
                      </span>
                    </div>

                    {/* Title & Date */}
                    <div className="space-y-1">
                      <h3 className="font-display font-bold text-sm text-slate-950 leading-snug group-hover:text-brand-blue transition-colors">
                        {ann.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Posted: {formatDate(ann.created_at)}</span>
                      </div>
                    </div>

                    {/* Schedule Timing Indicators (If set) */}
                    {(ann.publish_start || ann.publish_end) && (
                      <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg space-y-1 text-[10px] text-slate-500">
                        {ann.publish_start && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>Starts: {formatDate(ann.publish_start)}</span>
                          </div>
                        )}
                        {ann.publish_end && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>Expires: {formatDate(ann.publish_end)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Body Text */}
                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-4 font-normal pt-1">
                      {ann.content}
                    </p>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex items-center justify-end border-t border-slate-100 pt-3.5 mt-2 gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(ann)}
                      className="uipro-button uipro-button-secondary !py-2 !px-3.5 text-[10px] hover:!bg-slate-100"
                    >
                      <Edit2 className="h-3 w-3 mr-1.5 text-slate-500" />
                      Modify
                    </button>
                    <button
                      onClick={() => handleDelete(ann.id, ann.title)}
                      className="uipro-button uipro-button-secondary hover:!bg-danger-red-light hover:!text-danger-red !py-2 !px-3.5 text-[10px]"
                    >
                      <Trash2 className="h-3 w-3 mr-1.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Dialog: CREATE ANNOUNCEMENT */}
      {isCreateOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
            onClick={() => handleCloseWithDraftCheck(false)} 
          />
          
          <div className="max-w-xl w-full bg-white relative z-10 shadow-2xl rounded-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] md:max-h-[90vh] overflow-hidden">
            {/* Fixed Header */}
            <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100 shrink-0">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2.5">
                <Megaphone className="h-5 w-5 text-brand-blue" />
                Publish Bulletins & Notices
              </h3>
              <button
                onClick={() => handleCloseWithDraftCheck(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body Form wrapper */}
            <form noValidate onSubmit={(e) => handleSubmit(e, false)} className="flex-1 flex flex-col overflow-hidden">
              <div className="announcement-modal-scroll flex-1 overflow-y-auto m-2 mr-2.5 p-3 pr-2.5 space-y-4 font-sans text-xs rounded-xl">
                {formError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex gap-2.5 text-xs text-rose-600 font-sans shrink-0">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Bulletin Title</label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (fieldErrors.title) setFieldErrors(current => ({ ...current, title: undefined }));
                      }}
                      placeholder="e.g. Mid-Term Examination Schedule"
                      aria-invalid={Boolean(fieldErrors.title)}
                      aria-describedby={fieldErrors.title ? 'create-title-error' : undefined}
                      className={`w-full uipro-input !pl-10 !py-3 ${fieldErrors.title ? '!border-rose-400 !ring-2 !ring-rose-100' : ''}`}
                    />
                  </div>
                  <FieldError id="create-title-error" message={fieldErrors.title} />
                </div>

                {/* Target: scope (who broadly) × role (which population) */}
                <TargetPicker
                  scope={targetScope} setScope={setTargetScope}
                  role={targetRole} setRole={setTargetRole}
                  programmeCode={targetProgrammeCode} setProgrammeCode={setTargetProgrammeCode}
                  courseCode={targetCourseCode} setCourseCode={setTargetCourseCode}
                  programmes={programmes} courses={courses}
                />

                {/* Publisher Dropdown */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Notice Publisher</label>
                  <AnnouncementSelect
                    ariaLabel="Notice publisher"
                    value={publisher}
                    onChange={setPublisher}
                    options={[{ value: 'ADMIN', label: 'Administration', description: 'Official campus notice' }, ...programmes.map(p => ({ value: p.code, label: p.code, description: p.name }))]}
                  />
                </div>

                {/* Optional Schedule Start / Expiry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> Start Publishing (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={publishStart}
                      onChange={(e) => {
                        setPublishStart(e.target.value);
                        if (fieldErrors.dates) setFieldErrors(current => ({ ...current, dates: undefined }));
                      }}
                      aria-invalid={Boolean(fieldErrors.dates)}
                      className={`w-full uipro-input ${fieldErrors.dates ? '!border-rose-400' : ''}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> Expiry Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={publishEnd}
                      onChange={(e) => {
                        setPublishEnd(e.target.value);
                        if (fieldErrors.dates) setFieldErrors(current => ({ ...current, dates: undefined }));
                      }}
                      aria-invalid={Boolean(fieldErrors.dates)}
                      aria-describedby={fieldErrors.dates ? 'create-dates-error' : undefined}
                      className={`w-full uipro-input ${fieldErrors.dates ? '!border-rose-400' : ''}`}
                    />
                    <FieldError id="create-dates-error" message={fieldErrors.dates} />
                  </div>
                </div>

                {/* Premium Drag and Drop Image Input */}
                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-3">
                    <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-brand-blue" /> Banner image
                    </label>
                    <span className="text-[10px] text-slate-400">PNG or JPG · Max 2 MB</span>
                  </div>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => triggerFileInput(false)}
                    className={`w-full min-h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 cursor-pointer transition-all duration-200 relative overflow-hidden ${
                      dragActive
                        ? 'border-brand-blue bg-brand-blue/5 scale-[0.99]'
                        : imageBase64
                        ? 'border-emerald-500 bg-emerald-50/5'
                        : 'border-slate-300 hover:border-brand-blue hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {imageBase64 ? (
                      <div className="w-full h-full flex flex-col items-center gap-3">
                        <div className="w-full h-32 overflow-hidden rounded-xl relative border border-slate-200 bg-slate-100">
                          <img
                            src={imageBase64}
                            alt="Announcement banner preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage();
                            }}
                            aria-label="Remove banner image"
                            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg transition-all hover:scale-105"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">Click the preview to replace the image.</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center space-y-2">
                        <Upload className={`h-8 w-8 transition-transform duration-300 ${dragActive ? 'scale-110 text-brand-blue' : 'text-slate-400'}`} />
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-700">Drag & drop your file here, or <span className="text-brand-blue underline">browse</span></p>
                          <p className="text-[10px] text-slate-400">Supports PNG, JPG, JPEG (Max 2MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Announcement Content */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="font-semibold text-slate-700">Message</label>
                    <span className="text-[10px] tabular-nums text-slate-400">{content.length} characters</span>
                  </div>
                  <textarea
                    rows={6}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      if (fieldErrors.content) setFieldErrors(current => ({ ...current, content: undefined }));
                    }}
                    placeholder="Draft detailed announcement content here..."
                    aria-invalid={Boolean(fieldErrors.content)}
                    aria-describedby={fieldErrors.content ? 'create-content-error' : undefined}
                    className={`announcement-content-scroll w-full uipro-input !min-h-36 leading-relaxed resize-y ${fieldErrors.content ? '!border-rose-400 !ring-2 !ring-rose-100' : ''}`}
                  />
                  <FieldError id="create-content-error" message={fieldErrors.content} />
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-4 border-t border-slate-200/80 flex items-center gap-3 shrink-0 bg-slate-50/90">
                <button
                  type="button"
                  onClick={() => handleCloseWithDraftCheck(false)}
                  className="min-w-28 uipro-button uipro-button-secondary py-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 uipro-button uipro-button-primary py-3 flex items-center justify-center gap-2"
                >
                  {formSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Publish changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Dialog: EDIT ANNOUNCEMENT */}
      {isEditOpen && selectedAnnouncement && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
            onClick={() => handleCloseWithDraftCheck(true)} 
          />
          
          <div role="dialog" aria-modal="true" aria-labelledby="edit-announcement-title" className="max-w-2xl w-full bg-white relative z-10 shadow-2xl rounded-3xl border border-slate-200/80 animate-in zoom-in-95 fade-in duration-200 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Fixed Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0 bg-white/95 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
                  <Edit2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="edit-announcement-title" className="font-display font-bold text-base text-slate-900">Modify announcement</h3>
                  <p className="mt-0.5 text-[11px] text-slate-400">Update the message, audience, and schedule.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCloseWithDraftCheck(true)}
                aria-label="Close announcement editor"
                className="flex h-9 w-9 items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded-xl hover:bg-slate-100"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Scrollable Body Form wrapper */}
            <form noValidate onSubmit={(e) => handleSubmit(e, false)} className="flex-1 flex flex-col overflow-hidden">
              <div className="announcement-modal-scroll flex-1 overflow-y-auto px-6 py-5 pr-5 space-y-5 font-sans text-xs">
                {formError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex gap-2.5 text-xs text-rose-600 font-sans shrink-0">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="font-semibold text-slate-700">Title</label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (fieldErrors.title) setFieldErrors(current => ({ ...current, title: undefined }));
                      }}
                      placeholder="e.g. Mid-Term Examination Schedule"
                      aria-invalid={Boolean(fieldErrors.title)}
                      aria-describedby={fieldErrors.title ? 'edit-title-error' : undefined}
                      className={`w-full uipro-input !pl-10 !py-3.5 ${fieldErrors.title ? '!border-rose-400 !ring-2 !ring-rose-100' : ''}`}
                    />
                  </div>
                  <FieldError id="edit-title-error" message={fieldErrors.title} />
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2 border-b border-slate-200/70 pb-3">
                    <UserCheck className="h-4 w-4 text-brand-blue" />
                    <div>
                      <p className="font-bold text-slate-800">Audience</p>
                      <p className="text-[10px] text-slate-400">Choose who receives this notice.</p>
                    </div>
                  </div>
                  <TargetPicker
                    scope={targetScope} setScope={setTargetScope}
                    role={targetRole} setRole={setTargetRole}
                    programmeCode={targetProgrammeCode} setProgrammeCode={setTargetProgrammeCode}
                    courseCode={targetCourseCode} setCourseCode={setTargetCourseCode}
                    programmes={programmes} courses={courses}
                  />

                  <div className="space-y-2">
                    <label className="font-semibold text-slate-700">Publisher</label>
                    <AnnouncementSelect
                      ariaLabel="Notice publisher"
                      value={publisher}
                      onChange={setPublisher}
                      options={[{ value: 'ADMIN', label: 'Administration', description: 'Official campus notice' }, ...programmes.map(p => ({ value: p.code, label: p.code, description: p.name }))]}
                    />
                  </div>
                </div>

                {/* Optional Schedule Start / Expiry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                  <div className="sm:col-span-2 flex items-center gap-2 border-b border-slate-200/70 pb-3">
                    <Calendar className="h-4 w-4 text-brand-blue" />
                    <div>
                      <p className="font-bold text-slate-800">Schedule</p>
                      <p className="text-[10px] text-slate-400">Leave blank to publish without a time limit.</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> Starts
                    </label>
                    <input
                      type="datetime-local"
                      value={publishStart}
                      onChange={(e) => {
                        setPublishStart(e.target.value);
                        if (fieldErrors.dates) setFieldErrors(current => ({ ...current, dates: undefined }));
                      }}
                      aria-invalid={Boolean(fieldErrors.dates)}
                      className={`w-full uipro-input ${fieldErrors.dates ? '!border-rose-400' : ''}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" /> Ends
                    </label>
                    <input
                      type="datetime-local"
                      value={publishEnd}
                      onChange={(e) => {
                        setPublishEnd(e.target.value);
                        if (fieldErrors.dates) setFieldErrors(current => ({ ...current, dates: undefined }));
                      }}
                      aria-invalid={Boolean(fieldErrors.dates)}
                      aria-describedby={fieldErrors.dates ? 'edit-dates-error' : undefined}
                      className={`w-full uipro-input ${fieldErrors.dates ? '!border-rose-400' : ''}`}
                    />
                    <FieldError id="edit-dates-error" message={fieldErrors.dates} />
                  </div>
                </div>

                {/* Premium Drag and Drop Image Input */}
                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-3">
                    <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="h-4 w-4 text-brand-blue" /> Banner image
                    </label>
                    <span className="text-[10px] text-slate-400">PNG or JPG · Max 2 MB</span>
                  </div>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => triggerFileInput(true)}
                    className={`w-full min-h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 cursor-pointer transition-all duration-200 relative overflow-hidden ${
                      dragActive
                        ? 'border-brand-blue bg-brand-blue/5 scale-[0.99]'
                        : imageBase64
                        ? 'border-emerald-500 bg-emerald-50/5'
                        : 'border-slate-300 hover:border-brand-blue hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {imageBase64 ? (
                      <div className="w-full h-full flex flex-col items-center gap-3">
                        <div className="w-full h-32 overflow-hidden rounded-xl relative border border-slate-200 bg-slate-100">
                          <img
                            src={imageBase64}
                            alt="Announcement banner preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage();
                            }}
                            aria-label="Remove banner image"
                            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg transition-all hover:scale-105"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">Click the preview to replace the image.</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center space-y-2">
                        <Upload className={`h-8 w-8 transition-transform duration-300 ${dragActive ? 'scale-110 text-brand-blue' : 'text-slate-400'}`} />
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-700">Drag & drop your file here, or <span className="text-brand-blue underline">browse</span></p>
                          <p className="text-[10px] text-slate-400">Supports PNG, JPG, JPEG (Max 2MB)</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Announcement Content */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="font-semibold text-slate-700">Message</label>
                    <span className="text-[10px] tabular-nums text-slate-400">{content.length} characters</span>
                  </div>
                  <textarea
                    rows={6}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      if (fieldErrors.content) setFieldErrors(current => ({ ...current, content: undefined }));
                    }}
                    placeholder="Draft detailed announcement content here..."
                    aria-invalid={Boolean(fieldErrors.content)}
                    aria-describedby={fieldErrors.content ? 'edit-content-error' : undefined}
                    className={`announcement-content-scroll w-full uipro-input !min-h-36 leading-relaxed resize-y ${fieldErrors.content ? '!border-rose-400 !ring-2 !ring-rose-100' : ''}`}
                  />
                  <FieldError id="edit-content-error" message={fieldErrors.content} />
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-4 border-t border-slate-200/80 flex items-center gap-3 shrink-0 bg-slate-50/90">
                <button
                  type="button"
                  onClick={() => handleCloseWithDraftCheck(true)}
                  className="min-w-28 uipro-button uipro-button-secondary py-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 uipro-button uipro-button-primary py-3 flex items-center justify-center gap-2"
                >
                  {formSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Publish changes'}
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
