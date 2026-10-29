# Changelog

## Unreleased — snapshot 2026-10-29

- Baseline revision: `main` @ `aa47e226be86e66bbfeb779ea949b8bf6c1437fd` ("handle offline attendance and lecturer review").
- Nothing below is committed, tagged, released or confirmed deployed. No release version or deployment date is assigned.
- This file is the only versioned Markdown document. It consolidates nine former working notes (their operational content now lives in [Operational reference](#operational-reference); the files themselves were removed on 2026-10-29), the former READMEs, the cleanup change report and the review outcomes, plus the uncommitted Git changes inspected on 2026-10-29. "Source: X-ROLLOUT" labels below name the former notes. Statements copied from a note are labelled as such.
- Status labels: **Verified (tree)** = confirmed by inspecting current files/diffs on 2026-10-29. **Per note** = claimed by a note, not independently re-verified. **NOT VERIFIED** = unconfirmed; do not treat as fact.
- Notes record local test counts and local database upgrades from October 2026. Those are historical local checks, **not evidence about production**.

### Migration order (Verified (tree) from `down_revision` links)

`… → a6b9d2e4f307 → c5cc61db6fff → d7e3a1f8b204 → e8f4b2c9d105 → c2aeddcb9bf6 → d8569cd9629c` (head). `d8569cd9629c` is the current head, so the account-security note's "database is at `c2aeddcb9bf6`" is a historical statement that predates the semester revision. All six revisions are untracked files (see inventory). Every environment still needs `alembic upgrade head`; the notes' statements that the configured shared database was upgraded (to `d7e3a1f8b204` on 2026-10-11, and `e8f4b2c9d105` on 2026-10-12) are historical and unverified for any other database, including production.

---

## Backend (`fyp-backend`)

### Added
- **Secure check-in challenges and live updates** — one-time hashed `checkin-challenge` tokens (120 s), server-side MiniFASNet anti-spoof plus ArcFace match (fail-closed), PostgreSQL commit-time NOTIFY triggers with a `/live` WebSocket and polling fallback; new `domain/checkin_challenge.py`, `domain/live_updates.py`, `integrations/live_face.py`, `routers/live_updates.py`; migration `c5cc61db6fff`. Source: [Security Live Rollout notes](#secure-check-in-paged-reports-and-live-updates).
- **Paged report APIs** — `/page` routes for student feedback, student medical leave, admin feedback and admin MC reports (`page`, `per_page` 1–100, search/status/date filters); legacy list routes retained. Same source.
- **Recovery-reminder preference** — `recovery_prompt_dismissed` via `PUT /auth/me/settings`; migration `d7e3a1f8b204`. Same source.
- **One-time face registration and admin reset** — registration with `registration_version`, owner/admin status endpoints, admin reset with password + revision; old challenge/approval routes return `410`; migration `e8f4b2c9d105`; `routers/face_enrolment.py`. Source: [Identity Network Rollout notes](#face-registration-reset-and-campus-network-verification).
- **Enforced TOTP 2FA, revocable server sessions and mobile push (FCM HTTP v1)** — encrypted authenticator secrets, hashed recovery codes, durable per-device push queue, quiet hours, server-side class reminders; migration `c2aeddcb9bf6`; `domain/account_security.py`, `routers/account_security.py`, `integrations/mobile_push.py`, `integrations/private_storage.py`; new settings `TOTP_ENCRYPTION_KEY`, `FCM_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`. Sources: [Account Security Push Rollout notes](#account-security-and-mobile-push), [Firebase Server Hosting notes](#firebase-credentials-on-a-hosted-server) (hosting guide only).
- **Semester calendar and credit limits** — admin-defined semesters (Asia/Kuala_Lumpur dates, non-overlapping per programme, credit cap), `/academic-calendar`, `/auth/server-time`; migration `d8569cd9629c`; `domain/semesters.py`, `routers/academic_calendar.py`. Source: [Semester Calendar Rollout notes](#semester-calendar-and-credit-limits).
- **Notification inbox** — web bell, unread counts, cursor-paged older notices, read-state sync with mobile; reuses `user_notifications`, no migration; `domain/notification_inbox.py`. Source: [Notification Inbox Rollout notes](#notification-inbox).
- **Attendance audit times** — UTC `Z` timestamps, MYT display, Class Start/End vs Opened/Closed vs Recorded At, before/after manual-edit snapshots in Audit Logs; no migration; `domain/attendance_audit.py`. Source: [Attendance Audit Times notes](#attendance-audit-times).
- **Per-course analytics overview** (`GET /analytics/overview`) — role-scoped, real-data attendance trends/groups/verification mix. Verified (tree) in `routers/analytics.py`; **not described in any of the nine notes**.
- **Temporary AI chat** (`/query/temporary`, `body.temporary` in `routers/llm.py`) — messages not persisted or embedded. Per the former `fyp_web/README.md` (not one of the nine notes); code Verified (tree).
- **Protected student feedback migration** `a6b9d2e4f307` (untracked, predates the notes' chain). Contents not reviewed here.

### Changed
- **Network verification** is authoritative by source IP/CIDR: fail-closed in production/staging/unknown environments; SSID-only rules no longer grant access; proxy headers honoured only from `TRUSTED_PROXY_CIDRS`; demo bypass requires `APP_ENV=development` **and** `ALLOW_INSECURE_NETWORK_DEMO=true` (`integrations/network_verify.py`, `.env.example`). Source: IDENTITY-NETWORK-ROLLOUT. Interacts with the existing network-verification design.
- **Uvicorn is started with `--no-proxy-headers`** in `fyp-backend/Procfile`, `fyp-backend/run_backend.bat` and `fyp-backend/Dockerfile` (Verified (tree)). The **root `Dockerfile` is unchanged and does not pass this flag** (see Rollout caveats).
- **Windows `bcrypt` pinned to 3.2.2** (`platform_system == "Windows"`), other platforms stay 4.1.3; new dependencies `pyotp`, `cryptography`, `qrcode`, `google-auth`, CPU `torch==2.14.1+cpu` (Verified (tree) in `requirements.txt`).
- **Attendance audit and class listings** — scheduled/cancelled/needs-review labelled separately; a student without a record is "Unrecorded", not absent; saved attendance stays visible after group changes. Source: ATTENDANCE-AUDIT-TIMES.
- **Semester enforcement** — outside configured dates classes are not materialised, reminders not generated, check-in refused; the previous August demo date and fixed 14-week clamp removed. Source: SEMESTER-CALENDAR-ROLLOUT.
- **Admin staff passwords: minimum length lowered from 8 to 4** (`AdminStaffCreate`/`AdminStaffUpdate` in `schemas.py`; Verified (tree)). **Not mentioned in any note; intent and security acceptability NOT VERIFIED — needs an explicit decision before release.**
- Other modified backend files with no matching note were not analysed line-by-line: `db/models.py`, `main.py`, `routers/{admin_academic,admin_attendance,admin_config,admin_reports,attendance_features,auth,lecturers,medical_leave,sessions,students}.py`, `domain/{audit,scheduler,security_settings,session_sync}.py`, `integrations/{feedback_files,medical_leave}.py`, `utils/security.py`. Treat their behaviour as **NOT VERIFIED** here.

### Fixed
- Login error from the missing reminder column (migration `d7e3a1f8b204`, applied to the then-configured shared database 2026-10-11 per note); the `face_enrolment_requests` missing-table error (`e8f4b2c9d105`, per note 2026-10-12). Startup now checks required face-enrolment columns and stops with an actionable error when migrations are missing.
- Intermittent Windows bcrypt verification failures (dependency pin above; per note).

### Removed / deprecated
- Student face-replacement and admin face-approval flows: old `/students/me/face/challenge` and `/admin/students/{id}/face-enrolment` routes return `410 Gone`; old registration payloads without `registration_version` are rejected; approval records are retained but cannot activate faces. Clients built before this change will fail check-in and registration.
- The simulated `two_factor_enabled` flag is reset by migration `c2aeddcb9bf6`; legacy bearer tokens need a fresh sign-in.

### Rollout requirements (from notes)
- Back up the database; run `alembic upgrade head` with the privileged backend role. Docker and Procfile run it before start; direct `uvicorn` does not.
- Deploy backend, web and rebuilt mobile app together (older clients are intentionally rejected).
- Set `TOTP_ENCRYPTION_KEY` once and back it up; all instances share it. Never regenerate on restart.
- Set `FCM_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` to a server-side file path (Azure Files mount / Container Apps secret volume). `FIREBASE_SERVICE_ACCOUNT_JSON` is **not implemented**.
- Set `LIVE_DATABASE_URL` to a direct/session-pool URL if `DATABASE_URL` uses transaction pooling; proxies must forward WebSocket upgrades for `/live`.
- Configure real campus CIDRs in Admin → Network Security and restrict direct access to the origin.
- Keep a worker running with no web traffic (no scale-to-zero) for time-sensitive reminders.

### Rollout caveats found while reconciling (Verified (tree))
- The notes say "Docker prefetches ArcFace and anti-spoof weights at build time" and refer to "the updated Docker/Procfile launchers". This is true of `fyp-backend/Dockerfile` only. The root `Dockerfile` (the one `.github/workflows/azure-backend-deploy.yml` builds with `-f Dockerfile .`) installs the same requirements but does **not** prefetch the Fasnet weights and does **not** pass `--no-proxy-headers`. Whether that matters in production is **NOT VERIFIED**; it is not an established cause of any outage.
- The former Firebase hosting note named a specific service-account JSON file. Treat that credential as sensitive; it must stay out of Git, images and the mobile app (its filename is deliberately not repeated here).

### Not verified (per the notes' own admissions)
Live push delivery on physical devices; real camera/anti-spoof accuracy and photo/screen spoof trials; iOS signing/APNs on macOS; production Docker build; deployed cross-process live connections; campus egress/proxy ranges; production deployment and multi-device read sync.

---

## Web (`fyp_web`)

### Added
- Notification bell, unread badges and sidebar indicators (shared top-right bell; `99+` display; reduced-motion aware). Source: NOTIFICATION-INBOX-ROLLOUT.
- Account security panel (2FA enrolment, recovery codes, sessions), push quiet hours, face reset dialog, semesters panel, record pagination/status components, submission date-time picker, `ChatWorkspace`, `FloatingPanel`, `ModalLayer`, `LimitedTextField`, and the shared utilities/hooks under `src/utils` and `src/hooks` (all untracked; Verified (tree) that the files exist).
- AI chat workspace: **New chat**, server-paginated **Saved chats**, **Temporary chat**, cross-window sign-out notice, data-derived suggestions (former `fyp_web/README.md`).
- Paged Feedback and Medical Leave pages that no longer use the legacy list routes; recovery-reminder preference in Settings.
- Attendance audit view showing year/date/time in MYT with explicit class/open/close/recorded labels.
- Course analytics page consuming `/analytics/overview` (`pages/staff/Analytics.tsx`, +352 lines; Verified (tree)).
- Dev dependency `@electric-sql/pglite` 0.5.8 for browser/PostgreSQL tests.

### Changed
- Shared dropdown, floating-panel and opacity-only menu/page entrance policy (`src/utils/uiMotion.ts`, Motion mini API; panel `left/top/width/height` are never eased). Reference: [Animation Reference notes](#web-animation-policy) — a research note; only its "Implemented shared policy (2026-10-11)" section describes shipped behaviour. Calendar opening stays instant by explicit request.
- Admin Academic Manager gains Semesters and the Student Allocation display of semester name/credit budget; admin/staff/student timetables use the server clock and configured semester dates, not a demo date.
- Login now handles the second-factor step before any access token exists (`Login.tsx`; per account-security note).
- Many pages touched with no matching note (Admin, Staff, Student pages, `MainLayout`, `AuthContext`, `api.ts`, `index.css`, i18n); their detail is **NOT VERIFIED** here.

### Removed
- `src/components/UserProfileModal.tsx` and `UserSettingsModal.tsx` are deleted in the working tree (unstaged `D`). Replaced by full pages `UserProfilePage.tsx` and `UserSettingsPage.tsx`, lazily loaded and routed in `App.tsx`. No references to the old modals remain under `src/` (Verified (tree)).
- The August demonstration date and fixed 14-week timetable clamp (per semester note).

### Rollout / build
- `fyp_web/src/services/api.ts` falls back to localhost when `VITE_API_BASE_URL` is absent at build time; the deploy workflow sets `https://api.smartsystem.live`. The value in the currently deployed bundle is **NOT VERIFIED**.
- Not verified: browser behaviour on production, hardware frame rates.

---

## Mobile (`fyp_flutter`)

### Added
- Face-registration-required screen, account security card, notifications screen, and services `academic_calendar`, `account_security`, `live_updates`, `mobile_push` (untracked; Verified (tree) that files exist).
- FCM push: `firebase_core ^4.15.0`, `firebase_messaging ^16.7.0`; the Google services Gradle plugin is applied only if a real `android/app/google-services.json` exists, so builds still work without Firebase config. iOS push entitlements prepared (`Runner.entitlements`, Info.plist, project file).
- Live updates socket (5/10 s fallback polling; 60 s safety refresh when connected) and semester-calendar consumption. Per notes.

### Changed
- Student/staff dashboards, timetable, scanner, settings and profile screens updated (large edits to `main.dart`, `staff_dashboard_screen.dart`, `student_dashboard_screen.dart`, `full_timetable_screen.dart`). Detail **NOT VERIFIED**; the last commit (`aa47e22`) already covered offline attendance.
- The mobile app must be rebuilt/reinstalled; it defaults to the hosted API.

### Not verified
Android/iOS device builds, iOS release signing/APNs, real push delivery.

---

## Documentation

- **Markdown policy (2026-10-29, user request):** this root `CHANGELOG.md` is the only Markdown file eligible for Git. `.gitignore` ignores every other `*.md`/`*.MD` at any depth, `/output/report/` and `/review-workflow/`.
- Removed and consolidated into this file: the seven rollout/hosting notes under `fyp-backend/`, `fyp_web/ANIMATION-REFERENCE.md`, the root, `fyp-backend`, `fyp_web` and `fyp_flutter` READMEs, the two small Flutter asset READMEs, `CHANGE_REPORT.md`, and the `output/report/chapter-1-to-4-submission-updates.md` academic-report editing notes (kept under [Academic report editing notes](#academic-report-editing-notes-from-the-former-outputreport-file-review-dated-2026-09-25); they concern the Word/PDF report, not runtime features). Tracked deletions are staged and not committed; old commits and GitHub still contain them until a later manual push.
- Local-only, ignored: `review-workflow/` holds the implementation handoff, fix request and independent review report as historical evidence of the cleanup task. A separate ignored `docs/` folder of older developer documentation exists locally and has not been consolidated or deleted (decision pending; see Open items).
- Pre-existing: the dev-only image and icon READMEs were template text, not project documentation.

---

## Repository maintenance

- `.gitignore` (Verified (tree)); also see the Markdown policy and added test-pattern rules in Outcomes:
  - Backend tests: `/fyp-backend/tests/*` is kept, and the previous `!/fyp-backend/tests/test_attendance_audit_times.py` exception is **removed**.
  - Added `/fyp-backend/pytest.ini`, `/fyp_web/tests/` and `/fyp_flutter/test/`.
- **Tests are now excluded from version control** (index entries removed only; every file kept on disk, SHA-256 identical before and after): `fyp-backend/pytest.ini`, the `fyp-backend/tests/test_*.py` files and `fyp_flutter/test/app_config_test.dart` (14 index entries: `pytest.ini`, 12 backend test files — two of which, `test_admin_staff_password_policy.py` and `test_support_medical_flow.py`, had only been intent-to-add and were never committed, so they leave no staged deletion — and 1 Flutter test; 12 staged deletions result). **Consequences:** the removals appear as staged deletions (`D `) until committed — expected, not an error; fresh clones will not contain the tests; existing commits/GitHub history still contain the previously tracked copies until a separate authorised commit/push; future edits to ignored tests will not appear in `git status`.
- **Unresolved exception (AC-01 FAIL):** `fyp_flutter/ios/RunnerTests/RunnerTests.swift` is test-only source that is still tracked because the Xcode project and `Runner.xcscheme` reference its `RunnerTests` target; resolving it needs approval to edit native project files (details under Outcomes of the TASK-20261029-01 cleanup). `flutter_test` stays in `pubspec.yaml`.
- `fyp-backend/pytest.ini` keeps its protective collection setting locally: only `test_*` functions are collected because the `check_*` functions in `test_backend_fixes.py` write to whatever `DATABASE_URL` is set (production for this project).
- Note: `fyp_web/package.json` has no test script; web tests are run with `node --test tests/*.test.mjs` per the Operational reference.

---

---

## Operational reference

Consolidated from the working notes that were removed from the working tree on 2026-10-29. Everything here is a **historical claim or instruction from those notes** unless marked Verified (tree). Nothing here was re-tested, and no production state was checked.

### Setup and run (from the former root, backend and Flutter READMEs)
- Requirements: **Python 3.11 exactly** (`tensorflow 2.14` / DeepFace has no Windows wheels for 3.12+; `numpy==1.26.4`, `pandas==2.2.3` are pinned — do not move to numpy 2.x), Node.js 18+ for the web app, Flutter SDK for mobile (optional).
- Backend (Windows): in `fyp-backend`, `copy .env.example .env` and fill `DATABASE_URL`, `GEMINI_API_KEY`, `JWT_SECRET_KEY`; run `setup_backend.bat` (creates `.venv`, installs requirements, verifies imports), then `run_backend.bat` (runs `alembic upgrade head`, then Uvicorn on port 8003, reload by default; flags `--no-reload`, `--no-pause`). `stop_backend.bat` frees port 8003. Packages and cache stay inside `fyp-backend\.venv` and `.cache`; never copy a `.venv` between machines.
- Web: `cd fyp_web`, `setup_web.bat`, `run_web.bat` (http://127.0.0.1:5173). Flutter: `cd fyp_flutter`, `flutter pub get`, `flutter run --dart-define-from-file=env.json`.
- `BACKEND_PORT` in `fyp-backend/.env` is the single source of truth for the dev port; keep `fyp_web/.env` and `fyp_flutter/env.json` in step. Schema changes go through Alembic only.
- Face recognition (DeepFace/ArcFace): ArcFace weights (`arcface_weights.h5`, ~137 MB) auto-download to `%USERPROFILE%\.deepface\weights\` on first use; if that fails, download them manually from the `serengil/deepface_models` v1.0 release. The old backend README stated that a missing DeepFace import makes check-in return a hard-coded `confidence_score=0.95`; that is an **old claim that conflicts with the later fail-closed design** described below and is NOT VERIFIED — check `routers/students.py` before relying on either statement.
- Flutter app icon: place a 1024×1024 PNG named `app_icon.png` in `fyp_flutter/assets/icon/` (instruction from the former icon README).
- Backend tests (kept locally, not versioned): from `fyp-backend`, `python -m pytest`. Do **not** run the `check_*` script in `tests/test_backend_fixes.py`: it writes to the configured (production) database. Web tests: start the Vite preview, then `node --test tests/*.test.mjs` in `fyp_web` (needs the declared dev dependencies and Playwright, or `PLAYWRIGHT_MODULE_DIR` / `PGLITE_TEST_MODULE_DIR`; set `BACKEND_TEST_PYTHON` if the interpreter is not `venv/Scripts/python.exe` or `venv/bin/python`). Flutter: `flutter test --no-pub` plus analysis of changed files.

### Secure check-in, paged reports and live updates
Deployment order (per note): back up DB → install updated Python 3.11 requirements (CPU PyTorch) → `alembic upgrade head` with the privileged backend role (creates challenges, report indexes, commit-time notification triggers) → set `LIVE_DATABASE_URL` (direct or session-pool URL if `DATABASE_URL` is a transaction pooler; allow one extra connection per backend process) → deploy backend, web and Flutter together; reverse proxies must forward WebSocket upgrades for `/live` → verify one consenting student's real camera check-in on a real scheduled session, including a photo/screen spoof attempt, and the approved/rejected medical workflow.

Check-in contract: `POST /sessions/{id}/checkin-challenge` with the bearer token immediately before scanning; submit `challenge_token` with the photo within 120 s. Challenges are hashed, student/session scoped, atomically claimed before inference and never reusable. Older builds without challenges are intentionally rejected — do not bypass during rollout. The server requires exactly one face, a MiniFASNet anti-spoof pass and a matching ArcFace identity; unavailable models fail closed. Client gesture success/elapsed time is not liveness evidence. This is passive image-based anti-spoofing, not gesture-video verification or camera attestation, and needs real-device spoof/false-reject evaluation before being called production-grade. `fyp-backend/Dockerfile` prefetches ArcFace and Fasnet weights at build time (the root `Dockerfile` does not).

Paged API: `/page` routes under `/students/me/feedback`, `/students/me/medical-leave`, `/admin/reports/feedback` and `/admin/reports/mc` (`page`, `per_page` 1–100, `search`, `status`, timezone-qualified `submitted_from`/`submitted_to`; admin feedback also `category`). Results: `items`, `total`, `page`, `per_page`, `stats` (student stats are overall totals; internal admin notes never appear). Date range is start-inclusive/end-exclusive UTC; stable timestamp+ID ordering with SQL limit/offset. Legacy list routes remain.

Live updates: NOTIFY after commit only; old and new owners both invalidated on reassignment; each process listens on its own connection and rechecks account status, token validity and course access; one socket per tab/dashboard authenticates with its first message (never URL credentials) and carries topic names only. Clients refresh silently, resync on reconnect, fall back to 5 s (web) / 10 s (mobile) polling, use a 60 s safety refresh when connected, and pause hidden sockets. A missing migration/listener, incompatible pooler or blocked socket falls back to polling.

Recovery reminder: per-account preference stored in browser memory/localStorage and via `PUT /auth/me/settings` (`recovery_prompt_dismissed`); failed saves retry on the next authenticated sync; students can re-enable it in Settings; admin/staff have no control; dismissal never verifies an email. Migration `d7e3a1f8b204`; direct `uvicorn` start does not migrate (Docker/Procfile do).

Historical local results (2026-10-11, NOT production evidence): 144 backend and 61 web/PostgreSQL tests passed, web build passed; MiniFASNet inference smoke-tested locally. Existing web lint findings in admin report/student MC components and existing web-tree dependency advisories were deliberately not refactored/upgraded.

### Face registration, reset and campus network verification
- Rollout: back up and `alembic upgrade head` (keep revision `e8f4b2c9d105`, which protects biometric tables with RLS and keeps legacy audit metadata); deploy backend, web and rebuilt Flutter together. Start Uvicorn with `--no-proxy-headers` (`run_backend.bat`, Procfile, `fyp-backend/Dockerfile`, or `uvicorn main:app --no-proxy-headers --host 0.0.0.0 --port 8003`) so it cannot rewrite the transport peer before the app's own verification.
- Behind a proxy: set `TRUSTED_PROXY_CIDRS` to the **actual proxy peer IPs/CIDRs only** and `TRUST_PROXY_HEADERS=true` (or the admin proxy setting); restrict direct origin access; empty ranges trust nobody, wildcard/all-Internet ranges are refused; `X-Forwarded-For` is checked right to left and the proxy must overwrite/append it.
- Admin → Network Security: configure active campus CIDRs (LAN address for a local host; campus public egress/NAT for a cloud host; `/32` or `/128` for exact egress IPs), verified with campus IT. Auto-detection is a suggestion only. SSID-only legacy rules no longer grant access.
- Keep `APP_ENV=production` and `ALLOW_INSECURE_NETWORK_DEMO=false` in deployments. Missing/unknown environments, production and staging fail closed and ignore DB demo/bypass toggles. Demos need both `APP_ENV=development` and `ALLOW_INSECURE_NETWORK_DEMO=true`.
- Startup checks the face-enrolment columns and read access before starting background jobs; a missing migration stops startup with an actionable error.
- Registration flow: an unregistered student sees required face setup (can scan, refresh status or sign out; cancelling does not skip it); the app submits the image with the status endpoint's `registration_version` (`null` for first registration); the server independently requires MiniFASNet anti-spoof and exactly one face, registers immediately, rechecks account/session/ownership/revision under a student lock, and commits registration and audit together. Students cannot replace a face. For a change, the student visits the administration office; in Admin → Students → Reset face, an administrator confirms and enters their own password. Reset clears the biometric bytes, retires legacy pending captures and saves an audit entry plus a student notification in one transaction; attendance records and original verification evidence are untouched; stale admin tabs cannot reset a newer registration. Clients recheck status on sign-in, account-change events, resume and the periodic session check; in-flight attendance also checks the face revision. Physical identity checking at the office is outside the software; the flow trusts the first authenticated live registration. No image, password, token or biometric vector appears in status responses, audit details or notifications.
- API compatibility: `POST /students/me/face` (`image_base64`, `registration_version`; `409` if already registered); `GET /students/me/face/status`; `GET /admin/students/{id}/face`; `POST /admin/students/{id}/face/reset` (admin password, `confirm_reset: true`, current revision); old `/students/me/face/challenge` and `/admin/students/{id}/face-enrolment` routes return `410`; `POST /students/me/face/verify` is an unchanged read-only diagnostic. The network precheck keeps its response shape; missing CIDRs return `configuration_required`.
- Still needed: consenting real-device capture and photo/screen spoof trials, HTTPS, and review of the campus proxy/network configuration. Not verified: office identity checks, anti-spoof accuracy, deployed campus routing, live proxy ranges.

### Account security and mobile push
- Deployment: install `requirements.txt` and run `python -m alembic upgrade head` first; set `TOTP_ENCRYPTION_KEY` (a Fernet key from `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`), back it up, share it across every instance and never regenerate it on restart (changing it makes existing authenticator credentials unreadable); deploy web/mobile with the backend. Legacy bearer tokens require a fresh sign-in; the simulated `two_factor_enabled` flag is reset.
- Behaviour: authenticator setup needs the current password and expires after 10 minutes; login verification after 5 minutes; no access token is issued before the second factor; secrets are encrypted, challenge/recovery codes hashed, recovery codes shown once, failures rate-limited; setup QR/key and codes stay in client memory only. Private tables enable RLS and revoke anon/authenticated access. Sessions: web 1 hour, mobile 24 hours; logout revokes the current server session; password change/reset, suspension and "sign out all devices" revoke older sessions; enabling 2FA ends other sessions; disabling needs password plus factor and ends all sessions; offline logout clears the UI but cannot guarantee server revocation.
- Firebase (project `fyp-tar`): Android `google-services.json` for `com.example.fyp_flutter` goes in `fyp_flutter/android/app/` (applied only if present); alternatively pass `FIREBASE_APP_ID`, `FIREBASE_API_KEY`, `FIREBASE_SENDER_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_IOS_BUNDLE_ID` at build time (public values only). iOS needs the real Firebase config, Push Notifications entitlement, background remote notifications and an APNs key uploaded to Firebase; verify the signed release's production APNs entitlement on macOS (an iOS build is not verified on Windows). No Firebase Admin SDK is used (its protobuf/httpx upgrades conflict with the face stack); the backend uses Google OAuth + FCM HTTP v1.
- Delivery: notifications enqueue one durable delivery per authorised device in the same transaction; the worker leases rows, rechecks ownership, commits before network I/O, retries with backoff; no historical backfill, no fake success when credentials are missing. Class reminders run from the server scheduler (tutorial groups and cancelled classes respected, deduplicated). Quiet hours use the saved timezone (default Asia/Kuala_Lumpur); expired reminders are cancelled; other updates expire after 24 h and reminders after 15 min. Lock-screen payloads are generic (opaque notification ID only). One push token follows the currently selected mobile portal. Delivery is at-least-once; exactly-once cannot be guaranteed.
- Required validation after real configuration: test closed-app delivery, quiet-hour deferral, opt-out, token refresh and post-logout suppression on an authorised physical phone using a deliberately authorised new reminder/approval. No live push or real approval has been created by any automated check.

### Firebase credentials on a hosted server
- Never put the backend service-account JSON in Git, the Flutter APK, frontend assets, a download URL, Docker build arguments or an image. `google-services.json` is the Android app config, **not** the backend credential. A Windows path (e.g. `C:/Users/...`) cannot work on the Linux host.
- Set on the **backend** host (not Static Web Apps, not the Flutter app): `FCM_PROJECT_ID=fyp-tar` and `GOOGLE_APPLICATION_CREDENTIALS=<absolute server path to the JSON file>` — never JSON contents or a Key Vault URL. The loader in `integrations/mobile_push.py` reads that file, checks its project ID, and uses Google OAuth.
- Azure App Service (Linux custom container — confirm your resource type; the repo's workflow targets App Service): create a private Azure Files share, upload the JSON as `fyp-tar-service-account.json`, add a Path mapping (Azure Storage Mount, e.g. name `firebasecredentials`, mount `/mnt/firebase`), set the two app settings, restart, and verify the non-root app user can read the file. Protect the storage key (Key Vault reference). Azure Files has separate charges.
- Azure Container Apps alternative: store the JSON as a Key Vault secret, grant the app's managed identity Key Vault Secrets User, add a secret reference, mount a Secret volume at `/mnt/firebase` and point `GOOGLE_APPLICATION_CREDENTIALS` at the mounted filename.
- App Service Key Vault references return secret *values* as settings, not files. `FIREBASE_SERVICE_ACCOUNT_JSON` is **not implemented**; it would need new loader code (keeping the file-path fallback) first.
- Check the real server (not your Windows machine) from the backend container as the app user: load the file, require an absolute path, `type == service_account`, `project_id == FCM_PROJECT_ID == fyp-tar`, build credentials with scope `https://www.googleapis.com/auth/firebase.messaging`, refresh with a 15 s timeout, print only PASS/FAIL and the exception type — never the key, token or environment. This proves OAuth only, not FCM permission or phone delivery.
- Also confirm: FCM HTTP v1 API enabled for `fyp-tar`; a dedicated, narrowly authorised service account; outbound HTTPS to `oauth2.googleapis.com` and `fcm.googleapis.com`; updated backend and migrations deployed (frontend-only is insufficient); an always-running worker (no scale-to-zero); phone permission, notification preferences and quiet hours.
- Troubleshooting: "push not configured" = a variable missing; file not found = mount/filename; permission denied = mount permissions for the app user; project/JSON failure = wrong or unresolved credential; Google auth failure = revoked key, network or server clock; FCM rejects = API/IAM/token-project mismatch; silent phone = worker, session authorisation, phone permission, preferences or quiet hours. Key rotation: provision the replacement, update the file/secret, restart every instance, validate, then revoke the old key; if exposed, treat as compromised and revoke promptly (deleting a local copy is not revocation).

### Semester calendar and credit limits
- Back up the database, deploy backend, web and mobile together, run `venv\Scripts\python.exe -m alembic upgrade head` from `fyp-backend` (revision `d8569cd9629c`; Docker/Procfile already migrate; direct `uvicorn` does not and the readiness check reports a missing semester schema). Never stamp past this migration. The backend DB role needs access; public `anon`/`authenticated` clients must not.
- Admin setup: Academic Manager → Semesters → choose programme, name, start date, inclusive end date and maximum credits per student (e.g. 18), select courses (positive credits; existing allocations must already fit the cap). In Student Allocation, allocate the programme first, then its courses. The cap counts distinct enrolled courses (not tutorial groups) and is enforced by the backend; semesters in a programme cannot overlap.
- Dates are Asia/Kuala_Lumpur calendar dates, independent of browser/container timezone; the end date includes the whole day. Outside the dates classes are not materialised, reminders not generated, opening/check-in and out-of-range replacement classes refused; after expiry new allocations are refused (before start they are allowed); open classes still close at their scheduled end; history is retained. Edits that would exclude an open class are rejected. Legacy unassigned courses keep weekly behaviour with no expiry; assigned courses cannot be detached; programmes with semesters cannot be deleted. One course record per offering — create a distinct course for another semester; no repeat-course/catalogue versioning.
- Web calendar requests are not cached; semester commits trigger row-less timetable invalidations. If calendar loading fails, the timetable uses the device clock in Malaysia time until reachable.
- Verify on the hosted backend: `/auth/server-time` returns current UTC with `Z`, uncached; authenticated `/academic-calendar` returns `Asia/Kuala_Lumpur` and only that role's courses; check admin/student/staff dates, Today/navigation, boundaries, credit-limit rejection and a real mobile refresh. Hosts must keep their clocks synchronised. Rebuild/reinstall the mobile app.

### Notification inbox
- Deploy backend and web together and restart; no migration (existing `user_notifications` table). Environments missing earlier migrations still need `alembic upgrade head`.
- Behaviour: a shared bell on every authenticated page; the badge counts all unread notices for the account (`99+` above 99; the accessible label has the exact count); opening the bell marks displayed notices read, older ones stay unread until opened via cursor-paged "Older notices" or their page; clicking a sidebar destination clears that page's known notices (later arrivals stay unread; cancelled unsaved-form navigation clears nothing); Reports aggregates Feedback and Medical Leave indicators separately. Indicators measure unread messages, not unresolved requests; reading never approves/rejects anything. Read state saves to the backend and is shared with mobile; failed saves restore authoritative counts with a retry message. In-app preference opt-out hides web inbox/badges without deleting history. Reduced motion stops breathing rings.
- Destinations: admin — new feedback → Reports → Feedback Reports; new medical leave → Reports → Medical Leave; attendance requests/unresolved reviews → Attendance. Staff (incl. tutors) — requests for assigned courses → Attendance. Student — feedback status/response → Contact Admin; medical decision → Medical Leave; attendance-correction decision → Dashboard. All — timetable/cancellation/replacement updates → timetable. Student/staff — published announcements and class reminders → dashboard.
- Historical feedback/leave rows with no existing notice are not retroactively made unread; repeated no-change saves do not duplicate; internal notes and uploaded medical documents never appear in notification bodies.
- Not verified: production deployment, real multi-device read sync and reconnection (need a deployment smoke test).

### Attendance audit times
- **Class Start/End** are the stored scheduled times of that session and group (not the current weekly timetable); **Opened/Closed** are the actual window events (a never-opened class has none); **Recorded At** is the stored marking time — server check-in time for face check-in, server edit time for manual edits, the campus end-of-class-day finalisation time for automatic absences — not a departure time. APIs return UTC `Z`; the admin audit shows year/date/time in Asia/Kuala_Lumpur. Legacy offset-less values are read as UTC; missing history is not backfilled.
- Status: scheduled, cancelled and needs-review sessions are labelled separately; a student without a record is **Unrecorded**, not absent; only an existing absent record counts as absent. Saved attendance stays visible after a group/allocation change; unrelated members are not added. Existing automatic absence generation, calculations and medical-leave rules are unchanged.
- Manual edits write before/after status, timestamps, method, verification flags and prior evidence to the existing Audit Logs in the same transaction ("Attendance record updated" in Audit Logs → Details; structured timestamps stay UTC). It does not recover previously overwritten times, add a required override reason or notify students. No migration. Deploy backend and web together; tests used isolated records and did not verify an Azure deployment.

### Web animation policy
- Motion (`motion/react`) is the default for state-driven React interactions; Anime.js is not installed and should not be added to duplicate Motion. `package.json` declares Motion `^13.1.1` (lock `13.1.1`; one machine reported `13.1.0` — reconcile through the normal dependency workflow). Simple hover/focus colour changes stay in CSS.
- Shipped policy (2026-10-11): floating panels disable CSS transitions so `left/top/width/height` are never eased; the shared entrance is opacity-only; resize observations coalesce to one frame; `FloatingPanel` owns menu animation (`animateEntrance={false}` for calendars); `src/utils/uiMotion.ts` uses Motion's mini API for short opacity-only menu/page entrances; shared CSS tokens define control/dialog timing and reduced-motion fallbacks; `main.tsx` supplies Motion's reduced-motion preference. Menus close immediately, navigation never waits for animation, data refreshes do not replay entrances, and the Course Notices calendar opens instantly by explicit request. Do not add a second entrance engine or let CSS, Motion and Anime.js control the same property. Regression coverage: `tests/accountPages.browser.test.mjs` (local).
- Guidance for future work: Motion durations are seconds, Anime.js milliseconds; target 120–180 ms micro-interactions and 180–240 ms panel transitions with little bounce; prefer transform/opacity; keep `FloatingPanel`/`ModalLayer` portals, focus restoration and Escape handling; animation must never gate POST/GET or imply success; test rapid reversal, swipe vs vertical scroll, failed requests, keyboard focus, short viewports and unmount cleanup; frame-rate claims need profiling. Research on 2026-10-11 was not authorisation to upgrade dependencies or add animation.

### AI chat workspace (from the former `fyp_web/README.md`)
- **New chat** creates a separate saved conversation; existing chats stay under server-paginated **Saved chats**. **Temporary chat** keeps messages only in the open assistant's memory — never in browser storage, chat tables or semantic memory — and closing the tab, leaving the assistant, refreshing or signing out clears them. Temporary requests use the dedicated `/query/temporary` endpoint, so deploy/restart the backend with the web update (an older backend fails safely instead of saving them). No migration, but the existing AI history/context migrations must already be applied. Temporary mode does not control an external AI provider's retention; recent temporary messages may still be processed by the provider.
- Signing out notifies other same-origin windows of the same account (BroadcastChannel browsers); other accounts are unaffected. Suggestions use authorised database-resolved names and topics/frequency from currently open chats, not guessed names or extra AI requests.

### Academic report editing notes (from the former `output/report` file, review dated 2026-09-25)
These concern the Word/PDF report, not runtime features, and apply only to the supplied 101-page PDF.
- Submission order: official cover → inner title page → declaration → abstract → acknowledgement → regenerated table of contents → Chapters 1–4 (with dividers) → completed references → relevant appendices. Omit unfinished Chapter 5–7 placeholders from a Chapters 1–4 submission unless the lecturer requires them; do not invent an approval page or signature.
- A replacement abstract (under the 300-word limit, no measured results) was drafted describing the frontend design for a face-verification, liveness, campus-network and risk-monitoring attendance system built with Flutter/Dart and React/TypeScript against separately developed REST backend services.
- Corrections to make before submission: fill the "Choose an item." award/programme; replace the "Project Title" header; make the course code consistent (BMCS3403 vs BMCS3413 vs BACS3413); write an original acknowledgement; align Objective 3 with the frontend/API-integration scope (the backend is described as another developer's); reconcile Agile (Ch.1) with iterative-incremental (Ch.3); reconcile Railway (3.2.3) with Azure (4.7); update stale milestone statuses; standardise table captions and cross-references; separate attendance-percentage rules from any trained predictive model and claim no accuracy without evidence; replace absolute security claims with bounded ones; treat the <15 s check-in, <2 s load and 30 FPS figures as requirements, not results; check Chapter 3 requirements cover the features shown in Chapter 4; add short explanations to the diagram-heavy design chapter; replace the template references page with full entries.
- Use the editable Word/Google document with consistent heading levels; regenerate the whole table of contents after edits and do not reuse the old page numbers.

---

## Outcomes of the TASK-20261029-01 cleanup

Historical record of the cleanup work and its review. This changelog is not itself a new independent review.

- **Initial cleanup (Claude, 2026-10-29):** untracked 14 test index entries, kept all local tests (SHA-256 identical before/after), drafted this file, ran the read-only backend check recorded below.
- **Independent review (assessment NEEDS FIX):** confirmed ISSUE-01 (P2), ISSUE-02 (P2), ISSUE-03 (P3). Static review only: application suites, iOS builds, live production/database checks and the original preflight hash snapshots were not available to the reviewer; the 4-character staff password minimum was noted as a separate release decision.
- **ISSUE-01 — FIXED:** `.gitignore` now also ignores `__tests__/`, `integration_test/`, `test_*.py`, `*_test.py`, `*_test.dart`, `*.test.{js,ts,jsx,tsx,mjs,cjs}` and the `*.spec.*` equivalents. No tracked or unignored file matched these patterns before they were added. `git check-ignore -v --no-index` now matches the four reviewer paths (`fyp_web/src/example.test.ts`, `fyp_flutter/integration_test/example_test.dart`, `fyp-backend/test_example.py`, `fyp_web/__tests__/example.ts`); application files such as `fyp_web/src/services/api.ts`, `fyp-backend/main.py` and `fyp_flutter/lib/main.dart` remain visible.
- **ISSUE-02 — BLOCKED on approval (AC-01 is FAIL, not PASS):** `fyp_flutter/ios/RunnerTests/RunnerTests.swift` is the untouched Flutter template XCTest (an empty `testExample`) — test-only source, not production code — but it is still tracked. It is wired into the native project: `ios/Runner.xcodeproj/project.pbxproj` (build file, file reference, group, `RunnerTests` native target with 3 build configurations, and the `.xctest` product) and the shared scheme `Runner.xcscheme` (testable reference to `RunnerTests.xctest`). Merely untracking the file would leave a dangling reference in the committed project and break the `RunnerTests` target on a fresh clone. Smallest safe resolution, which **needs explicit approval because it edits protected native project configuration**: remove the `RunnerTests` target, its three build configurations, the file/group/product references and the scheme's testable entry from those two files, then `git rm --cached` the Swift file. Affected behaviour: the empty iOS unit-test target disappears; the app target is unchanged; verification needs Xcode on macOS (not available on this Windows host). Rollback: revert only the target edit (`project.pbxproj` already carries 3 unrelated uncommitted lines for push entitlements, so do not use a blanket `git checkout` of that file) and restore the file's index entry. Until approved, the native configuration and the tracked test file are untouched.
- **ISSUE-03 — FIXED (wording):** the evidence is that a GitHub Actions "Azure Backend Deploy" run for `aa47e22` concluded successfully, i.e. that run built an image from `aa47e22` and requested a deployment. Which image is currently configured and running on the hosting resource was **not** read and remains unverified. The migration-mismatch explanation below stays conditional.

### Backend 503 investigation (read-only, 2026-10-29 ~16:53 MYT)
- Observed: `https://smartsystem.live` returned HTTP 200; `https://api.smartsystem.live/health` and `https://fyp-backend-azure.azurewebsites.net/health` returned HTTP 503 (Azure error page) from the same IP, so the failure is at the App Service rather than DNS or the custom domain. The deployed web bundle embeds `https://api.smartsystem.live` as its API base and contains no localhost URL.
- A successful "Azure Backend Deploy" run (created 2026-10-27 19:59 UTC) for `aa47e22` built from the root `Dockerfile`. The committed Alembic head in `aa47e22` is `f4a8b0c3d206`; revisions `a6b9d2e4f307`, `c5cc61db6fff`, `d7e3a1f8b204`, `e8f4b2c9d105`, `c2aeddcb9bf6`, `d8569cd9629c` exist only as untracked local files, so an image built from that commit does not contain them. **Whether that image is the one currently running is NOT VERIFIED.**
- Conditional hypothesis (NOT confirmed): if the running image is built from `aa47e22` and the production database was advanced by those locally applied migrations, `alembic upgrade head` at container start would fail with an unknown-revision error, Uvicorn would never start, and App Service would return 503. Other candidates remain open: import/dependency failure, missing settings or secrets, port or startup timeout, resource limits, unreachable database.
- Not read (UNKNOWN): container/startup logs, App Service settings, the running image digest, resource state, the production `alembic_version`. CORS cannot be assessed until `/health` responds. Needed: Log stream or `LogFiles/*docker.log`, Deployment Center image tag, setting names, and `SELECT version_num FROM alembic_version`, by someone with Azure/database access.
- Proposed (not applied; needs authorisation): confirm from logs first; if confirmed, deploy code containing the missing migrations together with the code that needs them (after review) rather than stamping or downgrading production without a backup; separately align the root `Dockerfile` with `fyp-backend/Dockerfile` (Fasnet prefetch, `--no-proxy-headers`). The root `Dockerfile` drift is verified but is not an established cause.

### Open items
- ISSUE-02 approval decision (above).
- Staff password minimum of 4 characters (`schemas.py`): decide before release.
- Local ignored `docs/` folder (about 30 Markdown files of older architecture, API, ML and Azure documentation): whether to consolidate and delete it is pending the owner's decision; it is already excluded from Git.
- Nothing has been committed or pushed. Staged test and Markdown deletions, `.gitignore`, this file and all other uncommitted work await a later manual commit and push by the repository owner. Old commits and GitHub still hold the previously tracked tests and Markdown files.

---

---

## Git inventory

Captured 2026-10-29 from `git status --porcelain=v1 --untracked-files=all` after the test untracking, the Markdown consolidation and the move of the workflow documents, and before this file was last saved. It excludes `CHANGELOG.md` itself. Ignored files (local tests, `review-workflow/`, `docs/`, caches) are not listed. Staged `D` entries (tests and Markdown) are expected until a later manual commit; `CHANGELOG.md` shows as untracked until then.

### Staged (index vs HEAD) (18)

```text
D README.md
D fyp-backend/README.md
D fyp-backend/pytest.ini
D fyp-backend/tests/test_admin_audit_coverage.py
D fyp-backend/tests/test_audit_client_ip.py
D fyp-backend/tests/test_backend_fixes.py
D fyp-backend/tests/test_class_lifecycle.py
D fyp-backend/tests/test_class_lifecycle_scheduler.py
D fyp-backend/tests/test_llm_security.py
D fyp-backend/tests/test_manual_session_policy.py
D fyp-backend/tests/test_medical_leave.py
D fyp-backend/tests/test_recovery_email_unique.py
D fyp-backend/tests/test_session_sync_throttle.py
D fyp_flutter/README.md
D fyp_flutter/assets/icon/README.md
D fyp_flutter/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md
D fyp_flutter/test/app_config_test.dart
D fyp_web/README.md
```

### Unstaged (working tree vs index; `M` modified, `D` deleted) (80)

```text
M .gitignore
M fyp-backend/.env.example
M fyp-backend/Dockerfile
M fyp-backend/Procfile
M fyp-backend/db/database.py
M fyp-backend/db/models.py
M fyp-backend/domain/audit.py
M fyp-backend/domain/scheduler.py
M fyp-backend/domain/security_settings.py
M fyp-backend/domain/session_sync.py
M fyp-backend/integrations/feedback_files.py
M fyp-backend/integrations/medical_leave.py
M fyp-backend/integrations/network_verify.py
M fyp-backend/main.py
M fyp-backend/requirements.txt
M fyp-backend/routers/admin_academic.py
M fyp-backend/routers/admin_attendance.py
M fyp-backend/routers/admin_config.py
M fyp-backend/routers/admin_reports.py
M fyp-backend/routers/analytics.py
M fyp-backend/routers/attendance_features.py
M fyp-backend/routers/auth.py
M fyp-backend/routers/lecturers.py
M fyp-backend/routers/llm.py
M fyp-backend/routers/medical_leave.py
M fyp-backend/routers/sessions.py
M fyp-backend/routers/students.py
M fyp-backend/run_backend.bat
M fyp-backend/schemas.py
M fyp-backend/utils/security.py
M fyp_flutter/android/app/build.gradle.kts
M fyp_flutter/android/app/src/main/AndroidManifest.xml
M fyp_flutter/android/settings.gradle.kts
M fyp_flutter/ios/Runner.xcodeproj/project.pbxproj
M fyp_flutter/ios/Runner/Info.plist
M fyp_flutter/lib/main.dart
M fyp_flutter/lib/screens/staff/staff_dashboard_screen.dart
M fyp_flutter/lib/screens/student/face_scanner_screen.dart
M fyp_flutter/lib/screens/student/full_timetable_screen.dart
M fyp_flutter/lib/screens/student/student_dashboard_screen.dart
M fyp_flutter/lib/screens/system/home_screen.dart
M fyp_flutter/lib/screens/system/profile_screen.dart
M fyp_flutter/lib/screens/system/settings_screen.dart
M fyp_flutter/lib/services/user_service.dart
M fyp_flutter/pubspec.lock
M fyp_flutter/pubspec.yaml
M fyp_web/package-lock.json
M fyp_web/package.json
M fyp_web/src/App.tsx
M fyp_web/src/components/CustomDropdown.tsx
M fyp_web/src/components/MainLayout.tsx
M fyp_web/src/components/Shimmer.tsx
D fyp_web/src/components/UserProfileModal.tsx
D fyp_web/src/components/UserSettingsModal.tsx
M fyp_web/src/context/AuthContext.tsx
M fyp_web/src/context/DialogContext.tsx
M fyp_web/src/i18n/i18n.ts
M fyp_web/src/index.css
M fyp_web/src/main.tsx
M fyp_web/src/pages/admin/AcademicManager.tsx
M fyp_web/src/pages/admin/AdminPanel.tsx
M fyp_web/src/pages/admin/AnnouncementManager.tsx
M fyp_web/src/pages/admin/AttendanceManager.tsx
M fyp_web/src/pages/admin/AuditManager.tsx
M fyp_web/src/pages/admin/CampusNetworkManager.tsx
M fyp_web/src/pages/admin/ReportsManager.tsx
M fyp_web/src/pages/admin/StaffManager.tsx
M fyp_web/src/pages/admin/StudentsManager.tsx
M fyp_web/src/pages/security/Login.tsx
M fyp_web/src/pages/staff/Analytics.tsx
M fyp_web/src/pages/staff/AtRisk.tsx
M fyp_web/src/pages/staff/Attendance.tsx
M fyp_web/src/pages/staff/Chatbot.tsx
M fyp_web/src/pages/staff/CourseAnnouncements.tsx
M fyp_web/src/pages/staff/LecturerDashboard.tsx
M fyp_web/src/pages/staff/Timetable.tsx
M fyp_web/src/pages/student/StudentContact.tsx
M fyp_web/src/pages/student/StudentDashboard.tsx
M fyp_web/src/pages/student/StudentMC.tsx
M fyp_web/src/services/api.ts
```

### Untracked (60)

```text
fyp-backend/alembic/versions/a6b9d2e4f307_protect_student_feedback.py
fyp-backend/alembic/versions/c2aeddcb9bf6_enforced_mfa_sessions_and_mobile_push.py
fyp-backend/alembic/versions/c5cc61db6fff_secure_checkin_and_live_invalidations.py
fyp-backend/alembic/versions/d7e3a1f8b204_recovery_reminder_preference.py
fyp-backend/alembic/versions/d8569cd9629c_academic_semester_calendar_and_student_.py
fyp-backend/alembic/versions/e8f4b2c9d105_supervised_face_enrolment.py
fyp-backend/domain/account_security.py
fyp-backend/domain/attendance_audit.py
fyp-backend/domain/checkin_challenge.py
fyp-backend/domain/live_updates.py
fyp-backend/domain/notification_inbox.py
fyp-backend/domain/record_pages.py
fyp-backend/domain/semesters.py
fyp-backend/integrations/live_face.py
fyp-backend/integrations/mobile_push.py
fyp-backend/integrations/private_storage.py
fyp-backend/routers/academic_calendar.py
fyp-backend/routers/account_security.py
fyp-backend/routers/face_enrolment.py
fyp-backend/routers/live_updates.py
fyp_flutter/ios/Runner/Runner.entitlements
fyp_flutter/lib/screens/student/face_registration_required.dart
fyp_flutter/lib/screens/system/account_security_card.dart
fyp_flutter/lib/screens/system/notifications_screen.dart
fyp_flutter/lib/services/academic_calendar.dart
fyp_flutter/lib/services/account_security.dart
fyp_flutter/lib/services/live_updates.dart
fyp_flutter/lib/services/mobile_push.dart
fyp_web/src/components/AccountSecurityPanel.tsx
fyp_web/src/components/ChatWorkspace.tsx
fyp_web/src/components/FaceResetDialog.tsx
fyp_web/src/components/FloatingPanel.tsx
fyp_web/src/components/LimitedTextField.tsx
fyp_web/src/components/ModalLayer.tsx
fyp_web/src/components/NotificationBell.tsx
fyp_web/src/components/PushQuietHours.tsx
fyp_web/src/components/RecordPagination.tsx
fyp_web/src/components/RecordsStatus.tsx
fyp_web/src/components/SemestersPanel.tsx
fyp_web/src/components/SubmissionDateTimePicker.tsx
fyp_web/src/components/SubmissionTime.tsx
fyp_web/src/components/UserProfilePage.tsx
fyp_web/src/components/UserSettingsPage.tsx
fyp_web/src/hooks/useAccountProfile.ts
fyp_web/src/hooks/useDebouncedSearch.ts
fyp_web/src/hooks/useLiveRefresh.ts
fyp_web/src/hooks/useLiveResource.ts
fyp_web/src/hooks/useNotificationInbox.ts
fyp_web/src/services/liveUpdates.ts
fyp_web/src/services/notificationInbox.ts
fyp_web/src/utils/accountLogout.ts
fyp_web/src/utils/accountRole.ts
fyp_web/src/utils/apiError.ts
fyp_web/src/utils/attendanceTime.ts
fyp_web/src/utils/campusCalendar.ts
fyp_web/src/utils/chatSuggestions.ts
fyp_web/src/utils/recoveryReminder.ts
fyp_web/src/utils/secondFactor.ts
fyp_web/src/utils/submissionTime.ts
fyp_web/src/utils/uiMotion.ts
```

