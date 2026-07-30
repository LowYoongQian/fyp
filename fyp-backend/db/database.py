import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Add it to fyp-backend/.env before starting the app.")

# SQLAlchemy defaults `postgresql://` URLs to psycopg2, but this project
# installs psycopg v3. Normalize the URL so local startup works with the
# declared dependency set.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# Create database engine with connection pool settings
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
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
