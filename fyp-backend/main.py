from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

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

        # Multi-device session binding table (created by Base.metadata above; migration is idempotent)

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

# CORS middleware configuration for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:4173",   # Vite preview
        "http://127.0.0.1:4173",
        # Add your production domain here when deploying:
        # "https://your-domain.com",
    ],
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
