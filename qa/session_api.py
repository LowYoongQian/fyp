"""Guarded real FastAPI routes; synthetic face/network/clock and lost-response fault."""
import asyncio,json,os,re,struct,subprocess,sys
from pathlib import Path
from datetime import datetime,timedelta
from uuid import uuid4
from sqlalchemy import create_engine,text

from common import BACKEND as root, RUNTIME, guard_container, safe_env
os.environ.update(safe_env())
RUNTIME.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(root))
os.environ['PYTHON_DOTENV_DISABLED']='1'
os.environ['PYTHONPATH']=str(root)
record=RUNTIME/'session-environment.json'
info=json.loads(subprocess.check_output(['docker','inspect','supabase_db_fyp-qa-synthetic'],encoding='utf-8'))[0]
assert info['Config']['Labels']['com.supabase.cli.project']=='fyp-qa-synthetic'
assert info['NetworkSettings']['Ports']['5432/tcp'][0]['HostPort']=='56422'

if '--prepare' in sys.argv:
    name='qa_migration_'+uuid4().hex[:12]
    subprocess.run(['docker','exec','supabase_db_fyp-qa-synthetic','createdb','-U','postgres',name],check=True)
    os.environ['DATABASE_URL']=f'postgresql+psycopg://postgres:postgres@127.0.0.1:56422/{name}'
    engine=create_engine(os.environ['DATABASE_URL'])
    with engine.begin() as c:
        c.execute(text(f"COMMENT ON DATABASE {name} IS 'FYP SYNTHETIC MIGRATION REPLAY ONLY'"))
        c.execute(text('CREATE SCHEMA extensions'))
    engine.dispose()
    subprocess.run([sys.executable,'-m','alembic','upgrade','head'],cwd=root,check=True)
    from db.database import SessionLocal
    from db.models import User
    from utils.security import hash_password
    with SessionLocal() as db:
        db.add(User(email='qa-e2e-admin@staff.school.edu',password_hash=hash_password('Synthetic-E2E!123'),role='admin',recovery_prompt_dismissed=True))
        db.commit()
    record.write_text(json.dumps({'database':name,'port':58006,'synthetic_only':True}),encoding='utf-8')
    print('Prepared separate migrated synthetic database:',name)
    raise SystemExit(0)

name=json.loads(record.read_text(encoding='utf-8'))['database']
assert re.fullmatch(r'qa_migration_[0-9a-f]{12}',name)
os.environ['DATABASE_URL']=f'postgresql+psycopg://postgres:postgres@127.0.0.1:56422/{name}'
# safe_env supplies a fresh ephemeral QA signing key; no key file is stored.
os.environ['ALLOWED_ORIGINS']='http://127.0.0.1:5200'
for key in ('OPENROUTER_API_KEY','RESEND_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY'):
    os.environ[key]=''
engine=create_engine(os.environ['DATABASE_URL'])
with engine.connect() as c:
    assert c.scalar(text("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()"))=='FYP SYNTHETIC MIGRATION REPLAY ONLY'
engine.dispose()
from main import app
from db.database import SessionLocal
from routers import sessions
from domain import session_sync
from fastapi import Request

from utils.timeutil import campus_now
clock={'now':datetime.combine(campus_now().date(),datetime.min.time()).replace(hour=7,minute=30),'drop':False}
sessions.utcnow=lambda:clock['now']
sessions.campus_now=lambda:clock['now']+timedelta(hours=8)
session_sync.utcnow=lambda:clock['now']
# Authentication keeps its real clock. Only attendance and the app's displayed
# server time use the synthetic class clock; changing auth time can expire JWTs.
vector=struct.pack('512f',*([1.0]*512))
sessions.extract_live_embedding=lambda image:vector
sessions.verify_network=lambda **kw:(True,'QA synthetic network boundary; not campus verification')

@app.get('/qa/environment')
async def qa_environment():
    return {'database':name,'synthetic_only':True,'model_network_stubbed':True}

@app.post('/qa/response-loss')
async def response_loss():
    clock['drop']=True
    return {'synthetic_fault':'truncate next successful attend after commit'}

@app.post('/qa/close-at-five')
async def close_at_five():
    clock['now']=clock['now'].replace(hour=9,minute=0)
    with SessionLocal() as db:
        session_sync._sync_class_sessions_now(db)
    return {'campus_time':'17:00:00','synthetic_clock':True}

class TruncateAfterCommit:
    async def __call__(self,scope,receive,send):
        if scope['type']=='http' and scope['path']=='/auth/server-time':
            from fastapi.responses import JSONResponse
            await JSONResponse({'server_time':clock['now'].isoformat()+'Z'})(scope,receive,send)
            return
        if scope['type']=='http' and scope.get('method')=='POST' and scope['path'].endswith('/attend') and clock['drop']:
            messages=[]
            async def capture(message):messages.append(message)
            await app(scope,receive,capture)
            if messages[0]['status']==200:
                clock['drop']=False
                print('QA_TRUNCATED_AFTER_COMMIT',flush=True)
                await send({'type':'http.response.start','status':200,'headers':[(b'content-length',b'100000'),(b'content-type',b'application/json')]})
                await send({'type':'http.response.body','body':b'{','more_body':True})
                raise RuntimeError('QA intentional truncated response AFTER committed attendance')
            for message in messages:await send(message)
        else:await app(scope,receive,send)

if __name__=='__main__':
    import uvicorn
    uvicorn.run(TruncateAfterCommit(),host='127.0.0.1',port=58006)
