from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from enum import Enum


class StaffRole(str, Enum):
    """Roles that drive scheduling/assignment logic. Constrained to prevent a
    typo (e.g. 'Practical') from silently dropping a class from the timetable."""
    lecturer = "Lecturer"
    tutor = "Tutor"
    practical = "Practical"


class AccountRole(str, Enum):
    student = "student"
    lecturer = "lecturer"

# Authentication Schemas
class LoginRequest(BaseModel):
    # Accepts an email OR a student_code / staff_id. `email` kept for backward
    # compatibility with older app builds; `identifier` is preferred.
    email: Optional[str] = None
    identifier: Optional[str] = None
    password: str
    # Device fingerprint for multi-device session binding (optional; older
    # clients that omit it are not locked to a device).
    device_id: Optional[str] = None
    portal: Optional[str] = None

class RegisterRequest(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    email: EmailStr
    password: str = Field(min_length=8)
    role: AccountRole          # 'student' | 'lecturer'
    name: str
    code: Optional[str] = None          # student_code or staff_id
    class_group: Optional[str] = None   # alias/fallback sent by some frontend UI versions

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    # Profile details so the app never needs a direct DB connection to log in.
    profile_id: Optional[int] = None        # students.id or lecturers.id
    name: Optional[str] = None
    code: Optional[str] = None              # student_code or staff_id
    email: Optional[str] = None
    is_face_registered: Optional[bool] = None

# LLM Chatbot Schemas
class QueryRequest(BaseModel):
    question: str

class QueryResponse(BaseModel):
    answer: str
    sql_used: Optional[str] = None
    success: bool
    row_count: int = 0

# Generic Response
class MessageResponse(BaseModel):
    message: str
    user_id: Optional[int] = None

# Session & Attendance Schemas
from datetime import datetime

class SessionCreate(BaseModel):
    course_id: int
    class_group: str = "All"

class SessionResponse(BaseModel):
    id: int
    course_id: int
    opened_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    is_open: bool
    class_group: str

    class Config:
        from_attributes = True

class AttendanceSubmit(BaseModel):
    wifi_ssid: str
    image_base64: str
    liveness_passed: bool = True
    # Client-reported network facts (corroborating signals; spoofable individually)
    bssid: Optional[str] = None         # connected access point MAC
    gateway_ip: Optional[str] = None    # router/gateway IP the device routes through
    local_ip: Optional[str] = None      # device's own LAN IP
    # Behavioral biometrics — how long (ms) the liveness challenge took to pass.
    # A suspiciously short value (<800 ms) may indicate replay or automation.
    liveness_challenge_ms: Optional[int] = None
    # Device fingerprint of the phone checking in (recorded for audit only).
    device_id: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: int
    student_id: int
    session_id: int
    status: str
    confidence_score: Optional[float] = None
    wifi_verified: bool
    liveness_passed: bool
    marked_at: datetime
    network_verified: Optional[bool] = None
    verify_detail: Optional[str] = None
    liveness_challenge_ms: Optional[int] = None
    liveness_suspicious: Optional[bool] = None

    class Config:
        from_attributes = True

class StudentAttendanceStatus(BaseModel):
    student_id: int
    student_name: str
    student_code: str
    status: str
    marked_at: Optional[datetime] = None
    confidence_score: Optional[float] = None
    network_verified: Optional[bool] = None
    source_ip: Optional[str] = None
    verify_detail: Optional[str] = None

class SessionAttendanceResponse(BaseModel):
    session_id: int
    course_name: str
    course_code: str
    class_group: str
    is_open: bool
    attendance_list: list[StudentAttendanceStatus]

# Announcement Schemas
class AnnouncementCreate(BaseModel):
    title: str
    content: str
    faculty: str
    department: str
    is_draft: Optional[bool] = False
    priority: Optional[str] = "Medium"
    publisher: Optional[str] = "ADMIN"
    image_base64: Optional[str] = None
    publish_start: Optional[datetime] = None
    publish_end: Optional[datetime] = None
    target_scope: Optional[str] = "all"        # 'all' | 'programme' | 'course'
    target_role: Optional[str] = "all"         # 'all' | 'students' | 'staff'
    target_programme_code: Optional[str] = None
    target_course_code: Optional[str] = None

class AnnouncementResponse(BaseModel):
    id: int
    title: str
    content: str
    faculty: str
    department: str
    created_at: datetime
    is_draft: bool
    priority: str
    publisher: str
    image_base64: Optional[str] = None
    publish_start: Optional[datetime] = None
    publish_end: Optional[datetime] = None
    target_scope: str
    target_role: str
    target_programme_code: Optional[str] = None
    target_course_code: Optional[str] = None

    class Config:
        from_attributes = True

# Admin CRUD Schemas
class AdminStudentCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    student_code: str

class AdminStudentUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8)
    name: Optional[str] = None
    student_code: Optional[str] = None

class AdminStaffCreate(BaseModel):
    model_config = ConfigDict(use_enum_values=True, validate_default=True)
    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    staff_id: str
    role: Optional[StaffRole] = StaffRole.lecturer

class AdminStaffUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8)
    name: Optional[str] = None
    staff_id: Optional[str] = None
    role: Optional[StaffRole] = None

# Academic Schemas
class ProgrammeCreate(BaseModel):
    name: str
    code: str

class ProgrammeResponse(BaseModel):
    id: int
    name: str
    code: str

    class Config:
        from_attributes = True

class CourseCreate(BaseModel):
    course_name: str
    course_code: str
    credit_hours: Optional[float] = 3.0
    lecturer_id: Optional[int] = None
    programme_id: Optional[int] = None
    
    schedule_day: Optional[str] = None
    schedule_start: Optional[str] = None
    schedule_end: Optional[str] = None
    schedule_room: Optional[str] = None

class CourseResponse(BaseModel):
    id: int
    course_name: str
    course_code: str
    credit_hours: Optional[float] = 3.0
    lecturer_id: Optional[int] = None
    programme_id: Optional[int] = None
    
    schedule_day: Optional[str] = None
    schedule_start: Optional[str] = None
    schedule_end: Optional[str] = None
    schedule_room: Optional[str] = None

    class Config:
        from_attributes = True

class AssignmentCreate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    course_id: int
    lecturer_id: int
    role: StaffRole

class AssignmentResponse(BaseModel):
    id: int
    course_id: int
    lecturer_id: int
    role: str

    class Config:
        from_attributes = True

class StudentProgrammeAssign(BaseModel):
    programme_id: Optional[int] = None

class AdminAttendanceUpdate(BaseModel):
    status: str
    wifi_verified: bool = True
    liveness_passed: bool = True

# Campus Network & Security Settings Schemas
class CampusNetworkCreate(BaseModel):
    label: str
    cidr: Optional[str] = None
    ssid: Optional[str] = None
    bssid_prefix: Optional[str] = None
    is_active: bool = True

class CampusNetworkUpdate(BaseModel):
    label: Optional[str] = None
    cidr: Optional[str] = None
    ssid: Optional[str] = None
    bssid_prefix: Optional[str] = None
    is_active: Optional[bool] = None

class CampusNetworkResponse(BaseModel):
    id: int
    label: str
    cidr: Optional[str] = None
    ssid: Optional[str] = None
    bssid_prefix: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class SecuritySettingItem(BaseModel):
    key: str
    value: Optional[str] = None

class SecuritySettingsUpdate(BaseModel):
    # accepts any subset of the known keys
    settings: dict[str, str]

