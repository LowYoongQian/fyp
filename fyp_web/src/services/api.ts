import axios from 'axios';

// Base URL is injected at build time via Vite env (VITE_API_BASE_URL).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

// Memory cache for client-side API caching
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache TTL

export const clearApiCache = () => {
  apiCache.clear();
};

// Helper to handle cached GET requests
export const cachedGet = async (url: string, params?: any): Promise<any> => {
  const cacheKey = JSON.stringify({ url, params });
  const cached = apiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  const response = await api.get(url, { params });
  apiCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
  return response.data;
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

export interface StudentActiveSession {
  id: number | string;
  course_id: number | string;
  course_name: string;
  course_code: string;
  class_group: string;
  opened_at: string | null;
  is_open: boolean;
  already_checked_in: boolean;
}

export const apiService = {
  // Real Backend Auth APIs
  login: async (email: string, password: string, portal?: string) => {
    const response = await api.post('/auth/login', { email, password, portal });
    return response.data;
  },

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

  closeSession: async (sessionId: number | string) => {
    const response = await api.post<ActiveSession>(`/sessions/${sessionId}/close`);
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
    const response = await api.get(`/admin/sessions/${sessionId}/attendance`);
    return response.data;
  },
  adminUpdateAttendance: async (sessionId: number | string, studentId: number | string, data: { status: 'present' | 'absent'; wifi_verified: boolean; liveness_passed: boolean }): Promise<any> => {
    const response = await api.put(`/admin/attendance/${sessionId}/${studentId}`, data);
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
    const response = await api.delete(`/admin/campus-networks/${netId}`);
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
  studentGetCourses: async (): Promise<Course[]> => {
    return cachedGet('/students/me/courses');
  },
  studentGetAttendance: async (): Promise<StudentAttendanceRecord[]> => {
    return cachedGet('/students/me/attendance');
  },
  studentGetActiveSessions: async (): Promise<StudentActiveSession[]> => {
    return cachedGet('/students/me/active-sessions');
  },
  studentGetAnnouncements: async (): Promise<Announcement[]> => {
    return cachedGet('/students/me/announcements');
  },
  lecturerGetAnnouncements: async (): Promise<Announcement[]> => {
    return cachedGet('/lecturers/me/announcements');
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
  getUserActiveSessions: async () => {
    return cachedGet('/auth/active-sessions');
  },
  logoutSession: async (sessionId: string) => {
    const response = await api.post(`/auth/logout-session?session_id=${sessionId}`);
    return response.data;
  },
  fetchSystemLanguages: async () => {
    return cachedGet('/api/v1/system/languages');
  },
};
