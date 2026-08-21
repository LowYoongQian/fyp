import axios from 'axios';

// Base URL is injected at build time via Vite env (VITE_API_BASE_URL).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8003';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization Token to requests
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Short-lived, user-scoped cache. sessionStorage survives refreshes but is cleared
// when the tab/session ends, so authenticated data is never shared across accounts.
type ApiCacheEntry = { data: any; timestamp: number };
const apiCache = new Map<string, ApiCacheEntry>();
const pendingGets = new Map<string, Promise<any>>();
const CACHE_TTL = 60000;
const CACHE_PREFIX = 'sas_api_cache:';
const NO_CLIENT_CACHE = ['/sessions', '/students/me/active-sessions', '/students/me/attendance', '/students/me/attendance-sessions', '/lecturers/me/dashboard-summary', '/admin/sessions'];

const cacheScope = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
    return String(user.user_id || 'public');
  } catch {
    return 'public';
  }
};

const isRealtimeUrl = (url: string) => NO_CLIENT_CACHE.some(path => url === path || url.startsWith(`${path}/`));
const storageKey = (key: string) => `${CACHE_PREFIX}${key}`;

export const clearApiCache = () => {
  apiCache.clear();
  pendingGets.clear();
  for (let index = sessionStorage.length - 1; index >= 0; index--) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key);
  }
};

// Helper to handle cached GET requests
export const cachedGet = async (url: string, params?: any): Promise<any> => {
  if (isRealtimeUrl(url)) {
    return (await api.get(url, { params })).data;
  }

  const cacheKey = JSON.stringify({ scope: cacheScope(), url, params });
  let cached = apiCache.get(cacheKey);
  if (!cached) {
    try {
      const stored = sessionStorage.getItem(storageKey(cacheKey));
      cached = stored ? JSON.parse(stored) as ApiCacheEntry : undefined;
      if (cached) apiCache.set(cacheKey, cached);
    } catch {
      cached = undefined;
    }
  }
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  const pending = pendingGets.get(cacheKey);
  if (pending) return pending;

  const request = api.get(url, { params }).then(response => {
    const entry = { data: response.data, timestamp: Date.now() };
    apiCache.set(cacheKey, entry);
    try {
      sessionStorage.setItem(storageKey(cacheKey), JSON.stringify(entry));
    } catch {
      // Storage can be unavailable or full; the in-memory cache still works.
    }
    return response.data;
  }).finally(() => pendingGets.delete(cacheKey));
  pendingGets.set(cacheKey, request);
  return request;
};

// Invalidate memory cache whenever a mutating request (POST, PUT, DELETE) succeeds
api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'DELETE'].includes(method)) {
      apiCache.clear();
    }
    return response;
  },
  (error) => {
    // FastAPI 422 returns detail as an array of error objects. Rendering that
    // straight into JSX crashes React ("Objects are not valid as a React child"),
    // so flatten it to a string before any caller touches it.
    const detail = error.response?.data?.detail;
    if (detail && typeof detail !== 'string') {
      error.response.data.detail = (Array.isArray(detail) ? detail : [detail])
        .map((d: any) => {
          if (typeof d === 'string') return d;
          const field = Array.isArray(d?.loc) ? d.loc.filter((p: any) => p !== 'body').join('.') : '';
          return field ? `${field}: ${d?.msg ?? ''}` : (d?.msg ?? JSON.stringify(d));
        })
        .join('; ');
    }
    return Promise.reject(error);
  }
);

// Define data models supporting both integer and UUID string IDs
export interface Course {
  id: number | string;
  course_name: string;
  course_code: string;
  credit_hours?: number | null;
  lecturer_id: number | string | null;
  lecturer_name?: string | null;
  programme_id?: number | string | null;
  programme_name?: string | null;
  schedule_day?: string | null;
  schedule_start?: string | null;
  schedule_end?: string | null;
  schedule_room?: string | null;
  role?: string | null;
  class_group?: string | null;
  course_id?: number | string | null;
  attendance_rate?: number | null;
}

export interface Student {
  id: number | string;
  name: string;
  student_code: string;
  is_face_registered: boolean;
  programme_id?: number | string | null;
}

export interface Enrolment {
  id: number | string;
  student_id: number | string;
  student_name?: string;
  student_code?: string;
  course_id: number | string;
  course_code?: string;
  course_name?: string;
  semester: string;
  class_group: string;
}

export interface Programme {
  id: number | string;
  name: string;
  code: string;
}

export interface CourseStaffAssignment {
  id: number | string;
  course_id: number | string;
  course_code: string;
  course_name: string;
  lecturer_id: number | string;
  lecturer_name: string;
  role: 'Lecturer' | 'Tutor' | 'Practical';
}

export interface RiskScore {
  id: number | string;
  student_id: number | string;
  student_name?: string;
  student_code?: string;
  course_id: number | string;
  course_code?: string;
  course_name?: string;
  risk_score: number;
  risk_label: 'low' | 'medium' | 'high' | 'observing';
  attendance_rate: number;
  risk_factors?: string | null;
  updated_at?: string | null;
}

export interface AlertLog {
  id: number | string;
  student_id: number | string;
  student_name?: string;
  course_id: number | string;
  course_code?: string;
  alert_type: string;
  email_body: string;
  triggered_by: string;
  triggered_at: string;
  sent_at?: string;
}

export interface ActiveSession {
  id: number | string;
  course_id: number | string;
  course_name?: string;
  course_code?: string;
  opened_at?: string;
  closed_at?: string;
  is_open: boolean;
  class_group: string;
  meeting_id?: number | string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  status?: 'scheduled' | 'open' | 'completed' | 'cancelled' | 'needs_attention';
  room?: string | null;
  cancel_reason?: string | null;
  replacement_for_session_id?: number | string | null;
}

export interface TodayClass extends ActiveSession {
  course_name: string;
  course_code: string;
  role: string;
}

export interface LecturerDashboardSummary {
  profile: {
    name: string;
    staff_id: string;
    email: string;
    role: 'Lecturer';
    avatar_url?: string | null;
    joined_at?: string | null;
  };
  total_enrolled: number;
  active_sessions: number;
  my_courses: number;
  roster_classes: number;
  overall_attendance_rate: number;
}

export interface StudentAttendance {
  student_id: number | string;
  student_name: string;
  student_code: string;
  status: 'present' | 'absent';
  marked_at: string | null;
  confidence_score: number | null;
  source_ip?: string | null;
  network_verified?: boolean | null;
  verify_detail?: string | null;
}

export interface SessionAttendanceDetail {
  session_id: number | string;
  course_name: string;
  course_code: string;
  class_group: string;
  is_open: boolean;
  attendance_list: StudentAttendance[];
}

export interface Announcement {
  id: number | string;
  title: string;
  content: string;
  faculty: string;
  department: string;
  created_at: string;
  is_draft: boolean;
  priority: 'High' | 'Medium' | 'Low';
  publisher: string;
  image_base64?: string | null;
  publish_start?: string | null;
  publish_end?: string | null;
  target_scope: 'all' | 'programme' | 'course';
  target_role: 'all' | 'students' | 'staff';
  target_programme_code?: string | null;
  target_course_code?: string | null;
  target_audience?: string | null;
  creator_user_id?: string | null;
  target_group?: string | null;
  attachment_name?: string | null;
  attachment_mime_type?: string | null;
  attachment_size?: number | null;
  external_link?: string | null;
  recipient_count?: number;
}

export interface CourseAnnouncementOption {
  id: string;
  course_code: string;
  course_name: string;
  groups: string[];
}

export interface AdminStudent {
  id: number | string;
  user_id: number | string;
  name: string;
  student_code: string;
  is_face_registered: boolean;
  email: string;
  programme_id?: number | string | null;
}

export interface AdminStaff {
  id: number | string;
  user_id: number | string;
  name: string;
  staff_id: string;
  email: string;
  role?: string;
}

export interface AdminSession {
  id: number | string;
  course_id: number | string;
  course_code: string;
  course_name: string;
  lecturer_name: string;
  lecturer_role?: string;
  class_group: string;
  opened_at: string | null;
  closed_at: string | null;
  is_open: boolean;
  status?: string;
}

export interface AdminAttendanceRecord {
  student_id: number | string;
  student_name: string;
  student_code: string;
  status: 'present' | 'absent';
  marked_at: string | null;
  confidence_score: number | null;
  wifi_verified: boolean;
  liveness_passed: boolean;
}

export interface AdminSessionAttendanceResponse {
  session_id: number | string;
  course_name: string;
  course_code: string;
  class_group: string;
  is_open: boolean;
  attendance_list: AdminAttendanceRecord[];
}

export interface CampusNetwork {
  id: number | string;
  label: string;
  cidr: string | null;
  ssid: string | null;
  bssid_prefix: string | null;
  is_active: boolean;
}

export type SecuritySettings = Record<string, string>;

export interface StudentProfile {
  id: number | string;
  user_id: number | string;
  name: string;
  student_code: string;
  is_face_registered: boolean;
  email: string;
  programme_id: number | string | null;
  programme_name: string | null;
}

export interface StudentEnrolmentDetail {
  id: number | string;
  student_id: number | string;
  course_id: number | string;
  course_code: string;
  course_name: string;
  credit_hours: number;
  semester: string;
  class_group: string;
  schedule_day: string | null;
  schedule_start: string | null;
  schedule_end: string | null;
  schedule_room: string | null;
  attendance_rate?: number;
}

export interface StudentAttendanceRecord {
  id: number | string;
  session_id: number | string;
  course_id: number | string | null;
  course_code: string;
  course_name: string;
  status: 'present' | 'absent';
  marked_at: string | null;
  confidence_score: number | null;
  network_verified: boolean | null;
}

export interface MedicalLeaveRecord {
  id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  class_group: string;
  start_date: string;
  end_date: string;
  reason: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  remarks?: string | null;
  submitted_at: string;
  ai_verdict?: 'valid' | 'needs_review';
  ai_confidence?: number;
  ai_summary?: string;
}

export interface StudentAttendanceSession {
  session_id: number | string;
  course_id: number | string;
  course_code: string;
  course_name: string;
  class_group: string;
  class_type: string;
  room: string | null;
  staff_name: string;
  staff_role: string;
  status: 'present' | 'absent' | 'leave' | string;
  taken_by: string;
  taken_at: string | null;
  network_ip: string | null;
  device_ip: string | null;
  device_id: string | null;
  opened_at: string | null;
  closed_at: string | null;
  week_number: number;
}

export interface StudentActiveSession {
  id: number | string;
  course_id: number | string;
  course_name: string;
  course_code: string;
  class_group: string;
  opened_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  room: string | null;
  is_replacement: boolean;
  is_open: boolean;
  already_checked_in: boolean;
}

export const apiService = {
  // Real Backend Auth APIs
  login: async (email: string, password: string, portal?: string) => {
    const response = await api.post('/auth/login', { email, password, portal });
    return response.data;
  },
  forgotPassword: async (studentId: string, schoolEmail: string) =>
    (await api.post('/auth/forgot-password', { student_id: studentId, school_email: schoolEmail })).data,
  resetPassword: async (token: string, newPassword: string) =>
    (await api.post('/auth/reset-password', { token, new_password: newPassword })).data,
  requestRecoveryEmail: async (recoveryEmail: string) =>
    (await api.post('/auth/recovery-email/request', { recovery_email: recoveryEmail })).data,
  verifyRecoveryEmail: async (code: string) =>
    (await api.post('/auth/recovery-email/verify', { code })).data,

  register: async (data: any) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  // Real Backend Session APIs
  openSession: async (courseId: number | string, classGroup: string = 'All') => {
    const response = await api.post<ActiveSession>('/sessions/open', {
      course_id: courseId,
      class_group: classGroup,
    });
    return response.data;
  },

  getTodayClasses: async (): Promise<TodayClass[]> => {
    const response = await api.get<TodayClass[]>('/sessions/today');
    return response.data;
  },

  openTodayClass: async (classId: number | string): Promise<ActiveSession> => {
    const response = await api.post<ActiveSession>(`/sessions/${classId}/open`);
    return response.data;
  },

  cancelClass: async (classId: number | string, reason: string): Promise<ActiveSession> => {
    const response = await api.post<ActiveSession>(`/sessions/${classId}/cancel`, { reason });
    return response.data;
  },

  arrangeReplacementClass: async (
    classId: number | string,
    data: { scheduled_start: string; scheduled_end: string; room: string },
  ): Promise<ActiveSession> => {
    const response = await api.post<ActiveSession>(`/sessions/${classId}/replacement`, data);
    return response.data;
  },

  getActiveSessions: async () => {
    try {
      return await cachedGet('/sessions/active');
    } catch (err) {
      console.warn("Backend connection failed or no sessions, returning empty list.");
      return [];
    }
  },

  getSessionAttendance: async (sessionId: number | string) => {
    const response = await api.get<SessionAttendanceDetail>(`/sessions/${sessionId}/attendance`);
    return response.data;
  },

  getCourseSessions: async (courseId: number | string): Promise<ActiveSession[]> => {
    return cachedGet(`/sessions/course/${courseId}/sessions`);
  },

  updateLecturerAttendance: async (sessionId: number | string, studentId: number | string, status: 'present' | 'absent'): Promise<any> => {
    const response = await api.put(`/sessions/attendance/${sessionId}/${studentId}`, { status });
    return response.data;
  },

  queryNatural: async (question: string) => {
    const response = await api.post('/query/natural', { question });
    return response.data;
  },

  getCourses: async (): Promise<Course[]> => {
    return cachedGet('/lecturers/me/courses');
  },

  getLecturerTimetable: async (): Promise<Course[]> => {
    return cachedGet('/lecturers/me/timetable');
  },

  getLecturerEnrolments: async (): Promise<Enrolment[]> => {
    return cachedGet('/lecturers/me/enrolments');
  },

  getLecturerDashboardSummary: async (): Promise<LecturerDashboardSummary> => {
    return cachedGet('/lecturers/me/dashboard-summary');
  },

  getStudents: async (): Promise<Student[]> => {
    const res = await cachedGet('/admin/students');
    return res.items;
  },

  getEnrolments: async (): Promise<Enrolment[]> => {
    return cachedGet('/admin/enrolments');
  },

  getRiskScores: async (): Promise<RiskScore[]> => {
    return cachedGet('/analytics/risk-scores');
  },

  getAlertLogs: async (): Promise<AlertLog[]> => {
    return cachedGet('/lecturers/me/alerts');
  },

  triggerManualAlert: async (studentId: number | string, courseId: number | string) => {
    const response = await api.post('/lecturers/me/alerts', {
      student_id: studentId,
      course_id: courseId
    });
    return response.data;
  },

  runNightlyRiskScorerJob: async (): Promise<any> => {
    const response = await api.post('/analytics/recompute');
    return response.data;
  },

  // Admin backend CRUD endpoints
  adminGetStudents: async (skip?: number, limit?: number, search?: string): Promise<{ items: AdminStudent[]; total: number }> => {
    return cachedGet('/admin/students', { skip, limit, search });
  },
  adminCreateStudent: async (student: any): Promise<any> => {
    const response = await api.post('/admin/students', student);
    return response.data;
  },
  adminUpdateStudent: async (studentId: number | string, student: any): Promise<any> => {
    const response = await api.put(`/admin/students/${studentId}`, student);
    return response.data;
  },
  adminDeleteStudent: async (studentId: number | string): Promise<any> => {
    const response = await api.delete(`/admin/students/${studentId}`);
    return response.data;
  },
  adminGetStaff: async (skip?: number, limit?: number, search?: string): Promise<{ items: AdminStaff[]; total: number }> => {
    return cachedGet('/admin/staff', { skip, limit, search });
  },
  adminCreateStaff: async (staff: any): Promise<any> => {
    const response = await api.post('/admin/staff', staff);
    return response.data;
  },
  adminUpdateStaff: async (lecturerId: number | string, staff: any): Promise<any> => {
    const response = await api.put(`/admin/staff/${lecturerId}`, staff);
    return response.data;
  },
  adminDeleteStaff: async (lecturerId: number | string): Promise<any> => {
    const response = await api.delete(`/admin/staff/${lecturerId}`);
    return response.data;
  },
  adminGetAnnouncements: async (): Promise<Announcement[]> => {
    return cachedGet('/admin/announcements');
  },
  adminCreateAnnouncement: async (announcement: any): Promise<Announcement> => {
    const response = await api.post('/admin/announcements', announcement);
    return response.data;
  },
  adminUpdateAnnouncement: async (announcementId: number | string, announcement: any): Promise<Announcement> => {
    const response = await api.put(`/admin/announcements/${announcementId}`, announcement);
    return response.data;
  },
  adminDeleteAnnouncement: async (announcementId: number | string): Promise<any> => {
    const response = await api.delete(`/admin/announcements/${announcementId}`);
    return response.data;
  },

  // Programmes CRUD
  adminGetProgrammes: async (): Promise<Programme[]> => {
    return cachedGet('/admin/programmes');
  },
  adminCreateProgramme: async (programme: Omit<Programme, 'id'>): Promise<Programme> => {
    const response = await api.post('/admin/programmes', programme);
    return response.data;
  },
  adminUpdateProgramme: async (programmeId: number | string, programme: Omit<Programme, 'id'>): Promise<Programme> => {
    const response = await api.put(`/admin/programmes/${programmeId}`, programme);
    return response.data;
  },
  adminDeleteProgramme: async (programmeId: number | string): Promise<any> => {
    const response = await api.delete(`/admin/programmes/${programmeId}`);
    return response.data;
  },

  // Courses CRUD
  adminGetCourses: async (): Promise<Course[]> => {
    return cachedGet('/admin/courses');
  },
  adminCreateCourse: async (course: Omit<Course, 'id'>): Promise<Course> => {
    const response = await api.post('/admin/courses', course);
    return response.data;
  },
  adminUpdateCourse: async (courseId: number | string, course: Omit<Course, 'id'>): Promise<Course> => {
    const response = await api.put(`/admin/courses/${courseId}`, course);
    return response.data;
  },
  adminDeleteCourse: async (courseId: number | string): Promise<any> => {
    const response = await api.delete(`/admin/courses/${courseId}`);
    return response.data;
  },

  // Course Staff Assignments CRUD
  adminGetAssignments: async (): Promise<CourseStaffAssignment[]> => {
    return cachedGet('/admin/assignments');
  },
  adminGetTimetable: async (): Promise<Course[]> => {
    return cachedGet('/admin/timetable');
  },
  adminUpdateTimetableSlot: async (
    meetingId: number | string,
    slot: { day: string; start: string; end: string; room: string }
  ): Promise<any> => {
    const response = await api.put(`/admin/timetable/${meetingId}`, slot);
    return response.data;
  },
  adminCreateAssignment: async (assignment: { course_id: number | string; lecturer_id: number | string; role: string }): Promise<CourseStaffAssignment> => {
    const response = await api.post('/admin/assignments', assignment);
    return response.data;
  },
  adminDeleteAssignment: async (assignmentId: number | string): Promise<any> => {
    const response = await api.delete(`/admin/assignments/${assignmentId}`);
    return response.data;
  },

  // Student Programme Assignment
  adminAssignStudentProgramme: async (studentId: number | string, programmeId: number | string | null): Promise<any> => {
    const response = await api.put(`/admin/students/${studentId}/programme`, { programme_id: programmeId });
    return response.data;
  },

  // Student Enrolments CRUD
  adminGetEnrolments: async (): Promise<Enrolment[]> => {
    return cachedGet('/admin/enrolments');
  },
  adminCreateEnrolment: async (enrolment: { student_id: number | string; course_id: number | string; semester?: string; class_group?: string }): Promise<any> => {
    const response = await api.post('/admin/enrolments', enrolment);
    return response.data;
  },
  adminDeleteEnrolment: async (enrolmentId: number | string): Promise<any> => {
    const response = await api.delete(`/admin/enrolments/${enrolmentId}`);
    return response.data;
  },

  // Admin Attendance APIs
  adminGetSessions: async (): Promise<AdminSession[]> => {
    return cachedGet('/admin/sessions');
  },
  adminGetSessionAttendance: async (sessionId: number | string): Promise<AdminSessionAttendanceResponse> => {
    const response = await api.get(`/admin/sessions/${encodeURIComponent(String(sessionId))}/attendance`);
    return response.data;
  },
  adminUpdateAttendance: async (sessionId: number | string, studentId: number | string, data: { status: 'present' | 'absent'; wifi_verified: boolean; liveness_passed: boolean }): Promise<any> => {
    const response = await api.put(`/admin/attendance/${encodeURIComponent(String(sessionId))}/${encodeURIComponent(String(studentId))}`, data);
    return response.data;
  },

  // Campus Network whitelist + security settings
  adminDetectCurrentConnection: async (): Promise<{
    client_ip: string;
    ipv6_address?: string;
    cidr: string;
    label: string;
    ssid?: string;
    bssid?: string;
    location?: string;
    user_agent: string;
    protocol: string;
  }> => {
    const response = await api.get('/admin/detect-connection');
    return response.data;
  },
  adminGetCampusNetworks: async (): Promise<CampusNetwork[]> => {
    return cachedGet('/admin/campus-networks');
  },
  adminCreateCampusNetwork: async (net: Omit<CampusNetwork, 'id'>): Promise<CampusNetwork> => {
    const response = await api.post('/admin/campus-networks', net);
    return response.data;
  },
  adminUpdateCampusNetwork: async (netId: number | string, net: Partial<Omit<CampusNetwork, 'id'>>): Promise<CampusNetwork> => {
    const response = await api.put(`/admin/campus-networks/${netId}`, net);
    return response.data;
  },
  adminDeleteCampusNetwork: async (netId: number | string): Promise<any> => {
    const response = await api.delete(`/admin/campus-networks/${encodeURIComponent(String(netId))}`);
    return response.data;
  },
  adminGetSecuritySettings: async (): Promise<SecuritySettings> => {
    return cachedGet('/admin/security-settings');
  },
  adminUpdateSecuritySettings: async (settings: SecuritySettings): Promise<SecuritySettings> => {
    const response = await api.put('/admin/security-settings', { settings });
    return response.data;
  },

  studentGetProfile: async (): Promise<StudentProfile> => {
    return cachedGet('/students/me/profile');
  },
  studentGetEnrolments: async (): Promise<StudentEnrolmentDetail[]> => {
    return cachedGet('/students/me/enrolments');
  },
  studentGetMedicalLeave: async (): Promise<MedicalLeaveRecord[]> => {
    const response = await api.get('/students/me/medical-leave');
    return response.data;
  },
  studentSubmitMedicalLeave: async (data: FormData, onProgress?: (percent: number) => void): Promise<MedicalLeaveRecord> => {
    const response = await api.post('/students/me/medical-leave', data, {
      onUploadProgress: event => {
        const ratio = event.progress ?? (event.total ? event.loaded / event.total : null);
        onProgress?.(ratio === null ? 70 : Math.min(80, Math.max(5, Math.round(ratio * 80))));
      },
    });
    return response.data;
  },
  studentDownloadMedicalProof: async (requestId: string): Promise<Blob> => {
    const response = await api.get(`/students/me/medical-leave/${encodeURIComponent(requestId)}/proof`, { responseType: 'blob' });
    return response.data;
  },
  studentGetCourses: async (): Promise<Course[]> => {
    return cachedGet('/students/me/courses');
  },
  studentGetAttendance: async (): Promise<StudentAttendanceRecord[]> => {
    return cachedGet('/students/me/attendance');
  },
  studentGetAttendanceSessions: async (): Promise<StudentAttendanceSession[]> => {
    return cachedGet('/students/me/attendance-sessions');
  },
  studentGetActiveSessions: async (): Promise<StudentActiveSession[]> => {
    return cachedGet('/students/me/active-sessions');
  },
  studentGetAnnouncements: async (): Promise<Announcement[]> => {
    return cachedGet('/students/me/announcements');
  },
  studentDownloadAnnouncementAttachment: async (announcementId: string | number): Promise<Blob> => {
    const response = await api.get(`/students/me/announcements/${announcementId}/attachment`, { responseType: 'blob' });
    return response.data;
  },
  lecturerGetAnnouncements: async (): Promise<Announcement[]> => {
    return cachedGet('/lecturers/me/announcements');
  },
  lecturerGetCourseAnnouncements: async (): Promise<Announcement[]> => {
    const response = await api.get('/lecturers/me/course-announcements');
    return response.data;
  },
  lecturerGetCourseAnnouncementOptions: async (): Promise<CourseAnnouncementOption[]> => {
    return cachedGet('/lecturers/me/course-announcement-options');
  },
  lecturerCreateCourseAnnouncement: async (data: FormData, onProgress?: (percent: number) => void): Promise<Announcement> => {
    const response = await api.post('/lecturers/me/course-announcements', data, {
      onUploadProgress: event => {
        if (event.total) onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      },
    });
    clearApiCache();
    return response.data;
  },
  lecturerUpdateCourseAnnouncement: async (id: string | number, data: FormData, onProgress?: (percent: number) => void): Promise<Announcement> => {
    const response = await api.put(`/lecturers/me/course-announcements/${id}`, data, {
      onUploadProgress: event => {
        if (event.total) onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      },
    });
    clearApiCache();
    return response.data;
  },
  lecturerDeleteCourseAnnouncement: async (id: string | number) => {
    const response = await api.delete(`/lecturers/me/course-announcements/${id}`);
    clearApiCache();
    return response.data;
  },

  // ─── User Profile & Account Settings APIs ──────────────────────────
  getUserProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  changePassword: async (data: { current_password: string; new_password: string }) => {
    const response = await api.put('/auth/me/change-password', data);
    return response.data;
  },
  updateUserSettings: async (settings: Record<string, any>) => {
    const response = await api.put('/auth/me/settings', settings);
    return response.data;
  },
  updateUserAvatar: async (avatarUrl: string) => {
    const response = await api.put('/auth/me/avatar', { avatar_url: avatarUrl });
    return response.data;
  },
  updateAdminProfile: async (data: { name: string; email: string; code: string }) => {
    const response = await api.put('/auth/me/admin-profile', data);
    return response.data;
  },
  fetchSystemLanguages: async () => {
    return cachedGet('/api/v1/system/languages');
  },

  // Admin Reports & Audit Logs API
  getAdminFeedback: async (status?: string, category?: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'All') params.append('status', status);
    if (category && category !== 'All') params.append('category', category);
    const response = await api.get<StudentFeedbackReport[]>(`/admin/reports/feedback?${params.toString()}`);
    return response.data;
  },
  updateAdminFeedback: async (feedbackId: string, data: { status: string; admin_notes?: string }) => {
    const response = await api.put<StudentFeedbackReport>(`/admin/reports/feedback/${feedbackId}`, data);
    return response.data;
  },
  getAdminMCReports: async (status?: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'All') params.append('status', status);
    const response = await api.get<MCReportItem[]>(`/admin/reports/mc?${params.toString()}`);
    return response.data;
  },
  updateAdminMCReport: async (recordId: string, status: string) => {
    const response = await api.put(`/admin/reports/mc/${recordId}`, { status });
    return response.data;
  },
  getAdminAuditLogs: async (category?: string, search?: string) => {
    const params = new URLSearchParams();
    if (category && category.toLowerCase() !== 'all') params.append('category', category);
    if (search) params.append('search', search);
    const response = await api.get<AuditLogEntry[]>(`/admin/audit/logs?${params.toString()}`);
    return response.data;
  },
  getAuditIPLocation: async (ipAddress: string) => {
    const response = await api.get<AuditIPLocation>('/admin/audit/ip-location', {
      params: { ip: ipAddress },
    });
    return response.data;
  },
  getAuditMapConfig: async () => {
    const response = await api.get<{ api_key: string }>('/admin/audit/map-config');
    return response.data;
  },
  createAdminAuditLog: async (data: { category: string; action: string; details?: string; ip_address?: string }) => {
    const response = await api.post<AuditLogEntry>('/admin/audit/logs', data);
    return response.data;
  },
};

export interface StudentFeedbackReport {
  id: string;
  student_id?: string;
  student_name: string;
  student_code: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  admin_notes?: string;
  created_at: string;
}

export interface MCReportItem {
  id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  course_name: string;
  course_code: string;
  mc_proof_url?: string;
  timestamp: string;
  status: string;
  flag_reason?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id?: string;
  user_name: string;
  user_role: string;
  category: string; // 'admin' | 'staff'
  action: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface AuditIPLocation {
  available: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  resolved_ip?: string;
  network?: string;
  is_approximate: boolean;
  source_kind: 'public' | 'local_egress' | 'local' | 'invalid';
  message?: string;
}
