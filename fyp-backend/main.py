from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
import os
import hashlib

from utils.database import engine, SessionLocal
from utils.models import Base, ClassMeeting
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
        # NOTE: courses' timetable times now live in the class_meetings table
        # (seeded below via _seed_class_meetings), not in courses.schedule_*.
        # Those columns are kept for backward-compat but are no longer written.

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

        # Announcement publisher column
        conn.execute(text("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS publisher VARCHAR DEFAULT 'ADMIN';"))

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

        # Single-device login lock removed: device_id is now recorded per
        # check-in (audit only). Add the column and drop the old lock table.
        conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS device_id VARCHAR;"))
        conn.execute(text("DROP TABLE IF EXISTS device_sessions;"))

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
                "demo_simulated_ip": "10.52.13.77" # the simulated campus IP used in demo mode
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


# Seed the class_meetings timetable (single source of truth) once, from the
# deterministic scheduler — reproducing the legacy schedule exactly so behaviour
# is unchanged on day one. Fail-loud: if seeding errors, we must know (a silent
# empty table would leave every session on the 2h fallback window).
def _seed_class_meetings():
    from utils.scheduler import generate_clashfree_slots
    db = SessionLocal()
    try:
        if db.query(ClassMeeting).first() is not None:
            return  # already seeded
        rows = generate_clashfree_slots(db)
        for r in rows:
            db.add(ClassMeeting(**r))
        db.commit()
        print(f"Seeded class_meetings timetable with {len(rows)} meetings.")
    finally:
        db.close()

_seed_class_meetings()


class ETagMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method not in ("GET", "HEAD"):
            return await call_next(request)
        
        response = await call_next(request)
        
        if response.status_code != 200:
            return response
            
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type and "text/" not in content_type:
            return response
            
        # Consume response body to calculate md5 hash
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk
            
        etag = f'W/"{hashlib.md5(response_body).hexdigest()}"'
        
        # Check If-None-Match header
        if_none_match = request.headers.get("if-none-match")
        if if_none_match and if_none_match == etag:
            return Response(
                status_code=304,
                headers={"ETag": etag, "Cache-Control": "private, max-age=30"}
            )
            
        # Add ETag and Cache-Control headers
        headers = dict(response.headers)
        headers["ETag"] = etag
        headers["Cache-Control"] = "private, max-age=30"
        headers["content-length"] = str(len(response_body))
        
        return Response(
            content=response_body,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type
        )

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

app.add_middleware(ETagMiddleware)
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

# Public announcements endpoint for home screen
@app.get("/public/announcements", response_model=list)
def get_public_announcements():
    db = SessionLocal()
    try:
        from utils.models import Announcement
        # Return all published announcements (is_draft=False) sorted by created_at desc
        announcements = db.query(Announcement).filter(Announcement.is_draft == False).order_by(Announcement.created_at.desc()).all()
        return [
            {
                "id": a.id,
                "title": a.title,
                "content": a.content,
                "faculty": a.faculty,
                "department": a.department,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "priority": a.priority,
                "publisher": a.publisher,
                "image_base64": a.image_base64,
                "publish_start": a.publish_start,
                "publish_end": a.publish_end,
                "target_scope": a.target_scope,
                "target_role": a.target_role,
                "target_programme_code": a.target_programme_code,
                "target_course_code": a.target_course_code,
            }
            for a in announcements
        ]
    finally:
        db.close()

# Basic health check endpoint
@app.get("/")
def root():
    return {"status": "online", "message": "Smart Attendance API is running"}
