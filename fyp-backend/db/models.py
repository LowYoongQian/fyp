import uuid
from sqlalchemy import (
    Column, Integer, String, Boolean, Float,
    ForeignKey, DateTime, LargeBinary, Text, func, UniqueConstraint,
    CheckConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# User accounts table
class User(Base):
    __tablename__ = "users"
    id                    = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email                 = Column(String, unique=True, nullable=False, index=True)
    password_hash         = Column(String, nullable=False)
    role                  = Column(String, nullable=False)
    profile_name          = Column(String, nullable=True)
    profile_code          = Column(String, nullable=True)
    avatar_url            = Column(String, nullable=True)
    status                = Column(String, default="Active", nullable=False)
    last_login_at         = Column(DateTime, nullable=True)
    two_factor_enabled    = Column(Boolean, default=False, nullable=False)
    theme_preference      = Column(String, default="light", nullable=False)
    font_size_preference  = Column(String, default="medium", nullable=False)
    language_preference   = Column(String, default="en", nullable=False)
    notifications_enabled = Column(Boolean, default=True, nullable=False)
    email_notifications   = Column(Boolean, default=True, nullable=False)
    push_notifications    = Column(Boolean, default=True, nullable=False)
    in_app_notifications  = Column(Boolean, default=True, nullable=False)
    recovery_email        = Column(String, nullable=True, unique=True)
    recovery_email_verified = Column(Boolean, default=False, nullable=False)
    recovery_code_hash    = Column(String, nullable=True)
    recovery_code_expires_at = Column(DateTime, nullable=True)
    password_reset_hash   = Column(String, nullable=True, index=True)
    password_reset_expires_at = Column(DateTime, nullable=True)
    created_at            = Column(DateTime, server_default=func.now())
    
    student               = relationship("Student", back_populates="user", uselist=False)
    lecturer              = relationship("Lecturer", back_populates="user", uselist=False)

# Programmes table
class Programme(Base):
    __tablename__ = "programmes"
    id            = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name          = Column(String, nullable=False)
    code          = Column(String, unique=True, nullable=False)
    
    students      = relationship("Student", back_populates="programme")
    courses       = relationship("Course", back_populates="programme")

# Student profiles table
class Student(Base):
    __tablename__ = "students"
    id                  = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id             = Column(UUID(as_uuid=False), ForeignKey("users.id"), unique=True, index=True)
    name                = Column(String, nullable=False)
    student_code        = Column(String, unique=True, nullable=False, index=True)
    is_face_registered  = Column(Boolean, default=False)
    programme_id        = Column(UUID(as_uuid=False), ForeignKey("programmes.id", ondelete="SET NULL"), nullable=True, index=True)
    
    user                = relationship("User", back_populates="student")
    programme           = relationship("Programme", back_populates="students")
    enrolments          = relationship("Enrolment", back_populates="student")
    attendance_records  = relationship("AttendanceRecord", back_populates="student")
    face_embedding      = relationship("FaceEmbedding", back_populates="student", uselist=False)
    risk_scores         = relationship("RiskScore", back_populates="student")

# Lecturer profiles table
class Lecturer(Base):
    __tablename__ = "lecturers"
    id       = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id  = Column(UUID(as_uuid=False), ForeignKey("users.id"), unique=True, index=True)
    name     = Column(String, nullable=False)
    staff_id = Column(String, unique=True, nullable=False, index=True)
    role     = Column(String, default="Lecturer")
    
    user     = relationship("User", back_populates="lecturer")
    courses  = relationship("Course", back_populates="lecturer")

# Courses table
class Course(Base):
    __tablename__ = "courses"
    id           = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    course_name  = Column(String, nullable=False)
    course_code  = Column(String, unique=True, nullable=False)
    credit_hours = Column(Float, default=3.0)
    planned_total_hours = Column(Float, nullable=True)
    lecturer_id  = Column(UUID(as_uuid=False), ForeignKey("lecturers.id"), index=True)
    programme_id = Column(UUID(as_uuid=False), ForeignKey("programmes.id", ondelete="SET NULL"), nullable=True, index=True)
    # A course has no schedule of its own: class_meetings holds the timetable, one row
    # per lecture/tutorial/practical. The four schedule_* columns that used to sit here
    # were never read after that change, so a client sending schedule_day got a 200 and
    # no effect.

    lecturer    = relationship("Lecturer", back_populates="courses")
    programme   = relationship("Programme", back_populates="courses")
    enrolments  = relationship("Enrolment", back_populates="course")
    sessions    = relationship("ClassSession", back_populates="course")

# Course staff assignments table
class CourseStaffAssignment(Base):
    __tablename__ = "course_staff_assignments"
    id            = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    course_id     = Column(UUID(as_uuid=False), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    lecturer_id   = Column(UUID(as_uuid=False), ForeignKey("lecturers.id", ondelete="CASCADE"), nullable=False, index=True)
    role          = Column(String, nullable=False)
    
    course        = relationship("Course")
    lecturer      = relationship("Lecturer")

# Class meetings table
class ClassMeeting(Base):
    __tablename__ = "class_meetings"
    id            = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    meeting_key   = Column(String, unique=True, nullable=False, index=True)
    course_id     = Column(UUID(as_uuid=False), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    assignment_id = Column(UUID(as_uuid=False), ForeignKey("course_staff_assignments.id", ondelete="CASCADE"), nullable=True, index=True)
    role          = Column(String, nullable=False)
    # NULL only for a Lecture, meaning the whole course attends it. Tutorials and
    # practicals run per group, so they must name theirs — a CHECK constraint enforces
    # that split. Without this column there was no way to map "G1's practical" to a
    # specific slot, so the window check picked an arbitrary one.
    class_group   = Column(String, nullable=True)
    day           = Column(String, nullable=False)
    start         = Column(String, nullable=False)
    end           = Column(String, nullable=False)
    room          = Column(String, nullable=False)
    lecturer_id   = Column(UUID(as_uuid=False), ForeignKey("lecturers.id", ondelete="SET NULL"), nullable=True, index=True)

    course        = relationship("Course")
    lecturer      = relationship("Lecturer")

# Course enrolment table
class Enrolment(Base):
    __tablename__ = "enrolments"
    id          = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    student_id  = Column(UUID(as_uuid=False), ForeignKey("students.id"), index=True)
    course_id   = Column(UUID(as_uuid=False), ForeignKey("courses.id"), index=True)
    semester    = Column(String, default="2026-S1")
    class_group = Column(String, default="G1")
    
    student     = relationship("Student", back_populates="enrolments")
    course      = relationship("Course", back_populates="enrolments")

# Active or past class session
class ClassSession(Base):
    __tablename__ = "class_sessions"
    id          = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    course_id   = Column(UUID(as_uuid=False), ForeignKey("courses.id"), index=True)
    opened_at   = Column(DateTime, server_default=func.now())
    closed_at   = Column(DateTime, nullable=True)
    is_open     = Column(Boolean, default=True)
    class_group = Column(String, default="All")
    
    course      = relationship("Course", back_populates="sessions")
    records     = relationship("AttendanceRecord", back_populates="session")

# Attendance check-in records
class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    # One record per student per session, enforced by the database. The check-in
    # handler's "already checked in?" query cannot stop two concurrent requests from
    # both passing it; this constraint is what turns that race into an IntegrityError
    # the handler already knows how to swallow.
    __table_args__ = (
        UniqueConstraint("student_id", "session_id", name="uq_attendance_student_session"),
    )
    id                     = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    session_id             = Column(UUID(as_uuid=False), ForeignKey("class_sessions.id"), index=True)
    student_id             = Column(UUID(as_uuid=False), ForeignKey("students.id"), index=True)
    status                 = Column(String, default="present")
    method                 = Column(String, default="face+wifi")
    wifi_ssid              = Column(String, nullable=True)
    bssid                  = Column(String, nullable=True)
    gateway_ip             = Column(String, nullable=True)
    local_ip               = Column(String, nullable=True)
    marked_at              = Column(DateTime, server_default=func.now())
    is_flagged             = Column(Boolean, default=False)
    flag_reason            = Column(String, nullable=True)
    confidence_score       = Column(Float, nullable=True)
    image_url              = Column(String, nullable=True)
    mc_proof_url           = Column(String, nullable=True)
    liveness_challenge_ms  = Column(Integer, nullable=True)
    # Two independent signals, deliberately not each other's negation:
    # liveness_passed is the client's liveness result, liveness_suspicious flags a
    # gesture completed suspiciously fast. A property that derived one from the other
    # collapsed them into a single column and silently discarded the reported result.
    liveness_passed        = Column(Boolean, nullable=True)
    liveness_suspicious    = Column(Boolean, default=False)
    source_ip              = Column(String, nullable=True)
    reported_ssid          = Column(String, nullable=True)
    reported_bssid         = Column(String, nullable=True)
    reported_gateway_ip    = Column(String, nullable=True)
    network_verified       = Column(Boolean, default=False)
    verify_detail          = Column(String, nullable=True)
    device_id              = Column(String, nullable=True)
    
    session                = relationship("ClassSession", back_populates="records")
    student                = relationship("Student", back_populates="attendance_records")

    # No @property may shadow a physical column here. Four of them used to: a rename
    # left the old names as forwarding properties, SQLAlchemy stopped mapping the real
    # columns, and every row's data became invisible to the API. Rename the column
    # instead; where the outward name must differ, let Pydantic express that.

# Student leave and attendance-correction workflow.
class AttendanceRequest(Base):
    __tablename__ = "attendance_requests"
    __table_args__ = (
        CheckConstraint("request_type IN ('leave', 'correction')", name="ck_attendance_request_type"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected', 'cancelled')", name="ck_attendance_request_status"),
        Index("ix_attendance_requests_student_created", "student_id", "created_at"),
        Index("ix_attendance_requests_course_status", "course_id", "status"),
    )

    id               = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id       = Column(UUID(as_uuid=False), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    course_id        = Column(UUID(as_uuid=False), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    session_id       = Column(UUID(as_uuid=False), ForeignKey("class_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    request_type     = Column(String, nullable=False)
    reason           = Column(Text, nullable=False)
    status           = Column(String, nullable=False, default="pending")
    reviewer_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reviewer_note    = Column(Text, nullable=True)
    created_at       = Column(DateTime, server_default=func.now(), nullable=False)
    reviewed_at      = Column(DateTime, nullable=True)


# Durable in-app notifications for class reminders, timetable changes and requests.
class UserNotification(Base):
    __tablename__ = "user_notifications"
    __table_args__ = (
        UniqueConstraint("user_id", "dedupe_key", name="uq_user_notification_dedupe"),
        Index("ix_user_notifications_inbox", "user_id", "read_at", "created_at"),
    )

    id         = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id    = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind       = Column(String, nullable=False)
    title      = Column(String, nullable=False)
    body       = Column(Text, nullable=False)
    payload    = Column(Text, nullable=True)
    dedupe_key = Column(String, nullable=False)
    read_at    = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


# 512-d Face Embeddings (ArcFace)
class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"
    id            = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    student_id    = Column(UUID(as_uuid=False), ForeignKey("students.id"), unique=True, index=True)
    embedding     = Column(LargeBinary, nullable=False)
    sample_count  = Column(Integer, default=1)
    # Set False to retire a stored face without deleting the row. The check-in
    # query filters on it (routers/sessions.py), so it must stay declared here —
    # it exists in the database and dropping it from the model turns every
    # face check-in into a 500.
    is_active     = Column(Boolean, default=True)
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())

    student       = relationship("Student", back_populates="face_embedding")

# ML At-Risk Model Scores
class RiskScore(Base):
    __tablename__ = "risk_scores"
    id                  = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    student_id          = Column(UUID(as_uuid=False), ForeignKey("students.id"), index=True)
    course_id           = Column(UUID(as_uuid=False), ForeignKey("courses.id"), index=True)
    risk_score          = Column(Float, nullable=False)
    risk_label          = Column(String, nullable=True)
    attendance_rate     = Column(Float, nullable=True)
    risk_factors        = Column(String, nullable=True)
    updated_at          = Column(DateTime, server_default=func.now())

    # Legacy fields are retained because the existing database includes them.
    # Nullable: the live table has them NULL-able and recompute_risk_scores
    # (routers/analytics.py) never populates them. Declaring NOT NULL here made
    # create_all() build a schema that rejects every risk score the app writes.
    risk_level          = Column(String, nullable=True)
    absent_percentage   = Column(Float, nullable=True)
    consecutive_absences= Column(Integer, default=0)
    calculated_at       = Column(DateTime, server_default=func.now())
    
    student             = relationship("Student", back_populates="risk_scores")
    course              = relationship("Course")

# Campus wifi whitelist
class CampusNetwork(Base):
    __tablename__ = "campus_networks"
    id               = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    label            = Column(String, nullable=True)
    cidr             = Column(String, nullable=True)
    ssid             = Column(String, nullable=True)
    bssid_prefix     = Column(String, nullable=True)
    location_name    = Column(String, nullable=True)
    bssid            = Column(String, nullable=True)
    gateway_ip       = Column(String, nullable=True)
    subnet_range     = Column(String, nullable=True)
    is_active        = Column(Boolean, default=True)
    created_at       = Column(DateTime, server_default=func.now())

# Announcements
class Announcement(Base):
    __tablename__ = "announcements"
    id                    = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    title                 = Column(String, nullable=False)
    content               = Column(Text, nullable=False)
    faculty               = Column(String, nullable=False)
    department            = Column(String, nullable=False)
    created_at            = Column(DateTime, server_default=func.now())
    is_draft              = Column(Boolean, default=False, nullable=False)
    priority              = Column(String, default="Medium", nullable=False)
    publisher             = Column(String, default="ADMIN", nullable=False)
    image_base64          = Column(Text, nullable=True)
    publish_start         = Column(DateTime, nullable=True)
    publish_end           = Column(DateTime, nullable=True)
    target_scope          = Column(String, default="all", nullable=False)
    target_role           = Column(String, default="all", nullable=False)
    target_programme_code = Column(String, nullable=True)
    target_course_code    = Column(String, nullable=True)
    target_audience       = Column(String, nullable=True)

# Security settings table
class SecuritySetting(Base):
    __tablename__ = "security_settings"
    id         = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    key        = Column(String, unique=True, nullable=False, index=True)
    value      = Column(String, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

# Academic & attendance alerts table
class Alert(Base):
    __tablename__ = "alerts"
    id           = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    student_id   = Column(UUID(as_uuid=False), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id    = Column(UUID(as_uuid=False), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type   = Column(String, nullable=False, default="attendance")
    severity     = Column(String, default="Medium")
    message      = Column(Text, nullable=True)
    is_resolved  = Column(Boolean, default=False)
    triggered_at = Column(DateTime, server_default=func.now())
    # The lecturer alert endpoints read and write these three (routers/lecturers.py).
    # They exist in the database; leaving them off the model made both
    # GET and POST /lecturers/me/alerts raise AttributeError/TypeError.
    email_body   = Column(Text, nullable=True)
    triggered_by = Column(String, default="system")
    sent_at      = Column(DateTime, nullable=True)

    student      = relationship("Student")
    course       = relationship("Course")

# System action audit logs
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id          = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id     = Column(UUID(as_uuid=False), nullable=True, index=True)
    user_name   = Column(String, nullable=False, default="System Administrator")
    user_role   = Column(String, nullable=False, default="admin")
    category    = Column(String, nullable=False, default="admin")  # 'admin' | 'staff'
    action      = Column(String, nullable=False)
    details     = Column(Text, nullable=True)
    ip_address  = Column(String, nullable=True, default="127.0.0.1")
    created_at  = Column(DateTime, server_default=func.now())

# Student feedback & issue reports
class StudentFeedback(Base):
    __tablename__ = "student_feedback"
    id            = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    student_id    = Column(UUID(as_uuid=False), ForeignKey("students.id", ondelete="CASCADE"), nullable=True, index=True)
    student_name  = Column(String, nullable=False)
    student_code  = Column(String, nullable=False)
    subject       = Column(String, nullable=False)
    category      = Column(String, nullable=False, default="General")  # 'Attendance Issue', 'App Bug', 'Network Error', 'General'
    message       = Column(Text, nullable=False)
    status        = Column(String, nullable=False, default="Pending") # 'Pending', 'In Progress', 'Resolved'
    admin_notes   = Column(Text, nullable=True)
    created_at    = Column(DateTime, server_default=func.now())

    student       = relationship("Student")
