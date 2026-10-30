import os
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
import config  # noqa: F401  # loads fyp-backend/.env once for every entry point

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Add it to fyp-backend/.env before starting the app.")

# SQLAlchemy defaults `postgresql://` URLs to psycopg2, but this project
# installs psycopg v3. Normalize the URL so local startup works with the
# declared dependency set.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# Psycopg 3 prepares a statement after 5 executions of the same SQL. A pooler or
# server that resets a session then raises "prepared statement ... does not exist"
# (SQLSTATE 26000). None turns automatic preparation off; parameters stay bound.
PSYCOPG_CONNECT_ARGS = {"prepare_threshold": None}

# Create database engine with connection pool settings
engine = create_engine(
    DATABASE_URL,
    connect_args=PSYCOPG_CONNECT_ARGS if make_url(DATABASE_URL).drivername == "postgresql+psycopg" else {},
    pool_pre_ping=True,
    hide_parameters=True,  # Never include authenticator ciphertext or device tokens in SQL errors.
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,  # recycle stale connections after 30 min
)

# Session factory for DB operations
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# FastAPI dependency to yield DB session and close it afterwards
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
