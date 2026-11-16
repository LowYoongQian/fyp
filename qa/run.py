"""Portable QA entry point. No production URLs, resets, cloud calls or git writes."""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from common import BACKEND, ROOT, RUNTIME, cli, executable, guard_container, local_supabase, new_database, run, safe_env

CORE = ['test_postgres_routes.py', 'test_medical_leave_review.py', 'test_offline_recovery.py',
        'test_auth_access_regression.py', 'test_account_endpoints.py', 'test_invalid_class_time.py',
        'test_dashboard_sessions.py', 'test_alembic_isolated.py']
WIDGETS = ['login_widget_test.dart', 'offline_sync_test.dart', 'portal_background_sync_test.dart',
           'dashboard_cache_isolation_test.dart', 'attendance_localization_test.dart']


def pytest(files, env, extra=()):
    run([sys.executable, '-m', 'pytest', *['tests/' + f for f in files], '-q', '--tb=short', *extra], cwd=BACKEND, env=env)


def storage_env(env):
    from sqlalchemy import create_engine, inspect, text
    data = local_supabase()
    env.update(DATABASE_URL=data['DB_URL'].replace('postgresql://', 'postgresql+psycopg://'),
               SUPABASE_URL=data['API_URL'], SUPABASE_SERVICE_ROLE_KEY=data['SERVICE_ROLE_KEY'],
               SUPABASE_SECRET_KEY=data.get('SECRET_KEY', ''), RUN_LOCAL_MC='1', RUN_LOCAL_FEEDBACK='1',
               ALLOWED_ORIGINS='http://127.0.0.1:5179,http://127.0.0.1:5183',
               MC_PLAYWRIGHT_ROOT=str(ROOT / 'qa/node_modules'))
    engine = create_engine(env['DATABASE_URL'])
    try:
        with engine.begin() as conn:
            marker = conn.scalar(text("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()"))
            if marker != 'FYP SYNTHETIC STORAGE QA ONLY':
                if marker is not None or inspect(conn).has_table('users'):
                    raise RuntimeError('Refusing to adopt or relabel an existing unmarked database')
                conn.execute(text("COMMENT ON DATABASE postgres IS 'FYP SYNTHETIC STORAGE QA ONLY'"))
    finally:
        engine.dispose()
    # Functional Storage fixture, separate from real migration replay tests.
    run([sys.executable, '-c', 'from db.models import Base; from db.database import engine; Base.metadata.create_all(engine)'], cwd=BACKEND, env=env)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('task', choices=['smoke', 'backend-smoke', 'backend', 'storage-smoke', 'storage',
        'collect', 'flutter', 'analyze', 'build-web', 'build-android', 'web-cache', 'serve-accounts',
        'session-api', 'setup-session', 'cross-web', 'login-api', 'android', 'start', 'stop'])
    parser.add_argument('--device', default='emulator-5554')
    parser.add_argument('--test', choices=['history_mapping', 'account_isolation', 'cache_upgrade', 'cache_v4_upgrade', 'login', 'attendance', 'offline_account'], default='cache_v4_upgrade')
    parser.add_argument('--read-only-guest', action='store_true', help='Required after independently verifying a disposable read-only emulator')
    args = parser.parse_args()
    env = safe_env()
    if args.task == 'start':
        # CLI sees only the committed local synthetic project; never a linked cloud project.
        started = subprocess.run([cli(), 'start', '--workdir', str(ROOT / 'qa')], env=env, capture_output=True)
        if started.returncode:
            raise RuntimeError('Synthetic Supabase did not start; inspect Docker/CLI locally (secret-bearing CLI output is not forwarded)')
        guard_container()
        print('Synthetic QA stack ready on API 56421 / PostgreSQL 56422; local keys are not printed')
    elif args.task == 'stop':
        names = subprocess.check_output(['docker', 'ps', '-q', '--filter', 'label=com.supabase.cli.project=fyp-qa-synthetic'], encoding='utf-8').split()
        if names:
            run(['docker', 'stop', *names])  # Preserve every volume/database; never docker down/reset.
    elif args.task == 'smoke':
        pytest(['test_auth_access_regression.py', 'test_account_endpoints.py', 'test_invalid_class_time.py', 'test_dashboard_sessions.py'], env)
    elif args.task in ('backend', 'backend-smoke'):
        new_database(env)
        env['FYP_QA_MIGRATED_URL'] = env['DATABASE_URL']
        if args.task == 'backend':
            pytest(CORE, env)
        else:
            pytest(['test_postgres_routes.py', 'test_alembic_isolated.py'], env, ['-k',
                'student_history_face or runtime_auto_allocation or course_crud_preserves or empty_database_upgrade or legacy_group_migration'])
    elif args.task in ('storage', 'storage-smoke'):
        storage_env(env)
        extra = ['-k', 'test_playwright_mc_workflow or test_browser_submission_and_admin_reply'] if args.task.endswith('smoke') else []
        pytest(['test_mc_acceptance_local.py', 'test_feedback_local.py'], env, extra)
    elif args.task == 'collect':
        pytest(CORE + ['test_mc_acceptance_local.py', 'test_feedback_local.py'], env, ['--collect-only'])
    elif args.task in ('flutter', 'analyze'):
        command = [executable('flutter'), 'test', '--no-pub', *['../fyp-backend/tests/' + f for f in WIDGETS], '--reporter', 'expanded'] if args.task == 'flutter' else [executable('flutter'), 'analyze', '--no-pub']
        run(command, cwd=ROOT / 'fyp_flutter', env=env)
    elif args.task == 'build-web':
        run([executable('npm'), 'run', 'build'], cwd=ROOT / 'fyp_web', env=env)
    elif args.task == 'build-android':
        run([executable('flutter'), 'build', 'apk', '--debug', '--no-pub'], cwd=ROOT / 'fyp_flutter', env=env)
    elif args.task == 'web-cache':
        env['FYP_TEST_WEB_URL'] = 'http://127.0.0.1:5183'
        vite = subprocess.Popen([executable('node'), str(ROOT / 'fyp_web/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5183', '--strictPort'], cwd=ROOT / 'fyp_web', env=env, stdout=subprocess.DEVNULL)
        try:
            import urllib.request
            for attempt in range(100):
                if vite.poll() is not None:
                    raise RuntimeError('QA Vite exited; check port 5183')
                try:
                    urllib.request.urlopen(env['FYP_TEST_WEB_URL'], timeout=1).close()
                    break
                except OSError:
                    time.sleep(.1)
            else:
                raise RuntimeError('QA Vite did not become ready')
            run([executable('node'), BACKEND / 'tests/cache_regression.cjs'], env=env)
        finally:
            vite.terminate()
            vite.wait(timeout=15)
    elif args.task == 'serve-accounts':
        run([sys.executable, ROOT / 'qa/account_fixture.py'], env=env)
    elif args.task == 'session-api':
        run([sys.executable, ROOT / 'qa/session_api.py', '--prepare'], env=env)
        run([sys.executable, ROOT / 'qa/session_api.py'], env=env)
    elif args.task == 'setup-session':
        run([sys.executable, ROOT / 'qa/seed_session.py'], env=env)
    elif args.task == 'cross-web':
        env.update(FYP_QA_SCENARIO=str(RUNTIME / 'attendance-scenario.json'), VITE_API_BASE_URL='http://127.0.0.1:58006')
        # Uses the currently running QA Web server on 5200, as documented.
        run([executable('node'), BACKEND / 'tests/phase2_cross_platform.cjs'], env=env)
    elif args.task == 'login-api':
        new_database(env)
        run([sys.executable, ROOT / 'qa/seed_login.py', '--serve'], env=env)
    elif args.task == 'android':
        if not args.read_only_guest or not args.device.startswith('emulator-'):
            raise RuntimeError('Audit a read-only synthetic emulator and pass --read-only-guest; no physical device installs')
        adb = executable('adb')
        boot = subprocess.check_output([adb, '-s', args.device, 'shell', 'getprop', 'sys.boot_completed'], encoding='utf-8').strip()
        if boot != '1':
            raise RuntimeError('Wait for emulator sys.boot_completed=1 before installing test APKs')
        port = 58004 if args.test == 'login' else 58006 if args.test == 'attendance' else 58005
        server = f'http://10.0.2.2:{port}'
        if args.test not in ('cache_upgrade', 'cache_v4_upgrade'):
            import urllib.request
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/qa/environment',timeout=5) as response:
                identity=json.load(response)
            if identity.get('synthetic_only') is not True:
                raise RuntimeError('Refusing an HTTP service without explicit synthetic identity')
            if args.test in ('login','attendance'):
                metadata='login-environment.json' if args.test=='login' else 'attendance-scenario.json'
                expected=json.loads((RUNTIME/metadata).read_text(encoding='utf-8'))
                if identity.get('database')!=expected['database']:
                    raise RuntimeError('HTTP/database identity mismatch before Android authentication')
        defines = ['--dart-define=QA_READ_ONLY_GUEST=true', f'--dart-define=API_BASE_URL={server}', f'--dart-define=EMULATOR_API_BASE_URL={server}', '--dart-define=QA_STAFF_ID=T900001']
        if args.test == 'attendance':
            data = json.loads((RUNTIME / 'attendance-scenario.json').read_text(encoding='utf-8'))
            if data.get('synthetic_only') is not True:
                raise RuntimeError('Generate a fresh synthetic session first')
            defines += [f"--dart-define={k}={v}" for k, v in {
                'QA_STUDENT_A':data['students']['A']['email'], 'QA_USER_A':data['students']['A']['user_id'],
                'QA_SESSION':data['session_id'], 'QA_COURSE_CODE':data['course_code']}.items()]
        run([executable('flutter'), 'test', f'integration_test/qa_{args.test}_test.dart', '-d', args.device, '--no-pub', *defines, '--reporter', 'expanded'], cwd=ROOT / 'fyp_flutter', env=env)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print(f'QA stopped: {error}', file=sys.stderr)
        raise SystemExit(1)
