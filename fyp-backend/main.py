from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
import os
import hashlib

from utils.database import engine, SessionLocal
from utils.models import Base, ClassMeeting
from routers import auth, llm, sessions, students, admin_students, admin_staff, admin_academic, admin_attendance, admin_config, student_self, analytics, lecturers, admin_reports, admin_audit

# Automatically create all tables in PostgreSQL on startup
Base.metadata.create_all(bind=engine)

# Execute schema migration scripts inside a transaction block
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS credit_hours DOUBLE PRECISION DEFAULT 3.0;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS planned_total_hours DOUBLE PRECISION;"))
        conn.execute(text("ALTER TABLE risk_scores ADD COLUMN IF NOT EXISTS risk_factors VARCHAR;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule_day VARCHAR;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule_start VARCHAR;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule_end VARCHAR;"))
        conn.execute(text("ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule_room VARCHAR;"))

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

        # User profile and preference columns
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_name VARCHAR;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_code VARCHAR;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'Active';"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR DEFAULT 'light';"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS font_size_preference VARCHAR DEFAULT 'medium';"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference VARCHAR DEFAULT 'en';"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT TRUE;"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS in_app_notifications BOOLEAN DEFAULT TRUE;"))
        conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS device_id VARCHAR;"))
        conn.execute(text("DROP TABLE IF EXISTS device_sessions;"))

        # Announcement targeting: scope (all/programme/course) × role (all/students/staff).
        conn.execute(text("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_scope VARCHAR DEFAULT 'all';"))
        conn.execute(text("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_role VARCHAR DEFAULT 'all';"))
        conn.execute(text("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_course_code VARCHAR;"))
        conn.execute(text("ALTER TABLE announcements ALTER COLUMN target_audience DROP NOT NULL;"))

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
            
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk
            
        etag = f'W/"{hashlib.md5(response_body).hexdigest()}"'
        
        if_none_match = request.headers.get("if-none-match")
        if if_none_match and if_none_match == etag:
            return Response(
                status_code=304,
                headers={"ETag": etag, "Cache-Control": "private, max-age=30"}
            )
            
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
        "https://flutter.up.railway.app",
        "https://smart-web.up.railway.app",
        "https://fyps.up.railway.app",
    ]

origin_regex = r"https?://((localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?|.*\.up\.railway\.app)"

app.add_middleware(ETagMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=origin_regex,
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
app.include_router(admin_reports.router)
app.include_router(admin_audit.router)

# Public announcements endpoint for home screen
@app.get("/public/logo")
def get_public_logo():
    db = SessionLocal()
    try:
        row = db.execute(text("SELECT value FROM security_settings WHERE key = 'system_logo_base64'")).first()
        if row and row[0]:
            return {"logo_url": row[0]}
        url_row = db.execute(text("SELECT value FROM security_settings WHERE key = 'system_logo_url'")).first()
        if url_row and url_row[0]:
            return {"logo_url": url_row[0]}
        return {"logo_url": "https://iekqyzdevnzeohmiddjc.supabase.co/storage/v1/object/public/assets/saslogo.png"}
    finally:
        db.close()

@app.get("/public/announcements", response_model=list)
def get_public_announcements():
    db = SessionLocal()
    try:
        from utils.models import Announcement
        announcements = db.query(Announcement).filter(Announcement.is_draft == False).order_by(Announcement.created_at.desc()).all()
        return [
            {
                "id": a.id,
                "title": a.title,
                "content": a.content,
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

# System languages endpoint reading single master languages.json
@app.get("/api/v1/system/languages")
def get_system_languages():
    import json
    local_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "languages.json")
    root_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "languages.json")
    
    target_path = local_path if os.path.exists(local_path) else root_path
    if os.path.exists(target_path):
        with open(target_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"supportedLanguages": [], "translations": {}}

# Basic health check endpoint
@app.get("/")
def root():
    return {"status": "online", "message": "Smart Attendance API is running"}

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
