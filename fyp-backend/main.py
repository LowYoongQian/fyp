from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
import asyncio
import logging
import os
import hashlib

from domain.announcements import announcement_dict
from db.database import SessionLocal, engine
from routers import auth, llm, sessions, students, admin_students, admin_staff, admin_academic, admin_attendance, admin_config, student_self, analytics, lecturers, admin_reports, admin_audit

# Schema is owned by Alembic (`alembic upgrade head`, which the Procfile/Dockerfile run
# before uvicorn starts). Data seeds live in seed.py. Nothing here touches the database
# at import time: the old create_all + hand-written ALTER TABLE block could half-apply
# and only print a warning, so the app would start against a schema it assumed was
# migrated. A failed migration now stops the deploy instead.


# Attendance state changes the moment a lecturer opens or closes a session, and both
# clients poll these endpoints to decide whether check-in is available. A 30 second
# cache there means a student cannot see a class that just opened, and still sees the
# entry for one that just closed. Correctness beats the saved round trip on these.
NO_STORE_PREFIXES = (
    "/sessions/",              # open / active / per-session register
    "/students/me/active-sessions",
    "/students/me/attendance",
    "/admin/sessions",
)


def _is_realtime(path: str) -> bool:
    return path == "/sessions" or path.startswith(NO_STORE_PREFIXES)


class ETagMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method not in ("GET", "HEAD"):
            return await call_next(request)

        response = await call_next(request)

        if response.status_code != 200:
            return response

        if _is_realtime(request.url.path):
            response.headers["Cache-Control"] = "no-store"
            return response

        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type and "text/" not in content_type:
            return response
            
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk
            
        etag = f'W/"{hashlib.md5(response_body).hexdigest()}"'
        
        if_none_match = request.headers.get("if-none-match")
        # must-revalidate, not max-age=30: with a 30s freshness window the browser
        # answered its own cache after a PUT/POST, so an edit saved fine but the list
        # kept showing the old row. Revalidating always still costs only a 304.
        cache_control = "private, no-cache, must-revalidate"

        if if_none_match and if_none_match == etag:
            return Response(
                status_code=304,
                headers={"ETag": etag, "Cache-Control": cache_control}
            )

        headers = dict(response.headers)
        headers["ETag"] = etag
        headers["Cache-Control"] = cache_control
        headers["content-length"] = str(len(response_body))
        
        return Response(
            content=response_body,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type
        )

logger = logging.getLogger(__name__)

# Opening a fresh connection to the remote database measures ~1.9s (TLS + auth), while a
# pooled one costs ~0.2s. Supabase drops idle connections, so after a quiet spell the next
# page load paid that 1.9s on every connection it needed at once. Touching the pool on a
# timer keeps the connections alive so no user request ever pays for the handshake.
_KEEPALIVE_SECONDS = 240
_KEEPALIVE_CONNECTIONS = 6


async def _keep_pool_warm():
    while True:
        await asyncio.sleep(_KEEPALIVE_SECONDS)
        try:
            await asyncio.to_thread(_ping_pool)
        except Exception as exc:
            # A failed ping is not fatal: the next real request opens a connection as
            # before. Log it rather than killing the task, which would silently stop
            # every future ping.
            logger.warning("DB keepalive ping failed: %s", exc)


def _ping_pool():
    # Held open at the same time on purpose: one connection at a time would only ever
    # refresh the same pooled connection, leaving the rest to go stale. The admin pages
    # fan out ~6 parallel requests, so that many are kept live.
    conns = [engine.connect() for _ in range(_KEEPALIVE_CONNECTIONS)]
    try:
        for conn in conns:
            conn.execute(text("SELECT 1"))
    finally:
        for conn in conns:
            conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_keep_pool_warm())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title="Smart Attendance API",
    version="1.0.0",
    description="Backend API for Smart Attendance System",
    lifespan=lifespan,
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
        from db.models import Announcement
        announcements = (
            db.query(Announcement).filter(Announcement.is_draft == False)  # noqa: E712
            .order_by(Announcement.created_at.desc()).all()
        )
        # Same serialiser as the authenticated views. This copy omitted faculty and
        # department, so the mobile login screen read them as null.
        return [announcement_dict(a) for a in announcements]
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

@app.get("/health")
def health():
    """Health check endpoint for Azure App Service"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
