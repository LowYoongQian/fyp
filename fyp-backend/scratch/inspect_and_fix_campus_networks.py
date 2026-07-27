import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(env_path)

db_url = os.getenv("DATABASE_URL")
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(db_url, isolation_level="AUTOCOMMIT")

with engine.connect() as conn:
    print("Checking columns in 'campus_networks' table...")
    res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='campus_networks';")).fetchall()
    cols = {r[0] for r in res}
    print(f"Existing columns in campus_networks table: {cols}")

    # Add missing columns if needed
    for col_name, col_def in [
        ("label", "VARCHAR DEFAULT 'Campus Network'"),
        ("cidr", "VARCHAR"),
        ("ssid", "VARCHAR"),
        ("bssid_prefix", "VARCHAR"),
        ("location_name", "VARCHAR"),
        ("bssid", "VARCHAR"),
        ("gateway_ip", "VARCHAR"),
        ("subnet_range", "VARCHAR"),
        ("is_active", "BOOLEAN DEFAULT TRUE")
    ]:
        if col_name not in cols:
            print(f"Adding column '{col_name}' to campus_networks...")
            conn.execute(text(f"ALTER TABLE campus_networks ADD COLUMN IF NOT EXISTS {col_name} {col_def};"))

print("✅ 'campus_networks' table schema sync complete!")
