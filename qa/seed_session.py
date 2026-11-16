"""Real admin/staff APIs prepare a fresh synthetic cross-platform scenario."""
import json,os,sys,struct
from pathlib import Path
from datetime import date,timedelta
from uuid import uuid4
import httpx
from common import BACKEND as root, RUNTIME, guard_container, safe_env
os.environ.update(safe_env())
guard_container()
sys.path.insert(0,str(root))
name=json.loads((RUNTIME/'session-environment.json').read_text())['database']
assert name.startswith('qa_migration_') and name.isidentifier()
os.environ.update(PYTHON_DOTENV_DISABLED='1',DATABASE_URL=f'postgresql+psycopg://postgres:postgres@127.0.0.1:56422/{name}')
from db.database import SessionLocal
from db.models import Student,Lecturer,ClassMeeting,User,FaceEmbedding
from sqlalchemy import text
with SessionLocal() as db:
    assert db.scalar(text("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()"))=='FYP SYNTHETIC MIGRATION REPLAY ONLY'
client=httpx.Client(base_url='http://127.0.0.1:58006',timeout=30)
environment=client.get('/qa/environment').json()
assert environment['synthetic_only'] is True and environment['database']==name, 'HTTP server/database identity mismatch; no fixture writes allowed'
def request(method,path,body=None,token=None,status=200):
    result=client.request(method,path,json=body,headers={'Authorization':'Bearer '+token} if token else {})
    assert result.status_code==status,(path,result.status_code,result.text)
    return result.json()
admin=request('POST','/auth/login',{'identifier':'qa-e2e-admin@staff.school.edu','password':'Synthetic-E2E!123'})['access_token']
suffix=str(int(uuid4().hex[:8],16))[-6:].zfill(6)
password='Synthetic!123'
teacher_email=f'p2-teacher-{suffix}@staff.school.edu'
request('POST','/admin/staff',{'email':teacher_email,'password':password,'name':'Phase2 Synthetic Teacher','staff_id':'T'+suffix,'role':'Lecturer'},admin,201)
teacher=request('GET','/admin/staff?search=T'+suffix,token=admin)['items'][0]
programme=request('POST','/admin/programmes',{'code':'P2'+suffix,'name':'Phase2 Synthetic Programme'},admin,201)
course_body={'course_code':'P2'+suffix,'course_name':'Phase2 Synthetic Attendance','programme_id':programme['id'],'credit_hours':3,'lecturer_id':teacher['id']}
course=request('POST','/admin/courses',course_body,admin,201)
from utils.timeutil import campus_now
today=campus_now().date()
request('POST','/admin/semesters',{'programme_id':programme['id'],'name':'Phase2 Synthetic Term','start_date':str(today),'end_date':str(today+timedelta(days=30)),'max_student_credits':18,'course_ids':[course['id']]},admin,201)
students={}
for owner,prefix in [('A','8'),('B','7')]:
    email=f'p2-{owner.lower()}-{suffix}@student.school.edu';code='ST'+prefix+suffix
    request('POST','/admin/students',{'email':email,'password':password,'name':'Phase2 Synthetic Student '+owner,'student_code':code},admin,201)
    student=request('GET','/admin/students?search='+code,token=admin)['items'][0]
    request('PUT','/admin/students/'+student['id']+'/programme',{'programme_id':programme['id']},admin)
    request('POST','/admin/enrolments',{'student_id':student['id'],'course_id':course['id'],'class_group':'G1'},admin,201)
    students[owner]={'email':email,'id':student['id'],'code':code}
with SessionLocal() as db:
    meeting=db.query(ClassMeeting).filter_by(course_id=course['id'],role='Lecture').one()
    meeting_id=str(meeting.id)
    for item in students.values():
        student=db.get(Student,item['id']);student.is_face_registered=True
        user=db.get(User,student.user_id);user.recovery_email='synthetic-'+student.student_code+'@example.test';user.recovery_email_verified=True
        item['user_id']=str(user.id)
        db.add(FaceEmbedding(student_id=student.id,embedding=struct.pack('512f',*([1.0]*512)),is_active=True))
    db.commit()
request('PUT','/admin/timetable/'+meeting_id,{'day':today.strftime('%A'),'start':'15:00','end':'17:00','room':'Phase2 Synthetic Room'},admin)
staff=request('POST','/auth/login',{'identifier':teacher_email,'password':password})['access_token']
lesson=request('POST','/sessions/open',{'course_id':course['id'],'class_group':'All','meeting_id':meeting_id},staff,201)
proof={'synthetic_only':True,'database':name,'programme_id':programme['id'],'course_id':course['id'],'course_code':course['course_code'],'meeting_id':meeting_id,'session_id':lesson['id'],'students':students,'teacher_email':teacher_email,'teacher_code':'T'+suffix,
       'boundaries':'Real admin/staff/auth/attendance/database routes. Fake face vector, network verification, verified recovery email fixture and controlled 15:30/17:00 clock; no camera/model acceptance.'}
destination=RUNTIME/'attendance-scenario.json'
destination.write_text(json.dumps(proof,indent=2),encoding='utf-8')
print(json.dumps(proof,indent=2))
