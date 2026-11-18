"""Synthetic-only QA boundaries shared by portable test entry points."""
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'fyp-backend'
RUNTIME = ROOT / 'qa/.runtime'
CONTAINER = 'supabase_db_fyp-qa-synthetic'
MARKER = 'FYP SYNTHETIC MIGRATION REPLAY ONLY'


def executable(name):
    found = shutil.which(name)
    if not found:
        raise RuntimeError(f'{name} is required on PATH; see qa/README.md')
    return found


def safe_env():
    env = os.environ.copy()
    for key in list(env):
        if any(word in key.upper() for word in ('DATABASE_URL', 'SUPABASE', 'API_KEY', 'SECRET', 'CREDENTIAL', 'JWT_', 'FCM_', 'SMTP_', 'RESEND_')):
            env.pop(key, None)
    for key in ('FYP_QA_MIGRATED_URL', 'FYP_QA_DATABASE_URL', 'LOCAL_MC_TEST_DATABASE_URL', 'RUN_LOCAL_MC', 'RUN_LOCAL_FEEDBACK'):
        env.pop(key, None)
    env.update(PYTHON_DOTENV_DISABLED='1', PYTHONIOENCODING='utf-8', PYTHONUTF8='1',
               PYTHONPATH=str(BACKEND), JWT_SECRET_KEY=secrets.token_hex(32),
               DATABASE_URL='postgresql+psycopg://postgres:postgres@127.0.0.1:56422/qa_migration_000000000000',
               OPENROUTER_API_KEY='', RESEND_API_KEY='',
               SUPABASE_URL='', SUPABASE_SERVICE_ROLE_KEY='', SUPABASE_SECRET_KEY='',
               FCM_CREDENTIALS_JSON='', VITE_API_BASE_URL='http://127.0.0.1:1')
    return env


def run(args, *, cwd=ROOT, env=None):
    return subprocess.run([str(arg) for arg in args], cwd=cwd, env=env, check=True)


def guard_container():
    info = json.loads(subprocess.check_output(['docker', 'inspect', CONTAINER], encoding='utf-8'))[0]
    if info['Config']['Labels'].get('com.supabase.cli.project') != 'fyp-qa-synthetic':
        raise RuntimeError('Refusing a container outside the synthetic QA project')
    if not info['State']['Running'] or info['NetworkSettings']['Ports']['5432/tcp'][0]['HostPort'] != '56422':
        raise RuntimeError('Start only the synthetic QA stack on port 56422')


def database_url(name):
    if not re.fullmatch(r'qa_migration_[0-9a-f]{12}', name):
        raise ValueError('Only randomly named synthetic migration databases are accepted')
    return f'postgresql+psycopg://postgres:postgres@127.0.0.1:56422/{name}'


def guard_database(name):
    from sqlalchemy import create_engine, text
    guard_container()
    engine = create_engine(database_url(name))
    try:
        with engine.connect() as conn:
            if conn.scalar(text("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()")) != MARKER:
                raise RuntimeError('Synthetic database marker mismatch')
    finally:
        engine.dispose()


def new_database(env):
    """Create a fresh database, never clear, stamp or reset an existing one."""
    from sqlalchemy import create_engine, text
    guard_container()
    name = 'qa_migration_' + uuid4().hex[:12]
    run(['docker', 'exec', CONTAINER, 'createdb', '-U', 'postgres', name])
    engine = create_engine(database_url(name))
    try:
        with engine.begin() as conn:
            conn.execute(text(f"COMMENT ON DATABASE {name} IS '{MARKER}'"))
            conn.execute(text('CREATE SCHEMA extensions'))
    finally:
        engine.dispose()
    env['DATABASE_URL'] = database_url(name)
    run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], cwd=BACKEND, env=env)
    return name


def cli():
    path = ROOT / 'qa/node_modules/.bin' / ('supabase.cmd' if os.name == 'nt' else 'supabase')
    if not path.is_file():
        raise RuntimeError('Run npm ci --prefix qa first')
    return str(path)


def local_supabase():
    guard_container()
    data = json.loads(subprocess.check_output([cli(), 'status', '--workdir', str(ROOT / 'qa'), '-o', 'json'], encoding='utf-8'))
    if data['API_URL'] != 'http://127.0.0.1:56421' or data['DB_URL'] != 'postgresql://postgres:postgres@127.0.0.1:56422/postgres':
        raise RuntimeError('Refusing non-QA Supabase endpoints')
    return data  # Keys stay in memory; never print this dictionary or persist it.
