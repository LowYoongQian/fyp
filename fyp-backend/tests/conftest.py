"""Make even direct pytest imports refuse a production database or dotenv."""
import os
import re
import secrets
from pathlib import Path
from urllib.parse import urlsplit

os.environ['PYTHON_DOTENV_DISABLED'] = '1'
if os.environ.get('SUPABASE_URL') not in (None, '', 'http://127.0.0.1:56421'):
    raise RuntimeError('SUPABASE_URL is not the isolated local QA service; use qa/run.py')
for key in ('DATABASE_URL', 'FYP_QA_MIGRATED_URL', 'FYP_QA_DATABASE_URL', 'LOCAL_MC_TEST_DATABASE_URL'):
    raw = os.environ.get(key)
    if not raw:
        continue
    url = urlsplit(raw)
    migration = url.port == 56422 and bool(re.fullmatch(r'qa_migration_[0-9a-f]{12}', url.path.lstrip('/')))
    storage = url.port == 56422 and url.path == '/postgres' and (os.getenv('RUN_LOCAL_MC') == '1' or os.getenv('RUN_LOCAL_FEEDBACK') == '1')
    standalone = url.port == 55432 and url.path == '/fyp_qa'
    if url.hostname != '127.0.0.1' or not (migration or storage or standalone):
        raise RuntimeError(f'{key} is not a supported isolated synthetic target; use qa/run.py')
os.environ.setdefault('DATABASE_URL', 'postgresql+psycopg://postgres:postgres@127.0.0.1:56422/qa_migration_000000000000')
# Tests never reuse a personal or production signing key.
os.environ['JWT_SECRET_KEY'] = secrets.token_hex(32)
for key in ('OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'RESEND_API_KEY', 'FCM_CREDENTIALS_JSON'):
    os.environ[key] = ''
# A clean checkout has no ignored artifacts directory; browser tests create
# their local logs/screenshots there, never as versioned fixtures.
(Path(__file__).parent / 'artifacts').mkdir(exist_ok=True)
