from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import os

from utils.database import engine
from utils.models import Base
from routers import auth, llm, sessions, students, admin_students, admin_staff, admin_academic, admin_attendance, admin_config, student_self, analytics, lecturers

# Automatically create all tables in PostgreSQL on startup
Base.metadata.create_all(bind=engine)

# Execute schema migration scripts inside a transaction block
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE students ADD COLUMN IF NOT EXISTS programme_id INTEGER REFERENCES programmes(id) ON DELETE SET NULL;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS programme_id INTEGER REFERENCES programmes(id) ON DELETE SET NULL;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS credit_hours DOUBLE PRECISION DEFAULT 3.0;"))
        # Planned total contact hours for the whole semester (denominator of 80% rule)
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS planned_total_hours DOUBLE PRECISION;"))
        # At-risk explanation (why a student is flagged) for the dashboard
        conn.execute(text("ALTER TABLE risk_scores ADD COLUMN IF NOT EXISTS risk_factors VARCHAR;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule_day VARCHAR;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule_start VARCHAR;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule_end VARCHAR;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule_room VARCHAR;"))
        
        # Populate existing courses that lack schedules
        courses_res = conn.execute(text("SELECT id, course_code FROM courses WHERE schedule_day IS NULL;")).fetchall()
        if courses_res:
            import random
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
            starts = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]
            rooms = ["Theatre 1", "Theatre 2", "Lab 1", "Lab 2", "Lab 3", "Seminar Room 1", "Seminar Room 2"]
            for row in courses_res:
                cid = row[0]
                ccode = row[1]
                # Seed deterministically by course code hash to ensure stable assignments
                random.seed(hash(ccode))
                day = random.choice(days)
                start_t = random.choice(starts)
                hour = int(start_t.split(":")[0])
                end_t = f"{hour + 2:02d}:00"
                room = random.choice(rooms)
                conn.execute(text("""
                    UPDATE courses
                    SET schedule_day = :day,
                        schedule_start = :start,
                        schedule_end = :end,
                        schedule_room = :room
                    WHERE id = :id;
                """), {"day": day, "start": start_t, "end": end_t, "room": room, "id": cid})
            print(f"Provisioned random timetable schedules for {len(courses_res)} courses.")

        # Network-based location verification: attendance audit columns
        conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS source_ip VARCHAR;"))
        conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS reported_ssid VARCHAR;"))
        conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS reported_bssid VARCHAR;"))
        conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS reported_gateway_ip VARCHAR;"))
        conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS network_verified BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS verify_detail VARCHAR;"))

        # Behavioral biometrics columns
        conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS liveness_challenge_ms INTEGER;"))
        conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS liveness_suspicious BOOLEAN DEFAULT FALSE;"))

        # One attendance record per (student, session): dedupe any historical
        # duplicates first (keep present/leave over absent, then the newest id),
        # then add the unique constraint. Ranking: status_rank 0 = attended,
        # 1 = absent (lower is kept); within a rank the highest id (newest) wins.
        conn.execute(text("""
            DELETE FROM attendance_records a
            USING attendance_records b
            WHERE a.student_id = b.student_id
              AND a.session_id = b.session_id
              AND (
                    (CASE WHEN a.status IN ('present','leave') THEN 0 ELSE 1 END,  -a.id)
                  > (CASE WHEN b.status IN ('present','leave') THEN 0 ELSE 1 END,  -b.id)
                  );
        """))
        # ADD CONSTRAINT has no IF NOT EXISTS in Postgres — guard against re-runs.
        # A re-run raises duplicate_table (the backing index already exists) or
        # duplicate_object (the constraint already exists); swallow both.
        conn.execute(text("""
            DO $$ BEGIN
                ALTER TABLE attendance_records
                  ADD CONSTRAINT uq_attendance_student_session UNIQUE (student_id, session_id);
            EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
            END $$;
        """))

        # Multi-device session binding table (created by Base.metadata above; migration is idempotent)

        # Announcement targeting: scope (all/programme/course) × role (all/students/staff).
        # Adds the new columns and backfills them from the legacy target_audience value
        # so existing announcements keep their reach. Idempotent.
        conn.execute(text("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_scope VARCHAR DEFAULT 'all';"))
        conn.execute(text("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_role VARCHAR DEFAULT 'all';"))
        conn.execute(text("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_course_code VARCHAR;"))
        conn.execute(text("ALTER TABLE announcements ALTER COLUMN target_audience DROP NOT NULL;"))
        # Backfill only rows not yet migrated (scope still at default 'all' but a legacy
        # audience implies otherwise). Safe to re-run: it only rewrites when they disagree.
        conn.execute(text("""
            UPDATE announcements SET
                target_scope = CASE
                    WHEN target_audience = 'students_specific' THEN 'programme'
                    ELSE 'all' END,
                target_role = CASE
                    WHEN target_audience IN ('students_all','students_specific') THEN 'students'
                    WHEN target_audience IN ('staff_all','staff_specific')       THEN 'staff'
                    ELSE 'all' END
            WHERE target_audience IS NOT NULL;
        """))

        # Seed default security settings (idempotent) if the table is empty
        existing = conn.execute(text("SELECT COUNT(*) FROM security_settings;")).scalar()
        if not existing:
            defaults = {
                "network_check_enabled": "true",   # master switch for network verification
                "fail_closed": "true",             # reject check-in when network not verified
                "trust_proxy_header": "false",     # honour X-Forwarded-For (only behind a trusted proxy)
                "demo_simulate_network": "false",  # demo: override observed IP with a simulated one
                "demo_simulated_ip": "10.52.13.77", # the simulated campus IP used in demo mode
                "schedule_check_enabled": "false"  # enforce attendance only during scheduled class time
            }
            for k, v in defaults.items():
                conn.execute(
                    text("INSERT INTO security_settings (key, value) VALUES (:k, :v) ON CONFLICT (key) DO NOTHING;"),
                    {"k": k, "v": v}
                )
            print("Seeded default security settings.")
    print("Database migrations applied successfully.")
except Exception as e:
    print("Database migration execution warning:", e)


app = FastAPI(
    title="Smart Attendance API",
    version="1.0.0",
    description="Backend API for Smart Attendance System"
)

# CORS middleware configuration
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    allow_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    allow_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]

# Regex matches localhost, 127.0.0.1, and local private network IPs (192.168.x.x, 10.x.x.x, 172.16.x.x-172.31.x.x) on any port
local_origin_regex = r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=local_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(llm.router)
app.include_router(sessions.router)
app.include_router(students.router)
app.include_router(admin_students.router)
app.include_router(admin_staff.router)
app.include_router(admin_academic.router)
app.include_router(admin_attendance.router)
app.include_router(admin_config.router)
app.include_router(student_self.router)
app.include_router(analytics.router)
app.include_router(lecturers.router)

# Basic health check endpoint
@app.get("/")
def root():
    return {"status": "online", "message": "Smart Attendance API is running"}
