from sqlalchemy import (
    Column, Integer, String, Boolean, Float,
    ForeignKey, DateTime, LargeBinary, Text, func, Index
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

# User accounts table
class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role          = Column(String, nullable=False)
    created_at    = Column(DateTime, server_default=func.now())
    
    student       = relationship("Student", back_populates="user", uselist=False)
    lecturer      = relationship("Lecturer", back_populates="user", uselist=False)

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

# Active device-session bindings (multi-device lock)
class DeviceSession(Base):
    __tablename__ = "device_sessions"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id  = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user       = relationship("User")

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

    student          = relationship("Student", back_populates="attendance_records")
    session          = relationship("ClassSession", back_populates="attendance_records")

# ML Risk scores table
class RiskScore(Base):
    __tablename__ = "risk_scores"
    id              = Column(Integer, primary_key=True, index=True)
    student_id      = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    course_id       = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    risk_score      = Column(Float, nullable=False)
    risk_label      = Column(String)
    attendance_rate = Column(Float)
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
    image_base64          = Column(Text, nullable=True)
    publish_start         = Column(DateTime, nullable=True)
    publish_end           = Column(DateTime, nullable=True)
    target_audience       = Column(String, default="all", nullable=False) # 'all', 'students_all', 'students_specific', 'staff_all', 'staff_specific'
    target_programme_code = Column(String, nullable=True)

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
