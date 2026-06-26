import sys
import os

# Resolve the backend dir relative to this file (scratch/ is one level down).
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(backend_path)

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from utils.models import ClassSession, AttendanceRecord, Student, Course, Enrolment

# Load DB credentials from the backend .env (never hardcode secrets).
load_dotenv(os.path.join(backend_path, '.env'))
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Define it in fyp-backend/.env")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def test_attendance():
    db = SessionLocal()
    try:
        print("1. Fetching all class sessions...")
        sessions = db.query(ClassSession).all()
        print(f"   Found {len(sessions)} sessions.")
        for s in sessions:
            print(f"   - Session ID: {s.id}, Course ID: {s.course_id}, Group: {s.class_group}, Open: {s.is_open}")

        if len(sessions) > 0:
            target_session = sessions[0]
            print(f"\n2. Fetching attendance records for session {target_session.id}...")
            records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == target_session.id).all()
            print(f"   Found {len(records)} records.")

            print(f"\n3. Fetching enrolled students for course {target_session.course_id}...")
            enrolled = db.query(Student).join(Enrolment).filter(Enrolment.course_id == target_session.course_id).all()
            print(f"   Found {len(enrolled)} enrolled students.")

            if len(enrolled) > 0:
                target_student = enrolled[0]
                print(f"\n4. Simulating Admin update for Student ID: {target_student.id}...")
                
                # Check if record already exists
                existing = db.query(AttendanceRecord).filter(
                    AttendanceRecord.session_id == target_session.id,
                    AttendanceRecord.student_id == target_student.id
                ).first()

                if existing:
                    print(f"   Existing record status: {existing.status}")
                    original_status = existing.status
                    new_status = 'absent' if original_status == 'present' else 'present'
                    
                    # Toggle
                    existing.status = new_status
                    print(f"   Updating record status to: {new_status}")
                    db.commit()
                    
                    # Verify
                    db.refresh(existing)
                    print(f"   Verification - Updated status in DB: {existing.status}")
                    
                    # Toggle back
                    existing.status = original_status
                    db.commit()
                    print(f"   Reverted status back to: {original_status}")
                else:
                    print("   No record exists, creating a temporary test record...")
                    temp_rec = AttendanceRecord(
                        session_id=target_session.id,
                        student_id=target_student.id,
                        status='present',
                        confidence_score=1.0,
                        wifi_verified=True,
                        liveness_passed=True
                    )
                    db.add(temp_rec)
                    db.commit()
                    print(f"   Created new present record.")
                    
                    # Let's clean it up or change status to absent (since admins can't delete)
                    temp_rec.status = 'absent'
                    db.commit()
                    print(f"   Audit trail updated: status set to absent.")

        print("\nAll database queries and upserts ran cleanly without any constraint violations!")
    except Exception as e:
        print("\nError during database diagnostics:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    test_attendance()
