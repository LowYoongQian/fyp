import re

from pydantic import AliasChoices, BaseModel, EmailStr, Field, ConfigDict, field_validator, model_validator
from typing import Annotated, Optional, Any, Union
from enum import Enum


# Canonical student code: ST followed by exactly 7 digits (e.g. ST2510091). Mirrors the
# ck_students_student_code_format CHECK constraint in the DB, so a bad code is rejected
# with a readable 422 instead of a raw IntegrityError.
STUDENT_CODE_PATTERN = r"^ST\d{7}$"
StudentCode = Annotated[
    str,
    Field(pattern=STUDENT_CODE_PATTERN, description="ST followed by 7 digits, e.g. ST2510091"),
]

# Canonical staff id: T followed by exactly 6 digits (e.g. T000001). Mirrors the
# ck_lecturers_staff_id_format CHECK constraint in the DB.
STAFF_ID_PATTERN = r"^T\d{6}$"
StaffId = Annotated[
    str,
    Field(pattern=STAFF_ID_PATTERN, description="T followed by 6 digits, e.g. T000001"),
]


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
    email: Optional[str] = None
    identifier: Optional[str] = None
    password: str
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

    @field_validator("code", "class_group")
    @classmethod
    def _student_code_format(cls, v, info):
        # This endpoint only ever creates students (lecturer self-registration is
        # rejected in the router), and whichever of these fields is set becomes the
        # student_code -- so both must satisfy the canonical format.
        if v is not None and not re.fullmatch(STUDENT_CODE_PATTERN, v):
            raise ValueError("Student code must be ST followed by 7 digits, e.g. ST2510091")
        return v

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: Any
    profile_id: Optional[Any] = None        # students.id or lecturers.id
    name: Optional[str] = None
    code: Optional[str] = None              # student_code or staff_id
    email: Optional[str] = None
    is_face_registered: Optional[bool] = None
    recovery_email_verified: Optional[bool] = None

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
    user_id: Optional[Any] = None

# Session & Attendance Schemas
from datetime import datetime, timedelta, timezone

from pydantic import PlainSerializer

from utils.timeutil import iso_utc

# Every datetime we publish goes out as UTC with an explicit "Z". Annotate the field
# with this instead of bare `datetime`: Pydantic renders a naive value as
# "2026-08-03T02:26" with no zone, and Dart's DateTime.parse / JS's new Date() then
# read it as *device* local time, so .toLocal() does nothing. On Railway (no TZ set,
# so the host is UTC) that showed every time 8 hours behind Malaysia.
UtcDateTime = Annotated[datetime, PlainSerializer(iso_utc, return_type=Optional[str])]

class SessionCreate(BaseModel):
    course_id: Any
    class_group: str = "All"
    meeting_id: Optional[Any] = None

class SessionResponse(BaseModel):
    id: Any
    course_id: Any
    opened_at: Optional[UtcDateTime] = None
    closed_at: Optional[UtcDateTime] = None
    is_open: bool
    class_group: str
    meeting_id: Optional[Any] = None
    scheduled_start: Optional[UtcDateTime] = None
    scheduled_end: Optional[UtcDateTime] = None
    status: str = "open"
    room: Optional[str] = None
    cancel_reason: Optional[str] = None
    replacement_for_session_id: Optional[Any] = None

    class Config:
        from_attributes = True


class ClassCancellation(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)

    @field_validator("reason")
    @classmethod
    def reason_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Cancellation reason must contain at least 3 characters")
        return value


class ReplacementClassCreate(BaseModel):
    scheduled_start: datetime
    scheduled_end: datetime
    room: str = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def end_must_follow_start(self):
        if self.scheduled_start.tzinfo is not None:
            self.scheduled_start = self.scheduled_start.astimezone(timezone.utc).replace(tzinfo=None)
        if self.scheduled_end.tzinfo is not None:
            self.scheduled_end = self.scheduled_end.astimezone(timezone.utc).replace(tzinfo=None)
        if self.scheduled_end <= self.scheduled_start:
            raise ValueError("Replacement class end time must be after its start time")
        if self.scheduled_end - self.scheduled_start > timedelta(hours=6):
            raise ValueError("Replacement class cannot exceed 6 hours")
        self.room = self.room.strip()
        if not self.room:
            raise ValueError("Room is required")
        return self

class AttendanceSubmit(BaseModel):
    wifi_ssid: str
    image_base64: str
    liveness_passed: bool = True
    bssid: Optional[str] = None
    gateway_ip: Optional[str] = None
    local_ip: Optional[str] = None
    liveness_challenge_ms: Optional[int] = None
    device_id: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: Any
    student_id: Any
    session_id: Any
    status: str
    confidence_score: Optional[float] = None
    # The column is network_verified; both clients read "wifi_verified". Pydantic
    # bridges the two names so the storage layer keeps the accurate one and the
    # published contract stays unchanged.
    wifi_verified: bool = Field(validation_alias=AliasChoices("wifi_verified", "network_verified"))
    liveness_passed: Optional[bool] = None
    marked_at: UtcDateTime
    network_verified: Optional[bool] = None
    verify_detail: Optional[str] = None
    liveness_challenge_ms: Optional[int] = None
    liveness_suspicious: Optional[bool] = None

    class Config:
        from_attributes = True

class StudentAttendanceStatus(BaseModel):
    student_id: Any
    student_name: str
    student_code: str
    status: str
    marked_at: Optional[UtcDateTime] = None
    confidence_score: Optional[float] = None
    network_verified: Optional[bool] = None
    source_ip: Optional[str] = None
    verify_detail: Optional[str] = None

class SessionAttendanceResponse(BaseModel):
    session_id: Any
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
    publish_start: Optional[UtcDateTime] = None
    publish_end: Optional[UtcDateTime] = None
    target_scope: Optional[str] = "all"        # 'all' | 'programme' | 'course'
    target_role: Optional[str] = "all"         # 'all' | 'students' | 'staff'
    target_programme_code: Optional[str] = None
    target_course_code: Optional[str] = None
    target_group: Optional[str] = None
    external_link: Optional[str] = None

class AnnouncementResponse(BaseModel):
    id: Any
    title: str
    content: str
    faculty: Optional[str] = "All"
    department: Optional[str] = "All"
    created_at: UtcDateTime
    is_draft: bool = False
    priority: Optional[str] = "Medium"
    publisher: Optional[str] = "ADMIN"
    image_base64: Optional[str] = None
    publish_start: Optional[UtcDateTime] = None
    publish_end: Optional[UtcDateTime] = None
    target_scope: Optional[str] = "all"
    target_role: Optional[str] = "all"
    target_programme_code: Optional[str] = None
    target_course_code: Optional[str] = None
    creator_user_id: Optional[Any] = None
    target_group: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_mime_type: Optional[str] = None
    attachment_size: Optional[int] = None
    external_link: Optional[str] = None

    class Config:
        from_attributes = True

# Admin CRUD Schemas
class AdminStudentCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    student_code: StudentCode

class AdminStudentUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8)
    name: Optional[str] = None
    student_code: Optional[StudentCode] = None

class AdminStaffCreate(BaseModel):
    model_config = ConfigDict(use_enum_values=True, validate_default=True)
    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    staff_id: StaffId
    role: Optional[StaffRole] = StaffRole.lecturer

class AdminStaffUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8)
    name: Optional[str] = None
    staff_id: Optional[StaffId] = None
    role: Optional[StaffRole] = None

# Academic Schemas
class ProgrammeCreate(BaseModel):
    name: str
    code: str

class ProgrammeResponse(BaseModel):
    id: Any
    name: str
    code: str

    class Config:
        from_attributes = True

class CourseCreate(BaseModel):
    course_name: str
    course_code: str
    credit_hours: Optional[float] = 3.0
    lecturer_id: Optional[Any] = None
    programme_id: Optional[Any] = None
    # No schedule_* fields: the timetable lives in class_meetings and is edited through
    # /admin/timetable. Accepting them here promised a write that never happened.

class CourseResponse(BaseModel):
    id: Any
    course_name: str
    course_code: str
    credit_hours: Optional[float] = 3.0
    lecturer_id: Optional[Any] = None
    programme_id: Optional[Any] = None

    class Config:
        from_attributes = True

class AssignmentCreate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)
    course_id: Any
    lecturer_id: Any
    role: StaffRole

class AssignmentResponse(BaseModel):
    id: Any
    course_id: Any
    lecturer_id: Any
    role: str

    class Config:
        from_attributes = True

class StudentProgrammeAssign(BaseModel):
    programme_id: Optional[Any] = None

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
    id: Any
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
    settings: dict[str, str]
