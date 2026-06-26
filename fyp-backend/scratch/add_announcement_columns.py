import os
import sys
# Add parent directory to path so we can import utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not found in environment variables.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

columns_to_add = [
    ("is_draft", "BOOLEAN DEFAULT FALSE NOT NULL"),
    ("priority", "VARCHAR DEFAULT 'Medium' NOT NULL"),
    ("image_base64", "TEXT"),
    ("publish_start", "TIMESTAMP"),
    ("publish_end", "TIMESTAMP"),
    ("target_audience", "VARCHAR DEFAULT 'all' NOT NULL"),
    ("target_programme_code", "VARCHAR")
]

with engine.connect() as conn:
    trans = conn.begin()
    try:
        # Check existing columns
        result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='announcements'"))
        existing_cols = {row[0] for row in result.fetchall()}
        print(f"Existing columns: {existing_cols}")
        
        for col_name, col_type in columns_to_add:
            if col_name not in existing_cols:
                print(f"Adding column {col_name}...")
                conn.execute(text(f"ALTER TABLE announcements ADD COLUMN {col_name} {col_type}"))
            else:
                print(f"Column {col_name} already exists.")
        trans.commit()
        print("Migration completed successfully!")
    except Exception as e:
        trans.rollback()
        print(f"Migration failed: {e}")
        sys.exit(1)
