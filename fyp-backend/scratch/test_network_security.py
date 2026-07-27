import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(env_path)

db_url = os.getenv("DATABASE_URL")
if not db_url:
    sys.exit("DATABASE_URL not set")

if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

from utils.models import CampusNetwork, SecuritySetting

engine = create_engine(db_url)
Session = sessionmaker(bind=engine)
db = Session()

print("Testing CampusNetwork query...")
try:
    nets = db.query(CampusNetwork).order_by(CampusNetwork.id).all()
    print(f"Campus Networks count: {len(nets)}")
    for n in nets:
        print(f"  - [{n.id}] {n.label} | CIDR: {n.cidr} | Active: {n.is_active}")
except Exception as e:
    print(f"❌ Error querying CampusNetwork: {e}")

print("\nTesting SecuritySetting query...")
try:
    settings = db.query(SecuritySetting).all()
    print(f"Security Settings count: {len(settings)}")
    for s in settings:
        print(f"  - {s.key} = {s.value}")
except Exception as e:
    print(f"❌ Error querying SecuritySetting: {e}")
