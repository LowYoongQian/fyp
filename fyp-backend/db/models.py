import uuid
from sqlalchemy import (
    Column, Integer, String, Boolean, Float,
    ForeignKey, Date, DateTime, LargeBinary, Text, func, UniqueConstraint,
    CheckConstraint, Index, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class CheckinChallenge(Base):
    __tablename__ = "checkin_challenges"
    token_hash = Column(String(64), primary_key=True)
    student_id = Column(UUID(as_uuid=False), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=False), ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    issued_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    consumed_at = Column(DateTime, nullable=True)


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
    auth_version          = Column(Integer, default=0, server_default="0", nullable=False)
    push_quiet_enabled    = Column(Boolean, default=False, server_default="false", nullable=False)
    push_quiet_start      = Column(Integer, default=1320, server_default="1320", nullable=False)
    push_quiet_end        = Column(Integer, default=420, server_default="420", nullable=False)
    push_timezone         = Column(String(64), default="Asia/Kuala_Lumpur", server_default="Asia/Kuala_Lumpur", nullable=False)
    theme_preference      = Column(String, default="light", nullable=False)
    font_size_preference  = Column(String, default="medium", nullable=False)
    language_preference   = Column(String, default="en", nullable=False)
    notifications_enabled = Column(Boolean, default=True, nullable=False)
    email_notifications   = Column(Boolean, default=True, nullable=False)
    push_notifications    = Column(Boolean, default=True, nullable=False)
    in_app_notifications  = Column(Boolean, default=True, nullable=False)
    recovery_email        = Column(String, nullable=True, unique=True)
    recovery_email_verified = Column(Boolean, default=False, nullable=False)
    recovery_prompt_dismissed = Column(Boolean, default=False, server_default="false", nullable=False)
    recovery_code_hash    = Column(String, nullable=True)
    recovery_code_expires_at = Column(DateTime, nullable=True)
    password_reset_hash   = Column(String, nullable=True, index=True)
    password_reset_expires_at = Column(DateTime, nullable=True)
    created_at            = Column(DateTime, server_default=func.now())
    
    student               = relationship("Student", back_populates="user", uselist=False)
    lecturer              = relationship("Lecturer", back_populates="user", uselist=False)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    auth_version = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    revoked_at = Column(DateTime)
    device_label = Column(String(120), nullable=False, default="Unknown device")


class AuthFactor(Base):
    __tablename__ = "auth_factors"
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    secret = Column(Text)
    pending_secret = Column(Text)
    pending_expires_at = Column(DateTime)
    last_counter = Column(Integer, default=-1, nullable=False)
    recovery_hashes = Column(Text, default="[]", nullable=False)
    failures = Column(Integer, default=0, nullable=False)
    blocked_until = Column(DateTime)


class AuthLoginChallenge(Base):
    __tablename__ = "auth_login_challenges"
    token_hash = Column(String(64), primary_key=True)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    auth_version = Column(Integer, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    consumed_at = Column(DateTime)
    device_label = Column(String(120), nullable=False)


class AuthAttempt(Base):
    __tablename__ = "auth_attempts"
    key = Column(String(64), primary_key=True)
    failures = Column(Integer, default=0, nullable=False)
    blocked_until = Column(DateTime)
    updated_at = Column(DateTime, nullable=False)


class PushDevice(Base):
    __tablename__ = "push_devices"
    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=False), ForeignKey("auth_sessions.id", ondelete="CASCADE"), nullable=False)
    token = Column(Text, nullable=False, unique=True)
    platform = Column(String(16), nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class PushDelivery(Base):
    __tablename__ = "push_deliveries"
    __table_args__ = (UniqueConstraint("notification_id", "device_id", name="uq_push_delivery_notification_device"),
                     Index("ix_push_deliveries_due", "status", "next_attempt_at"))
    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    notification_id = Column(UUID(as_uuid=False), ForeignKey("user_notifications.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(UUID(as_uuid=False), ForeignKey("push_devices.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(16), default="pending", nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    next_attempt_at = Column(DateTime, nullable=False)
    lease_until = Column(DateTime)
    expires_at = Column(DateTime, nullable=False)
    error_code = Column(String(60))
    sent_at = Column(DateTime)


class AIChatSession(Base):
    __tablename__ = "ai_chat_sessions"
    id         = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id    = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    context_state = Column(JSONB, nullable=False, default=dict, server_default="{}")


class AIChatMessage(Base):
    __tablename__ = "ai_chat_messages"
    id         = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(UUID(as_uuid=False), ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role       = Column(String(16), nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

# Programmes table
class Programme(Base):
    __tablename__ = "programmes"
    id            = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name          = Column(String, nullable=False)
    code          = Column(String, unique=True, nullable=False)
    
    students      = relationship("Student", back_populates="programme")
    courses       = relationship("Course", back_populates="programme")

# Student profiles table
class AcademicSemester(Base):
    __tablename__ = "academic_semesters"
    __table_args__ = (
        UniqueConstraint("programme_id", "name", name="uq_semester_programme_name"),
        CheckConstraint("end_date >= start_date", name="ck_semester_dates"),
        CheckConstraint("max_student_credits > 0 AND max_student_credits <= 60", name="ck_semester_credit_limit"),
    )
    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    programme_id = Column(UUID(as_uuid=False), ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    max_student_credits = Column(Float, nullable=False)


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
    semester_id  = Column(UUID(as_uuid=False), ForeignKey("academic_semesters.id", ondelete="RESTRICT"), nullable=True, index=True)
    lecturer_id  = Column(UUID(as_uuid=False), ForeignKey("lecturers.id"), index=True)
    programme_id = Column(UUID(as_uuid=False), ForeignKey("programmes.id", ondelete="SET NULL"), nullable=True, index=True)
    # A course has no schedule of its own: class_meetings holds the timetable, one row
    # per lecture/tutorial/practical. The four schedule_* columns that used to sit here
    # were never read after that change, so a client sending schedule_day got a 200 and
    # no effect.

    lecturer    = relationship("Lecturer", back_populates="courses")
    programme   = relationship("Programme", back_populates="courses")
    semester    = relationship("AcademicSemester")
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
    __table_args__ = (
        UniqueConstraint("meeting_id", "scheduled_start", name="uq_class_session_meeting_start"),
        CheckConstraint(
            "status IN ('scheduled', 'open', 'completed', 'cancelled', 'needs_attention')",
            name="ck_class_sessions_status",
        ),
    )
    id          = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    course_id   = Column(UUID(as_uuid=False), ForeignKey("courses.id"), index=True)
    meeting_id  = Column(UUID(as_uuid=False), ForeignKey("class_meetings.id", ondelete="SET NULL"), nullable=True, index=True)
    scheduled_start = Column(DateTime, nullable=True, index=True)
    scheduled_end   = Column(DateTime, nullable=True)
    status      = Column(String, nullable=False, default="open", index=True)
    room        = Column(String, nullable=True)
    semester    = Column(String, nullable=True, index=True)
    opened_at   = Column(DateTime, nullable=True)
    closed_at   = Column(DateTime, nullable=True)
    is_open     = Column(Boolean, default=True)
    class_group = Column(String, default="All")
    opened_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancelled_by_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancel_reason = Column(Text, nullable=True)
    replacement_for_session_id = Column(
        UUID(as_uuid=False), ForeignKey("class_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
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
        Index("ix_attendance_mc_page", "marked_at", "id"),
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
    # liveness_passed is the server anti-spoof result, liveness_suspicious flags a
    # server challenge completed suspiciously fast. A property that derived one from the other
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
        Index("ix_medical_page", "created_at", "id"),
        Index("ix_medical_owner_page", "student_id", "created_at", "id"),
    )

    id               = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id       = Column(UUID(as_uuid=False), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    course_id        = Column(UUID(as_uuid=False), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    session_id       = Column(UUID(as_uuid=False), ForeignKey("class_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    request_type     = Column(String, nullable=False)
    reason           = Column(Text, nullable=False)
    start_date       = Column(Date, nullable=True)
    end_date         = Column(Date, nullable=True)
    proof_path       = Column(String, nullable=True)
    proof_file_name  = Column(String, nullable=True)
    proof_mime_type  = Column(String, nullable=True)
    proof_size       = Column(Integer, nullable=True)
    ai_verdict       = Column(String, nullable=True)
    ai_confidence    = Column(Float, nullable=True)
    ai_summary       = Column(Text, nullable=True)
    ai_details       = Column(Text, nullable=True)
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

class FaceEnrolmentRequest(Base):
    __tablename__ = "face_enrolment_requests"
    __table_args__ = (
        CheckConstraint("status IN ('authorised', 'pending', 'approved', 'rejected', 'expired')", name="ck_face_enrolment_status"),
        Index("ix_face_enrolment_owner_created", "student_id", "created_at"),
        Index("ix_face_enrolment_expiry", "status", "expires_at"),
        Index("uq_face_enrolment_open", "student_id", unique=True,
              postgresql_where=text("status IN ('authorised', 'pending')"),
              sqlite_where=text("status IN ('authorised', 'pending')")),
    )
    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(UUID(as_uuid=False), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    supervisor_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(16), nullable=False, default="authorised")
    created_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    token_hash = Column(String(64), nullable=True, unique=True)
    challenge_issued_at = Column(DateTime, nullable=True)
    challenge_consumed_at = Column(DateTime, nullable=True)
    candidate_embedding = Column(LargeBinary, nullable=True)
    previous_face_hash = Column(String(64), nullable=True)
    captured_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewer_note = Column(String(255), nullable=True)
    reauth_failures = Column(Integer, nullable=False, default=0, server_default="0")


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
    creator_user_id       = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    target_group          = Column(String, nullable=True)
    attachment_path       = Column(String, nullable=True)
    attachment_name       = Column(String, nullable=True)
    attachment_mime_type  = Column(String, nullable=True)
    attachment_size       = Column(Integer, nullable=True)
    external_link         = Column(String, nullable=True)

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
    __table_args__ = (
        Index("ix_feedback_page", "created_at", "id"),
        Index("ix_feedback_owner_page", "student_id", "created_at", "id"),
    )
    id            = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    student_id    = Column(UUID(as_uuid=False), ForeignKey("students.id", ondelete="CASCADE"), nullable=True, index=True)
    student_name  = Column(String, nullable=False)
    student_code  = Column(String, nullable=False)
    subject       = Column(String, nullable=False)
    category      = Column(String, nullable=False, default="General")  # 'Attendance Issue', 'App Bug', 'Network Error', 'General'
    message       = Column(Text, nullable=False)
    priority      = Column(String, nullable=False, default="Medium", server_default="Medium")
    attachment_path = Column(String, nullable=True)
    attachment_name = Column(String, nullable=True)
    attachment_type = Column(String, nullable=True)
    student_response = Column(Text, nullable=True)
    status        = Column(String, nullable=False, default="Pending") # 'Pending', 'In Progress', 'Resolved'
    admin_notes   = Column(Text, nullable=True)
    created_at    = Column(DateTime, server_default=func.now())

    student       = relationship("Student")
