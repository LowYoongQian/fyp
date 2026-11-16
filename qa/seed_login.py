"""Fresh synthetic login fixtures for the unchanged Android login assertions."""
import os
import sys
from sqlalchemy import create_engine, text
from common import BACKEND, RUNTIME, database_url, guard_database

sys.path.insert(0, str(BACKEND))
name = os.environ['DATABASE_URL'].rsplit('/', 1)[-1]
if os.environ.get('PYTHON_DOTENV_DISABLED') != '1' or os.environ['DATABASE_URL'] != database_url(name):
    raise RuntimeError('Use qa/run.py login-api; no other database URL is accepted')
guard_database(name)
from db.database import SessionLocal
from db.models import User, Student, Lecturer
from utils.security import hash_password

with SessionLocal() as db:
    if db.query(User).count() != 0:
        raise RuntimeError('Login fixtures require a new empty synthetic database')
    student_user = User(email='qa-e2e-student@student.school.edu', password_hash=hash_password('Synthetic-E2E!123'), role='student', recovery_prompt_dismissed=True)
    staff_user = User(email='qa-e2e-staff@staff.school.edu', password_hash=hash_password('Synthetic!123'), role='lecturer', recovery_prompt_dismissed=True)
    db.add_all([student_user, staff_user]); db.flush()
    db.add(Student(user_id=student_user.id, name='Synthetic E2E Student', student_code='ST9900001'))
    db.add(Lecturer(user_id=staff_user.id, name='UI Synthetic Teacher', staff_id='T900001', role='Lecturer'))
    db.commit()
print('Fresh synthetic login fixtures ready; QA staff ID T900001')
if '--serve' in sys.argv:
    import json
    import uvicorn
    from main import app
    identity={'database':name,'synthetic_only':True,'fixture':'login'}
    RUNTIME.mkdir(parents=True,exist_ok=True)
    (RUNTIME/'login-environment.json').write_text(json.dumps(identity),encoding='utf-8')
    @app.get('/qa/environment')
    def qa_environment():
        return identity
    uvicorn.run(app,host='127.0.0.1',port=58004)
