# Reproducible synthetic FYP tests

This directory contains project test tooling, not production deployment tooling. Run commands from the repository root with an activated **Python 3.11** environment. No command here commits, pushes, deploys, resets a database or connects to cloud Supabase. Python entry points disable backend dotenv loading. Normal Vite/Flutter builds may read their usual local build/SDK configuration when present; those local files are not versioned, and the runner overrides the Web API target with loopback for checks.

## Install the declared dependencies

```text
python -m pip install -r fyp-backend/requirements.txt
npm ci --prefix qa --ignore-scripts
npm ci --prefix fyp_web
```

Use Flutter **3.41.4** (the APK workflow's existing SDK version), Node.js **22 or newer**, Docker Desktop/Engine, and Android SDK/ADB when running native tests. Put `flutter`, `node`, `npm`, `docker`, and optionally `adb` on PATH. Activate your own Python environment rather than copying another machine's virtual environment.

```text
cd fyp_flutter
flutter pub get
cd ..
```

Install the Chromium build matching the locked Playwright version:

```text
cd qa
npx --no-install playwright install chromium
cd ..
```

On Linux, install Playwright's Chromium system libraries as documented by Playwright (`playwright install --with-deps chromium` when appropriate). The lockfile contains only public package registry URLs. No dependency folder, SDK, model weights, browser binary, real credential, generated account, or session file is committed.

## Quick checks for a saved checkout

```text
python qa/run.py smoke
python qa/run.py collect
python qa/run.py flutter
python qa/run.py analyze
python qa/run.py build-web
python qa/run.py build-android
python qa/run.py web-cache
```

- `smoke`: the existing 47 authentication/account/time/dashboard tests; SQLite and controlled boundaries, no PostgreSQL service required.
- `collect`: collect the explicit existing 168 Python cases without executing them. Collection alone is not a PASS result.
- `flutter`: existing 22 widget/offline cases, including en/zh/ms attendance dates and exact 5pm closure; HTTP/preferences are fixtures.
- `web-cache`: six existing browser cache/account-switch scenarios against actual React/API modules with controlled HTTP adapters, served by a temporary loopback Vite server. It is not a real-backend E2E.
- `build-web`: production compilation only. It does not upload or deploy.
- `build-android`: compile a debug APK with the installed Android SDK; no device installation, signing-key upload or release publishing.

The runner clears inherited database/service credentials and sets `PYTHON_DOTENV_DISABLED=1`. The pytest conftest also rejects non-QA URLs before importing backend modules. Test signing keys are generated in memory. Synthetic account passwords in fixtures are public test data, never real credentials.

## Independent PostgreSQL and Storage

```text
python qa/run.py start
python qa/run.py backend-smoke
python qa/run.py storage-smoke
```

The committed Supabase config is exclusively for project `fyp-qa-synthetic`, API **127.0.0.1:56421**, database **127.0.0.1:56422**. The original local Supabase **54321/54322 is prohibited** as a test target. Do not run `supabase link`, `db push`, `db reset`, downgrade, or volume deletion for these tests. If the QA ports are occupied by an unrelated service, stop and resolve the conflict; never silently switch to another database.

Docker's default published-port binding may be broader than loopback: use this stack only on a trusted development host; the HTTP test servers themselves bind loopback. No claims are made that Docker's network exposure is loopback-only.

`backend-smoke` creates a **new** `qa_migration_<random 12 hex>` database with marker `FYP SYNTHETIC MIGRATION REPLAY ONLY`, creates the required extensions schema, and runs real Alembic `upgrade head`. It then executes the existing 13 cases for empty/legacy migration replay, face-evidence projection, course CRUD and runtime overlap. The route fixture rolls back endpoint writes; each migration fixture creates its own database. Nothing clears an existing database. Fresh and marked databases are retained for diagnosis.

`storage-smoke` runs the two existing real React/HTTP/Storage flows (MC and Feedback). Its separate root `postgres` database must have marker `FYP SYNTHETIC STORAGE QA ONLY`; a fresh root can be marked only when it has no existing application users table or other database marker. Existing unmarked databases are refused. This functional Storage fixture uses current ORM table creation; it is **not** the evidence for migration replay. Only document AI is controlled; actual cloud AI and mail are disabled. Local Supabase keys are read in memory and are not printed or saved by the runner.

For an explicitly requested full rerun, use:

```text
python qa/run.py backend
python qa/run.py storage
```

These execute 162 core cases and 6 opt-in Storage cases separately. Plain pytest without the Storage flags skips those opt-in cases; never describe such a run as all 168 passing. The full commands are available for future use; preparing this checkout does not imply they were rerun now.

To stop only QA containers, preserving volumes and databases:

```text
python qa/run.py stop
```

## Android: synthetic emulator only

Use a disposable emulator started explicitly with `-read-only -no-snapshot`; confirm its process command line and wait for `sys.boot_completed=1`. Do not clear an existing AVD or uninstall a personal app. The runner requires an `emulator-*` device and an explicit `--read-only-guest` declaration before Flutter installs the test APK. This declaration is the operator's confirmation of the read-only command line; ADB alone cannot prove that host launch flag.

Start the deterministic, no-database account HTTP fixture in a separate terminal:

```text
python qa/run.py serve-accounts
```

Then execute individual native suites:

```text
python qa/run.py android --test history_mapping --read-only-guest
python qa/run.py android --test account_isolation --read-only-guest
python qa/run.py android --test cache_upgrade --read-only-guest
python qa/run.py android --test cache_v4_upgrade --read-only-guest
```

Add `--device emulator-5556` if necessary. HTTP fixture endpoints on the host are reached through Android's standard `10.0.2.2`. Native cache upgrade fixtures refuse an existing database; use a fresh test installation, never reset real app data. They preserve pending account/request/photo data and do not infer face verification from unknown legacy evidence.

For the actual guest network-outage assertion, run `--test offline_account` and capture output into a **new ignored local log**. On Windows, a second terminal can run:

```text
powershell -NoProfile -File qa/toggle-guest-network.ps1 -Log <absolute-new-log-path>
```

The helper requires exactly the known `flutter_emulator` read-only guest, `emulator-5554`, ADB on PATH, and watches the test's exact cut/restore markers. It restores the original network settings in `finally`. Other emulator names/hosts need an independently audited controller or a manual guest-only toggle; never count HTTP503 as a real network outage. If no controller is available, mark this test MANUAL/BLOCKED rather than weakening its assertion.

## Fresh real-backend Android / Web scenarios

For real API login with synthetic accounts, keep this running in one terminal:

```text
python qa/run.py login-api
```

It creates and migrates a new marked database and seeds only the student/staff expected by the original test. In another terminal:

```text
python qa/run.py android --test login --read-only-guest
```

For lost-response attendance recovery and the four-identity cross-platform read check:

```text
python qa/run.py session-api
```

In another terminal, generate a fresh scenario, then run the Android test:

```text
python qa/run.py setup-session
python qa/run.py android --test attendance --read-only-guest
```

Start the Web dev server in a third terminal with `VITE_API_BASE_URL=http://127.0.0.1:58006`, bound to `127.0.0.1:5200 --strictPort`, then:

```text
python qa/run.py cross-web
```

This generates all scenario IDs at runtime in ignored `qa/.runtime/`. The API/database identity is checked before fixture writes or browser login. The scenario must have been completed by the Android callback (including 5pm closure) before the cross-Web check. Do not reuse a completed scenario as a fresh attendance case: restart `session-api` and run `setup-session` again to create a new database/scenario.

The real-backend attendance fixture explicitly controls the clock, face vector, model inference and network verifier. It proves orchestration/recovery, **not real camera, biometrics, liveness/spoof protection or campus Wi-Fi acceptance**. SDK/device availability and these manual acceptance boundaries remain separate.

## What belongs in Git

Keep the candidate commit manifest and preparation reports outside the repository. Group changes into migrations, backend, Flutter and test infrastructure. The root ignore rules allow only specific test/config filenames, not whole test directories. Do not use `git add .` or blanket force-add.

Runtime output, `.runtime/`, test artifacts/reports/traces, generated sessions, local review ZIPs, secrets and AI instructions remain ignored. Historical `real_e2e.cjs`, `academic_ui.cjs`, performance probes and `live_api_contract_test.dart` remain local because they depend on old scenario output; their recorded evidence is not represented as a new clean-checkout PASS. Their core API and MC/Feedback paths remain covered by the selected independent tests.

Do not push main, open a PR, merge or publish a tag as part of running tests. Existing repository workflows can deploy Web previews on PR and production on main; this tooling deliberately does not change those workflows or production settings. The commit plan is a proposal, not a staging or commit command.
