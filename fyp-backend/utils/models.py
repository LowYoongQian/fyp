from sqlalchemy import (
    Column, Integer, String, Boolean, Float,
    ForeignKey, DateTime, LargeBinary, Text, func, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# User accounts table
class User(Base):
    __tablename__ = "users"
    id                    = Column(Integer, primary_key=True, index=True)
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
    created_at            = Column(DateTime, server_default=func.now())
    
    student               = relationship("Student", back_populates="user", uselist=False)
    lecturer              = relationship("Lecturer", back_populates="user", uselist=False)

# Programmes table
class Programme(Base):
    __tablename__ = "programmes"
    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, nullable=False)
    code          = Column(String, unique=True, nullable=False)
    
    students      = relationship("Student", back_populates="programme")
    courses       = relationship("Course", back_populates="programme")

# Student profiles table
class Student(Base):
    __tablename__ = "students"
    id                  = Column(Integer, primary_key=True, index=True)
    user_id             = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    name                = Column(String, nullable=False)
    student_code        = Column(String, unique=True, nullable=False, index=True)
    is_face_registered  = Column(Boolean, default=False)
    programme_id        = Column(Integer, ForeignKey("programmes.id", ondelete="SET NULL"), nullable=True, index=True)
    
    user                = relationship("User", back_populates="student")
    programme           = relationship("Programme", back_populates="students")
    enrolments          = relationship("Enrolment", back_populates="student")
    attendance_records  = relationship("AttendanceRecord", back_populates="student")
    face_embedding      = relationship("FaceEmbedding", back_populates="student", uselist=False)
    risk_scores         = relationship("RiskScore", back_populates="student")

# Lecturer profiles table
class Lecturer(Base):
    __tablename__ = "lecturers"
    id       = Column(Integer, primary_key=True, index=True)
    user_id  = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    name     = Column(String, nullable=False)
    staff_id = Column(String, unique=True, nullable=False, index=True)
    role     = Column(String, default="Lecturer")
    
    user     = relationship("User", back_populates="lecturer")
    courses  = relationship("Course", back_populates="lecturer")

# Courses table
class Course(Base):
    __tablename__ = "courses"
    id           = Column(Integer, primary_key=True, index=True)
    course_name  = Column(String, nullable=False)
    course_code  = Column(String, unique=True, nullable=False)
    credit_hours = Column(Float, default=3.0)
    # Planned total contact hours for the WHOLE semester offering of this course
    # (e.g. 5h/week * 14 weeks = 70). This is the denominator of the 80% rule and
    # is set once at course setup. Nullable: if absent, the at-risk logic falls
    # back to the ML model only (no "cannot recover" certainty layer).
    planned_total_hours = Column(Float, nullable=True)
    lecturer_id  = Column(Integer, ForeignKey("lecturers.id"), index=True)
    programme_id = Column(Integer, ForeignKey("programmes.id", ondelete="SET NULL"), nullable=True, index=True)
    
    schedule_day   = Column(String, nullable=True)
    schedule_start = Column(String, nullable=True)
    schedule_end   = Column(String, nullable=True)
    schedule_room  = Column(String, nullable=True)
    
    lecturer    = relationship("Lecturer", back_populates="courses")
    programme   = relationship("Programme", back_populates="courses")
    enrolments  = relationship("Enrolment", back_populates="course")
    sessions    = relationship("ClassSession", back_populates="course")

# Course staff assignments table
class CourseStaffAssignment(Base):
    __tablename__ = "course_staff_assignments"
    id            = Column(Integer, primary_key=True, index=True)
    course_id     = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    lecturer_id   = Column(Integer, ForeignKey("lecturers.id", ondelete="CASCADE"), nullable=False, index=True)
    role          = Column(String, nullable=False)
    
    course        = relationship("Course")
    lecturer      = relationship("Lecturer")

# Class meetings table — the SINGLE SOURCE OF TRUTH for the timetable.
# One row per fixed weekly class: a course's Lecture, or one Tutor/Practical
# staff assignment. meeting_key mirrors the old in-memory schedule dict key
# ("Lecture-{course_id}" / "Tutor-{assignment_id}" / "Practical-{assignment_id}")
# so calculate_schedule() can rebuild the same dict shape by reading this table.
# Rows are seeded once by the deterministic scheduler, then editable by admin.
class ClassMeeting(Base):
    __tablename__ = "class_meetings"
    id            = Column(Integer, primary_key=True, index=True)
    meeting_key   = Column(String, unique=True, nullable=False, index=True)
    course_id     = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    assignment_id = Column(Integer, ForeignKey("course_staff_assignments.id", ondelete="CASCADE"), nullable=True, index=True)
    role          = Column(String, nullable=False)   # Lecture / Tutor / Practical
    day           = Column(String, nullable=False)
    start         = Column(String, nullable=False)
    end           = Column(String, nullable=False)
    room          = Column(String, nullable=False)
    lecturer_id   = Column(Integer, ForeignKey("lecturers.id", ondelete="SET NULL"), nullable=True, index=True)

    course        = relationship("Course")
    lecturer      = relationship("Lecturer")

# Course enrolment table
class Enrolment(Base):
    __tablename__ = "enrolments"
    id          = Column(Integer, primary_key=True, index=True)
    student_id  = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    course_id   = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    semester    = Column(String, nullable=False)
    class_group = Column(String, default="G1")
    
    student    = relationship("Student", back_populates="enrolments")
    course     = relationship("Course", back_populates="enrolments")

# Student face embeddings table
class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"
    id         = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, index=True)
    embedding  = Column(LargeBinary, nullable=False)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    
    student    = relationship("Student", back_populates="face_embedding")

# Class session table
class ClassSession(Base):
    __tablename__ = "class_sessions"
    id          = Column(Integer, primary_key=True, index=True)
    course_id   = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    opened_at   = Column(DateTime)
    closed_at   = Column(DateTime)
    is_open     = Column(Boolean, default=False, index=True)
    class_group = Column(String, default="All")
    
    course    = relationship("Course", back_populates="sessions")
    attendance_records = relationship("AttendanceRecord", back_populates="session")

# Attendance log table
class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id               = Column(Integer, primary_key=True, index=True)
    student_id       = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    session_id       = Column(Integer, ForeignKey("class_sessions.id"), nullable=False, index=True)
    status           = Column(String, default="present", index=True)
    confidence_score = Column(Float)
    wifi_verified    = Column(Boolean, default=False)
    liveness_passed  = Column(Boolean, default=False)
    marked_at        = Column(DateTime, server_default=func.now())

    # Network-based location verification audit fields
    source_ip            = Column(String, nullable=True)   # server-observed IP (unspoofable)
    reported_ssid        = Column(String, nullable=True)   # client-reported WiFi name
    reported_bssid       = Column(String, nullable=True)   # client-reported AP MAC
    reported_gateway_ip  = Column(String, nullable=True)   # client-reported gateway IP
    network_verified     = Column(Boolean, default=False)  # passed campus network policy
    verify_detail        = Column(String, nullable=True)   # human-readable audit summary

    # Behavioral biometrics — liveness gesture timing
    liveness_challenge_ms = Column(Integer, nullable=True)  # ms to complete both challenges
    liveness_suspicious   = Column(Boolean, default=False)  # flagged as abnormally fast

    # Device fingerprint of the phone used for THIS check-in (audit only; not a
    # login lock). Null for older records / clients that don't report it.
    device_id             = Column(String, nullable=True)

    student          = relationship("Student", back_populates="attendance_records")
    session          = relationship("ClassSession", back_populates="attendance_records")

    # One attendance record per student per session — a student cannot check in
    # twice for the same class. Matches the DB constraint added in main.py.
    __table_args__ = (
        UniqueConstraint("student_id", "session_id", name="uq_attendance_student_session"),
    )

# ML Risk scores table
class RiskScore(Base):
    __tablename__ = "risk_scores"
    id              = Column(Integer, primary_key=True, index=True)
    student_id      = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    course_id       = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    risk_score      = Column(Float, nullable=False)
    risk_label      = Column(String)
    attendance_rate = Column(Float)
    # Human-readable reasons behind this verdict (e.g. "6 consecutive absences;
    # attendance declining"). Populated at recompute so the dashboard can explain
    # WHY a student is flagged. Nullable for backward compatibility.
    risk_factors    = Column(String, nullable=True)
    updated_at      = Column(DateTime, server_default=func.now())
    
    student         = relationship("Student", back_populates="risk_scores")

# Alert notifications log table
class Alert(Base):
    __tablename__ = "alerts"
    id           = Column(Integer, primary_key=True, index=True)
    student_id   = Column(Integer, ForeignKey("students.id"), index=True)
    course_id    = Column(Integer, ForeignKey("courses.id"), index=True)
    alert_type   = Column(String, default="at_risk")
    email_body   = Column(Text)
    triggered_by = Column(String, default="system")
    triggered_at = Column(DateTime, server_default=func.now())
    sent_at      = Column(DateTime)

# Faculty / Department Announcements table
class Announcement(Base):
    __tablename__ = "announcements"
    id                    = Column(Integer, primary_key=True, index=True)
    title                 = Column(String, nullable=False)
    content               = Column(Text, nullable=False)
    faculty               = Column(String, nullable=False)
    department            = Column(String, nullable=False)
    created_at            = Column(DateTime, server_default=func.now())
    is_draft              = Column(Boolean, default=False, nullable=False)
    priority              = Column(String, default="Medium", nullable=False) # 'High', 'Medium', 'Low'
    publisher             = Column(String, default="ADMIN", nullable=False)
    image_base64          = Column(Text, nullable=True)
    publish_start         = Column(DateTime, nullable=True)
    publish_end           = Column(DateTime, nullable=True)
    # Targeting = scope (who broadly) × role (which population). See main.py migration.
    target_scope          = Column(String, default="all", nullable=False)   # 'all' | 'programme' | 'course'
    target_role           = Column(String, default="all", nullable=False)   # 'all' | 'students' | 'staff'
    target_programme_code = Column(String, nullable=True)                   # set when scope='programme'
    target_course_code    = Column(String, nullable=True)                   # set when scope='course'
    # Legacy discriminator kept nullable for backward compat; superseded by scope+role.
    target_audience       = Column(String, nullable=True)

# Campus network whitelist table (allowed CIDR ranges / SSIDs / AP MAC prefixes)
class CampusNetwork(Base):
    __tablename__ = "campus_networks"
    id            = Column(Integer, primary_key=True, index=True)
    label         = Column(String, nullable=False)            # e.g. "Main Campus Student VLAN"
    cidr          = Column(String, nullable=True)             # e.g. "10.52.0.0/16" (IP/subnet rule)
    ssid          = Column(String, nullable=True)             # e.g. "UniWiFi-Student" (soft rule)
    bssid_prefix  = Column(String, nullable=True)             # e.g. "AC:DE:48" (AP vendor OUI)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, server_default=func.now())

# Key/value security settings table (policy toggles)
class SecuritySetting(Base):
    __tablename__ = "security_settings"
    id      = Column(Integer, primary_key=True, index=True)
    key     = Column(String, unique=True, nullable=False)
    value   = Column(String, nullable=True)
