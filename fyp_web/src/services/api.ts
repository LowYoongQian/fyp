import axios from 'axios';

// Base URL is injected at build time via Vite env (VITE_API_BASE_URL).
// Define it in fyp_web/.env (see .env.example). Falls back to the local backend.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8003';

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

// Seed data storage keys for local dashboard simulation
const KEYS = {
  COURSES: 'sas_courses',
  STUDENTS: 'sas_students',
  ENROLMENTS: 'sas_enrolments',
  RISK_SCORES: 'sas_risk_scores',
  ALERTS: 'sas_alerts',
};

// Seed initial dashboard data if not already initialized in LocalStorage
const seedDatabase = () => {
  const coursesRaw = localStorage.getItem(KEYS.COURSES);
  const isOldMockData = !coursesRaw || coursesRaw.includes('CSE-401');

  if (isOldMockData) {
    const initialCourses = [
      { id: 1, course_name: 'Software Engineering', course_code: 'CS-101', lecturer_id: 1 },
      { id: 2, course_name: 'Database Systems', course_code: 'CS-202', lecturer_id: 2 },
      { id: 5, course_name: 'Test Course', course_code: 'T_COURSE', lecturer_id: 6 },
    ];
    localStorage.setItem(KEYS.COURSES, JSON.stringify(initialCourses));

    const initialStudents = [
      { id: 1, name: 'John Tan', student_code: 'B21001', is_face_registered: true },
      { id: 2, name: 'Priya Raj', student_code: 'B21002', is_face_registered: true },
      { id: 3, name: 'Muhammad Ali', student_code: 'B21003', is_face_registered: false },
      { id: 4, name: 'Sarah Lim', student_code: 'B21004', is_face_registered: true },
      { id: 5, name: 'Yong', student_code: 'B12345', is_face_registered: false },
      { id: 8, name: 'Test Student', student_code: 'T_STUDENT', is_face_registered: false },
      { id: 9, name: 'low', student_code: 'TP061111', is_face_registered: true },
    ];
    localStorage.setItem(KEYS.STUDENTS, JSON.stringify(initialStudents));

    const initialEnrolments = [
      { id: 1, student_id: 1, course_id: 1, semester: '2026-Semester 1', class_group: 'G1' },
      { id: 2, student_id: 2, course_id: 1, semester: '2026-Semester 1', class_group: 'G1' },
      { id: 3, student_id: 3, course_id: 1, semester: '2026-Semester 1', class_group: 'G2' },
      { id: 4, student_id: 4, course_id: 2, semester: '2026-Semester 1', class_group: 'G1' },
      { id: 7, student_id: 8, course_id: 5, semester: '2026-SEM1', class_group: 'G1' },
    ];
    localStorage.setItem(KEYS.ENROLMENTS, JSON.stringify(initialEnrolments));

    const initialRiskScores = [
      { id: 1, student_id: 1, course_id: 1, risk_score: 0.12, risk_label: 'low', attendance_rate: 0.95 },
      { id: 2, student_id: 2, course_id: 1, risk_score: 0.45, risk_label: 'medium', attendance_rate: 0.78 },
      { id: 3, student_id: 3, course_id: 1, risk_score: 0.88, risk_label: 'high', attendance_rate: 0.52 },
      { id: 4, student_id: 4, course_id: 2, risk_score: 0.18, risk_label: 'low', attendance_rate: 0.90 },
      { id: 5, student_id: 8, course_id: 5, risk_score: 0.92, risk_label: 'high', attendance_rate: 0.48 },
    ];
    localStorage.setItem(KEYS.RISK_SCORES, JSON.stringify(initialRiskScores));

    const initialAlerts = [
      { id: 1, student_id: 3, course_id: 1, alert_type: 'at_risk', email_body: 'Warning email drafted...', triggered_by: 'system', triggered_at: new Date(Date.now() - 86400000).toISOString(), sent_at: new Date(Date.now() - 86400000).toISOString() }
    ];
    localStorage.setItem(KEYS.ALERTS, JSON.stringify(initialAlerts));
  }
};

seedDatabase();

// Define data models
export interface Course {
  id: number;
  course_name: string;
  course_code: string;
  credit_hours?: number | null;
  lecturer_id: number | null;
  lecturer_name?: string | null;
  programme_id?: number | null;
  programme_name?: string | null;
  schedule_day?: string | null;
  schedule_start?: string | null;
  schedule_end?: string | null;
  schedule_room?: string | null;
  role?: string | null;
  course_id?: number | null;
  attendance_rate?: number | null;
}

export interface Student {
  id: number;
  name: string;
  student_code: string;
  is_face_registered: boolean;
  programme_id?: number | null;
}

export interface Enrolment {
  id: number;
  student_id: number;
  student_name?: string;
  student_code?: string;
  course_id: number;
  course_code?: string;
  course_name?: string;
  semester: string;
  class_group: string;
}

export interface Programme {
  id: number;
  name: string;
  code: string;
}

export interface CourseStaffAssignment {
  id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  lecturer_id: number;
  lecturer_name: string;
  role: 'Lecturer' | 'Tutor' | 'Practical';
}

export interface RiskScore {
  id: number;
  student_id: number;
  student_name?: string;
  student_code?: string;
  course_id: number;
  course_code?: string;
  risk_score: number;
  risk_label: 'low' | 'medium' | 'high';
  attendance_rate: number;
}

export interface AlertLog {
  id: number;
  student_id: number;
  student_name?: string;
  course_id: number;
  course_code?: string;
  alert_type: string;
  email_body: string;
  triggered_by: string;
  triggered_at: string;
  sent_at?: string;
}

export interface ActiveSession {
  id: number;
  course_id: number;
  course_name?: string;
  course_code?: string;
  opened_at?: string;
  closed_at?: string;
  is_open: boolean;
  class_group: string;
}

export interface StudentAttendance {
  student_id: number;
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
  session_id: number;
  course_name: string;
  course_code: string;
  class_group: string;
  is_open: boolean;
  attendance_list: StudentAttendance[];
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  faculty: string;
  department: string;
  created_at: string;
  is_draft: boolean;
  priority: 'High' | 'Medium' | 'Low';
  image_base64?: string | null;
  publish_start?: string | null;
  publish_end?: string | null;
  target_audience: string;
  target_programme_code?: string | null;
}

export interface AdminStudent {
  id: number;
  user_id: number;
  name: string;
  student_code: string;
  is_face_registered: boolean;
  email: string;
  programme_id?: number | null;
}

export interface AdminStaff {
  id: number;
  user_id: number;
  name: string;
  staff_id: string;
  email: string;
  role?: string;
}

export interface AdminSession {
  id: number;
  course_id: number;
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
  student_id: number;
  student_name: string;
  student_code: string;
  status: 'present' | 'absent';
  marked_at: string | null;
  confidence_score: number | null;
  wifi_verified: boolean;
  liveness_passed: boolean;
}

export interface AdminSessionAttendanceResponse {
  session_id: number;
  course_name: string;
  course_code: string;
  class_group: string;
  is_open: boolean;
  attendance_list: AdminAttendanceRecord[];
}

export interface CampusNetwork {
  id: number;
  label: string;
  cidr: string | null;
  ssid: string | null;
  bssid_prefix: string | null;
  is_active: boolean;
}

export type SecuritySettings = Record<string, string>;

// Student self-service types (returned by /students/me/* endpoints)
export interface StudentProfile {
  id: number;
  user_id: number;
  name: string;
  student_code: string;
  is_face_registered: boolean;
  email: string;
  programme_id: number | null;
  programme_name: string | null;
}

export interface StudentEnrolmentDetail {
  id: number;
  student_id: number;
  course_id: number;
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
  id: number;
  session_id: number;
  course_id: number | null;
  course_code: string;
  course_name: string;
  status: 'present' | 'absent';
  marked_at: string | null;
  confidence_score: number | null;
  network_verified: boolean | null;
}

export interface StudentActiveSession {
  id: number;
  course_id: number;
  course_name: string;
  course_code: string;
  class_group: string;
  opened_at: string | null;
  is_open: boolean;
  already_checked_in: boolean;
}

export const apiService = {
  // Real Backend Auth APIs
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data; // returns { access_token, token_type, role, user_id }
  },

  register: async (data: any) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  // Real Backend Session APIs
  openSession: async (courseId: number, classGroup: string = 'All') => {
    const response = await api.post<ActiveSession>('/sessions/open', {
      course_id: courseId,
      class_group: classGroup,
    });
    return response.data;
  },

  closeSession: async (sessionId: number) => {
    const response = await api.post<ActiveSession>(`/sessions/${sessionId}/close`);
    return response.data;
  },

  getActiveSessions: async () => {
    try {
      const response = await api.get<ActiveSession[]>('/sessions/active');
      return response.data;
    } catch (err) {
      console.warn("Backend connection failed or no sessions, returning empty list.");
      return [];
    }
  },

  getSessionAttendance: async (sessionId: number) => {
    const response = await api.get<SessionAttendanceDetail>(`/sessions/${sessionId}/attendance`);
    return response.data;
  },

  getCourseSessions: async (courseId: number): Promise<ActiveSession[]> => {
    const response = await api.get<ActiveSession[]>(`/sessions/course/${courseId}/sessions`);
    return response.data;
  },

  updateLecturerAttendance: async (sessionId: number, studentId: number, status: 'present' | 'absent'): Promise<any> => {
    const response = await api.put(`/sessions/attendance/${sessionId}/${studentId}`, { status });
    return response.data;
  },

  // Real Backend LLM query API
  queryNatural: async (question: string) => {
    const response = await api.post('/query/natural', { question });
    return response.data; // returns { answer, sql_used, success, row_count }
  },

  // Mock / Simulated Admin APIs
  // Live Backend Lecturer & Analytics APIs
  getCourses: async (): Promise<Course[]> => {
    const response = await api.get('/lecturers/me/courses');
    return response.data;
  },

  getLecturerTimetable: async (): Promise<Course[]> => {
    const response = await api.get('/lecturers/me/timetable');
    return response.data;
  },

  getStudents: async (): Promise<Student[]> => {
    const response = await api.get('/admin/students');
    return response.data.items;
  },

  getEnrolments: async (): Promise<Enrolment[]> => {
    const response = await api.get('/admin/enrolments');
    return response.data;
  },

  getRiskScores: async (): Promise<RiskScore[]> => {
    const response = await api.get('/analytics/risk-scores');
    return response.data;
  },

  getAlertLogs: async (): Promise<AlertLog[]> => {
    const response = await api.get('/lecturers/me/alerts');
    return response.data;
  },

  triggerManualAlert: async (studentId: number, courseId: number) => {
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
  adminGetStudents: async (skip?: number, limit?: number): Promise<{ items: AdminStudent[]; total: number }> => {
    const response = await api.get('/admin/students', { params: { skip, limit } });
    return response.data;
  },
  adminCreateStudent: async (student: any): Promise<any> => {
    const response = await api.post('/admin/students', student);
    return response.data;
  },
  adminUpdateStudent: async (studentId: number, student: any): Promise<any> => {
    const response = await api.put(`/admin/students/${studentId}`, student);
    return response.data;
  },
  adminDeleteStudent: async (studentId: number): Promise<any> => {
    const response = await api.delete(`/admin/students/${studentId}`);
    return response.data;
  },
  adminGetStaff: async (skip?: number, limit?: number): Promise<{ items: AdminStaff[]; total: number }> => {
    const response = await api.get('/admin/staff', { params: { skip, limit } });
    return response.data;
  },
  adminCreateStaff: async (staff: any): Promise<any> => {
    const response = await api.post('/admin/staff', staff);
    return response.data;
  },
  adminUpdateStaff: async (lecturerId: number, staff: any): Promise<any> => {
    const response = await api.put(`/admin/staff/${lecturerId}`, staff);
    return response.data;
  },
  adminDeleteStaff: async (lecturerId: number): Promise<any> => {
    const response = await api.delete(`/admin/staff/${lecturerId}`);
    return response.data;
  },
  adminGetAnnouncements: async (): Promise<Announcement[]> => {
    const response = await api.get('/admin/announcements');
    return response.data;
  },
  adminCreateAnnouncement: async (announcement: any): Promise<Announcement> => {
    const response = await api.post('/admin/announcements', announcement);
    return response.data;
  },
  adminUpdateAnnouncement: async (announcementId: number, announcement: any): Promise<Announcement> => {
    const response = await api.put(`/admin/announcements/${announcementId}`, announcement);
    return response.data;
  },
  adminDeleteAnnouncement: async (announcementId: number): Promise<any> => {
    const response = await api.delete(`/admin/announcements/${announcementId}`);
    return response.data;
  },

  // Programmes CRUD
  adminGetProgrammes: async (): Promise<Programme[]> => {
    const response = await api.get('/admin/programmes');
    return response.data;
  },
  adminCreateProgramme: async (programme: Omit<Programme, 'id'>): Promise<Programme> => {
    const response = await api.post('/admin/programmes', programme);
    return response.data;
  },
  adminUpdateProgramme: async (programmeId: number, programme: Omit<Programme, 'id'>): Promise<Programme> => {
    const response = await api.put(`/admin/programmes/${programmeId}`, programme);
    return response.data;
  },
  adminDeleteProgramme: async (programmeId: number): Promise<any> => {
    const response = await api.delete(`/admin/programmes/${programmeId}`);
    return response.data;
  },

  // Courses CRUD
  adminGetCourses: async (): Promise<Course[]> => {
    const response = await api.get('/admin/courses');
    return response.data;
  },
  adminCreateCourse: async (course: Omit<Course, 'id'>): Promise<Course> => {
    const response = await api.post('/admin/courses', course);
    return response.data;
  },
  adminUpdateCourse: async (courseId: number, course: Omit<Course, 'id'>): Promise<Course> => {
    const response = await api.put(`/admin/courses/${courseId}`, course);
    return response.data;
  },
  adminDeleteCourse: async (courseId: number): Promise<any> => {
    const response = await api.delete(`/admin/courses/${courseId}`);
    return response.data;
  },

  // Course Staff Assignments CRUD
  adminGetAssignments: async (): Promise<CourseStaffAssignment[]> => {
    const response = await api.get('/admin/assignments');
    return response.data;
  },
  adminGetTimetable: async (): Promise<Course[]> => {
    const response = await api.get('/admin/timetable');
    return response.data;
  },
  adminCreateAssignment: async (assignment: { course_id: number; lecturer_id: number; role: string }): Promise<CourseStaffAssignment> => {
    const response = await api.post('/admin/assignments', assignment);
    return response.data;
  },
  adminDeleteAssignment: async (assignmentId: number): Promise<any> => {
    const response = await api.delete(`/admin/assignments/${assignmentId}`);
    return response.data;
  },

  // Student Programme Assignment
  adminAssignStudentProgramme: async (studentId: number, programmeId: number | null): Promise<any> => {
    const response = await api.put(`/admin/students/${studentId}/programme`, { programme_id: programmeId });
    return response.data;
  },

  // Student Enrolments CRUD
  adminGetEnrolments: async (): Promise<Enrolment[]> => {
    const response = await api.get('/admin/enrolments');
    return response.data;
  },
  adminCreateEnrolment: async (enrolment: { student_id: number; course_id: number; semester?: string; class_group?: string }): Promise<any> => {
    const response = await api.post('/admin/enrolments', enrolment);
    return response.data;
  },
  adminDeleteEnrolment: async (enrolmentId: number): Promise<any> => {
    const response = await api.delete(`/admin/enrolments/${enrolmentId}`);
    return response.data;
  },

  // Admin Attendance APIs
  adminGetSessions: async (): Promise<AdminSession[]> => {
    const response = await api.get('/admin/sessions');
    return response.data;
  },
  adminGetSessionAttendance: async (sessionId: number): Promise<AdminSessionAttendanceResponse> => {
    const response = await api.get(`/admin/sessions/${sessionId}/attendance`);
    return response.data;
  },
  adminUpdateAttendance: async (sessionId: number, studentId: number, data: { status: 'present' | 'absent'; wifi_verified: boolean; liveness_passed: boolean }): Promise<any> => {
    const response = await api.put(`/admin/attendance/${sessionId}/${studentId}`, data);
    return response.data;
  },

  // Campus Network whitelist + security settings
  adminGetCampusNetworks: async (): Promise<CampusNetwork[]> => {
    const response = await api.get('/admin/campus-networks');
    return response.data;
  },
  adminCreateCampusNetwork: async (net: Omit<CampusNetwork, 'id'>): Promise<CampusNetwork> => {
    const response = await api.post('/admin/campus-networks', net);
    return response.data;
  },
  adminUpdateCampusNetwork: async (netId: number, net: Partial<Omit<CampusNetwork, 'id'>>): Promise<CampusNetwork> => {
    const response = await api.put(`/admin/campus-networks/${netId}`, net);
    return response.data;
  },
  adminDeleteCampusNetwork: async (netId: number): Promise<any> => {
    const response = await api.delete(`/admin/campus-networks/${netId}`);
    return response.data;
  },
  adminGetSecuritySettings: async (): Promise<SecuritySettings> => {
    const response = await api.get('/admin/security-settings');
    return response.data;
  },
  adminUpdateSecuritySettings: async (settings: SecuritySettings): Promise<SecuritySettings> => {
    const response = await api.put('/admin/security-settings', { settings });
    return response.data;
  },

  // ─── Student Self-Service APIs ───────────────────────────────────────
  // These call /students/me/* endpoints that are scoped to the logged-in student.

  studentGetProfile: async (): Promise<StudentProfile> => {
    const response = await api.get('/students/me/profile');
    return response.data;
  },
  studentGetEnrolments: async (): Promise<StudentEnrolmentDetail[]> => {
    const response = await api.get('/students/me/enrolments');
    return response.data;
  },
  studentGetCourses: async (): Promise<Course[]> => {
    const response = await api.get('/students/me/courses');
    return response.data;
  },
  studentGetAttendance: async (): Promise<StudentAttendanceRecord[]> => {
    const response = await api.get('/students/me/attendance');
    return response.data;
  },
  studentGetActiveSessions: async (): Promise<StudentActiveSession[]> => {
    const response = await api.get('/students/me/active-sessions');
    return response.data;
  },
  studentGetAnnouncements: async (): Promise<Announcement[]> => {
    const response = await api.get('/students/me/announcements');
    return response.data;
  },
  lecturerGetAnnouncements: async (): Promise<Announcement[]> => {
    const response = await api.get('/lecturers/me/announcements');
    return response.data;
  },
};
