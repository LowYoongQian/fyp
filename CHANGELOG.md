# Changelog

## Release readiness checks — 2026-11-09 06:09 MYT
- The production web build passed with existing dependencies. A clean npm install rejected five registry mirror entries. Backend tests passed 543 with 22 skipped, all 17 semester browser checks passed, and Flutter analysis and the Android release build passed.
- The live site and API health responded with HTTP 200. Password reset requires the new backend before the new frontend can send school email alone. The feedback migration generated SQL locally. Azure deployment and execution of the migration remain unverified.
- The release candidate still includes an iOS test source, public walkthrough screenshots with sample data and a manually run seed utility. The review records each separately.

## Web settings: theme preview fills the banner — 2026-11-08 17:29
- The preview no longer bunches at the right: sun or moon and clouds in the middle, a larger mini app window at the right, the badge under the words.
- System shows a light app on its light side and a dark app on its dark side; Day/Night shows the app as it looks right now.
- On phone widths the app windows are hidden so the words have room.
- Checks (self-reported): tsc clean; rendered in Chrome with intercepted APIs at desktop and 420 px widths, no page errors. ChatGPT review pending.


## Web settings: theme mode preview — 2026-11-08 17:19
- A preview banner under Theme Mode: a day scene for Light, a night scene for Dark, both split for System (with whether the device is light or dark now), and the live campus sky for Day/Night with when it next turns.
- It cross-fades between choices (instant with reduced motion).
- Checks (self-reported): tsc clean; rendered in Chrome with intercepted APIs in light and dark, no page errors. ChatGPT review pending.


## Academics: delete semesters, ongoing-semester rule, edit in a dialog — 2026-11-08 16:49
- Admins can delete a semester, an ongoing one included (not while a class is open for check-in). Its courses keep their students, classes and attendance and simply leave the semester.
- A course or programme cannot be deleted while its semester is ongoing; delete the semester first. A programme's upcoming and ended semesters are removed with it.
- Editing a semester opens a dialog; the page form always creates a new semester.
- Checks (self-reported): backend pytest 543 passed / 22 skipped; web tsc clean; semester browser tests 17/17 on intercepted APIs. Academic-calendar browser test and a visual check not done. ChatGPT review pending.


## Face check-in: smaller countdown chip — 2026-11-08 02:30
- The challenge countdown chip (ring, number, label) is about 20% smaller; timing colours unchanged.
- Checks (self-reported): flutter analyze clean, flutter test 51/51; rendered offscreen in light and dark. Not checked on a real phone. ChatGPT review pending.


## Face check-in: gesture cue under the status chip, web blue — 2026-11-08 02:28
- The Blink and Nod cues sit just under the status chip (12 px gap); turn arrows stay beside the face.
- All cues use the web button colour (#2563eb) with a white icon.
- Checks (self-reported): flutter analyze clean, flutter test 51/51; rendered offscreen in light and dark. Not checked on a real phone. ChatGPT review pending.


## Face check-in: web-blue button, countdown colours, green progress, animated cues and result icons — 2026-11-08 02:22
- Main scan button uses the web's primary blue (#2563eb).
- Challenge countdown turns green (4 s), yellow (3-2 s), red (1-0 s); progress bar is green with a small percentage above it.
- Smaller gesture cue: the eye blinks, arrows glide the way to move; the Nod cue now sits above the face so it is not hidden.
- Success and failure dialogs: the icon pops in with a spark burst and breathing waves, then settles (still with reduced motion).
- Checks (self-reported): flutter analyze clean, flutter test 51/51; rendered offscreen in light and dark. Not checked on a real phone. ChatGPT review pending.


## Face check-in: accuracy, smooth tracking, colour states, result dialogs — 2026-11-08 02:07
- A face locks only when truly frontal for several frames (angles plus eye and nose positions), so a side view never counts; the final photo waits for a frontal face.
- The tracking frame moves smoothly every frame; grey/white while searching, green/lime for a frontal face, red/pink for a side view.
- Docked bottom panel; green ticks on Even light, Look forward and Hold steady once met; red/white LIVE pill; green locked chip.
- Success dialog is green; failed check-ins show a red dialog with the reason and Try again (reopens the scan).
- Checks (self-reported): flutter analyze clean, flutter test 51/51; flow rendered offscreen with a fake camera. Not checked on a real phone. ChatGPT review pending.


## Font Size setting works — 2026-11-07 21:37
- Small / Medium / Large in Settings now resize the text on every screen (same steps as the web), on top of the phone's own text size.
- Side effect: lib/main.dart was re-wrapped by the code formatter (layout only; behaviour unchanged).
- Checks (self-reported): flutter analyze clean, flutter test 48/48. Not checked on a real phone. ChatGPT review pending.


## Staff login no longer locked after a student sign-in — 2026-11-07 21:12
- Each login page is busy only during its own sign-in; the signed-in student's background refresh no longer disables the staff login (and the reverse).
- Checks (self-reported): flutter analyze clean, flutter test 46/46. Not checked on a real phone. ChatGPT review pending.


## Staff notification center, sign-in shimmer for both portals — 2026-11-07 21:01
- Staff Notification Center redesigned in the app's blue and greys: summary tiles, categories for staff notifications (All, Unread, Classes, Requests, Notices), the same date and time filter as students, day headings, swipe or tap to mark read, one-request Mark all read, restyled attendance requests.
- Fixed: marking a notice read could crash on numeric ids; the loading skeleton was white in dark mode.
- Staff login and the Home Staff Portal tile use the app blue.
- Signing in shows that portal's own loading skeleton even when the other portal is already signed in (it showed only a button spinner); new staff skeleton.
- Checks (self-reported): flutter analyze clean, flutter test 46/46; screens rendered offscreen. Not checked on a real phone. ChatGPT review pending.


## Timetable week picker: semester weeks only — 2026-11-07 20:50
- The week picker shows only the weeks of the assigned semester (e.g. 5 weeks for a 5-week semester); the arrows stop at its first and last week.
- With no semester dates it shows an icon, "No semester dates yet" and "No available timetable" instead of made-up weeks.
- Checks (self-reported): flutter analyze clean, flutter test 45/45; both cases rendered offscreen. Not checked on a real phone. ChatGPT review pending.


## Theme previews, whole app in the chosen language — 2026-11-07 20:43
- Theme Mode is plain buttons again, with a preview banner for the chosen mode (Light, Dark, System); Day/Night keeps its live sky card.
- Choosing a language now translates the whole mobile app, Settings included, at once and in place: about 580 texts go through one translator, with Malay, Chinese, Tamil, Japanese, Korean, Spanish, French, German and Arabic (709 phrases each). Date pickers and dialog buttons follow too; dates use each language's order.
- Server content (announcements, notifications, course names, server messages) stays as written. Translations are not yet reviewed by native speakers.
- Checks (self-reported): flutter analyze clean, flutter test 45/45; key screens rendered in six languages with no layout overflow. Not checked on a real phone. ChatGPT review pending.


## Theme picture cards, full-page announcement, timetable weeks — 2026-11-07 20:04
- Theme Mode choices are picture cards (light, dark, live sky for Day/Night, split for System) with a check on the chosen one.
- Announcement detail is a full page: the picture runs edge to edge and folds into the bar on scroll.
- Timetable: the week button now always opens (it did nothing without semester dates); new week bar with previous/next and Today, today's dot, real semester subtitle, dark-mode colours.
- Fixed: closing a page with the new pull-to-refresh that had never been pulled raised an error.
- Checks (self-reported): flutter analyze clean, flutter test 42/42; screens rendered offscreen (output/timetable). Not checked on a real phone. ChatGPT review pending.


## Day/Night theme mode and logo pull-to-refresh — 2026-11-07 19:25
- New Day/Night theme mode (mobile and web): light by day, dark at night by campus time, turning when the web sign-in sky does (about 04:58 and 20:01). On mobile the background becomes the same moving sky (sun, moon, stars, dusk and dawn colours) and Settings shows a live sky card with the next turn.
- Theme changes cross-fade smoothly without the earlier lag; reduced motion switches at once.
- Backend accepts only light, dark, system or cycle as the theme.
- Every mobile pull-to-refresh now reveals the app emblem filling with colour, with a haptic tap at the release point and a light sweep while loading (from the colab project's style).
- Checks (self-reported): flutter analyze clean, flutter test 39/39; web type check passes; backend 541 passed, 22 skipped (one earlier run had one failure that did not repeat). Not checked on a real phone. ChatGPT review pending.


## Staff card, theme buttons, announcements, notice pop-ups — 2026-11-07 19:03
- Staff dashboard: a plain card with photo, greeting, role, staff ID and three quiet counts instead of the gradient banner; person icon in the header again.
- Settings: the theme buttons now always match the app after a quick switch, close and reopen; saves reach the server in the order tapped.
- Home: "Announcements" with Show More; the newest three as cards that open a detail page; a full list five per page with page numbers (also from the News tile).
- Student notice pop-up shows once per sign-in instead of on every Home / Student / Staff switch.
- Checks (self-reported): flutter analyze clean, flutter test 35/35; screens rendered offscreen (output/staff). Not checked on a real phone. ChatGPT review pending.


## Settings 2FA, sync log, staff dashboard, profile photos, theme switch — 2026-11-07 18:38
- General Settings no longer shows 2FA and devices when signed in; they stay on My Profile.
- Backend: when the database cannot be reached, the class sync logs one warning line instead of two full tracebacks a minute.
- Profile photos: mobile now shows photos the web saved as embedded images; the web now uploads picked photos to storage like the mobile (one https link for both); the backend refuses non-web photo links.
- Staff dashboard: web blue instead of maroon, photo in the header, gradient banner with greeting and today's counts, clearer class cards with status pills, bigger small text, header overflow fixed.
- Theme switch is instant: the theme was blended twice and every card re-blurred the moving sky on each frame.
- Checks (self-reported): backend 540 passed, 22 skipped; flutter analyze clean, flutter test 31/31; web type check passes; staff screens rendered offscreen (output/staff). Not checked on a real phone or Azure. ChatGPT review pending.
- For Azure: use Supabase's pooler address for DATABASE_URL; the direct host is IPv6 only.


## Mobile student app: recovery email, splash, notices, attendance tab, notifications, profile — 2026-11-07 16:10
- Recovery email pop-up redesigned (steps, styled field, clear errors, no double sending, resend and change email). Same rules and server calls.
- Splash title now blends blue, cyan, purple and dark purple with a white shine (white also stays in the middle in dark mode); the green is gone.
- Student dashboard shows only programme and course notices; general announcements stay on Home. Fixed a notice title that was unreadable in dark mode.
- Attendance tab: one sentence tells the student what to do next; cleaner no-class state and unavailable button.
- Notifications: All / Updates / Today / Classes chips and a date and time filter at the top right, with day headings.
- Profile: gradient banner header and a redesigned account security card. Background: no birds, smaller sun, solid content cards.
- Fixed: dark-mode text on blue buttons was navy (now white); an unread notification row overflowed on narrow phones.
- Checks (self-reported): flutter analyze clean, flutter test 30/30; screens rendered offscreen in light and dark (output/mobile-student). Not checked on a real phone. ChatGPT review pending.
- Noted, not changed: GET /public/announcements is open to anyone and returns course, programme and staff-only notices too.


## Mobile app: grey dark theme, day and night sky, new splash — 2026-11-07 15:36
- Dark theme now uses the web's dark greys (#181818 page, #222222 cards, #2d2d2d raised, #333333 borders) instead of dark blue: the theme's own surfaces and 129 hard-coded dark-mode colours. Light mode is unchanged.
- New background: by day a sun, drifting clouds and birds; by night a crescent moon, twinkling and sparkling stars, two constellations, three planets and shooting stars; low hills with a few trees in both. Still with reduced motion.
- Splash: the logo grows in, "Smart Attendance System" appears in one gradient across its words (blue, sky, emerald from the web theme), and it closes by itself; the Continue button is gone.
- Checks (self-reported): flutter analyze clean, flutter test 25/25; offscreen pictures in output/mobile-theme. Not checked on a real phone or emulator. ChatGPT review pending.


## Opaque sign-in and sign-out covers — 2026-11-07 14:52
- The "Signing in…" and "Signing out…" screens no longer let the page behind them show through. They were 94 % white with a blur, so the sign-in page (after sign-out) or the dashboard (after sign-in) showed as a blurry ghost; they are now fully opaque, and when the server has answered they fade away to reveal the finished page. After sign-out the screen is there at once instead of fading in (what is behind it is already the next page).
- A "Signing in…" cover and an inert form behind it were already in AuthContext when this started (not added in this turn). Seven older sign-in tests and the 2FA "too many attempts" test described the previous look (form visible under a grey button, a card-sized veil) and used queries that cannot see inside an inert area; they were updated to the cover while keeping what they guard (one request, values kept, error shown, retry works, nothing protected shown early). The app's own behaviour was traced and is correct (field locked under the cover, unlocked after).
- Checks (self-reported, isolated fixtures only): type check and build pass; ESLint 155 (unchanged); new pixel tests for the sign-in cover (light and dark) and the sign-out cover pass and fail on the old style; browser suite 525 tests, 524 passed, 0 failed, 1 pre-existing skip (four files at a time). Not checked: a real device, a screen reader, the hosted site. ChatGPT review pending.


## Bell reminder, recovery buttons, sign-out, 2FA page, reset page, pet caret, chat thinking bar — 2026-11-04 00:00
- Notifications: while unread notices remain the bell gives a small shake and its red badge a soft ripple every 10 s; it pauses while the tab is hidden, stops at zero and stays still with reduced motion. A new notice still rings the bell as before.
- Settings: Copy codes and I have saved my codes have a 12 px gap and equal heights, side by side or stacked on phones.
- Sign-out: shows "Signing out…" until the server answers, then "Signed out" and fades onto the sign-in page; if the server cannot be reached it says "Signed out on this device". Fixed: the menu's sign-out had never actually asked the server to end the session.
- Two-factor sign-in has its own page (/login/verify) with six code cells: paste, autofill, editing and leading zeroes work, six digits submit once, a wrong code stays editable and is not resent on its own, recovery codes have their own mode, and refresh or Back starts sign-in again. Authenticator setup uses the same cells.
- Forgot password has its own page (/login/reset): school email only, the same answer whatever the account, the link checked before a new password is typed, single use, 20 minutes. Backend: /auth/forgot-password now takes school_email only (one link a minute, sent after the reply, a failed send can be retried), new /auth/reset-password/check. Fixed: reset emails pointed at the public home page; old links now open the reset page. Staff reset is unchanged (contact the admin office).
- Pet: a thin blinking caret follows its line while it is typed. Chat: a compact "Thinking" bar while an answer is pending, replacing the timed "Checking data…/Writing answer…" labels, which were not real progress.
- Checks (self-reported, isolated fixtures only): type check and build pass; ESLint 155 (157 before); web unit 61/61 (3 database test files not run, package missing); backend 535 passed, 22 skipped; browser 523 tests: 522 passed, 0 failed, 1 pre-existing skip (the one failure in the full run was the old popup test, rewritten for the new page; the four sign-in suites, 122 tests, were then re-run on the final code and all passed). Normal-speed MP4 and screenshots in output/auth-polish. Not checked: real phone keyboard/autofill, screen reader, hosted site, real email delivery. ChatGPT review pending; LOGIN-SCENE-02 still not implemented.


## Authentication and chat UI requests — 2026-11-03 22:50 MYT
- Recorded pending bell shake/ripple, recovery-code button spacing, sign-out polish, dedicated six-digit 2FA and school-email recovery pages, pet text animation and chat shimmer/thinking-bar requests.
- Preserved the breathing chat loader, school-only sign-in rule, verified personal recovery destination and unfinished tasks; synchronized owner statuses in the existing three workflow files.
- Requirements/source review only; no app changes or tests. Loading UI reference read; Prompt-kit documentation returned 403 and exact component motion remains unverified.


## Independent login, dashboard and feedback checks — 2026-11-03 20:36 MYT
- Confirmed the dashboard tab-return correction in 21 dashboard/live Chrome checks and feedback preview/triage behavior in focused tests. Updated bounded review statuses in the three workflow files.
- Login glass/lighting/ridge/composition checks pass, but LOGIN-SCENE-02 smooth fast-forward after a long-hidden tab is still not implemented; the latest visual refinement explicitly excludes it.
- Independent checks: TypeScript passed; 13 Node tests, 10 backend tests and 47 browser tests passed. Three PostgreSQL tests skipped; target severity migration, live services, continuous animation playback, real devices and screen reader unverified. Notice/pet follow-up suites and the reported full suite were not rerun. No application changes, production operations or deployment.


## Follow-ups: trees on the ground, sign-in veil, notice Description label, pet speech bubble — 2026-11-03 20:27
- Login scene: each tree now stands on the ridge at any screen size or shape (before, they were placed a fixed distance from the bottom, so at other resolutions they floated or sank). The grey veil shown while signing in now covers exactly the card (it started 24 px low because of the card's spacing rule) and is lighter, so the glass stays visible.
- Notices: the message in the details dialog is labelled "Description" and sits directly under the title, above Posted / Posted by / For.
- Assistant pet: the speech bubble is a rounded bubble with a tail and a shadow that follows its shape (the old reveal clipped the shadow into a square), light and dark. The pet now says a different line each time it waves, from 15, never the same twice in a row; a line stays a few seconds and later waves come at random 14 to 30 second gaps. Touching the pet ends the line.
- Checks (self-reported, fixed clocks and isolated fixtures): web type check and build pass; ESLint 157 problems (158 before); all non-database unit tests 60/60 (the 3 database test files need a package that is not installed here and were not run); browser suite 509 tests, 508 passed, 0 failed, 1 pre-existing skip (header screenshots), run four files at a time; two earlier runs with every file at once showed a few unrelated 7 to 8 second timeouts under load, and those files passed when re-run alone. Not checked: watching the motion live, a screen reader, the hosted site. ChatGPT review pending.


## Sign-in scene: glass card, phone layout, depth, soft dawn and dusk, one light — 2026-11-03 20:27
- The sign-in card is lightly translucent glass: blurred backdrop, a subtle light border and a soft shadow that falls away from the sun or moon, more solid against a dark sky. It was a solid white slab before (a shared card style overrode the page's own see-through classes). Every word on it measures at least 4.5:1 contrast by day, dawn, dusk and night; the input hints, the character count and "Forgot password?" were darkened a little for that.
- On a phone the scene is arranged around the form: a band of sky above it holds the sun or moon on a shallow arc, two corner planets, clouds and birds; the land stays at the bottom. The whole scene is now one stage fixed to the screen, so it keeps its composition however tall the form is.
- Depth: far layers (stars, sun, moon, planets) barely shift with the pointer or the scroll, near ones (clouds, trees, the hill) shift more, and near clouds drift a little faster than far ones. Nothing moves with reduced motion.
- Dawn and dusk run through soft peach, lavender and blue into night instead of the old red and purple sunset. Stars, clouds, birds, the moon and the shadows fade in and out gradually; nothing switches at 19:59 or 04:59 any more.
- One light, the sun by day and the moon by night, lights the sky, clouds, planets, hills, trees and the card's shadow from the same side; shadows are long and dense when the sun is low, short and soft at noon, faint by moonlight.
- Checks (self-reported, fixed clock and isolated fixtures): web type check and build pass; ESLint 157 problems (158 before); all non-database unit tests 60/60 (the 3 database test files need a package that is not installed here and were not run); browser suite 509 tests, 508 passed, 0 failed, 1 pre-existing skip (header screenshots), run four files at a time; two earlier runs with every file at once showed a few unrelated 7 to 8 second timeouts under load, and those files passed when re-run alone; 13 of these are new composition tests. Not checked: watching the motion live, a real pointer or touch device, a screen reader, the hosted site. The tab-return catch-up (LOGIN-SCENE-02) is not part of this change. ChatGPT review pending.


## Smooth login sky catch-up requested — 2026-11-03 12:40 MYT
- Revised LOGIN-SCENE-02: after a long-hidden tab resumes, smoothly fast-forward the last visible sky through intervening day/night phases to current Malaysia time, with coordinated sun/moon movement, lighting and colors.
- Specified a bounded catch-up, midnight/multi-day handling, repeated interruption and reduced-motion support; animation time remains separate from real authentication/business clocks.
- Updated existing fix, handoff and review report. Source/requirements analysis only; no app changes, tests, database operations or deployment. Implementation and motion review pending.


## Open a notice to see all of it; two new file routes — 2026-11-03 00:08
- Students, lecturers and administrators can click a notice card to open a Notice details dialog: picture (expandable), priority, who it is for, who posted it and when, how long it is visible, the whole message (web addresses are links), the attached file and the link. Admins also see its state (draft, scheduled, live, expired) and can Modify or Delete from it; lecturers can on their own notices. It opens from the student and lecturer dashboards, the admin Announcements cards and the lecturer Course Notices page, with a calm entrance animation, reduced-motion support, focus handling and a note if the notice is removed while it is open.
- Cards keep their own buttons (download, link, Modify, Delete, Edit) working without opening the card, and show a "View details" cue, High priority and "Posted 2 days ago"; their small text is larger.
- Admins can now open the file on any notice, and lecturers the file on any notice they can see (before: only the author). A file with a non-Latin or quoted name no longer breaks the download.
- Built as a dialog (like the ticket details), not as a separate page.
- Checks (self-reported, isolated fixtures): web type check and build pass; unit tests 44/44; backend 531 passed (PostgreSQL-only tests not run this time); browser suite 488 of 489 passed (1 pre-existing skip), including 12 new notice tests. Not checked: watching the motion live, a screen reader, the hosted site. ChatGPT review pending.


## Browser tab shows the system logo; student ticket details with animated progress — 2026-11-02 21:59
- The tab icon is now your system logo's round badge (32 and 48 px, and a 180 px home-screen icon) instead of the purple bolt. A browser may keep showing the old icon in an already-open tab until a hard refresh.
- Student feedback tickets: click (or press Enter or Space on) a card to open a Ticket details dialog with a three-stage progress, Pending, In Review, Resolved. The line fills smoothly to the current stage, finished stages turn into checks, the current one pulses, and a status change while the dialog is open moves it on. The dialog also shows the full message, the admin's reply and your own attachment.
- Wording: students see Pending / In Review / Resolved (no more "Open"), admins see Pending / In Progress / Completed. Only the labels changed; nothing stored or sent changed.
- Checks (self-reported, isolated fixtures): web type check and build pass; unit tests 38/38; browser suite 476 of 477 passed (1 pre-existing skip), including 8 new ticket-dialog tests, 1 new favicon test and 1 new admin-wording test; backend feedback tests 48 passed. Not checked: watching the motion live, a screen reader, the hosted site. ChatGPT review pending.


## Stable dashboard on tab return, admin-owned feedback severity and image preview — 2026-11-02 21:12
- STUDENT-SCOPE-07: coming back to the tab, a reconnect, a missed-events resync and the timed fallback no longer replace the settled student dashboard with "Updating". They refresh quietly and swap the new data in together; only a real timetable or account change says Updating. One snapshot per return instead of two.
- FEEDBACK-TRIAGE-13: students no longer choose a priority (form, request and ticket badge removed; a submitted value is ignored and students never see the admin's severity). The admin chooses Low/Medium/High/Urgent in Feedback Details, required before a report leaves Pending, and it is saved with the status in one request. Set In Progress closes the dialog first, then one toast; double clicks, repeats and two admins are handled safely, an old dialog cannot reset a Resolved report, a response can be saved on its own, and a resolved report can be reopened.
- FEEDBACK-PREVIEW-13: the attachment shows as a framed picture (Expand at the top right, a footer with Download at the bottom right) as drawn, with a larger viewer, a PDF file card and clear loading, retry, missing-file and no-attachment states. Nothing downloads until you press Download.
- New migration d8e3b5a1f7c2 (after c6e2a9d4f018, still unapplied): run `alembic upgrade head` locally. The backend now refuses to start until it is applied; the Azure image applies it itself.
- Checks (self-reported, isolated fixtures and a throwaway local PostgreSQL, removed afterwards): backend 546 passed, 0 skipped; web type check, build and unit tests pass; browser suite 465 of 466 passed (1 pre-existing skip); 6 new tab-return tests (5 fail on the old behaviour) and 12 new feedback tests pass. Not checked: real Alt-Tab, the hosted site, a screen reader. ChatGPT review pending.


## Dashboard focus refresh and feedback triage requested — 2026-11-02 19:58 MYT
- Reopened STUDENT-SCOPE-07 for visible refresh on Alt-Tab/tab return: connection ready topics currently trigger the same scope-changing path as actual assignment invalidation. Keep settled content stable during ordinary revalidation while preserving real scope/account/midnight safeguards.
- Added FEEDBACK-TRIAGE-13: remove submitter-controlled priority, require admin severity before In Progress, close the dialog before the success toast and prevent repeated/stale/concurrent same-state actions.
- Added FEEDBACK-PREVIEW-13 following the user's sketch: contained inline image, top-right expand, separate footer with bottom-right download; authenticated fetch, safe file fallbacks and scoped cleanup.
- Reviewed latest report/changelog claims as self-reported; unrelated Academic Manager/toast revisions still await independent review. Requirements/source analysis only, no application changes, tests, database operations or deployment.


## Clearer Academics workspace on every tab; toasts back at the top right — 2026-11-02 18:06
- ACADEMIC-UX-12: each Academics tab now has a searchable record list paged on the server, with a count, a range, and clear empty, no-match and error states. Rows show what matters: programme usage, course programme, semester and status, the teaching role, and each student's courses with their own semester status.
- Forms show errors beside the field and focus the first one, keep entries when a save is refused, block double saves and show the saved record marked in the list. Deletes say what they affect and use a red confirm.
- Student Allocation has one student choice. The programme is fixed for an assigned student, only valid courses are offered, the course's real semester and group seats are shown, and a summary with credits sits near Save. The teaching role is a three-way choice. Sync stays busy until the list answers.
- NOTIFICATION-UI-11: toasts are back at the top right under the header, never centred; with the bell panel open they move beneath it (or wait on a phone).
- New read-only endpoints `/admin/records/*` and `/admin/lookup/allocation`; enrolment refuses a course from another programme. No migration.
- Checks (self-reported, isolated fixtures and a throwaway local PostgreSQL): backend 526 passed plus the 6 PostgreSQL-only tests (44/44 in their files); web type check, build and lint on changed files pass; unit tests 38/38; browser suite 445 of 446 passed (1 pre-existing skip), then 10 new Academics tests pass. Not checked: real browser zoom, hosted site. ChatGPT review pending.


## Academic Manager quality-of-life brief — 2026-11-02 17:03 MYT
- Added ACADEMIC-UX-12 across all five admin academic tabs: readable hierarchy, consistent responsive forms/lists, guided dependent choices, one shared allocation student selector, useful record search/statuses and clearer validation/recovery.
- Specified reuse of existing server lookups, system shimmer, safe allocation transactions and same-programme rules; preserve recent dropdown fixes, page refresh behavior and top-right toast placement.
- Handoff/source analysis only; no application code, tests, database or deployment changes. Existing tasks preserved and all three workflow status tables synchronized.


## Toast position clarified — 2026-11-02 17:01 MYT
- User rejects centred toasts: keep top-right alignment below the header, with a safe gap around the notification bell and no overlap with its open panel.
- Updated existing NOTIFICATION-UI-11 in all three workflow files; inspect both library positioning and CSS overrides. Placement correction pending; other completion claims remain independently unreviewed. Documentation only, no application changes or tests.


## Searchable pickers and one programme per student, page-shaped refresh, clear student empty states, calmer toasts and bell, 404 monitor — 2026-11-02 15:35
- ACADEMIC-SEARCH-11: programme, course, student and staff pickers search on the server one small page at a time (built for 100,000 records); students already on a course this semester are hidden until searched; a student keeps one programme and only gets courses from it (refused on the server too).
- AUTH-UI-04: refreshing an app page shows that page's own loading skeleton while the session is checked, not the sign-in shape.
- STUDENT-EMPTY-11 / STUDENT-SCOPE-07: clear empty panels (no courses with Contact Admin, no completed classes, no notices) instead of empty charts; after midnight or a course change the dashboard never shows old totals as current.
- NOTIFICATION-UI-11: toasts sit below the header and away from the notification panel, use green/red/yellow/blue consistently, queue without repeats and never drop a failure; the bell rings only for a genuinely new update.
- ERROR-PAGES-10: the 404 is a monitor whose screen says 404, with a server rack behind it; secret-looking parts of the address are hidden.
- Checks (self-reported, isolated fixtures): backend suite 521 passed, 0 failed, 6 skipped (the earlier skips), including the PostgreSQL allocation and upcoming-class tests and 6 new search/one-programme tests; full browser suite 445 tests: 444 passed, 0 failed, 1 skipped (the earlier skip); web unit tests 38 of 38; tsc and the production build clean; ESLint clean on every new file. The public page's title test was updated to the hyphen now in the source (changed there at 13:11, before this work). Nothing committed, pushed, deployed or restarted. ChatGPT review pending.

## Student guidance, searchable allocation and notification polish requested — 2026-11-02 14:12 MYT
- Added clearer student empty-state panels, scalable server-searched dropdowns with available-first suggestions, and strict same-programme additional course enrolment. Search may reveal enrolled students but cannot bypass eligibility; ordinary allocation must no longer silently change an assigned programme.
- Requested shared toast placement below header controls, consistent success/error/warning/info feedback, and a restrained animated bell with authoritative unread counts capped at 99+.
- Revised refresh loading to use the current page's system shimmer while retaining authoritative session checks; revised 404 to show the code inside a monitor with a server behind it. Existing login-submit behavior and other error handling remain covered by their prior requirements.
- Updated existing FIX, handoff and review report; preserved unfinished work. Requirements/source analysis only, no app changes, tests, production operations or deployment.


## Independent Git push readiness checks — 2026-11-02 01:47 MYT
- Built a Git-included source snapshot: web production build/type-check passed with the Azure API address, and backend import/allocation route passed using dummy settings. Web reused installed dependencies; no fresh npm ci, Docker, Flutter or hosted startup check.
- Only CHANGELOG.md, no tests/recordings/private env files, and no oversized files in the pushable snapshot. Heuristic secret scans found only an example connection-URI template candidate; no exhaustive secret-free guarantee.
- One Alembic head c6e2a9d4f018; offline SQL for three nullable-column upgrades passed. Live revision and actual migration execution remain unverified. Latest attendance upcoming-row fix passed 23 focused tests; earlier missing-row finding superseded.
- STUDENT-SCOPE-07 refresh defect remains. Main push deploys automatically and runs backend migrations; repository has no configured staging-slot swap/rollback guaranteeing old-version availability. No commit, staging, push, production write or deployment performed.


## Error pages, locked sign-in, account-saved pet position, upcoming classes and a Git-ready repo — 2026-11-02 01:03
- Error pages: one quality design for 400, 401, 403, 404, 408, 429, 500, 502, 503 and 504, labelled like "404: Not Found" with the full address the visitor tried, a copy button and the actions that fit; /error/<code> opens any of them, and a page that crashes or fails to load now shows the 500 page with Try again instead of a blank screen.
- Sign-in: while signing in the whole card is locked and whited out, so the email and password can no longer be changed; the logo shines like a badge on hover.
- The AI assistant pet's position is saved with the account, so it is the same in every browser and on the live site (migration c6e2a9d4f018).
- ATTENDANCE-LIFECYCLE-09 follow-up: today's classes appear in admin attendance from one hour before they start even if nobody opened the staff Today list.
- Repo: output/ and local test tooling are git-ignored, unused template images are removed, and the old docs/ pages are merged into this changelog (see "Project documentation" at the end); docs/ is deleted.
- Before the next backend start run `python -m alembic upgrade head` in fyp-backend (pet a9c4e2f7b315, timetable b4d7e1f0a2c9, pet position c6e2a9d4f018).
- Checks (self-reported, isolated fixtures): backend suite 515 passed, 0 failed, 6 skipped (the earlier skips), including 13 real-PostgreSQL tests and 23 lifecycle tests; full browser suite 419 tests: 418 passed, 0 failed, 1 skipped (the earlier skip), including the new error-page, locked-login and logo-shine tests; web unit tests 38 of 38; tsc and the production build clean; ESLint clean on the new and changed public, routing and pet files; both new migrations ran up and down on a throwaway local PostgreSQL with existing rows kept. Nothing committed, pushed, deployed or restarted. ChatGPT review pending.

## Independent allocation, attendance and admin UI review — 2026-11-02 00:18 MYT
- Found ATTENDANCE-LIFECYCLE-09 gap: one-hour filtering only works for existing session rows. Isolated reproduction at 09:30 MYT with a 10:00 meeting and no session returns an empty admin list; added integration correction to the existing fix/handoff/review documents.
- Dropdown and Network Security loading corrections passed 32 focused Chrome checks, zero failed/skipped; marked those scoped reviews complete. Allocation transaction/source changes are present, but independent PostgreSQL validation remains outstanding.
- Allocation browser command reported seven passing cases but did not exit and was interrupted; no clean aggregate pass or new public-overlap approval is claimed.
- Independent TypeScript passed; lifecycle backend 17 passed; PostgreSQL allocation tests 12 skipped because no scratch-server URL was configured. Target database migration/startup and hosted behavior not checked; no application changes or deployment this turn. Earlier full-suite counts remain self-reported.


## Allocation, attendance listing, network page and menus — 2026-11-02 00:10
- ADMIN-ALLOCATION-09: Save Student Allocation is one request and one transaction (fixed lock order, safe to repeat, deadlocks retried as a whole), so the programme and the course can no longer deadlock or half-save; one student for both parts; clear refusal, lost-answer and double-click handling.
- ATTENDANCE-LIFECYCLE-09: upcoming classes appear in admin attendance from one hour before they start; a new or moved timetable slot no longer produces review rows for days before it existed; the teacher and role come from the class itself (Unassigned when nobody is). Needs migration b4d7e1f0a2c9 (and the pending pet migration) run by the user before the next backend start.
- NETWORK-SHIMMER-09: Network Security loads with the system shimmer (delayed import, mode, detection, rules and connections independently), retry rows on failure, no false mode or success, quiet refresh.
- ADMIN-DROPDOWN-09: the nine Academics menus use the pale rounded look with the scrollbar inside the rounded shell; Create New Group stays reachable.
- PUBLIC-EXPERIENCE-08: the floating tiles step aside before the closing words, so none covers the text on a phone.
- Checks (self-reported, isolated fixtures): backend suite 503 passed, 0 failed, 6 skipped (the earlier skips), including 12 real-PostgreSQL allocation tests and 17 lifecycle tests; full browser suite 414 tests: 413 passed, 0 failed, 1 skipped (the earlier skip), including 7 allocation, 11 network page, 21 dropdown and the new tile-overlap test; public experience 15 of 15; web unit tests 38 of 38; tsc and the production build clean; ESLint clean on the public files and the new shimmer parts (the other edited pages keep the explicit-any and in-page-component findings they already had); the new migration was run up and down on a throwaway local PostgreSQL (existing rows kept, column empty for them) and generates the expected SQL offline. Nothing committed, pushed, deployed or restarted; the migration was written, not applied. ChatGPT review pending.

## Academic allocation, attendance and dropdown fixes requested — 2026-11-01 23:08 MYT
- Added four focused Claude tasks: readable rounded dropdowns with inset scrollbars, coherent allocation saving/deadlock handling, one-hour attendance visibility with correct meeting staff/role and no unintended historical backfill, and full Network Security system shimmer.
- User log confirms an enrolment 201 followed by programme-update 500 with PostgreSQL DeadlockDetected, then an enrolment 400. Source concurrently sends dependent saves; the exact 400 detail is not in the log and must be reproduced rather than guessed.
- Source confirms attendance labels use the main course lecturer/default Lecturer and session sync backfills seven calendar days. Preserve existing valid history, limits and server check-in/security rules when correcting these paths.
- Analysis and documentation only; no application tests, hosted data operations or implementation performed. Previous unfinished tasks retained; statuses synchronized.


## Independent public-page visual revision review — 2026-11-01 22:46 MYT
- Confirmed proportionate existing logo, populated book spreads, improved screen assets, removed sample badge and frosted header through source and scoped fresh Chrome rendering.
- Found one remaining mobile composition defect: a foreground tile overlaps the closing paragraph at 390x844. Added correction/evidence to FIX, handoff and review report; PUBLIC-EXPERIENCE-08 stays unfinished. Student scope-refresh follow-up remains open.
- Independent checks: TypeScript passed; 14 focused public browser tests passed, zero skipped after rerunning on temporary local Vite 5181 (initial default URL refused connections). Inspected representative fresh desktop/mobile screenshots; supplied MP4s decode at 30 fps, but continuous playback, other browsers, real devices and hosted behavior were not checked. No app changes or deployment; full-suite totals remain self-reported.


## Public page: sharp logo and screens, a book with real pages, and a motion rework — 2026-11-01 19:45
- PUBLIC-EXPERIENCE-08 corrections: the logo is drawn at its own proportions everywhere; the phone and monitor screens are the real app and web captures at their own shape and enough pixels (no crop, no blur at the closest view); the sample-data badge is gone; the book has real words and pictures on all eight pages and no page shows through another while it turns; the header is a frosted white bar with the logo, words and button sharp.
- Motion rework after the four references (Puture, Karma, Anniversary, Awwwards): a deep blue stage with a light cone and a sliding grid floor, glossy tiles that burst outward at each chapter, word-by-word headlines, the phone and monitor power on, open the app and are tapped through, the camera moves into the web screen. Built with CSS 3D and `motion` only (three.js is still not installed).
- Checks (self-reported, isolated fixtures): Full browser run: 375 tests, 374 passed, 0 failed, 1 skipped (the skip was already there). publicExperience.browser.test.mjs 14 of 14: the 9 earlier tests updated for the new page, plus 5 new (page order at every sampled angle forwards and backwards; real content on every page; logo and screens never cropped or stretched; web screen sharp at 1x and 2x; frosted header). Web unit 38 of 38. tsc and build clean; ESLint clean on the public files. The public page's own code is 14.5 KB gzipped and the eight screens are 459 KB, loaded only with the public page. Flutter was not touched this turn (the earlier analyze and 20 of 20 tests stand). Real-time MP4 recordings are kept locally in output/public-experience (desktop, phone, landscape; forwards and backwards). Not checked on Safari, Firefox or a real phone. Nothing committed, pushed, deployed or restarted. ChatGPT review pending.

## Public header glass effect clarified — 2026-11-01 18:38 MYT
- Added a lightly transparent white header with subtle backdrop blur to PUBLIC-EXPERIENCE-08 in all three workflow files; logo, text and portal button stay sharp and readable.
- Existing PublicHeader already has transparency/backdrop-blur classes; Claude should refine and visually verify that treatment with scrolling content. Documentation only; implementation/visual checks pending, no application tests run.


## Public page visual corrections and motion references — 2026-11-01 18:37 MYT
- Reopened PUBLIC-EXPERIENCE-08 for stretched/blurred branding and demo screens, blank book leaves, premature final-page artwork, sparse storytelling and removal of the top-right sample-data badge. Existing logo and original school/system/device journey retained.
- Confirmed 768x570 logo forced into square boxes and differing phone capture/display ratios; documented aspect-correct sharp assets, page-face content/occlusion and desktop/mobile visual acceptance for Claude.
- Captured all four supplied reference sites as local 1440x900 MP4 study clips (45 sampled frames, 9 seconds at 5 fps each), checked decoding and inspected contact sheets; not full-speed playback verification. Stored locally in output/public-references and excluded from Git. Revised USAS implementation and smooth motion recording remain pending; no app code changes or application tests this turn.


## Independent public-page and student-dashboard review — 2026-11-01 18:23 MYT
- Confirmed existing-logo reuse (now explicitly required by the user), public scene/routing source, shared student shimmer wiring and a real GitHub latest-release destination; APK asset/install and rendered visual quality remain unverified.
- STUDENT-SCOPE-07 needs follow-up: timetable/account refresh updates enrolments without the matching attendance snapshot, and a failed midnight refresh silently retains previous-scope totals. Added focused corrections and acceptance checks to the existing workflow files; task remains unfinished.
- Independent TypeScript passed; student dashboard backend scope tests: 8 passed, zero skipped, isolated fixtures only. Initial SQLite engine URL failed test collection due to pool options; dummy PostgreSQL driver URL rerun passed without hosted DB access. Browser/mobile visuals, production services and deployment not checked; other full-suite totals remain Claude's self-report.


## Public information page, portal choice and page not found — 2026-11-01 17:59
- PUBLIC-EXPERIENCE-08: smartsystem.live now opens a USAS information page: a book opens with the welcome, a phone shows the app (sign in, dashboard, face check-in, recorded), a monitor shows the web portal (portal choice, sign-in, dashboard, timetable), then Open Portal and Get the App. All screens are real app and web screens with sample data. Open Portal leads to a Student or Staff choice and then the existing sign-in at /login. Unknown addresses show a short "Page not found" scene. Built with CSS 3D (installing three.js was refused); the download button opens the repository's latest GitHub release.
- Checks (self-reported, isolated fixtures): Full browser run: 370 tests, 369 passed, 0 failed, 1 skipped (9 new); three LOGIN-LOGO-03 tests failed at first because they opened the old sign-in address, were corrected to /login and re-run with the whole login-scene file passing 10 of 10. Flutter analyze clean, 20 of 20 tests. Not checked on Safari, Firefox or a real phone. Nothing committed, pushed, deployed or restarted. ChatGPT review pending.

## Student dashboard: current courses only, and its own loading skeleton — 2026-11-01 16:25 MYT
- STUDENT-SCOPE-07: the student dashboard now shows only courses of a semester running today (Malaysia date, last day included) and classes held in it. An ended course with old absences no longer appears as a failing 0%; with no current course it says "No current courses assigned". The server decides (new `scope=current`); history screens and stored records are unchanged, and course notices for students still enrolled keep arriving. The app's Overall course cards follow the same rule.
- STUDENT-SHIMMER-07: the student dashboard loads with a skeleton in the page's own shape (banner, summary cards, notices, charts, courses) in place of solid grey blocks, for the page download, the data load and an account change.
- Checks (self-reported, isolated fixtures): backend 474 passed, 6 skipped (8 new); Full browser run 361: 360 passed, 0 failed, 1 skipped (10 new). Flutter analyze clean, 20 of 20 tests, debug APK built. No emulator or live data check. Nothing committed, pushed, deployed or restarted. ChatGPT review pending.

## USAS identity and book design confirmed — 2026-11-01 16:24 MYT

- Updated the existing Claude handoff, fix request and review report: USAS — University Smart Attendance System; realistic book/page turns with a subtle blue glow.
- Preserved the confirmed public-page, phone, monitor, portal and 404 flow and all unfinished tasks. Existing logo retained as the proposed default; no real-university affiliation or school facts inferred.
- Exact GitHub app download URL remains pending. Storyboard and implementation review are still pending; this update changes documentation only, with no application tests run.


## Public page flow and 3D demos clarified — 2026-11-01 16:20 MYT
- Confirmed separate school/system sections, information -> portal choice -> existing login, scroll-controlled student phone and monitor demonstrations, and a combined-device closing scene with portal/app actions.
- Phone: black screen -> app -> student login -> dashboard -> face check-in -> Recorded; monitor: black screen -> portal -> student login -> dashboard -> timetable. Full 3D also on mobile; no FAQ, Contact or Features sections.
- 404 only: a server rack cannot find the monitor's request and the monitor looks sad. Inspected sampled frames from all three local book clips; YouTube/reference animations remain unverified.
- Three remaining questions: book visual treatment, school identity/book content and exact GitHub download URL. Planning documents updated; no application changes or tests run.

## Public information and error-page discovery — 2026-11-01 16:06 MYT
- Captured the requested 3D book, Flutter phone and web monitor scroll story, portal entry and error-page direction in PUBLIC-EXPERIENCE-08; 11 product/design questions await answers.
- Recorded existing-system styling, actual UI with fictional demo data, route compatibility and motion/fallback constraints. Reference text partly available; live reference animation inspection unavailable.
- Planning only; no application changes or tests. Implementation/design approval pending; existing task states preserved.

## Student dashboard shimmer mismatch confirmed — 2026-11-01 15:55 MYT
- Added STUDENT-SHIMMER-07: student data loading uses solid pulse blocks; requested the established system shimmer with a matching student layout across lazy import, data fetch and account changes.
- Preserve login/auth gating, student scope, existing background refresh and clear errors; require rendered light/dark/narrow/reduced-motion verification.
- Source analysis/handoff only; no app changes or application tests run. Implementation pending; existing tasks preserved.

## Student dashboard old-course scope issue reported — 2026-11-01 15:55 MYT
- Added STUDENT-SCOPE-07 after screenshots showed a retained course, old absences and 0% warning while the student awaits a new assignment; source uses retained enrolments and all completed sessions for current dashboard summaries.
- Requested active-semester dashboard scope and accurate empty states across web/Flutter, preserving historical records, intentional history views and retained-enrolment Course Notices eligibility.
- Source analysis/handoff only; no app/database changes or tests run. Implementation pending; other task statuses preserved.

## Rollover preview, student next step and attendance parity — 2026-11-01 15:17 MYT
- SEMESTER-PREVIEW-06: admins get a read-only "Next semester preview" (what stays, what a new offering would copy, what is missing or in conflict). It says plainly why a plan cannot be applied yet; nothing is saved or moved and there is no apply step.
- STUDENT-NEXT-06 (web and server): one next-step card on the student dashboard (check in, register face, verify email, or next class). The Flutter card is not built yet.
- CLIENT-PARITY-06 (partial): the app now shows approved leave as Excused and no longer shows 100% for a course with no held class; one shared attendance case is checked by the backend, web and app tests.
- Checks (self-reported, isolated fixtures): backend 466 passed, 6 skipped (15 new); Full browser run 351: 350 passed, 0 failed, 1 skipped (16 new). Flutter analyze clean, 18 of 18 tests, debug APK built. Flutter check-in result, sync status and readiness not started. Nothing committed, pushed, deployed or restarted. ChatGPT review pending.

## Six selected improvements prepared for implementation — 2026-11-01 14:42 MYT
- Added admin semester rollover preview, Flutter attendance confirmation, connection/sync status, web/mobile rule consistency, a student next-action card and Flutter check-in readiness to the existing Claude handoff.
- Specified reuse of the account-scoped offline queue, server-confirmed attendance, preserved historical/cohort data, read-only rollover preview, existing account/notice rules and focused cross-client/device regression checks.
- Documentation only; all six implementations pending. No app code, database or tests changed/run; existing unfinished tasks and review states preserved.

## Staff current-semester scope and the pet on every staff page — 2026-11-01 14:04 MYT
- STAFF-SEMESTER-05: staff Attendance, Analytics, At-Risk, the dashboard, warnings, attendance requests and the AI assistant now use only assigned courses in a semester running today (Malaysia date, end date included). An ended, upcoming or undated course is refused on the server, even by direct request; old records, assignments and ended-semester risk scores are kept. Course Notices keep the retained course; former-semester students the admin still keeps enrolled keep receiving notices; a scheduled notice is not sent after its lecturer loses the course. Attendance no longer loads every enrolment in the system.
- STAFF-SEMESTER-05 follow-up (2026-11-01 14:07 MYT): a student the admin moves out of a course no longer appears in current At-Risk results, the Analytics at-risk count or the assistant's risk list; the stored score stays as history. Backend now 451 passed, 6 skipped.
- PET-PAGES-05: one pet for staff on every signed-in page (Timetable, Attendance, Analytics, At-Risk, Course Notices, account pages), hidden on the full AI Assistant page; the Dashboard-only copy was removed.
- Checks (self-reported, isolated fixtures): backend 451 passed, 6 skipped (10 new); Full browser run 335: 334 passed, 0 failed, 1 skipped. 18 + 9 mutants killed; tsc and build clean. Live database not checked. Nothing committed, pushed, deployed or restarted. ChatGPT review pending.

## Independent staff scope and assistant coverage review — 2026-11-01 13:59 MYT
- Current-semester filters, retained notice options and a shared pet mount are present in source; latest completion documentation has not caught up.
- Found STAFF-SEMESTER-05 defect: removing a course enrolment leaves its saved risk score visible in current At-Risk results; isolated reproduction confirmed. Requested enrolment/cohort eligibility without deleting history.
- Independent checks: 9 focused backend tests passed, zero skipped; TypeScript passed. Browser/live services not checked; tasks remain unfinished and workflow statuses are synchronized.

## Course notice audience clarified — 2026-11-01 13:24 MYT
- STAFF-SEMESTER-05: students may receive course notices after semester expiry while the admin retains their course enrolment; moving/removing them from that course stops new notices from it.
- Kept active-semester teaching restrictions separate; added retained-enrolment and post-move dispatch acceptance checks in the three workflow files. Documentation only; implementation pending, no application tests or real messages sent.

## Staff semester access and assistant page coverage requested — 2026-11-01 13:22 MYT
- Added STAFF-SEMESTER-05: current assigned semester data for staff Attendance, Analytics and At-Risk, while retaining course assignments and separate Course Notices permissions; notice audience after expiry awaits clarification.
- Added PET-PAGES-05: show the floating assistant on authenticated pages including Timetable, excluding the full AI Assistant interface, with existing account preferences and permissions preserved.
- Source/requirements analysis and Claude handoff only; no application changes, database calls or tests run; previous unfinished tasks and self-reported review statuses preserved.

## Sign-in loading, pet look direction and attached chat — 2026-11-01 03:35 MYT
- AUTH-UI-04: a wrong password no longer replaces the sign-in form with the signed-in app's placeholders. The form stays, Sign In turns grey with a centred spinner, then the error shows and the button works again. A saved session is confirmed by the server before the app appears (a sign-in shaped placeholder shows meanwhile); expired, refused, wrong-account and malformed sessions go to sign-in. Success moves to the role's dashboard.
- PET-LOOK-04: Luna and Hoodie Cat now look upper-left when the cursor is upper-left (the sheets' own cells faced right there; the matching up-right frames are mirrored in the sprite only).
- PET-LAYOUT-04: the Start chat control, question box and reply stay attached to the pet and inside the page through resizing, sidebar changes, minimising, scrolling and dragging (they could drift off the page because the layout state went stale).
- Checks (self-reported, isolated fixtures): Full browser run 323 tests: 313 passed, 9 failed (the account-page fixtures assumed the app trusts a saved session before checking it; updated, then that file passed 52 of 52), 1 skipped; then the 7 browser files covering the touched code re-run: 171 run, 171 passed, 0 failed (the full run was not repeated after the fixture fix). Node unit 36/36; tsc and build clean; 12 of 12 mutants killed. Live backend not verified (PET-SCHEMA-03 open). Nothing committed, pushed, deployed or restarted. ChatGPT review pending.

## Login loading and submit-state defect confirmed — 2026-11-01 02:38 MYT
- Added AUTH-UI-04: global auth loading currently replaces Login with protected-looking skeletons during session startup and credential submission; Login's lazy fallback also uses the internal generic page skeleton.
- Requested a login-shaped initial shimmer, a mounted login form with grey centred-spinner Sign In while authenticating, errors remaining on Login, and role Dashboard shimmer only after successful authentication/2FA.
- Source analysis/handoff only; no app changes or tests run. Actual private-data leakage is not established by the screenshot. Existing unfinished tasks and user-confirmed DB/email closures remain intact.

## Pet gaze direction and detached controls reported — 2026-11-01 02:34 MYT
- Added PET-LOOK-04 after inspecting both actual sprite sheets: upper-left look slots contain right-facing poses; requested verified per-pack frame/orientation correction without flipping the control UI.
- Expanded existing PET-LAYOUT-04 with the user's detached Start chat screenshots and minimize/resize, drag and relative-anchor acceptance checks; no duplicate layout task created.
- Analysis/handoff only; no application/assets changed or new tests run. Both fixes await Claude implementation and independent review; prior closed DB/email statuses remain unchanged.

## Independent free-placement and pet quick-chat review — 2026-11-01 02:23 MYT
- Confirmed source implementation of full-chat pet removal, free drop positions and temporary pet quick chat. Found PET-LAYOUT-04: resize/sidebar changes retain stale rendered bounds when scale/full are unchanged, allowing reply/input overflow even when the sprite is clamped correctly.
- Actual state/helper probe reproduced a reply ending at 712 px against a new body edge of 650 px. Added correction and synchronized statuses; no app code changes.
- Independent TypeScript and pet-assets checks passed (2 tests, zero skipped). Browser/sky visuals, real answers and migration-dependent persistence remain unverified; DB-01/email user closures remain intact.

## Constellations and aurora, pet free placement and quick chat — 2026-11-01 02:20 MYT
- Login sky: constellations redrawn from the user's video (thin lines, glowing stars, named, drawing in and fading, up to two at night) and a new random aurora of soft ray curtains that comes and goes; reduced motion keeps both still.
- PET-SCOPE-03: no pet on the full AI Assistant page; that page and its Settings are unchanged.
- PET-PLACEMENT-03: the pet stays exactly where it is dropped, remembered per account; no corner snapping.
- PET-QUICKCHAT-03: click the pet, Start chat, ask, and the real answer shows above it; a temporary conversation of its own, never saved to chat history.
- Checks (self-reported, isolated fixtures): browser 279 run, 278 passed, 0 failed, 1 skipped; unit 26/26; tsc and build clean; 10 of 12 mutants killed. Live backend and real answers not verified while PET-SCHEMA-03 is open. Nothing committed, pushed, deployed or restarted. ChatGPT review pending.

## Independent review and user-confirmed runtime status — 2026-11-01 01:41 MYT
- Closed DB-01 on the user's confirmation that prepared-statement errors are gone; recorded email as having no current issue and closed that follow-through on the accepted user report. No fresh log or live-mail verification is claimed.
- Logo-origin and chat-scroll fixes are present in source; browser verification remains attributed to Claude. Latest pet requests (hide in full chat, free placement, compact chat input/reply) remain unimplemented.
- Independent TypeScript and pet-assets Node checks passed (2 tests, zero skipped). Pet-column migration remains a separate unverified task; no app changes, database access, sends or deployment this turn.

## Free pet placement and compact assistant requested — 2026-11-01 01:40 MYT
- User confirmed the full AI Assistant page/navigation stay; the floating pet is removed from inside it and remains available on Dashboard.
- Requested free interior drag/drop without corner snapping and a click-to-open control beneath the pet, smoothly expanding into an input with real authenticated replies above.
- Added PET-SCOPE-03, PET-PLACEMENT-03 and PET-QUICKCHAT-03, superseding the older in-chat pet/corner-snap/click-only-jump behavior while retaining account preferences, boundary safety and unfinished work.
- Documentation/source analysis only; no app changes, tests, provider calls or database operations. Implementation and independent approval remain pending.

## Backend startup blocked by pet migration, logo address, chat scroll — 2026-11-01 01:12 MYT
- PET-SCHEMA-03: the live database is one migration behind (f2b8d4e6a731; code head a9c4e2f7b315). The pending step only adds two empty nullable columns. Applying it, and a direct column check, were denied by the permission classifier, so nothing was changed on the database; run `run_backend.bat` (it migrates first) or `alembic upgrade head`. `run_backend.bat` now warns that reload mode does not migrate. A database password was printed in clear text in a tool output once (not saved anywhere); consider rotating it.
- LOGIN-LOGO-03: the sign-in logo lookup used port 8000 while the app uses 8003; it now uses the API client's address, checks the answer, aborts on leaving the page and keeps the bundled logo on any failure.
- CHAT-SCROLL-03: a restored chat now opens at its newest message (it stopped 2258 px short with motion on), the message pane scrolls itself, a reader who scrolled up is not pulled back and only they load older messages, older pages keep their place, and each tab keeps its place.
- Checks (self-reported, isolated fixtures): browser 269 run, 268 passed, 0 failed, 1 skipped; node unit 26/26; tsc and build clean; 8 mutants killed. Not run: live migration, live pet save/read, real backend start, other browsers or devices. Nothing committed, pushed, deployed or restarted. ChatGPT review pending.

## Backend startup, logo requests and chat restore review — 2026-11-01 00:50 MYT
- User traceback confirms missing users.pet_visible causes backend lifespan failure; existing a9c4e2f7b315 migration was not applied/tested against PostgreSQL in Claude's completion. Added PET-SCHEMA-03 and reopened account-persistence runtime completion.
- Confirmed Login logo defaults to port 8000 while the shared API/local backend default to 8003; added LOGIN-LOGO-03. Added CHAT-SCROLL-03 for saved conversations landing mid-history with pane-scoped restore/pagination checks.
- Independent isolated pet preferences: 8 passed, zero skipped; local Alembic head identified. No shared database access/write, migration, restart, app code changes or browser verification by reviewer; all three corrections await Claude.

## Account-saved pet, Luna and Hoodie Cat, pet behaviours, login sky — 2026-10-31 23:49 MYT
- PET-PREFERENCES-02: Show pet and the chosen pet are saved to the signed-in account (new nullable `users.pet_visible`/`pet_choice`, migration a9c4e2f7b315). Choices hold across refresh, new sessions and browsers. No pet is drawn until the account's choice loads. Failed saves say so and undo. An old browser-only OFF for the same account carries over once.
- PET-ASSETS-02: the old mascot is removed. Luna TechBot (default) and Hoodie Cat are fetched from the OpenPets catalog (installer inspected, not run) and measured. Attribution is recorded; Luna's artwork licence is still to be confirmed. Chat Settings has a two-pet chooser.
- PET-BEHAVIOUR-02: drag runs left/right, a click jumps, five idle seconds bring a wave, the pet looks toward the cursor, and Review shows only during the visible chat's own request. Failed, Waiting and Running are unused. Reduced motion keeps it still. The pet also appears in AI Assistant, inside the chat body.
- PET-STORAGE-01 / PET-BOUNDS-02: blocked storage falls back to the default corner. Small bodies get a smaller pet without its bubble, or none, and it returns when space comes back.
- LOGIN-SCENE-02: redrawn planets, black hole, crescent and full moon, sun, clouds and star field, with smoother day/night light. The shooting star now flies along its own tail, one at a time, and never appears with reduced motion.
- Checks (self-reported, isolated fixtures): backend 441 passed, 6 skipped. Browser 260 run, 258 passed; 1 failure fixed and re-run passing; 1 skipped. Node unit 26/26. tsc and build clean. 15 mutants killed. Not run: PostgreSQL, hosted data, other browsers or devices. Nothing committed, pushed or deployed. ChatGPT review pending.

## Pet visibility scope confirmed — 2026-10-31 22:55 MYT
- User confirmed Dashboard and AI Assistant; both share the saved account visibility and pet selection, with Review tied to the active chat request and safe chat-body boundaries.
- Updated all three workflow documents; implementation remains pending. Existing chat breathing/shimmer behavior is preserved; unspecified Failed/Waiting triggers remain unassigned.

## Saved pet choices, Luna and cat resources, behaviours and login visuals requested — 2026-10-31 22:55 MYT
- Reopened Show pet after the user's OFF-still-visible report; requested authenticated account persistence of visibility and selection across logout/login and new sessions.
- Requested replacement of the old mascot with default Luna TechBot and selectable Hoodie Cat using the supplied resource commands, plus explicit interaction-driven animations; generic Running is disabled.
- Requested refined planets, black hole, crescent/round moon and login transitions while preserving day/night timing and the chat breathing loader. Chat pet visibility and unspecified Failed/Waiting triggers remain explicitly unresolved.
- Handoff/status updates only; no assets installed, app changes, migrations, service writes or tests performed.

## Independent pet, loading and student email review — 2026-10-31 22:23 MYT
- Requested source changes are present; two pet follow-ups remain: blocked corner-storage cleanup can throw, and a 150 px-tall body produces a pet bottom at 185 px. Added PET-STORAGE-01 and PET-BOUNDS-02 with exact reproductions to the current workflow documents.
- Independent checks: isolated backend 54 passed, zero skipped; personal-email Node 3 passed, zero skipped; TypeScript and diff formatting passed. Student identity/dot-format corrections pass focused verification; broader client review remains open.
- Browser fixtures and visual comparison were not independently run (project Playwright unavailable; module-directory variable unset). Settings/shimmer stay unfinished for review; no app changes, hosted access, mail, deployment or restart performed.

## School-only student sign-in, email format, pet bounds and setting, Chat/At-Risk loading — 2026-10-31 21:19 MYT
- STUDENT-EMAIL-02: a student signs in only with an approved `@student.school.edu` address that has its Student record; student-ID sign-in is removed (staff IDs stay); the same check runs before a pending second step completes and before a reset link is sent; admin provisioning stores one lower-cased spelling. Legacy accounts were not touched or inspected.
- STUDENT-EMAIL-03: personal-email format now refuses leading, trailing and doubled dots on server, web and mobile; provisioning shares the rule.
- PET-BOUNDS-01: the pet stays inside the measured page body with a 28 px inset for drag, snap, restore, resize, sidebar collapse and scroll; a 24 px margin offset from the dashboard layout was also fixed.
- PET-SETTINGS-01: Settings with a Show pet switch at the bottom of the chat sidebar, saved per account on this browser and shared with the Dashboard pet.
- SHIMMER-02: At-Risk and AI Assistant show a page-shaped system shimmer (route load, then data load); At-Risk gets real failure/Retry and keeps its data on refresh; the existing breathing chat loader is unchanged and never overlaps the page shimmer.
- Checks (self-reported, isolated fixtures only): backend 433 passed, 6 skipped (PostgreSQL-gated); browser 249 run: 248 passed, 0 failed, 1 skipped (screenshot helper); unit 24 of 24 passed; tsc, build and flutter analyze clean. Not run: PostgreSQL, hosted data, real mail delivery, device, other browsers. Nothing committed, pushed or deployed. ChatGPT review is pending for every revision above.

## Pet boundaries, visibility setting and shared loading UI requested — 2026-10-31 20:39 MYT
- Added PET-BOUNDS-01 and PET-SETTINGS-01: keep the existing pet within the page body with comfortable edge spacing and add a bottom chat-sidebar Settings control with an account-specific Show pet toggle.
- Added SHIMMER-02: use the existing system shimmer for full-page Chat and At-Risk loading, followed by the preserved breathing chat loader only while history remains pending.
- Screenshot/source analysis and Claude handoff only; all three new implementations remain pending, existing unfinished tasks were preserved, and no app code or runtime tests changed.

## Shared task progress tracking required — 2026-10-31 20:14 MYT
- Added a synchronized status table and permanent update rule to the three workflow files: pending, fixing, unfinished, failed or completed, with separate Claude implementation and ChatGPT review results.
- Tasks are ready to clear only after implementation and independent approval with required evidence; unfinished work stays visible and completed history remains here.
- Initialized statuses from existing evidence; this documentation update does not claim new application work, tests or a Claude acknowledgement.

## Independent Attendance and student email review — 2026-10-31 20:06 MYT
- Attendance scope implementation passes focused verification; student email work needs corrections: legacy personal-email or missing-Student accounts still authenticate, student-ID sign-in remains despite the school-email-only rule, and leading/trailing local-part dots pass email validation.
- Independent isolated backend checks: 43 passed, zero skipped; TypeScript passed. Added exact reproductions and Claude corrections to the current workflow documents; no app changes, hosted access or real messages sent.
- Full browser/build/backend, PostgreSQL, mobile and live delivery were not independently rerun; prior runtime follow-through remains pending.

## Admin Attendance by programme and course; school-email sign-in with a verified personal email (ATTENDANCE-FILTER-01, STUDENT-EMAIL-01) — 2026-10-31 19:55 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; verified only in isolated tests, a fake mail provider and intercepted-API browser fixtures. Nothing committed, pushed, deployed or restarted; no hosted database was read or written and no real email was sent.

- **Attendance:** Admin Attendance now opens on Programme then Course. Nothing about classes is requested until both are chosen, courses come from the chosen programme, and the server lists, reads and edits only that course's classes (a wrong or stale choice is refused). Changing a choice clears the old results; slow answers are dropped; class notices restore their course. Staff and student attendance are unchanged.
- **Sign-in:** a student signs in with the approved school email only; a linked personal email never works as a sign-in, even after it is verified. Public self-registration as a student was closed (accounts come from the administrator).
- **Personal email:** any valid personal address is accepted (not only Gmail) once its owner enters the emailed code; school-style addresses are refused; the code expires, has a resend cooldown and is destroyed after five wrong tries. Password-reset links and attendance-warning emails go only to the verified personal address, resolved on the server, and the reset changes only the password. Mail goes through the one Resend sender, which refuses a school-domain sender.
- **Not covered:** the student ID sign-in was kept; existing hosted accounts and a live mailbox delivery check were not audited or run.
- **Checks:** backend 422 passed, 6 PostgreSQL-gated skipped; browser 236 passed, 0 failed; type-check, build and Flutter analyze pass. DB-01 and EMAIL-02 runtime follow-through remain pending.

## Attendance filtering and student email rules requested — 2026-10-31 19:10 MYT
- Added the confirmed Claude handoff: Admin Attendance requires Programme and Course selection with server-side scope validation.
- Students sign in using approved school emails only; verified linked personal emails receive notifications and recovery messages and cannot be used for login.
- Documentation only; implementation and delivery verification remain pending. Existing unfinished tasks were preserved; no application changes or messages sent.

## Independent shimmer source review — 2026-10-31 15:50 MYT
- SHIMMER-01 is present across Academics initial content and Timetable picker/options/list/access-check/grid states; refresh handling preserves existing content and drafts. No new confirmed source defect identified; older pending-only wording is superseded.
- Independent TypeScript and diff checks passed. Full browser/build/backend/hosted checks were not rerun for this source review; Claude's 228 browser/389 backend counts remain self-reported. Runtime, wider copy and platform checks remain unverified as documented.
- Updated current report/FIX/handoff; no app changes, database access/write, deployment or restart performed by reviewer.

## Page loading shimmer for Academics and Timetable (SHIMMER-01) — 2026-10-31 16:00 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; verified only in isolated tests and intercepted-API browser fixtures. Nothing committed, pushed, deployed or restarted; no database was touched.

- **Academics:** the first load now shows a skeleton of the whole page (heading, tabs, form, list, pagination) in the website's existing shimmer style. Sync Records and post-save refreshes keep the page, tab, data and any draft instead of replacing it. The Semesters list no longer flashes "No semesters yet." while loading.
- **Timetable:** the admin first screen, the Course control after a programme change, the semester list after a course choice, the selected semester's page during the access check and its grid while classes load all show matching placeholders. A page waiting for a choice is not shimmering, nothing is fetched to fill a placeholder, and blocked, unavailable and failed screens show their status with Back or Retry. Students and staff get the same shapes without the admin selectors.
- Each loading area has one concise status and hidden, non-interactive placeholders. Reduced motion, dark and narrow screens checked in fixtures.
- Also fixed a race where an invalid course and an unknown programme in the address undid each other's cleanup.
- Checks: browser 228 passed, 0 failed; backend 389 passed, 6 PostgreSQL-gated skipped; type-check and build pass. Not run: account switch, live refresh of an open timetable, slow lazy-import fallback, other browsers, touch. DB-01 and EMAIL-02 runtime follow-through remain pending.

## Independent admin-filter and shimmer status review — 2026-10-31 15:15 MYT
- ADMIN-FILTER-01 source and server scope checks are present; focused isolated backend 11 passed, zero skipped, TypeScript/diff checks passed. Full browser/build/hosted/PostgreSQL checks were not independently repeated; no new confirmed filter defect found.
- SHIMMER-01 remains unimplemented: Academics still has ledger-only shimmer and the admin timetable options still use loading text/partial placeholders. Request history has no completion entry. Kept this correction in current FIX/handoff and clarified the report's older pending admin-filter wording.
- Documentation review only; no app changes, new tests, database access/write or deployment performed. Standing authorization and prior runtime/copy follow-through remain intact.

## Academics and Timetable page shimmer requested — 2026-10-31 15:14 MYT
- Added SHIMMER-01 to existing handoff/FIX: reuse system shimmer across full initial page content and appropriate pending sections, including Academics forms/tabs/lists and Timetable options/list/detail.
- Keep intentional selection-ready, empty, failed and blocked states distinct; preserve drafts, scoped loading, no-unfiltered-first-request behavior and current-only access.
- Documentation/source inspection only; no app changes or new runtime/browser tests. Standing access, concise-copy rules and earlier unfinished verification remain.

## Admin timetable: choose a programme and course first (ADMIN-FILTER-01) — 2026-10-31 15:10 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; verified only in isolated SQLite tests and intercepted-API browser fixtures. Nothing committed, pushed, deployed or restarted; no database was touched.

- Admin Timetable now opens on a Programme dropdown and a Course dropdown (course options come from the chosen programme only, with search for long lists). Nothing about semesters is requested until both are chosen; the list then shows that course's semester with counts for that course, and opening it shows only that course's classes. Back, refresh and browser history keep the choice (it is in the address).
- The server enforces it: the admin list, semester check and timetable read need programme and course, a course outside the programme or a semester that is not the course's is refused (404), upcoming/previous stay blocked, and a student or staff member who sends these filters gets 403. Students and staff see no selectors and their lists are unchanged.
- Distinct states for loading, failure with Retry, no programmes, no courses, a course with no semester and no matching semester. A class notice restores its programme and course.
- Checks: backend 389 passed, 6 PostgreSQL-gated skipped; type-check and build pass; browser 213 passed, 0 failed; Node unit 21/21. Not run: PostgreSQL, real or hosted data, Flutter, other browsers, touch. DB-01 and EMAIL-02 runtime follow-through remain pending.

## Admin programme and course timetable filters requested — 2026-10-31 14:47 MYT
- Prepared ADMIN-FILTER-01: admin chooses a programme and its course before semester rows load; selected timetable and Back retain that course scope. Require server-side filtering/membership validation and dependent options rather than downloading the whole list first.
- Student/staff lists and assigned programme/course scopes stay unchanged, with current-only viewing preserved. Real records only; no allocation or semester changes requested.
- Updated current handoff/FIX/report while retaining standing access, concise-copy rules and existing runtime follow-through. Documentation only; no app changes, new tests, database action or deployment this turn.

## 10 PM is now a full grid row — 2026-10-31
- The timetable grid has a real 10 PM row and column cells of the same size as the 9 PM row, replacing the hanging label. Classes still end at 22:00 and cannot be dragged past it. Self-reported: browser fixtures only.

## 10 PM label spacing — 2026-10-31
- The 10 PM label now sits one row (72 px) below 9 PM, like the other labels, instead of being squeezed into the last row; no extra row is drawn. Self-reported: browser fixtures only; browser 201 passed, 0 failed.

## Independent source and real tutorial-data review — 2026-10-31 14:17 MYT
- TERM-04 source changes pass focused verification; integrated 22:00 edge and actual class time ranges are present. Independent backend 14 passed, zero skipped; TypeScript/diff checks passed. Full browser/build/mobile/PostgreSQL test paths were not independently rerun; complete copy coverage remains unverified.
- Under AUTH-01, Supabase MCP SELECT-only aggregates on FYP_project confirmed TRY-01 has 0 enrolments/groups, 1 Tutor assignment and only its lecture; group-based tutorial creation needs genuine enrolment. BMCS2073 has 2 groups, 4 tutorials and 2 practicals, with no missing expected assignment-group combinations in these two inspected courses.
- No database write, student allocation, repair, migration or deployment performed. Updated current report/FIX and retained authorization plus DB-01/EMAIL-02 runtime follow-through; older no-access statements remain dated history.

## Standing project access granted — 2026-10-31 14:15 MYT
- User granted Claude, ChatGPT/Astra and Codex standing access to project files/.env and configured services, including Supabase, with reads and necessary writes for requested work. Suitable MCP/plugins are preferred; permitted CLI/direct connections are allowed when needed.
- AUTH-01 supersedes older local missing-permission/read-only/MCP-only restrictions for requested tasks, including real tutorial inspection and scoped repair. Actual enforced tool/account restrictions still apply; no denial may be bypassed.
- Updated the same three workflow files. Authorization documentation only: no secrets read, database queries/writes, repair, deployment or implementation review performed this turn.

## Schedule disclosures, 10 PM edge, class time range and shorter wording (TERM-04, TIME-02, TIME-03, COPY-01) — 2026-10-31 14:10 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; verified only in isolated SQLite tests and intercepted-API browser fixtures. Nothing committed, pushed, deployed or restarted; no shared data touched.

- **TERM-04:** course lists (`/lecturers/me/courses`, `/sessions/my-courses`, `/students/me/enrolments`, `/admin/courses`) keep the course, enrolments, attendance and history but now blank the lecture day/time/room unless the course is in a current semester. A course with no semester no longer has a schedule on any read, including the omitted-semester timetable reads. The Flutter app was checked by source only, not run.
- **TIME-02:** the detached 10 PM row is gone; the closing line and the 10 PM label are part of the grid, which stays 08:00–22:00 with the same geometry. A 20:00–22:00 class ends on the line.
- **TIME-03:** each class card shows its real start and end, such as "8 PM – 10 PM" or "8:30 AM – 10 AM"; the label, hover, print preview, PDF and course table match. Short classes (30–45 minutes) no longer spill out of their card.
- **COPY-01:** about 75 notices, empty states, help texts and errors across the web were shortened to one plain sentence and developer wording removed. This was a bounded scan, not a full review: short strings, email bodies, backend messages and the mobile app were not covered. The unscheduled-class note now reads "No class time yet for CS1 practical."
- **TUTOR-01 real data:** not inspected (no authorized read-only access this session); the live symptom is not confirmed resolved and no repair was run.
- **Checks:** backend 386 passed, 6 PostgreSQL-gated skipped; type-check and build pass; browser 201 passed, 0 failed; Node unit 21/21. Not run: PostgreSQL, real or hosted data, Flutter device, other browsers, touch, PDF content. DB-01 and EMAIL-02 runtime follow-through remain pending.

## Plain website wording and timetable time display requested — 2026-10-31 13:47 MYT
- Added permanent COPY-01 rule for short, familiar user-facing wording throughout the website, normally one short sentence per notice/help message; remove repetitive technical explanations.
- Added TIME-02 for an integrated 10 PM closing edge and TIME-03 for actual start–end ranges visible on class cards without hover. Preserve true class duration and the 08:00–22:00 grid.
- Updated existing workflow files and retained unfinished TERM-04/tutorial-data/runtime checks. Documentation only; no app changes, new tests, shared-data repair or deployment performed.

## Independent timetable completion review — 2026-10-31 13:31 MYT
- UI corrections and original TERM-03 code fixes are present in source. Independently reproduced TERM-04: course-metadata API still returns upcoming/previous lecture times, and no-semester schedules remain returned. Recorded targeted corrections while preserving course/attendance history.
- Tutorial enrolment-order and multiple-assignment fixes pass isolated tests, but real TRY-01 inspection/repair remains undone; actual missing classes are not confirmed resolved.
- Independent backend 13 passed, date-grid Node 5 passed, TypeScript passed, zero skipped focused tests. Full build/browser/PostgreSQL/mobile/live checks were not independently rerun; Claude's counts remain attributed in report. No shared query/repair, app changes or deployment by reviewer.

## Timetable layering, boundary, notices, Back label, tutorials and current-only gaps (LAYER-01, SCROLL-01, TIME-01, NOTICE-01, BACK-01, TUTOR-01, TERM-03A/B) — 2026-10-31 10:40 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; verified only in isolated SQLite tests and intercepted-API browser fixtures. Nothing committed, pushed, deployed or restarted; no shared data touched.

- **TERM-03A:** leaving out `semester_id` on the lecturer and student schedule reads now returns only current-semester schedules, so upcoming and previous ones cannot be fetched that way; the test that asserted the old behaviour was replaced. The Flutter app was checked by source only, not run. Other course-metadata reads that carry one lecture time per course are not restricted and need a decision.
- **TERM-03B:** an open semester now closes from its own end date on the server-sampled clock even if the recheck fails, is slow or offline; a still-current semester stays open through a harmless failed refresh.
- **LAYER-01:** the live line and its circular marker no longer draw over the application header (reproduced first); previews and drag layers are contained to the timetable. A separate date-chip overlap could not be reproduced.
- **SCROLL-01:** the horizontal scrollbar now sits 8–10 px inside the rounded timetable card instead of touching it; full scroll reach kept.
- **TIME-01:** a "10 PM" label and boundary close the grid at 22:00; the grid is still 08:00–22:00 and a 20:00–22:00 class ends on the line.
- **NOTICE-01:** the admin drag guidance is spaced from the grid and has its own X (Saving feedback stays visible); the assistance notice is student-only with its own X.
- **BACK-01:** the return button reads exactly "Back" with the chevron in every state.
- **TUTOR-01:** tutorials and practicals were only created when an assignment was made, never when students were enrolled afterwards, and students saw only the first assignment per role. Both fixed in code and fixtures; admins see why a tutorial/practical is not scheduled yet. The real TRY-01 data was not inspected; `python seed.py reconcile-groups` lists (dry run) and with `--apply` repairs existing data and was not run.
- **Checks:** backend 385 passed, 6 PostgreSQL-gated skipped; type-check and build pass; browser 193 passed, 0 failed; Node unit 21/21. Not run: PostgreSQL, real or hosted data, Flutter, other browsers, touch, overlay scrollbars. DB-01 and EMAIL-02 runtime follow-through remain pending.

## Timetable header overlap and scrollbar spacing requested — 2026-10-31 10:11 MYT
- Recorded LAYER-01 from supplied screenshots: contain live-time/today indicators so they cannot overlap application or weekday headers; verify local stacking/scroll behavior without breaking previews, drag or dialogs.
- Recorded SCROLL-01: add visible horizontal-scrollbar spacing inside the rounded timetable/card and preserve full scroll reach and the 22:00 boundary.
- Retained earlier pending UI/tutorial requests and TERM-03A/B/runtime follow-through in the same three ignored workflow files. Documentation only; no application changes, new tests, production action or deployment performed.

## Timetable display and missing tutorial requests — 2026-10-31 10:09 MYT
- Prepared current Claude handoff/FIX for visible 22:00 end boundary without adding an extra hour, spacing and X dismissal for admin drag guidance, student-only dismissible assistance, short Back labels and missing tutorial/practical investigation.
- Source confirms the grid extent is already 08:00–22:00, with no final label. Tutorial creation requires real enrolled groups; actual course data was not queried and no live root cause is claimed. Require genuine meetings/role/group scope rather than fabricated extra classes.
- Documentation only; no application change/tests, database repair, production mutation or deployment this turn. Existing TERM-03A/B and runtime obligations remain pending.

## Independent current-only timetable review — 2026-10-31 03:01 MYT
- TERM-02 list-first web journey and CAL-02 keyboard date clamping are present. Found TERM-03A: omitting semester_id on student/lecturer data endpoints still returns upcoming/past schedules, contrary to the confirmed policy; an existing passing compatibility test explicitly preserves this bypass.
- Found TERM-03B in source: expired detail remains open if Malaysia-day revalidation fails/offline. Browser reproduction not independently run. Recorded both corrections in existing FIX.md and replaced the current review report.
- Independent focused backend 23 passed, Node date-grid 5 passed, zero skipped; TypeScript passed. Full/browser/build/PostgreSQL/mobile/live checks were not independently rerun. DB-01/EMAIL-02 runtime checks remain unverified. Documentation only; no app changes, production mutation or deployment by reviewer.

## Semester timetable list and calendar keyboard fix (TERM-02, CAL-02) — 2026-10-31 02:40 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; verified only in isolated tests and intercepted-API browser fixtures.

- **CAL-02:** PageUp/PageDown in the date picker now land on a real day of the target month (31 March back is 28 February, 29 in a leap year) and never on a greyed day; a move toward the minimum or maximum lands on that edge when it is inside the target month.
- **TERM-02:** Timetable now opens on a semester list (upcoming, current, previous) instead of a weekly grid, and the Weekly timetable/Semesters tabs and Show all classes are gone. Only the current semester opens; upcoming and previous rows stay listed with a disabled "Blocked from viewing" action and the reason. The list comes from the semester records (an admin sees saved semesters even with no courses; others see their own scope), and states for no semesters, no courses, no classes, loading and failure are separate. The server enforces the same rule on the semester endpoints and on the lecturer, student and admin timetable reads when a `semester_id` is given; the admin read now requires it. The selected semester is in the address (`?semester=<id>`), is revalidated on open, reload, Malaysia date change and any refusal, and never shows another semester's classes. Notifications about a class open its semester or show why they cannot.
- **Needs your decision:** the Flutter app's `/students/me/courses` and `/lecturers/me/timetable` calls carry no `semester_id` and still return every semester in the person's scope; I did not change them. The admin timetable course/programme filter bar and the no-semester fallback were removed; courses with no semester have no web timetable now.
- **Checks:** backend 379 passed, 6 PostgreSQL-gated skipped; web type-check and build pass; browser suites 170/170 and Node unit 21/21. New queries were not run on PostgreSQL; real data, hosted runtime, Flutter app and the reference image are unverified. Nothing committed, pushed, deployed or restarted. DB-01 runtime resolution and EMAIL-02 checks remain pending.

## Semester viewing policy confirmed — 2026-10-31 02:03 MYT
- User confirmed TERM-02: only current semesters may open their timetable. Upcoming and past semesters remain listed with viewing blocked in the UI and backend; this supersedes the earlier provisional upcoming-access assumption.
- Updated the existing fix, implementation handoff and review report, including Malaysia start/end boundary verification. Documentation only; implementation remains pending.

## Semester timetable navigation correction requested — 2026-10-31 02:01 MYT
- TERM-02 replaces the previous tabs with semester list -> selected semester timetable -> Back to list. Upcoming/current/previous rows remain visible; past timetable viewing must be blocked in UI and backend. Upcoming access is provisionally allowed pending clarification.
- Source inspection found weekly-first default, unrestricted row actions, Show all classes and rows derived only from linked courses. Handoff now requires real authorized semester metadata and distinct no-course/loading/error states; shared database contents remain unverified.
- Reused current workflow files; retained CAL-02/runtime follow-through. Documentation only, no application implementation, tests, production changes or deployment this turn.

## Independent calendar and audit implementation review — 2026-10-31 00:44 MYT
- Reviewed Claude's latest report against source. Saved-chat restoration corrections, password explanation, styled semester dates/course states, semester overview and audit filters are present; existing-password retrieval remains unavailable, not fulfilled.
- Found CAL-02: keyboard PageUp/PageDown overflows shorter months (March 31 -> PageUp -> March 3 instead of February 28). Reproduced with extracted source helpers and recorded the focused correction in existing FIX.md.
- Independent checks: 71 isolated backend tests and 5 audit-range Node tests passed, zero skipped; TypeScript and diff whitespace checks passed. Full build/browser/PostgreSQL/real-service checks were not independently rerun; Claude's full counts remain self-reported. Real course data and DB-01/EMAIL-02 runtime verification remain unverified.
- Documentation only by reviewer; no app implementation, production query/change, migration, real email, restart/deployment, commit or push.

## Saved-chat chips, password row, semester calendar, course list, semester overview, audit filters — 2026-10-31 00:40 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; verified only in isolated tests and intercepted-API browser fixtures.

- **SUGGEST-02:** every saved answer now stores its own follow-ups (empty for greetings, refusals, off-topic, failed lookups and errors) without clearing the entity context; reopening a chat shows exactly what its last reply showed. History returns `null` for a chat with no stored state, shown as labelled starters, which is not the same as an intentionally empty list.
- **DETAILS-03:** existing passwords still cannot be viewed (bcrypt hashes only), so that literal request is not met. Both detail dialogs now say so and offer Change password, which opens the existing Edit form; a blank edit keeps the password and only an explicit new one replaces it.
- **CAL-01:** a styled date-only calendar replaces the native semester date inputs. Dates before today in Malaysia are greyed and disabled (end minimum is the later of today and the start), the minimum follows Malaysia midnight, and the server refuses newly chosen past dates while keeping unchanged saved ones.
- **COURSE-01:** one failed request no longer blanks every Academics list. The semester course list now says whether it is loading, failed (with Retry), empty, or fully assigned, with counts, a search box for long lists and styled checkboxes. Whether the real database has courses is not established.
- **TERM-01:** a Semesters tab on the timetable lists each semester's programme, dates, total weeks and status, and View timetable scopes the weekly view to it. The supplied reference image was not visible to me, so the layout follows the handoff text.
- **AUDIT-01:** the audit log has From/Until filters (Malaysia time, past dates allowed, whole-day and minute-inclusive semantics) with Apply and Clear dates, applied by the server before ordering. Stale answers are ignored and failures show Retry. Row and dialog times now read in Malaysia time; typed search applies on Apply.
- **Checks:** backend 372 passed, 6 PostgreSQL-gated skipped; web type-check and build pass; browser suites 166/166 plus Node unit 16/16. The embedded-PostgreSQL migration tests were not run (pglite not installed).
- **Not verified:** real data, hosted runtime, touch, other browsers. Nothing committed, pushed, deployed or restarted. DB-01 runtime resolution and EMAIL-02 checks remain pending.

## Calendar, semester courses and audit filter request — 2026-10-31 00:03 MYT
- Prepared current Claude handoff for a system-styled semester date picker, Malaysia past-date restrictions with unchanged historical-edit support, informative course selection states, reference-inspired semester timetable overview and audit date/time filters that retain historical access.
- Source review confirms missing semester start minimum/empty-course message and category/search-only audit filtering; actual database course availability remains unverified.
- Reviewed existing report/history: SUGGEST-02, DETAILS-03 and runtime follow-through lack new completion evidence. Documentation only; no application implementation, runtime tests, database change, deployment or push performed.

## Staff and student password detail request — 2026-10-30 16:36 MYT
- Recorded the repeated password-display request as DETAILS-03 in the existing ignored FIX.md; no application change implemented by reviewer.
- Confirmed existing passwords are salted bcrypt hashes and cannot be recovered. Proposed clear password explanation and reuse of existing admin change-password controls for both dialogs; actual existing-password display remains unavailable.
- SUGGEST-02 and unresolved runtime verification remain pending; no real account password changed.

## Independent review of weekly view, suggestions and account details — 2026-10-30 16:17 MYT
- Weekly dropdown and requested detail-field removals are present in source; browser/live API verification remains separate from Claude's reported checks.
- Found saved-chat suggestion defects: greeting/refusal/off-topic responses leave old stored follow-ups; empty follow-up restoration can fall back to generic starters. Recorded correction SUGGEST-02 in the existing ignored review-workflow/FIX.md.
- Independent isolated chat tests: 32 passed, zero skipped; TypeScript and diff whitespace checks passed. Separate SQLite reproduction confirmed stale suggestions after Hello. Full browser suite and live database/email flows were not independently rerun; DB-01 runtime verification remains pending.

## Weekly view, contextual follow-ups, admin account details — 2026-10-30 16:08 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; verified only in isolated tests and intercepted-API browser fixtures.

- **WEEK-01:** the Weekly view control was disabled whenever no single semester was in scope. It now always opens: real numbered weeks for one semester, otherwise a "Weekly view · this week" choice plus a hint explaining why numbered weeks are unavailable (nothing invented). Keyboard open/move/select/Escape, focus return and outside click work; week options transition colours only because `transition-all` stopped focus on open.
- **SUGGEST-01:** the assistant no longer pads every answer with the same four defaults. Follow-ups are deterministic, built from entities the server resolved in the lecturer's scope, keep the course/group, never repeat an asked question, and are empty when there is no context (labelled starters only before a chat has any). They are scoped to their own chat (no cross-tab or temporary-chat influence) and restored with a saved chat. Also fixed: the deterministic "below N%" plan ignored the course.
- **DETAILS-02:** Two-factor authentication, Display and Notifications are removed from the student and staff detail dialogs and from their admin detail responses; student details gain Account role. No passwords or hashes are exposed. `last_login_at` is written on every login, so null means never signed in. A failed photo fetch now shows the server's own message.
- **Checks:** backend 348 passed, 6 PostgreSQL-gated skipped; web type-check and build pass; browser suites 127/127 plus Node unit 11/11 (two stale tests updated).
- **Not verified:** real data, hosted runtime, touch, dark theme, other browsers. Nothing committed, pushed, deployed or restarted. DB-01 runtime resolution and EMAIL-02 checks are unchanged and still pending.

## Requested — 2026-10-30 15:36 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Added current FIX.md requirements for a usable Weekly view dropdown, conversation/account-context next questions, complete existing non-secret account details and removal of Two-factor authentication, Display and Notifications from both admin detail dialogs. Existing passwords are hashes and cannot be fetched; no credential exposure or account reset is requested.
- Source inspection found the week dropdown disabled without semester and shared default suggestions appended to every candidate list. Documentation only; application changes and tests remain pending. Reused the same three workflow files.

## Prepared-statement source follow-up (DB-01) — 2026-10-30 14:40 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; no code, deployment or restart.

- The producer of the Supavisor 42P05 errors is **unknown**. The local backend (direct host, port 5432, running the patched code since uvicorn's automatic reload at 14:27:08) is unlikely to be it. Circumstantial lead: a hosted or other instance of this backend through the Supabase pooler, since committed code has no preparation policy and runs 60-second loops that match the error timing, and the ignored deployment notes recommend pooler port 6543. Not confirmed.
- The fix touches only `db/database.py` and `domain/live_updates.py` (+9/-2), so it can be committed and deployed alone. A rollout plan and the evidence needed to close the issue (hosted `DATABASE_URL` host/port and deployed commit, then a bounded clean Supabase log window) are in the review report. Nothing was deployed; the push is the user's.
- **Not verified:** Supabase log correlation (no Supabase tools in my session), hosted environment and revision, the dashboard error breakdown, and any post-rollout logs.

## Prepared-statement runtime review — 2026-10-30 14:38 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Source review confirms prepare_threshold=None on the owned SQLAlchemy/Psycopg engine and raw LISTEN connection; independent focused configuration tests: 4 passed, 3 PostgreSQL tests skipped. No new confirmed defect in those changed connection settings.
- New screenshot shows SQLSTATE 42P05 (prepared statement already exists), distinct from the earlier 26000 missing-statement error. Read-only Supabase logs for 14:30-14:36 MYT confirm three 42P05 PARSE failures at 14:32:57, 14:33:57 and 14:35:58 with application_name Supavisor. Local configured URL is direct 5432; the specific upstream client/hosted process remains unidentified. Pooler server-session age does not identify the client process age.
- The dashboard's 22 errors/57.7% success are aggregate window counts, not proof every error is this statement failure or that all occurred after the fix. Claude reports no restart/deploy; local source correctness is not runtime resolution. Updated the current FIX.md with targeted client/deployment attribution and fresh-connection verification. No database mutation, restart, deployment or source change performed by this reviewer.

## Prepared-statement fix (DB-01) — 2026-10-30 14:30 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; backend only.

- The SQLAlchemy engine (and therefore Alembic) and the live-updates LISTEN connection now pass `prepare_threshold=None` to Psycopg 3, which turns off automatic server-side prepared statements. SQL parameter binding, transactions, pool settings and the dedicated autocommit LISTEN connection are unchanged. No migration, retry or `DEALLOCATE` workaround.
- Reproduced the reported SQLSTATE 26000 on a local throwaway PostgreSQL by resetting a session after repeated queries; with the setting the same sequence passes. Added 7 tests (4 fail without the fix). Full backend suite: 341 passed with the local PostgreSQL, 335 passed and 6 skipped without it.
- **Not verified:** which client produced the user's screenshot (the configured backend URL is a direct Supabase connection on port 5432, not a pooler; no Supabase tools were available to correlate logs), the hosted runtime, and fresh connections to the real database. Running processes must be restarted to pick the change up; nothing was restarted. EMAIL-02 startup, `/health` and Resend checks remain pending.

## Database investigation — 2026-10-30 14:21 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- User screenshot shows SQLSTATE 26000, named prepared statement missing from its session. Backend Psycopg connections currently permit automatic preparation; local configuration is direct Supabase port 5432, so transaction pooling is not confirmed as the local cause. Hosted/source-client settings remain unverified.
- Added DB-01 to the current FIX.md: verify the originating connection, apply Psycopg prepare_threshold=None to owned connection factories, preserve transaction/parameter-binding/LISTEN behavior and verify on fresh isolated connections. Read-only filtered Supabase log lookup returned no matching rows through the queried field; no runtime resolution is claimed.
- Documentation only: no application code, database, migration, deployment or service restart performed by this reviewer.

## Warning-email schema recovery (EMAIL-02) — 2026-10-30 02:08 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; no code changed.

- The startup failure (`alerts.delivery_status does not exist`) was a code/database version mismatch: migration `f2b8d4e6a731` (four nullable `alerts` columns) had not been applied, and plain `uvicorn` skips Alembic. The startup check correctly refused to run; it was left in place.
- With the user's approval for this specific migration I ran `alembic upgrade head` against the backend's configured shared Supabase database (project ref `iekqyzdevnzeohmiddjc`). It reported nothing to apply, and `alembic current` is `f2b8d4e6a731 (head)`, so the database was already at head. All five startup schema checks, including the alert delivery columns, now pass against it.
- **Not verified:** the backend lifespan and `/health` (I did not start the server against the shared database; restart with `run_backend.bat`), the lecturer alert list and other flows on real data, and the Resend sender domain (Resend MCP not yet authorised in Claude). No email was sent.

## Startup review — 2026-10-30 02:01 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- New user traceback confirms missing alerts.delivery_status stops lifespan in the alert-delivery schema check. Migration f2b8d4e6a731 is present and both implementation reports disclose it remains unapplied. Direct uvicorn skips the launcher's migration step; the Google Python support warning is unrelated.
- Independent focused warning-email/notification-detail/locator/photo/staff suites: 52 passed, 3 PostgreSQL tests skipped, 5 warnings with isolated SQLite/fake services. Full reported 334 suite and browser/real-service checks were not rerun.
- Updated the existing FIX.md with EMAIL-02: verify target/schema/revision, use the existing Alembic migration under valid authorization, then restart and verify actual startup/health. No migration, real email, database/application edit or deployment performed by this reviewer.

## Avatars, warning email, notification details, chat loader — 2026-10-30 01:55 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; local and uncommitted; not independently reviewed.

- **Profile images:** the signed-in account's `avatar_url` now shows in the sidebar account chip (expanded, collapsed and menu) and in the chat "ME" circles, from one cached, account-scoped value that refreshes after a photo change and clears on logout. A neutral fallback appears only when there is no image or it fails to load.
- **At-risk warning email (real sending, not yet applied):** the warning now goes through Resend to the student's verified recovery email, chosen on the server. The lecturer must teach the course and the student must be enrolled; the edited text is sent exactly; retries and double clicks are idempotent; the status is pending, accepted or failed and "sent" is recorded only after the provider accepts the message. The unsupported advisor-CC and "Delivered" claims were removed, and old rows show "Recorded only - no email was sent". Acceptance does not prove inbox delivery. **Needs migration `f2b8d4e6a731` (`alembic upgrade head`) before the backend can start, and a verified Resend sender; neither was done or checked, and no real email was sent.**
- **Notification details:** attendance requests, correction decisions, and cancelled or replacement classes now open a read-only detail dialog (new `GET /notifications/{id}/detail`, owner-scoped and rechecked against current access). Lecturers get the assigned class instead of the "administrator Attendance page" message (cause: the lecturer tab map had no entry for class-review notices); students see their own content; admin exact-row targets are unchanged. Missing or no-longer-permitted targets say so.
- **Chat:** restoring a saved chat shows only a centred "Loading..." loader over a soft blue glow (static under reduced motion); saved messages appear without a greeting; failures show Retry; older messages load with a small separate indicator. A genuinely new chat shows a short typing indicator then the greeting once.
- **Locator hardening (LOCATE-01):** `focus_id` must now be a complete UUID (normalised); anything else is ignored, never a database error. Verified on a local throwaway PostgreSQL, including that unvalidated malformed text does raise there.
- **Checks:** backend 334 passed with a local PostgreSQL (331 passed, 3 skipped without); `tsc` and build pass; real Chrome runs with intercepted APIs for every item above. Not tested: account switch without logout, touch, dark theme, real Resend/Storage, Flutter.

## Requested — 2026-10-30 01:35 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Added screenshot-based avatar, role-correct staff/student notification and chat typing/history-loader requirements to existing FIX.md. User confirmed at-risk warnings must be sent through Resend to the student's verified recovery email. Current Alert endpoint only records warnings; real sending, truthful status and duplicate prevention are requested.
- Documentation only; implementation/tests and provider setup verification remain pending. No real email, application/database change or push performed.

## Independent review — 2026-10-30 01:20 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Notification destination coverage is substantially expanded and scoped page locators pass isolated ownership/filter tests. Attendance requests/corrections and cancelled/replacement classes still have no exact-content view; these remain pending requirements, not user-approved exclusions.
- Found malformed focus_id values accepted by the new regex (hex-only/hyphen-only strings that are not UUIDs) before typed UUID comparisons. Validation flaw confirmed locally; its PostgreSQL error behavior was not exercised. Added LOCATE-01 to the current FIX.md alongside remaining NOTIFY-01 scope.
- Independent focused run: 36 passed, 2 PostgreSQL tests skipped, 5 warnings across locator/photo/staff suites with isolated fixtures. Full reported 315 suite, browser and real-service checks were not rerun. Updated current review report; no application/database changes performed.

## NOTIFY-01 notification destinations — 2026-10-30 01:17 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; local and uncommitted; not independently reviewed. This supersedes the earlier "partial" note for notification destinations.

- **What now opens the exact content (scrolled to, focused, outlined, announced):** admin class reviews, feedback, medical leave, announcements and timetable meetings; student feedback responses, medical-leave decisions, announcements (even beyond the first six) and timetable meetings including class reminders; lecturer announcements and timetable meetings.
- **How:** the four paged record endpoints accept an optional `focus_id` and return the page that contains that record within the same account scoping and filters (one windowed query, no scanning); student courses and the lecturer timetable now include `meeting_id`. No migration, no backfill; existing notice payloads already carried the IDs, and legacy notices without one show an explicit note.
- **Still not openable, by design of the website:** attendance requests and correction decisions (the website has no view of them) and cancelled or replacement classes (the weekly timetable does not show them). These open the right page with a clear note instead of highlighting something unrelated.
- **Checks:** backend `pytest tests` 315 passed, 2 PostgreSQL tests skipped (not re-run); `tsc` and the web build pass; real Chrome runs with intercepted APIs for each supported kind and role, off-page records, already-open destination, rapid clicks, canceled leave guard and missing records. Not tested: logout and account switch, touch, dark theme, the lecturer Course notices tab, real backend data.

## Independent review — 2026-10-30 01:02 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Panel clipping/list scrolling, security button styles and the single combined quiet-hours preference save are present in inspected source. Claude's latest browser evidence was not independently repeated; account-switch/discard/reload and related interaction checks remain open.
- Exact notification navigation is incomplete: only admin class-review targets are implemented; valid request/feedback/medical/timetable/announcement and lecturer/student notices remain page-only. Added NOTIFY-01 to current FIX.md; the original user requirement is not complete.
- Independently ran focused photo/staff suites: 32 passed, 2 PostgreSQL tests skipped, 5 dependency warnings. The new late-upload recovery handling and isolated regressions pass; full reported 311 suite, browser and real-service tests were not rerun. Updated the existing review report; no application or database changes performed.

## PHOTO-04, notification panel and navigation, settings — 2026-10-30 00:59 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; local and uncommitted; not independently reviewed.

- **PHOTO-04 (registration photo lifecycle):** a late upload that completes after the cleanup worker already claimed, deleted and forgot its intent is now detected right after the upload and deleted via a committed tombstone instead of being left unreferenced; registration still succeeds without a photo and a claimed photo is never attached. Upload timeouts also tombstone the key. Documented bounds: normal uploads finish in seconds versus a 10-minute grace period; a remote write that lands after the request has given up and deleted would need periodic bucket reconciliation (not implemented). Backend tests: 311 passed, 2 PostgreSQL tests skipped (not re-run in this pass).
- **Notification panel:** the outer scrollbar no longer sits on the rounded edge. The panel clips its own corners, header/toolbar/footer stay pinned and only the list scrolls. `FloatingPanel` has a new opt-in `clip` prop; all other callers behave as before.
- **Notification destinations (partial):** clicking a notice now navigates through a typed internal target. Exact opening and outlining is implemented only for admin Attendance class notices (`class_needs_attention`, `class_attention_escalated`, by class id, including a different page of the list); other notice types open the right page and show a note that they do not yet point to a specific item, and notices without an id show a legacy note. Missing or inaccessible items show an honest unavailable note. Attendance requests, feedback, medical leave, timetable, announcements and the lecturer/student destinations still need by-id loading before they can be opened exactly.
- **Settings:** Security & Authentication actions use the application button styles (behaviour and verification unchanged). Quiet hours use the shared switch and website input styling, are part of the one settings draft (dirty tracking, validation, single Save Preferences request) and the separate "Save quiet hours" button was removed. Overnight ranges stay valid; equal times are rejected inline.
- **Checks:** `tsc --noEmit` and `npm run build` pass; browser checks in real Chrome with intercepted APIs for panel clipping (desktop, narrow, short), class navigation cases and the quiet-hours save/validation/failure flow. Not tested: touch, dark theme, canceled leave guard, account switch, reload after save, and the other notice types' exact destinations.

## Requested — 2026-10-30 00:44 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Prepared the current Claude handoff for notification panel scrolling inside its boundary; notification activation must open the exact authorized content and identify it with accessible focus/highlight, including missing/legacy-target handling.
- Requested consistent security-action button styling and website-style quiet-hours switch/time controls. Quiet hours must join the main settings draft and single Save Preferences action; remove the duplicate child save without losing persistence or dirty/discard handling.
- Planning only; no application changes/tests performed. Existing PHOTO-04 remains unresolved; reused the same three ignored workflow files.

## Independent review — 2026-10-30 00:38 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Students Manager now confines horizontal scrolling to the minimum-width table, with pagination outside it and nonwrapping actions; source matches UI-01. Claude reports Chrome checks at three widths; those browser checks were not independently rerun here.
- Independently ran focused photo/staff suites using isolated SQLite and fake Storage: 28 passed, 2 PostgreSQL tests skipped, 5 dependency warnings. The tombstone protocol addresses the previously identified deletion/rollback path in inspected source and focused tests; real PostgreSQL results remain implementer-reported.
- A new in-memory reviewer test failed: after an upload exceeded the cleanup grace period, cleanup removed its intent/tombstone before the upload completed; the late write then remained in Storage with photo_saved=false, no photo reference and zero cleanup rows. Added PHOTO-04 to existing FIX.md. No actual private image/database service was used, and no persistent test or application source was changed.

## UI-01 table layout and PHOTO-03 tombstone protocol — 2026-10-30 00:36 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; local and uncommitted; not independently reviewed.

- **UI-01 (Students Manager):** horizontal scrolling is now confined to the table. The record count and pagination sit inside the card but outside the scroller and wrap when narrow, the table has a minimum width instead of compressing columns, and the action buttons no longer shrink, wrap or clip (Reset face stays on one line). The scroller also has horizontal scroll padding so keyboard focus fully reveals the last action. Verified in real Chrome at 1280, 718 and 390 px with intercepted APIs (no page overflow, all actions reachable by scroll and by keyboard); touch/trackpad gestures were not tested.
- **PHOTO-03 correction:** the previous protocol could still leave a usable cleanup intent after the object was deleted, if the cleanup's database commit failed and rolled back. Cleanup is now claim, delete, forget: it first commits a `claimed:` tombstone in place of the intent (a deleted object can then never be attached by registration), then deletes the object (idempotent), then removes the tombstone. Any failure or crash leaves only the tombstone, which every worker retries and nothing can attach. Duplicate workers are harmless. This supersedes the earlier statements that the worker race was fully closed by the row lock alone. No schema change; the tombstone is encoded in the cleanup key.
- **Checks:** backend `pytest tests`: 309 passed with a local throwaway PostgreSQL (two real-PostgreSQL concurrency tests included), 307 passed and 2 skipped without it; web `tsc --noEmit` and `npm run build` pass. Not run: real Supabase storage and the shared database.

## Fix requested — 2026-10-30 00:26 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Added the Students Manager narrow-layout scrollbar issue to the existing local FIX.md: table-only horizontal scrolling, independently visible pagination, reachable action buttons and single-line Reset face. Screenshot symptoms are recorded; CSS diagnosis and implementation remain pending. Existing photo-cleanup finding is preserved. No application change performed.

## Independent review — 2026-10-29 22:59 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Independently ran focused student-photo and staff-detail suites with isolated fixtures: 25 passed, 1 PostgreSQL row-lock test skipped, 5 dependency warnings. Full reported 304-test suite, web build and browser/live Storage checks were not rerun.
- Staff Eye action, admin-only allowlisted details, current uploaded profile image and deduplicated course assignments match the handoff in inspected code and endpoint tests. No confirmed staff defect found in that scope; browser behavior remains unverified.
- Shared cleanup-row locking addresses the ordinary PHOTO-03 stale-selection race, but one failure gap remains: successful Storage deletion followed by rolled-back DB commit restores an intent that registration may attach to a missing photo. Returning 404 does not restore object/reference consistency. Updated the existing FIX.md with the residual case and regression requirements; no application/database changes made by the reviewer.

## PHOTO-03 and staff details — 2026-10-29 22:55 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; local and uncommitted; not independently reviewed.

- **Correction:** the earlier "worker cannot delete a photo that is being attached" claim rested on a 10-minute grace period and a withdrawn-intent check, which was not enough: a worker could select an aged key, registration could attach it and withdraw the intent, and the worker would still delete the object.
- **Final protocol (PHOTO-03):** the `face_photo_cleanups` row is the ownership token. The cleanup worker locks the row (`FOR UPDATE SKIP LOCKED`), confirms no face row references the key, deletes the object, then deletes the row. Registration finalization locks the same row last, deletes it in the same commit that attaches the photo, and attaches nothing if the row is already gone (registration still succeeds with `photo_saved: false`). Stale worker selections, two workers and repeated retries are therefore harmless. Reset and student deletion still remove the old photo and keep durable retry. One residual double-failure window (object deleted but the row commit fails while registration waits) is documented in the review report; a missing object now shows "Photo unavailable" (404) instead of a 502.
- **Staff details:** Staff Manager has an Eye button before Edit/Delete on every row that opens a read-only dialog with the staff member's current profile image (`User.avatar_url`, loaded by the browser, no proxy or upload change), identity, assigned staff role versus account role, account status/dates/2FA/recovery/preferences, and assigned courses merged from the course's lecturer and assignment rows. New admin-only `GET /admin/staff/{lecturer_id}/details` returns an explicit allowlist; non-admins are denied and secrets are excluded.
- **Checks:** backend `pytest tests`: 304 passed, 1 skipped; web `tsc --noEmit` and `npm run build` pass. NOT RUN: the PostgreSQL row-lock test (no PostgreSQL or Docker available here), browser tests (Playwright 1.15 only), real storage and live admin requests. PostgreSQL lock behaviour and the dialogs in a real browser are therefore unverified.

## Planned — 2026-10-29 22:47 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Updated the current Claude fix request to carefully resolve PHOTO-03 using coordinated cleanup/registration ownership and deterministic concurrency regressions, preserving optional-photo failure recovery and intentional Reset face/Delete student cleanup.
- Prepared the current implementation handoff for Staff Manager: Eye action before Edit/Delete, admin-only account-details dialog matching the student dialog, and the staff account's existing uploaded profile image from avatar_url. Missing/broken images must not prevent details from loading.
- Reused the same three ignored workflow files. These are planned changes, not implemented or tested. Per user preference, recorded history takes priority and minor timestamp differences are not an open defect.

## Independent review — 2026-10-29 22:34 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Focused student-details/photo backend suite independently executed with dummy loopback database configuration and isolated SQLite/fake Storage fixtures: 17 passed, 5 dependency warnings. Full reported 296-test suite, browser checks and web builds were not rerun.
- Local /health now returns 200. Claude reports the photo migration applied; exact live schema/revision/grants and authenticated dialog/storage behavior were not independently inspected. The earlier missing-column startup failure should not be presented as a current confirmed outage.
- PHOTO-03 remains open: cleanup worker selection and registration attachment are still unsynchronized. Current passing tests do not cover the previously demonstrated stale-selection race.
- Replaced the current local review report to remove contradictory fixed/pending/failed statuses and updated FIX.md. Changelog entries labelled 22:40, 22:50 and 23:05 were already present ahead of this machine's observed 22:34 MYT clock; their event times remain unverified and require provenance correction. No application/database changes, commit or push performed.

## UI fix — 2026-10-29 23:05 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Student details dialog: the scrollbar sat on the dialog's rounded outer edge. The dialog is now a fixed-height flex column: header and Close footer stay pinned and only the middle content scrolls inside the dialog padding. Self-reported: `tsc`, ESLint and `npm run build` pass; the visual result and the browser test were NOT run (no compatible Playwright), so please re-check it in your browser.

## Migration applied — 2026-10-29 22:50 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported, at the user's request ("you help me do it").

- Ran `venv\Scripts\python.exe -m alembic upgrade head` from `fyp-backend` against the database configured for the backend (Supabase project ref `iekqyzdevnzeohmiddjc`). Alembic reported `d8569cd9629c -> f1a7c3d9e520`, and `alembic current` now shows `f1a7c3d9e520 (head)`. The migration only adds nullable `face_embeddings.photo_key` and the `face_photo_cleanups` table (RLS on, client roles revoked); no rows were read or changed.
- `_check_face_photo_schema()` now passes against that database. The backend was not running afterwards (`/health` not reachable locally), so startup, `/health`, the admin details dialog and the "Photo unavailable" display for older registrations are NOT VERIFIED; the user will restart with `run_backend.bat` and check. No Supabase MCP inspection or storage-bucket check was done.
- Because the database is shared, the hosted backend now sees the extra column and table too; this is additive and does not affect the previously deployed code.

## Diagnosis — 2026-10-29 22:40 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported; no database or application change was made.

- The user's startup traceback (`UndefinedColumn: face_embeddings.photo_key`) confirms the photo migration `f1a7c3d9e520` is not applied to the database that backend used; the new startup check stopped the server as intended. Starting with plain `uvicorn` does not run Alembic; `run_backend.bat` does.
- The backend's configured database host corresponds to Supabase project ref `iekqyzdevnzeohmiddjc` (read from local config, credentials not shown). This is shared data, so applying the migration needs the owner's approval. Offline SQL for the migration is additive only: nullable `face_embeddings.photo_key` and a new `face_photo_cleanups` table with row-level security and client roles revoked.
- Not done: running the migration, any Supabase MCP inspection (no Supabase MCP server is configured in this Claude session) and a live revision check (blocked by the permission classifier). Python was not upgraded; the Python 3.11 FutureWarning is unrelated.
- Next, once approved: from `fyp-backend` run `venv\Scripts\python.exe -m alembic upgrade head`, restart with `run_backend.bat`, then verify `/health`, the admin details dialog and that older registrations show "Photo unavailable".

## Independent review — 2026-10-29 22:14 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Rechecked Claude's 18:55 fix claims: cleanup intent is now committed before upload and registration failure no longer requires a second bookkeeping commit before attempting deletion. This addresses the originally identified paths by source inspection; the reported 296-test suite was not independently rerun.
- Confirmed a remaining cleanup-worker race with an isolated replay of the actual worker/deletion functions: a worker can retain a selected key while registration attaches the photo and removes its intent, then delete that active photo. A ten-minute grace period delays selection but does not synchronize transactions. Added PHOTO-03 to the existing local FIX.md; the changelog's unconditional worker-safety claim is not established.
- Startup schema recovery remains incomplete in the available evidence: the supplied traceback proves missing photo_key, and the documents contain no subsequent verified Supabase schema/revision result, successful migration or restored admin-details request. No database change, application fix or deployment performed by this review.

## Startup analysis — 2026-10-29 22:12 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- User traceback confirms missing face_embeddings.photo_key prevents application startup under the new schema check. Direct uvicorn invocation skips the launcher migration step; existing Alembic migration f1a7c3d9e520 defines the needed schema. Actual database revision remains unverified. The Google Python support warning is unrelated to the fatal error.
- Updated the three existing local workflow documents to require Claude's Supabase MCP/plugin for project identification and read-only schema/revision/log checks before an Alembic-consistent remedy. Supabase connection in this chat lists FYP_project; Claude's connection is separate. No database migration, application fix or deployment performed.
- Tooling review: compatible Playwright plus browser binaries would unblock reported browser-test gaps; Azure CLI/account access is useful for App Service runtime logs. Neither is a prerequisite for resolving this confirmed missing-column error. No extra plugin or package installed.

## Fix pass — 2026-10-29 18:55 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Self-reported by the implementer; not independently re-reviewed. Local and uncommitted.

- **PHOTO-01 (fixed):** the registration photo's delete intent is now committed before the upload, so an upload that times out after the object was stored can no longer lose it. An upload exception triggers an immediate delete; if that also fails the intent stays queued for the worker. Registration continues without a photo (`photo_saved: false`).
- **PHOTO-02 (fixed):** after a failed registration the handler no longer needs a second commit before deleting the object; the intent already exists, and a failure while cleaning up cannot mask the original error.
- **Worker safety:** a successful registration removes its intent in the same transaction that attaches the photo, and the worker only touches intents older than 10 minutes, so it cannot delete a photo that is being attached. Consequently, retries of failed reset/delete cleanups also wait about 10 minutes. This corrects the earlier statement that the worker retries "every minute": it runs every minute but only acts on rows past the grace period.
- **Startup check:** the backend now refuses to start, naming migration `f1a7c3d9e520`, if `face_embeddings.photo_key` or `face_photo_cleanups` is missing.
- **Student details error (not confirmed):** the local "Student details could not be loaded" alert is unexplained. Its status/traceback were not captured and the configured database's revision was not checked (an automated read-only check was blocked). The leading hypothesis is an unapplied migration `f1a7c3d9e520`; if so, restart with `run_backend.bat` (runs `alembic upgrade head`) or run `python -m alembic upgrade head` from `fyp-backend`. The same gap would also break face check-in and registration, which is why the startup check was added.
- **Checks:** backend `pytest tests` 296 passed (isolated SQLite and fake object store; 6 new regression tests for the above). Not run: browser test, real storage, migration on a real database, deployment.

## Analysis — 2026-10-29 18:19 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Investigated the local student-details error: API health returns 200 and the running server exposes the new details/photo routes. The screenshot's alert comes from the details request, before the photo request.
- Missing application of the new photo-schema migration is a hypothesis: the details query selects photo_key, while startup validation does not check the new photo schema. The authenticated response status/traceback and actual database revision remain unverified; no database query, migration, source fix or test suite was run. Recorded the diagnostic steps in the existing local workflow files.

## Review and workflow update — 2026-10-29 18:14 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Standardized the ignored review-workflow folder to three reusable current-task files: FIX.md, IMPLEMENTATION_HANDOFF.md and REVIEW_REPORT.md. Replace their task content instead of adding separate files; preserve history here and unresolved findings until resolved or explicitly superseded.
- Claude must update this changelog and the current review report after each implementation/fix, with local timezone timestamps, actual changes, verification and limitations; distinguish implementer-reported checks from independent review.
- Static review of student-details/photo changes found two cleanup gaps: upload success followed by response timeout can lose the object key, and a second database-commit failure can bypass photo deletion. These are recorded for correction; no application source changed or tests rerun in this review. Earlier cleanup guarantees are not established for these failure cases.

## Implemented locally — 2026-10-29 18:10 MYT (Asia/Kuala_Lumpur, UTC+08:00)

Student details dialog and private registration photo (uncommitted, not deployed, not pushed).

- **Web:** Students Manager has an Eye button directly right of Reset face (also on unregistered rows) that opens a read-only dialog: identity, account (status, dates, 2FA, recovery email, saved preferences), programme and enrolled courses, face-registration status and the current registration photo. Loading, error/retry, "Not registered" and "Photo unavailable" states are separate; requests are aborted on close or student switch and photo object URLs are revoked.
- **Backend:** new admin-only `GET /admin/students/{id}/details` (explicit allowlist; no password/recovery/reset hashes, TOTP, sessions, embeddings or storage credentials) and `GET /admin/students/{id}/face/photo` (admin-only, `no-store`; the object key is read from the database for the active registration, and an optional `registration_version` rejects stale tabs). The shared student list response is unchanged.
- **Photo storage:** new registrations save a re-encoded, size-bounded JPEG (metadata stripped) of the same capture that passed liveness and matching, in a dedicated private Supabase bucket `face-registration-photos`, created on first upload. If storage fails, registration still succeeds and reports `photo_saved: false`; rejected scans are never stored.
- **Consistency:** a photo uploaded for a registration that then loses a race or fails to commit is deleted. Reset and student deletion clear the reference in the same database transaction (access is revoked immediately) and delete the object afterwards; a failed delete stays queued in the new `face_photo_cleanups` table, is reported as `photo_cleanup_pending` on reset, and is retried every minute by the existing face-expiry worker. Each registration uses a new object key, so a reset followed by re-registration never shows the old photo.
- **Migration `f1a7c3d9e520`** (new head after `d8569cd9629c`): adds nullable `face_embeddings.photo_key` and the `face_photo_cleanups` table (RLS enabled, client roles revoked). No backfill. Run `alembic upgrade head` before deploying this backend.
- **Existing registrations remain "Photo unavailable"** until a student registers again in a future authorised registration; no resets were initiated, and original photos cannot be reconstructed from embeddings.
- **Verified locally:** backend `pytest tests` (isolated SQLite, fake object store): 290 passed, including 11 new photo/details tests; `alembic heads` shows one head; web `tsc --noEmit`, ESLint on the new dialog, and `npm run build` pass.
- **NOT RUN / NOT VERIFIED:** the new browser test `fyp_web/tests/studentDetails.browser.test.mjs` could not run (only Playwright 1.15 is installed locally, which lacks the APIs used); keyboard focus, mobile layout and image-failure behaviour are therefore unverified in a real browser. The migration, bucket creation, real Supabase upload/download/delete and the hosted deployment were not exercised. The bucket is created on first upload only if the backend's storage key has permission to create buckets.

## Planned — 2026-10-29 17:52 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- Prepared a local Claude handoff for an admin-only student-details dialog opened by an Eye button immediately after Reset face; planned sections cover available non-secret profile, account, academic and face-registration details.
- User approved private storage of future registration photos. Current registration stores embeddings rather than original images, so older registrations will show “Photo unavailable”. Photo access, reset/deletion cleanup and existing registration behavior must be verified during implementation.
- Planning only: no application/schema/storage changes or tests performed, and nothing committed or pushed.

## Update — 2026-10-29 17:44 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- The user reported that the hosted page loaded and cancelled the proposed login fix. The local handoff is marked cancelled; no application fix was applied. Recovery was user-reported, not independently retested.

## Investigation — 2026-10-29 17:41 MYT (Asia/Kuala_Lumpur, UTC+08:00)

- After commit `cce8759`, the website returned HTTP 200, but API `/health` and unauthenticated `/auth/me` each returned no response within a 25-second read-only probe. Backend recovery is not verified.
- Frontend and backend workflows for that commit completed successfully; this does not establish active container health.
- Code inspection found that initial login has no request timeout and keeps the global authentication skeleton visible while pending; the screenshot is consistent with this path, but browser network evidence was not captured. A scoped local Claude handoff was prepared; no application fix, deployment or runtime test was performed.
- The older snapshot below describes the pre-commit working tree; its untracked/uncommitted labels are historical after `cce8759`, not current Git status. This investigation entry is a new local documentation change awaiting a future authorized commit/push.

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

## Project documentation (merged from docs/ on 2026-11-02)
Every Markdown file that was in docs/ is kept here word for word, in folder order; its headings are moved down three levels so they sit under this section. docs/ itself was deleted afterwards. Links inside these pages may still point at the old docs/ paths.

### docs/README.md

#### FYP 文档索引

Smart Attendance System — 智能考勤系统的全部文档。

**对应代码版本**：`45da256`（alembic head `42c198406814`）
**最后核对**：2026-07-31（端口 → 8003、Python 锁 3.11、删 `launch_backend.py`）

---

##### 按目的找文档

| 你想做什么 | 去哪 |
|---|---|
| 看某个端点收什么、返回什么 | [01-CurrentCode/backend-api-reference.md](./01-CurrentCode/backend-api-reference.md) |
| 搞懂后端怎么分层、表怎么设计 | [01-CurrentCode/backend-architecture.md](./01-CurrentCode/backend-architecture.md) |
| 准备答辩，讲三个模块 | [01-CurrentCode/](./01-CurrentCode/) 的 module1/2/3 |
| 动手改代码前 | [02-Engineering/CONVENTIONS.md](./02-Engineering/CONVENTIONS.md) |
| 查某个设计为什么是这样 | [02-Engineering/BACKEND-REVIEW.md](./02-Engineering/BACKEND-REVIEW.md) |
| 迁移 Azure & 配置自定义域名 (smartsystem.live) | [AZURE-MIGRATION-GUIDE.md](./AZURE-MIGRATION-GUIDE.md) |
| 重新训练风险模型 | [03-MLModel/](./03-MLModel/) |
| 查模型的方法论 / 已知局限 | [03-MLModel/ml_risk_predict_desc.md](./03-MLModel/ml_risk_predict_desc.md) |

---

##### 目录

###### [01-CurrentCode/](./01-CurrentCode/) — 现行代码资料
和当前代码**逐条核对过**的技术资料。架构、81 个端点的完整参考、三个模块的中文讲解。

###### [02-Engineering/](./02-Engineering/) — 工程规范与评审
`CONVENTIONS.md`（写代码的规矩，每条对应一次真实事故）和 `BACKEND-REVIEW.md`
（后端评审与修复的执行记录，1879 行）。

###### [03-MLModel/](./03-MLModel/) — 风险模型
英文完整实现参考 + 数据生成/训练脚本。

###### [archive/](./archive/) — 归档
过时的评审、旧计划、已完成的测试清单。**只读，不要更新。**

---

##### 三条规矩

1. **代码是真相，文档跟着改。** 对不上就改文档，别改代码去迁就文档。
   API 参考的重新核对命令写在它自己的 §11。
2. **归档不删除。** `docs/` 在 `.gitignore` 内（`.gitignore:58`），删了没有 git
   历史可恢复。过时的东西移进 `archive/`。
3. **`archive/` 里的判断可能已被推翻。** 引用历史文档前先查
   `BACKEND-REVIEW.md` 的「附录 C」。

### docs/AUTO-DEPLOY-SETUP.md

#### 🚀 Azure 自动部署完整配置指南

##### 🎯 目标：实现 Git Push 自动部署

```
git push origin main
    ↓
GitHub Actions 自动触发
    ↓
├─ 后端代码变更 → 构建 Docker → 推送到 ACR → 部署到 App Service
├─ 前端代码变更 → 构建 React → 部署到 Static Web Apps
└─ Flutter 代码变更 → 构建 APK/IPA (Codemagic)
```

**Railway 和 Azure 双环境同时自动部署，互不干扰！**

---

##### 📋 一次性设置（只需做一次）

###### Step 1: 获取 ACR 凭证

```powershell
az acr credential show --name yss2026fyp --resource-group fyp-azure-rg
```

记下：
- **username**: `yss2026fyp`
- **password**: `xxxxxxxxxxxxxx` (复制 `passwords[0].value`)

---

###### Step 2: 创建 Azure 服务主体（用于 GitHub Actions 登录）

```powershell
az ad sp create-for-rbac --name "github-actions-fyp" --role contributor --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/fyp-azure-rg --sdk-auth
```

会输出一大段 JSON，**全部复制**：
```json
{
  "clientId": "xxxx",
  "clientSecret": "xxxx",
  "subscriptionId": "xxxx",
  "tenantId": "xxxx",
  ...
}
```

---

###### Step 3: 获取 Static Web App 部署 Token（稍后设置）

这个需要先创建 Static Web App 才能获取，我们先跳过，后面再补。

---

###### Step 4: 添加 GitHub Secrets

1. 打开 GitHub 仓库: https://github.com/你的用户名/fyp
2. **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**，添加以下 3 个：

| Name | Value | 来源 |
|------|-------|------|
| `ACR_USERNAME` | `yss2026fyp` | Step 1 |
| `ACR_PASSWORD` | (ACR 密码) | Step 1 |
| `AZURE_CREDENTIALS` | (整段 JSON) | Step 2 |

**截图示意：**
```
Repository secrets
├─ ACR_USERNAME        •••••••••
├─ ACR_PASSWORD        •••••••••
└─ AZURE_CREDENTIALS   •••••••••
```

---

###### Step 5: 推送代码激活 Workflows

```powershell
cd C:\Users\sungs\OneDrive\Desktop\fyp

git add .
git commit -m "Enable Azure auto-deployment workflows"
git push origin main
```

---

##### ✅ 验证自动部署

###### 测试后端自动部署

1. 修改后端文件（随便改个注释）：
   ```powershell
   echo "# Test change" >> fyp-backend/main.py
   git add fyp-backend/main.py
   git commit -m "Test: trigger Azure backend deploy"
   git push origin main
   ```

2. 去 GitHub → **Actions** 查看
3. 应该看到 "Azure Backend Deploy" 自动运行

###### 测试前端自动部署

1. 修改前端文件：
   ```powershell
   echo "/* Test */" >> fyp_web/src/App.tsx
   git add fyp_web/src/App.tsx
   git commit -m "Test: trigger Azure frontend deploy"
   git push origin main
   ```

2. 应该看到 "Azure Frontend Deploy" 自动运行

---

##### 🎨 Workflow 触发规则

| 变更路径 | 触发的 Workflow | 部署目标 |
|---------|----------------|---------|
| `fyp-backend/**` | Azure Backend Deploy | Azure App Service |
| `fyp_web/**` | Azure Frontend Deploy | Azure Static Web Apps |
| `fyp_flutter/**` | (Codemagic) | APK/IPA artifacts |
| 其他文件 | 无 | - |

**聪明之处：**
- 只改前端 → 只部署前端（省时间）
- 只改后端 → 只部署后端
- Railway 也在监听 push，同时部署 ✅

---

##### 🔍 查看部署日志

###### GitHub Actions
```
GitHub 仓库 → Actions → 选择一个运行 → 查看详细日志
```

###### Azure App Service
```powershell
# 实时查看后端日志
az webapp log tail --name fyp-backend-azure --resource-group fyp-azure-rg
```

---

##### ⚠️ 常见问题

###### Q1: Workflow 没有自动运行？

**检查：**
1. GitHub Secrets 是否都设置了？
2. 修改的文件路径是否匹配 `paths` 配置？
3. 是否推送到 `main` 分支？

###### Q2: 构建失败 "ACR_USERNAME not found"

**原因：** GitHub Secrets 没设置或名称拼写错误

**解决：** 去 Settings → Secrets 检查拼写

###### Q3: Railway 和 Azure 会冲突吗？

**不会！** 
- Railway 监听 push → 部署到 Railway
- GitHub Actions 监听 push → 部署到 Azure
- 两者独立运行，互不干扰

---

##### 📊 成本对比

| 平台 | 自动部署 | 月成本 |
|------|---------|--------|
| **Railway** | ✅ 自动 | ~$5 |
| **Azure** | ✅ 自动 | ~$13 (学生 credit) |

---

##### 🎯 下一步

现在你需要：

1. **完成 Step 1-4**（设置 GitHub Secrets）
2. **继续运行部署脚本**（完成 App Service 创建）
   ```powershell
   # 先启动 Docker Desktop
   # 然后运行
   .\scripts\build-local.ps1
   
   # 或者用 GitHub Actions（手动触发一次）
   # 去 GitHub → Actions → Build Docker Image → Run workflow
   ```
3. **测试自动部署**（改个文件，push，看 Actions）

---

##### 🚀 快速命令（复制粘贴）

```powershell
# 获取 ACR 凭证
az acr credential show --name yss2026fyp --resource-group fyp-azure-rg

# 创建服务主体
az ad sp create-for-rbac --name "github-actions-fyp" --role contributor --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/fyp-azure-rg --sdk-auth

# 推送代码
git add .
git commit -m "Enable auto-deployment"
git push origin main
```

添加完 GitHub Secrets 后，告诉我，我们继续下一步！

### docs/AZURE-DEPLOY-SAFE.md

#### Azure 部署实战指南 (Railway 共存版)

> ⚠️ 本指南确保 Railway 继续正常服务，Azure 作为独立测试环境

##### 🎯 架构状态

```
┌─────────────────────────────────────────────────┐
│  现有生产环境 (Railway)                           │
│  https://fyps.up.railway.app                    │
│  ✅ 继续服务现有用户                              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  新测试环境 (Azure)                              │
│  https://smartsystem.live                       │
│  🧪 内部测试，不影响现有用户                       │
└─────────────────────────────────────────────────┘
```

---

##### 📦 准备工作

###### 1. 安装 Azure CLI

```bash
# Windows (PowerShell)
winget install Microsoft.AzureCLI

# 验证安装
az --version
```

###### 2. 登录 Azure

```bash
az login
# 会打开浏览器，用你的学生账号登录
```

###### 3. 确认订阅

```bash
az account show
# 确认是你的学生订阅 (应该有 $100 credit)
```

---

##### 🚀 部署步骤

###### Step 1: 创建资源组

```bash
# East Asia 区域 (新加坡，离马来西亚最近)
az group create \
  --name fyp-azure-rg \
  --location eastasia
```

###### Step 2: 创建 Azure Container Registry (ACR)

```bash
# ⚠️ 名称必须全局唯一，建议用: 你的名字+年份+项目
# 只能包含小写字母和数字，5-50 字符
az acr create \
  --resource-group fyp-azure-rg \
  --name yss2026fyp \
  --sku Basic \
  --admin-enabled true

# 获取 ACR 登录凭证 (记下来，后面 GitHub Secrets 要用)
az acr credential show --name yss2026fyp --resource-group fyp-azure-rg
```

###### Step 3: 构建并推送后端镜像

```bash
# 在项目根目录执行
cd C:\Users\sungs\OneDrive\Desktop\fyp

# 构建镜像 (包含 OpenCV + DeepFace + ArcFace weights)
# 这会花 5-10 分钟，因为要下载模型权重
az acr build \
  --registry yss2026fyp \
  --image fyp-backend:latest \
  --file Dockerfile \
  .
```

###### Step 4: 创建 App Service Plan

```bash
# B1 规格: 1.75GB RAM, 1 vCPU
# 每月约 $13，学生 $100 credit 可用 7 个月
az appservice plan create \
  --name fyp-plan \
  --resource-group fyp-azure-rg \
  --sku B1 \
  --is-linux
```

###### Step 5: 创建后端 Web App (容器)

```bash
az webapp create \
  --resource-group fyp-azure-rg \
  --plan fyp-plan \
  --name fyp-backend-azure \
  --deployment-container-image-name yss2026fyp.azurecr.io/fyp-backend:latest
```

###### Step 6: 配置后端环境变量

```bash
# 获取你的 Supabase DATABASE_URL、GEMINI_API_KEY、JWT_SECRET_KEY
# ⚠️ 把下面的值替换成你的实际值

az webapp config appsettings set \
  --resource-group fyp-azure-rg \
  --name fyp-backend-azure \
  --settings \
    WEBSITES_PORT="8000" \
    PORT="8000" \
    DATABASE_URL="你的Supabase数据库URL" \
    GEMINI_API_KEY="你的Gemini密钥" \
    JWT_SECRET_KEY="你的JWT密钥" \
    JWT_ALGORITHM="HS256" \
    JWT_EXPIRE_MINUTES="1440" \
    ALLOWED_ORIGINS="https://smartsystem.live,https://www.smartsystem.live" \
    WEBSITES_CONTAINER_START_TIME_LIMIT="1800"
```

**获取现有配置的方法：**
```bash
# 如果你忘了，可以从 Railway 查看
# Railway Dashboard → 你的 backend service → Variables
```

###### Step 7: 配置 ACR 拉取权限

```bash
# 让 App Service 能从 ACR 拉取镜像
az webapp config container set \
  --name fyp-backend-azure \
  --resource-group fyp-azure-rg \
  --docker-custom-image-name yss2026fyp.azurecr.io/fyp-backend:latest \
  --docker-registry-server-url https://yss2026fyp.azurecr.io \
  --docker-registry-server-user yss2026fyp \
  --docker-registry-server-password $(az acr credential show --name yss2026fyp --query "passwords[0].value" -o tsv)
```

###### Step 8: 验证后端部署

```bash
# 查看部署状态
az webapp show \
  --resource-group fyp-azure-rg \
  --name fyp-backend-azure \
  --query "defaultHostName" -o tsv

# 应该输出: fyp-backend-azure.azurewebsites.net

# 测试健康检查
curl https://fyp-backend-azure.azurewebsites.net/health
# 应该返回 {"status":"healthy"}
```

###### Step 9: 创建 Azure Static Web App (前端)

```bash
# ⚠️ 需要先创建 GitHub Personal Access Token
# GitHub → Settings → Developer settings → Personal access tokens → Generate new token
# Scopes: repo (all), workflow

az staticwebapp create \
  --name fyp-web-azure \
  --resource-group fyp-azure-rg \
  --source https://github.com/你的用户名/fyp \
  --branch main \
  --app-location "/fyp_web" \
  --output-location "dist" \
  --login-with-github
```

**或者手动配置 (推荐)：**
1. 去 Azure Portal → Static Web Apps → Create
2. 选择 GitHub 仓库: `fyp`
3. Build Details:
   - App location: `/fyp_web`
   - Output location: `dist`
4. 部署后获取 deployment token，添加到 GitHub Secrets

---

##### 🌐 DNS 配置 (smartsystem.live)

登录你的域名服务商后台，添加以下记录：

| 类型 | 名称 | 值 | TTL |
|------|------|-----|-----|
| CNAME | @ | `gentle-sea-xxxx.azurestaticapps.net` | 3600 |
| CNAME | www | `gentle-sea-xxxx.azurestaticapps.net` | 3600 |
| CNAME | api | `fyp-backend-azure.azurewebsites.net` | 3600 |

**获取 Static Web App 域名：**
```bash
az staticwebapp show \
  --name fyp-web-azure \
  --resource-group fyp-azure-rg \
  --query "defaultHostname" -o tsv
```

**在 Azure Portal 绑定自定义域名：**
1. Static Web Apps → fyp-web-azure → Custom domains
2. Add custom domain: `smartsystem.live`
3. 按提示添加 TXT 验证记录

---

##### 🧪 测试策略

###### 后端 API 测试

```bash
# 测试 Azure 后端（不影响 Railway）
curl https://api.smartsystem.live/health

# 测试登录
curl -X POST https://api.smartsystem.live/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

###### 前端测试

1. 访问 `https://smartsystem.live` (Azure)
2. 打开浏览器开发者工具 → Network
3. 确认所有 API 请求都指向 `api.smartsystem.live`

###### Flutter App 测试 (Azure 版本)

```bash
# 编译 Azure 测试版 APK
cd fyp_flutter
flutter build apk --dart-define=API_BASE_URL=https://api.smartsystem.live

# 输出位置: build/app/outputs/flutter-apk/app-release.apk
# 重命名方便区分
cp build/app/outputs/flutter-apk/app-release.apk ../app-azure-test.apk
```

**安装到手机测试：**
```bash
adb install ../app-azure-test.apk
```

---

##### 📊 成本监控

```bash
# 查看当前花费
az consumption usage list \
  --start-date 2026-08-01 \
  --end-date 2026-08-31 \
  --query "[?contains(instanceName, 'fyp')]"

# 设置预算警报
az consumption budget create \
  --budget-name fyp-monthly-budget \
  --amount 50 \
  --time-grain Monthly \
  --start-date 2026-08-01 \
  --end-date 2027-08-01
```

---

##### 🔄 GitHub Actions 自动化部署

已创建两个 workflow 文件：
- `.github/workflows/azure-backend-deploy.yml` (后端)
- `.github/workflows/azure-frontend-deploy.yml` (前端)

**配置 GitHub Secrets：**
1. 去 GitHub → Settings → Secrets and variables → Actions
2. 添加以下 secrets：
   - `AZURE_CREDENTIALS` (Azure 服务主体 JSON)
   - `ACR_USERNAME` (ACR 用户名)
   - `ACR_PASSWORD` (ACR 密码)
   - `AZURE_STATIC_WEB_APPS_API_TOKEN` (Static Web App 部署 token)

**获取 AZURE_CREDENTIALS：**
```bash
az ad sp create-for-rbac \
  --name "github-actions-fyp" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/fyp-azure-rg \
  --sdk-auth
```

---

##### ✅ 验证清单

- [ ] 后端 API 健康检查通过
- [ ] 前端可以访问并加载
- [ ] 前端能登录并获取数据
- [ ] Flutter Azure 版 App 能打卡
- [ ] Railway 部署依然正常工作
- [ ] 成本监控已设置

---

##### 🚨 回滚方案

如果 Azure 出问题，Railway 依然可用：

1. **前端**：Railway 前端继续运行在 `https://smart-web.up.railway.app`
2. **后端**：Railway 后端继续运行在 `https://fyps.up.railway.app`
3. **Flutter**：现有 APK 依然连接 Railway

**切换回 Railway：**
- 前端：访问 Railway URL
- Flutter：重新安装 Railway 版本 APK

---

##### 📝 后续优化

Azure 稳定后：
1. 在 DNS 添加流量分配 (50% Railway, 50% Azure)
2. 观察 Azure 性能和成本
3. 逐步提高 Azure 流量比例
4. 完全迁移后删除 Railway 服务

### docs/AZURE-INDEX.md

#### Azure 部署文档索引

##### 📚 核心文档（按顺序阅读）

###### 1️⃣ [AUTO-DEPLOY-SETUP.md](AUTO-DEPLOY-SETUP.md)
**Git Push 自动部署配置指南**
- GitHub Secrets 设置
- 服务主体创建
- CI/CD 自动化流程

###### 2️⃣ [AZURE-DEPLOY-SAFE.md](AZURE-DEPLOY-SAFE.md)
**Azure 资源部署详细步骤**
- 资源组创建
- ACR、App Service 配置
- 环境变量设置
- 完整的 az cli 命令

###### 3️⃣ [QUICK-REFERENCE.md](QUICK-REFERENCE.md)
**快速参考卡片**
- Railway vs Azure 环境对照
- 常用命令
- 故障排查

---

##### 🛠️ 脚本工具

###### PowerShell 脚本（scripts/）
- `azure-deploy.ps1` - 完整部署脚本（交互式）
- `build-local.ps1` - 本地构建 Docker 镜像

---

##### 📖 其他文档

- [README.md](README.md) - 项目文档总览
- [01-CurrentCode/](01-CurrentCode/) - 代码架构文档
- [02-Engineering/](02-Engineering/) - 工程规范
- [03-MLModel/](03-MLModel/) - ML 模型文档
- [FYP-report/](FYP-report/) - 报告相关

---

##### 🚀 快速开始

###### 首次部署
```powershell
# 1. 运行部署脚本
.\scripts\azure-deploy.ps1

# 2. 设置自动部署
# 参考 AUTO-DEPLOY-SETUP.md
```

###### 日常开发
```powershell
# 修改代码后
git add .
git commit -m "Update feature"
git push origin main

# Railway 和 Azure 自动部署 ✅
```

---

##### ✅ 当前部署状态

| 组件 | 状态 |
|------|------|
| 资源组 | ✅ fyp-azure-rg |
| ACR | ✅ yss2026fyp |
| Docker 镜像 | ✅ 已构建并推送 |
| App Service Plan | ⏳ 待创建 |
| Web App | ⏳ 待创建 |
| Static Web App | ⏳ 待创建 |
| GitHub Secrets | ⏳ 待设置 |

---

##### 📝 下一步

1. **验证镜像**：确认 Docker 镜像已在 ACR
2. **创建 App Service**：运行部署脚本
3. **设置 GitHub Secrets**：启用自动部署

### docs/AZURE-PRODUCTION.md

#### Azure 生产环境文档

##### 🗺️ 架构总览

###### Azure 上跑着的 4 个东西

| # | 资源 | 名称 | 花钱? | 一句话说明 |
|---|---|---|---|---|
| 1 | Container Registry (ACR) | `yss2026fyp` | ~$5/月 | **仓库**。存打包好的后端 Docker 镜像 |
| 2 | App Service Plan | `fyp-backend-plan` | ~$13/月 | **服务器**。B1 规格，1.75GB RAM，真正的算力 |
| 3 | Web App (App Service) | `fyp-backend-azure` | 含在 #2 | **后端应用**。跑在 #2 上，拉 #1 的镜像 |
| 4 | Static Web App | `fyp-frontend-azure` | 免费 | **前端**。纯静态文件托管，自带 CDN |

关键理解：**#2 和 #3 是分开的**。Plan 是你租的服务器，Web App 是跑在上面的应用。
一个 Plan 可以跑多个 Web App（共享同一份算力）。你想省钱可以降 Plan 规格，不用动 Web App。

另外还有 **Supabase PostgreSQL**（不在 Azure，独立第三方），Railway 和 Azure 共用它。
这就是为什么两边数据是同一份。

---

###### 你改代码 → 上线，一条线走完

###### 前端（React）

```
你改 fyp_web/ 里的代码
        │
        ▼  git push 到 main
   ┌─────────┐
   │ GitHub  │  检测到 fyp_web/** 有变更
   └────┬────┘
        ▼  自动跑 azure-static-web-apps-red-sand-0c0d09f00.yml
   ┌──────────────────────────────────────────┐
   │ GitHub Actions 干了什么:                  │
   │                                          │
   │ 1. 拉代码                                │
   │ 2. npm install                           │
   │ 3. 注入 VITE_API_BASE_URL                │
   │       = https://api.smartsystem.live     │
   │    （写在 workflow 的 env: 里）           │
   │ 4. npm run build  →  产出 dist/ 文件夹    │
   │ 5. 用 SWA token 把 dist/ 上传上去         │
   └────┬─────────────────────────────────────┘
        ▼
   ┌────────────────────────────────────────────┐
   │ Azure Static Web App (#4)                  │
   │ fyp-frontend-azure                         │
   │                                            │
   │ 收下 dist/ 里的 HTML/JS/CSS，              │
   │ 铺到 Azure 全球 CDN 节点上                  │
   └────┬───────────────────────────────────────┘
        │
        │ Azure 自己给的地址（一创建就有，永久有效）:
        ▼
   red-sand-0c0d09f00.7.azurestaticapps.net   ← 这已经是 live 了
        │
        │ 但这个地址太丑，所以绑自己的域名 ↓
        ▼
   ┌────────────────────────────────────────────┐
   │ 绑定自定义域名 smartsystem.live             │
   │ （只做一次，之后不用再管）                   │
   │                                            │
   │ ① Azure 说：证明这域名是你的                │
   │    → 在 Hostinger 加 TXT @                 │
   │      = _5ggxha2e6altn74z428fplv6j52eg6j    │
   │                                            │
   │ ② 把域名指向 Azure                          │
   │    → 在 Hostinger 加 A 记录 @              │
   │      = 57.158.92.245（SWA 的 IP）          │
   │    （apex 域名不能用 CNAME，只能写死 IP）    │
   │                                            │
   │ ③ Azure 自动签 HTTPS 证书（免费，自动续）    │
   └────┬───────────────────────────────────────┘
        ▼
   https://smartsystem.live  ← 真正对外的 live 地址
```

**两个地址都是活的**，指向同一份文件：
`red-sand-0c0d09f00.7.azurestaticapps.net`（Azure 送的）和 `smartsystem.live`（你的域名）。
前者永远能用，后者依赖 Hostinger 的 DNS。域名出问题时可以用前者应急。

第 3 步注入 `VITE_API_BASE_URL` 是关键：Vite 在**打包时**把后端地址写死进 JS 文件。
所以后端地址是「构建时决定」的，不是运行时读的。改了地址必须重新构建整个前端。

---

###### 后端（FastAPI）

```
你改 fyp-backend/ 里的代码
        │
        ▼  git push 到 main
   ┌─────────┐
   │ GitHub  │  检测到 fyp-backend/** 或 Dockerfile 有变更
   └────┬────┘
        ▼  自动跑 azure-backend-deploy.yml
   ┌──────────────────────────────────────────┐
   │ GitHub Actions 干了什么:                  │
   │                                          │
   │ 1. 拉代码                                │
   │ 2. 用 AZURE_CREDENTIALS 登录 Azure       │
   │ 3. 用 ACR_USERNAME/PASSWORD 登录 ACR     │
   │ 4. docker build  →  打包成镜像            │
   │    （装 Python、DeepFace、OpenCV...）     │
   │ 5. docker push  →  推到 ACR              │
   │ 6. 叫 Web App 去拉新镜像                  │
   └────┬─────────────────────────────────────┘
        ▼
   ┌────────────────────────────┐
   │ Azure ACR (#1)             │
   │ yss2026fyp                 │
   │ 镜像存在这里               │
   └────┬───────────────────────┘
        ▼  Web App 主动来拉
   ┌────────────────────────────────────────────┐
   │ Azure Web App (#3)                         │
   │ fyp-backend-azure                          │
   │ 跑在 App Service Plan (#2) 那台机器上      │
   │                                            │
   │ 重启容器 → uvicorn 启动 FastAPI            │
   │ 从 App Service 的「环境变量」读:            │
   │   DATABASE_URL → Supabase                  │
   │   ALLOWED_ORIGINS → 允许哪些前端来调        │
   └────┬───────────────────────────────────────┘
        │
        │ Azure 自己给的地址:
        ▼
   fyp-backend-azure.azurewebsites.net   ← 这已经是 live 了
        │
        │ 同样，绑自己的域名 ↓
        ▼
   ┌────────────────────────────────────────────┐
   │ 绑定自定义域名 api.smartsystem.live         │
   │ （只做一次）                                │
   │                                            │
   │ ① 证明域名是你的                            │
   │    → Hostinger 加 TXT asuid.api            │
   │      = E5D2E54C...5EE4                     │
   │    （App Service 规定前缀必须是 asuid.）    │
   │                                            │
   │ ② 指向 Azure                                │
   │    → Hostinger 加 CNAME api                │
   │      = fyp-backend-azure.azurewebsites.net │
   │    （子域名可以用 CNAME，不用写死 IP）       │
   │                                            │
   │ ③ Azure 签免费证书 + SNI SSL 绑定           │
   └────┬───────────────────────────────────────┘
        ▼
   https://api.smartsystem.live  ← 前端和 App 真正调的地址
```

后端比前端慢很多，因为要 build Docker 镜像（装 DeepFace 那堆依赖很重）。
中间多了 ACR 这一层「仓库」：GitHub 只负责打包和推仓库，Web App 自己去仓库拿。

注意前后端**绑域名的方式不一样**：前端是 apex（`smartsystem.live`）只能用 A 记录写死 IP，
后端是子域名（`api.`）可以用 CNAME。CNAME 更好，因为 Azure 换 IP 你不用动。

---

###### 手机 App（Flutter）

```
你改 fyp_flutter/ 里的代码
        │
        ▼  git push（这一步什么都不会发生）
   ┌─────────┐
   │ GitHub  │  普通 push 不触发，等 tag
   └─────────┘

        ▼  你打 tag: git tag v0.1.1 && git push origin v0.1.1
   ┌─────────┐
   │ GitHub  │  检测到 v*.*.* 格式的 tag
   └────┬────┘
        ▼  自动跑 flutter-release.yml
   ┌──────────────────────────────────────────┐
   │ GitHub Actions 干了什么:                  │
   │                                          │
   │ 1. 装 Java 17 + Flutter 3.41.4           │
   │ 2. flutter pub get                       │
   │ 3. flutter build apk --release           │
   │    （API 地址来自 app_config.dart）       │
   │ 4. 改个好看的文件名                       │
   │ 5. 建一个 GitHub Release，把 APK 挂上去   │
   └────┬─────────────────────────────────────┘
        ▼
   ┌────────────────────────────────────────────┐
   │ GitHub Releases 页面                        │
   │ github.com/LowYoongQian/fyp/releases       │
   │ （不经过 Azure，GitHub 自己托管文件）        │
   └────┬───────────────────────────────────────┘
        ▼
   别人下载 APK 装手机
        ▼
   App 打开后，直接调 https://api.smartsystem.live
   （地址在打包时就写死在 APK 里了）
```

这条线**完全不碰 Azure**，只产出一个安装包放 GitHub 上。「live」在这里的意思是
「Release 页面上能下载到」，不是「有个网址在跑」。

和前两条最大的区别：**tag 触发，不是 push 触发**。日常 push 不会打包 APK。

APK 里的后端地址来自 `app_config.dart` 的默认值，**打包时定死**。
所以已经装在别人手机上的旧 APK 还是指向旧地址（Railway），只能重新发版 + 让人重装。

iOS 走 Codemagic，不在 GitHub Actions 里，是另一套。

---

###### 上线之后，用户访问时怎么走

```
                          ┌─────────────────┐
      浏览器输入            │  Hostinger DNS  │
   smartsystem.live  ────>│  (域名解析)      │
                          └────────┬────────┘
                                   │ A 记录 @ → 57.158.92.245
                                   ▼
                    ┌──────────────────────────────┐
                    │  Static Web App (#4)         │
                    │  fyp-frontend-azure          │
                    │  ─────────────────────────   │
                    │  返回 React 打包好的         │
                    │  HTML / JS / CSS             │
                    └──────────────┬───────────────┘
                                   │
                    JS 在浏览器里跑起来后，
                    向 api.smartsystem.live 发 API 请求
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Hostinger DNS  │
                          └────────┬────────┘
                                   │ CNAME api → fyp-backend-azure.azurewebsites.net
                                   ▼
                    ┌──────────────────────────────┐
                    │  Web App (#3)                │
                    │  fyp-backend-azure           │
                    │  跑在 App Service Plan (#2)  │
                    │  ─────────────────────────   │
                    │  FastAPI + DeepFace          │
                    │  容器镜像来自 ACR (#1)        │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  Supabase PostgreSQL         │
                    │  (第三方，Railway 也连这里)   │
                    │  连接池 port 6543 + SSL      │
                    └──────────────────────────────┘
```

**要点**：前端和后端是**两个完全独立**的服务，各有自己的域名。
浏览器先拿到前端文件，然后由前端的 JS 去调后端 API——不是前端服务器帮你转发。
这就是为什么 CORS 会成为问题（跨域），也是为什么 `ALLOWED_ORIGINS` 必须配对。

---

###### 所有 live 地址一览

| 地址 | 是什么 | 谁给的 | 会不会失效 |
|---|---|---|---|
| `https://smartsystem.live` | Web 前端（对外用这个） | 你的域名 + Hostinger A 记录 | DNS 或域名到期会挂 |
| `https://red-sand-0c0d09f00.7.azurestaticapps.net` | 同一个前端 | Azure 送的，创建 SWA 时自动有 | 只要 SWA 不删就一直在 |
| `https://api.smartsystem.live` | 后端 API（前端和 App 都调这个） | 你的域名 + Hostinger CNAME | DNS 或域名到期会挂 |
| `https://fyp-backend-azure.azurewebsites.net` | 同一个后端 | Azure 送的 | 只要 Web App 不删就一直在 |
| `github.com/LowYoongQian/fyp/releases` | Android APK 下载页 | GitHub | — |
| `https://fyps.up.railway.app` | Railway 旧后端（备用，还活着） | Railway | 你自己停掉才会挂 |

**Azure 送的那两个地址是你的保命符**：域名/DNS 出问题时，直接用它们照样能访问。
排查问题时也用它们——如果 Azure 地址正常但自己域名不行，那就是 DNS 的事，不是 Azure 的事。

---

###### DNS 记录清单（Hostinger）

一共 4 条，两条负责「把流量送到哪」，两条负责「证明域名是你的」：

| 类型 | 名称 | 值 | 作用 | 能删吗 |
|---|---|---|---|---|
| **A** | `@` | `57.158.92.245` | 根域名 → 前端 SWA | ❌ 删了前端打不开 |
| **CNAME** | `api` | `fyp-backend-azure.azurewebsites.net` | 子域名 → 后端 | ❌ 删了 API 全挂 |
| **TXT** | `asuid.api` | `E5D2E54C...5EE4` | 向 App Service 证明域名所有权 | ⚠️ 留着 |
| **TXT** | `@` | `_5ggxha2e6altn74z428fplv6j52eg6j` | 向 SWA 证明域名所有权 | ⚠️ 留着 |

###### 为什么前端用 A 记录，后端用 CNAME？

不是随便选的，是 **DNS 协议的硬限制**：

- **根域名（`smartsystem.live`，apex）不允许 CNAME**。DNS 规范如此，因为 apex 必须能同时挂
  SOA/NS 记录，而 CNAME 要求该名下不能有其他记录。所以只能用 A 记录，直接写 IP。
- **子域名（`api.smartsystem.live`）可以 CNAME**。指向 Azure 给的域名，
  Azure 换 IP 时自动跟着变，不用你操心。

代价：A 记录写死了 IP。**如果 Azure 换掉 SWA 的 IP，前端会挂，要手动改这条记录。**
有些域名商提供 ALIAS/ANAME（apex 的 CNAME 替代方案）能规避这个问题，Hostinger 不支持。

###### 两条 TXT 是干什么的

防止别人拿你的域名去绑他自己的 Azure 服务。Azure 给你一个随机字符串，
你能把它写进 DNS，就证明你控制这个域名。
验证通过后 Azure 才肯签发 HTTPS 证书。

`asuid.api` 是 App Service 的规矩（前缀固定 `asuid.`），apex 那条是 SWA 的规矩。
两个服务各自验证，所以要两条。

---

###### 三条流水线速查表

| Workflow 文件 | 什么时候跑 | 结果落在哪 | 用到的 Secret |
|---|---|---|---|
| `azure-static-web-apps-red-sand-0c0d09f00.yml` | push main 且改了 `fyp_web/**` | SWA `fyp-frontend-azure` (#4) | `AZURE_STATIC_WEB_APPS_API_TOKEN_RED_SAND_0C0D09F00` |
| `azure-backend-deploy.yml` | push main 且改了 `fyp-backend/**` 或 `Dockerfile` | ACR (#1) → Web App (#3) | `ACR_USERNAME` / `ACR_PASSWORD` / `AZURE_CREDENTIALS` |
| `flutter-release.yml` | 打 tag `v*.*.*`（不是 push） | GitHub Releases（不碰 Azure） | 无（用内置 `GITHUB_TOKEN`） |

三条互不干扰，各自只看自己那个目录。改了 `fyp_web/` 后端不会重新部署，反之也一样。

---

###### 配置散落在哪（最容易踩坑的地方）

同一个「后端地址」，在 4 个地方各自定义，改一处不会同步到其他：

| 谁要连后端 | 配置写在哪 | 当前值 |
|---|---|---|
| Web 前端 | GitHub workflow 的 `env:` | `https://api.smartsystem.live` |
| Android APK | `fyp_flutter/lib/config/app_config.dart` | `https://api.smartsystem.live` |
| iOS (Codemagic) | `codemagic.yaml` 没设 → 落回 `app_config.dart` | 同上 |
| 本地开发 | `fyp_web/.env`（gitignore） | localhost |

**为什么 Web 的不写在 `.env.production`**：那个文件被 gitignore 了，
GitHub Actions 拿不到，构建时会落回代码里的 fallback `http://localhost:8003`，
部署出去的前端就连不上后端。所以必须写在 workflow 里。这个坑已经踩过一次。

反方向，后端要知道**允许谁来调**：

| 配置 | 写在哪 | 说明 |
|---|---|---|
| `ALLOWED_ORIGINS` | Azure App Service 环境变量 | 设了就**整体替换** `main.py` 里的默认列表 |
| `DATABASE_URL` | Azure App Service 环境变量 | 必须用连接池 6543 + `sslmode=require` |

---

###### 依赖关系：动什么会坏什么

```
Supabase PostgreSQL ◄──────────┬─────────────── Railway 后端
   （单点，两边共用）           │                （备用环境）
                               │
                        Web App (#3)
                               ▲
                    ┌──────────┴──────────┐
                    │                     │
            App Service Plan (#2)     ACR (#1)
              （算力）                 （镜像）
                    ▲                     ▲
                    │                     │
              CNAME api           GitHub Actions
                                  (backend workflow)

Static Web App (#4) ◄─── A 记录 @ ◄─── GitHub Actions
                                        (SWA workflow)
```

| 你动了 | 后果 |
|---|---|
| 删 A 记录 `@` | 前端立刻打不开，后端不受影响 |
| 删 CNAME `api` | 后端 API 全挂，前端页面能开但功能全废 |
| 删 ACR (#1) | 现有容器继续跑，但重启/重新部署会失败（拉不到镜像） |
| 删 App Service Plan (#2) | Web App (#3) 一起没了，Plan 是它的宿主 |
| 停 Supabase | **Railway 和 Azure 同时挂**，唯一的单点 |
| 停 Railway | Azure 不受影响，但你失去唯一验证过的备用环境 |
| 改 SWA 的 IP（Azure 那边变） | 前端挂，要手动改 Hostinger 的 A 记录 |

**唯一真正的单点是 Supabase**。Azure 和 Railway 互为备份，但数据库只有一份。

---

###### 当前真实状态（不是全 Azure）

| 端 | 连的后端 | 备注 |
|---|---|---|
| Web (smartsystem.live) | Azure | ✅ 已验证 |
| Android APK | Azure | ✅ 已改 `app_config.dart` |
| iOS（已装在手机上的） | Railway | ⚠️ 旧构建，要重新跑 Codemagic 才会变 |
| Railway 前端 | Railway 后端 | 仍在跑，作为备用 |

Azure 上线时间：2026-08-11。**人脸识别在 B1（1.75GB RAM）上的表现还没压测过**，
DeepFace 首次加载 ArcFace 模型很吃内存，这是最可能出问题的地方。
Railway 是目前唯一被长期验证的环境，别急着停。

---

##### 📋 资源清单

###### Resource Group
- **名称**: `fyp-azure-rg`
- **位置**: East Asia
- **用途**: 包含所有 FYP 相关的 Azure 资源

---

###### 后端 (Backend)

###### Container Registry (ACR)
- **名称**: `yss2026fyp.azurecr.io`
- **用途**: 存储 Docker 镜像
- **镜像**: `yss2026fyp.azurecr.io/fyp-backend:latest`
- **登录**: 
  ```bash
  az acr login --name yss2026fyp
  ```

###### App Service Plan
- **名称**: `fyp-backend-plan`
- **SKU**: B1 (Basic, 1.75GB RAM)
- **用途**: 运行容器化的 FastAPI 后端

###### Web App (App Service)
- **名称**: `fyp-backend-azure`
- **默认域名**: `fyp-backend-azure.azurewebsites.net`
- **自定义域名**: `api.smartsystem.live` ✅
- **HTTPS**: Azure Managed Certificate (SNI SSL) ✅
- **容器来源**: ACR (`yss2026fyp.azurecr.io/fyp-backend:latest`)
- **用途**: 
  - 人脸识别 API (DeepFace + ArcFace)
  - 考勤系统后端
  - 连接 Supabase PostgreSQL

**环境变量**（在 Azure Portal 配置）:
- `DATABASE_URL`: Supabase 连接池 (port 6543, SSL)
- `WEBSITES_PORT`: 8000
- 其他从 `fyp-backend/.env` 复制

**健康检查**:
```bash
curl https://api.smartsystem.live/
# 返回: {"status":"online","message":"Smart Attendance API is running"}
```

---

###### 前端 (Frontend)

###### Static Web App
- **名称**: `fyp-frontend-azure`
- **默认域名**: `red-sand-0c0d09f00.7.azurestaticapps.net` ✅
- **自定义域名**: `smartsystem.live` ✅ (A 记录 → `57.158.92.245`)
- **SKU**: Free Tier
- **用途**: 托管 React Vite 前端
- **构建配置**:
  - App location: `/fyp_web`
  - Output location: `dist`
  - Build command: `npm run build`
- **GitHub 集成**: 自动从 `LowYoongQian/fyp` main 分支部署

**环境变量** (`.env.production`):
```env
VITE_API_BASE_URL=https://api.smartsystem.live
VITE_DEFAULT_STUDENT_PASSWORD=Student@2024
```

**DNS 配置** (Hostinger):
- TXT 记录（域名验证）:
  ```
  类型: TXT
  名称: @ (根域名)
  值:   _5ggxha2e6altn74z428fplv6j52eg6j
  TTL:  300
  ```
- A 记录（流量路由）:
  ```
  类型: A
  名称: @
  值:   57.158.92.245
  TTL:  300
  ```
  > 注意 1: Hostinger 不支持根域名 CNAME/ALIAS，只能用 A 记录。
  > SWA 的 IP 理论上可能变，变了要手动更新这条记录。
  >
  > 注意 2: 配置时如果 DNS 已指向 Azure 但响应头出现 `Server: hcdn`，
  > 说明 Hostinger CDN 在拦截流量，要去 hPanel 关掉 CDN。

**CORS 配置**（关键）:
后端 `ALLOWED_ORIGINS` 环境变量必须包含前端域名，否则前端所有 API 调用被浏览器拦掉：
```bash
az webapp config appsettings set --name fyp-backend-azure --resource-group fyp-azure-rg \
  --settings "ALLOWED_ORIGINS=https://smartsystem.live,https://red-sand-0c0d09f00.7.azurestaticapps.net,http://localhost:5173,http://localhost:5174"
```
> 设了这个变量会**整体替换** `main.py` 里的默认列表，所以本地开发地址也要带上。
> `origin_regex` 不受影响，Railway 前端照样能调 Azure 后端。

**验证部署**:
```bash
# 默认域名
curl https://red-sand-0c0d09f00.7.azurestaticapps.net

# 自定义域名（配置完成后）
curl https://smartsystem.live
```

---

##### 🛠️ 常用命令

###### 后端管理

###### 查看 App Service 日志
```bash
az webapp log tail --name fyp-backend-azure --resource-group fyp-azure-rg
```

###### 重启 App Service
```bash
az webapp restart --name fyp-backend-azure --resource-group fyp-azure-rg
```

###### 查看环境变量
```bash
az webapp config appsettings list --name fyp-backend-azure --resource-group fyp-azure-rg
```

###### 更新环境变量
```bash
az webapp config appsettings set --name fyp-backend-azure --resource-group fyp-azure-rg --settings KEY=VALUE
```

###### 手动构建并推送镜像
```bash
cd fyp-backend
docker build -t yss2026fyp.azurecr.io/fyp-backend:latest .
az acr login --name yss2026fyp
docker push yss2026fyp.azurecr.io/fyp-backend:latest
az webapp restart --name fyp-backend-azure --resource-group fyp-azure-rg
```

---

###### 前端管理

###### 查看 Static Web App 状态
```bash
az staticwebapp show --name fyp-frontend-azure --resource-group fyp-azure-rg
```

###### 获取部署 token
```bash
az staticwebapp secrets list --name fyp-frontend-azure --resource-group fyp-azure-rg --query "properties.apiKey" -o tsv
```

---

###### SSL 证书管理

###### 查看证书列表
```bash
az webapp config ssl list --resource-group fyp-azure-rg
```

###### 查看自定义域名
```bash
az webapp config hostname list --webapp-name fyp-backend-azure --resource-group fyp-azure-rg
```

---

##### 🔀 环境切换

###### Railway (当前生产环境)
- **Backend**: `https://fyp-backend-production.up.railway.app`
- **Frontend**: 部署在 Railway
- **用途**: 当前在线的生产系统

###### Azure (测试/备用环境)
- **Backend**: `https://api.smartsystem.live`
- **Frontend**: `https://smartsystem.live` (待部署)
- **用途**: 新环境测试，未来可能切换为主环境

###### 切换步骤（未来）
1. 验证 Azure 环境功能完整
2. 更新 Flutter app 的 API base URL
3. 更新 DNS 记录（如果需要）
4. 逐步将流量从 Railway 迁移到 Azure
5. 保持 Railway 作为备份一段时间

---

##### 📊 资源成本

###### 当前配置（预估）
- **App Service Plan B1**: ~$13/月
- **Container Registry Basic**: ~$5/月
- **Static Web Apps Free Tier**: $0/月
- **Azure Managed Certificate**: $0（免费）

**总计**: ~$18/月

---

##### 🚨 故障排查

###### 后端无法访问
```bash
# 1. 检查 App Service 状态
az webapp show --name fyp-backend-azure --resource-group fyp-azure-rg --query "state"

# 2. 查看最近日志
az webapp log tail --name fyp-backend-azure --resource-group fyp-azure-rg

# 3. 检查容器健康
az webapp show --name fyp-backend-azure --resource-group fyp-azure-rg --query "siteConfig.linuxFxVersion"

# 4. 重启
az webapp restart --name fyp-backend-azure --resource-group fyp-azure-rg
```

###### SSL 证书问题
```bash
# 查看证书状态
az webapp config ssl list --resource-group fyp-azure-rg

# 重新绑定证书（如果需要）
# 通过 Azure Portal: App Service → Custom domains → api.smartsystem.live → Add binding
```

###### DNS 问题
```bash
# 检查 DNS 解析
nslookup api.smartsystem.live
nslookup smartsystem.live

# 检查 CNAME 记录
nslookup -type=CNAME api.smartsystem.live

# 检查 TXT 记录（证书验证）
nslookup -type=TXT asuid.api.smartsystem.live
```

---

##### 📝 维护清单

###### 每周
- [ ] 检查 GitHub Actions 构建状态
- [ ] 查看 App Service 日志（是否有错误）
- [ ] 测试 API 端点响应

###### 每月
- [ ] 检查 Azure 账单
- [ ] 更新依赖包（如有安全更新）
- [ ] 备份数据库（Supabase 自动备份）

###### 季度
- [ ] 审查资源使用情况（是否需要升级/降级）
- [ ] 测试故障恢复流程
- [ ] 更新文档

---

##### 🔗 相关文档

- [AUTO-DEPLOY-SETUP.md](AUTO-DEPLOY-SETUP.md) - GitHub Actions CI/CD 配置
- [QUICK-REFERENCE.md](QUICK-REFERENCE.md) - Railway vs Azure 环境对比
- [AZURE-INDEX.md](AZURE-INDEX.md) - 文档索引

---

**最后更新**: 2026-08-11  
**维护者**: Yss

### docs/FACE-MATCH-TEST.md

#### Face Match Test — 独立的人脸识别测试功能

**临时的 testing 功能,不属于系统正式需求。测完可以整块删掉,删除步骤在最下面。**

加它的原因:签到(刷脸)功能被绑在一堆前置条件后面 —— 要有开着的 session、要在课表时间内、要连校园网、要过 liveness。凌晨没课开着,所以想单独验证「人脸比对本身准不准」根本没法测。

这个功能把 ArcFace 比对那一步单独剥出来,不碰其他任何东西。

---

##### 用法

前提:该学生**已经注册过人脸**(否则按钮不显示,backend 也会返回 400)。

1. 手机 app 用 student 账号登入
2. 进 **Check In** 那个 tab
3. 最上面有一个蓝色描边按钮 **"Test Face Recognition"**
4. 点进去刷脸,扫完直接弹结果:

```
✓ Face Matched
Identity confirmed as Lows.
Distance 0.2211 (threshold 0.4).
Lower is a closer match.
```

不匹配的话:

```
✗ No Match
This face does not match the registered profile.
Distance 0.6857 exceeds the threshold of 0.4.
```

不需要有课在上、不需要开 session、不需要连校园网、不需要过 liveness。任何时间都能点。

###### 怎么读那个 distance

Cosine distance,范围 0–2,**越小越像**。阈值 `0.40`(定义在 `integrations/face.py` 的 `_FACE_MATCH_THRESHOLD`)。

- `≤ 0.40` → 判定同一个人
- `> 0.40` → 判定不同人

拿自己的脸测应该落在 0.2–0.35 左右。找别人的脸测,应该 > 0.5。

---

##### API

```
POST /students/me/face/verify
Authorization: Bearer <student JWT>
{ "image_base64": "..." }

200 →
{
  "matched": true,
  "distance": 0.2211,
  "threshold": 0.4,
  "confidence": 0.7789,
  "student_name": "Lows"
}
```

错误:

| 情况 | 返回 |
|---|---|
| 空图片 | 400 `A captured face image is required.` |
| 没注册过人脸 | 400 `No registered face found. Register your face first.` |
| 图片解不开 / 没检测到脸 | 400 `Face embedding extraction failed: ...` |
| 没带 token | 401 |
| deepface 没装 | 503 |

---

##### 这个功能只做一件事

代码里最重要的一点:**它完全不写数据库**。没有 session 查询,没有 `AttendanceRecord`,没有任何 `commit` / `add` / `delete`。

这是安全前提,不是巧合。它故意跳过了 check-in 的全部关卡(开课 session、课表窗口、校园网验证、liveness),这只有在「它不可能记录任何东西」的情况下才是安全的 —— 否则它就变成一条绕过所有关卡记考勤的路,正好是这个系统要防的 proxy attendance。

所以如果以后有人想给它加个「顺便把考勤记上」,那就不能再留着了,必须把 check-in 的那些检查一起加回去。

---

##### 用真实数据验过

拿 DB 里 6 张已注册的 embedding 互相比对(阈值 0.40):

| 组合 | distance | 判定 |
|---|---|---|
| LOWS vs Lows | 0.2211 | **matched** ← 同一个人的两个测试账号,认出来了 |
| LOWS vs lows | 0.4399 | rejected |
| Yong Sung Shen vs Test1 | 0.4469 | rejected |
| LOWS vs Yong Sung Shen | 0.7439 | rejected |
| LOWS vs Low | 0.9487 | rejected |
| 其余 impostor 组合 | 0.64 – 0.98 | rejected |

真人识别是通的。

###### 自动化测试

`fyp-backend/tests/test_backend_fixes.py` 里的 `check_face_verify_is_read_only`:

```bash
cd fyp-backend && .venv/Scripts/python.exe tests/test_backend_fixes.py
```

测的是:调用前后 attendance 行数必须相等(read-only 性质)、坏图片 400、空图片 400、未授权 401。

当时结果 `13/14 passed`,`flutter analyze` 干净。唯一 FAIL 是 `check_announcement_visibility`,在 clean tree 上跑同样 fail(过期断言:期望 `created_at` 没有 `Z`,而 `iso_utc` 现在会加),跟这个功能无关。

---

##### 删除步骤

四处,全部是「删掉整块」,没有需要改回原样的地方 —— 除了 dashboard 的两行参数。

###### 1. `fyp-backend/routers/students.py`

删掉 `verify_face_only` 整个函数,连上面那行 `@router.post("/me/face/verify", ...)` 装饰器。大约在第 68–108 行,以

```python
@router.post("/me/face/verify", status_code=200)
```

开头,到 `student_name` 那个 return dict 的结尾 `}` 为止,下一个函数是 `get_my_courses`。

**import 不用动** —— `_extract_face_embedding` / `_embedding_to_floats` / `_cosine_distance` / `_FACE_MATCH_THRESHOLD` / `FaceEmbedding` 这些原本就在这个文件里被 `register_face` 用着。

###### 2. `fyp_flutter/lib/main.dart`

- 删掉 `testFaceMatch` 整个方法(约 1302–1390 行),从注释 `// Face matching on its own:` 开始,到下一个方法 `_showFaceRegistrationPrompt` 之前
- 删掉这一行(约 1603 行):
  ```dart
  onTestFaceMatch: () => testFaceMatch(context),
  ```

###### 3. `fyp_flutter/lib/screens/student/student_dashboard_screen.dart`

- 删掉字段声明(约 36 行):`final VoidCallback onTestFaceMatch;`
- 删掉构造函数参数(约 56 行):`required this.onTestFaceMatch,`
- 删掉 `_buildFaceMatchTestButton` 整个方法(约 379–397 行)
- 删掉调用那行(约 831 行):`_buildFaceMatchTestButton(),`

###### 4. `fyp-backend/tests/test_backend_fixes.py`

- 删掉 `check_face_verify_is_read_only` 整个函数(约 532–588 行)
- 从 `NEEDS_DB` 列表里删掉 `check_face_verify_is_read_only,`(约 637 行)

###### 5. 删掉这个文件 (`docs/FACE-MATCH-TEST.md`)

###### 删完确认

```bash
# 应该没有任何输出
grep -rn "face/verify\|verify_face_only\|testFaceMatch\|onTestFaceMatch\|_buildFaceMatchTestButton\|check_face_verify_is_read_only" \
  fyp-backend/ fyp_flutter/lib/ --include=*.py --include=*.dart | grep -v .venv

cd fyp_flutter && flutter analyze lib/main.dart lib/screens/student/student_dashboard_screen.dart
cd fyp-backend && .venv/Scripts/python.exe tests/test_backend_fixes.py
```

`flutter analyze` 要 "No issues found",测试要回到 `12/13 passed`(那个 announcement 的 FAIL 是原本就有的)。

### docs/NETWORK-VERIFICATION-FIX.md

#### 签到位置验证功能修复文档

##### 问题概述

学生签到时的**位置验证功能目前无法正常工作**，会导致所有签到请求被拦截，即使学生在校园网内也会收到「必须连接校园网络才能签到」的错误。

---

##### 根本原因

后端部署在 Azure App Service 上，Azure 在应用前面放了一层反向代理（负载均衡器）。学生的请求流程是：

```
学生手机 → 互联网 → Azure 反向代理 → 你的后端容器
```

Azure 反向代理会在请求头里加一个 `X-Forwarded-For` 字段，里面是学生的真实 IP。

但 `fyp-backend/domain/security_settings.py:18` 默认配置是：

```python
"trust_proxy_header": "false"
```

这导致 `fyp-backend/integrations/network_verify.py` 的 `get_client_ip()` 函数**忽略**了 `X-Forwarded-For`，直接读 `request.client.host`，拿到的是 **Azure 内部负载均衡器的 IP**（`169.254.x.x` 这种），不是学生的真实 IP。

签到时系统会拿这个假 IP 去匹配数据库里的白名单规则（`campus_networks` 表），当然匹配不上 → 拦截签到。

---

##### 已完成的修复（第 1 步）

**✅ 在前端 Admin 面板打开了「Trust X-Forwarded-For」开关**

路径：Admin → Network Security → Trust X-Forwarded-For（蓝色代表已开启）

这个开关控制的是数据库里 `system_config` 表的 `trust_proxy_header` 配置项。打开后，后端会信任 `X-Forwarded-For` 头，能拿到学生真实 IP 了。

---

##### 需要完成的修复（第 2 步）

###### 问题：白名单规则过时了

当前数据库里的 `campus_networks` 白名单规则是为**局域网部署**设计的，CIDR 字段填的是内网地址段（`192.168.x.x` / `10.x.x.x` 之类）。

但现在后端在云上，学生通过互联网访问，后端看到的是学生的**公网 IP**（比如 `161.142.150.7`）。

公网 IP 永远匹配不上内网段的规则 → 所有签到被拦。

###### 修复方案

根据你们的实际使用场景选择一种：

---

###### 方案 A：只允许特定公网 IP 段签到（推荐，适合固定校园出口 IP 的场景）

如果你们学校的所有设备出校园网时都走固定的公网 IP 段（比如学校买了一个 `161.142.150.0/24` 的 IP 段），就用这个方案。

**操作步骤：**

1. **确定校园的公网 IP 段**
   - 联系学校 IT 部门，要「校园网对外的公网 IP 地址段」
   - 或者：让几个学生连上校园 WiFi，在前端 Admin 面板点「Re-Detect」看他们的 IP，找到共同部分

2. **修改白名单规则**
   - Admin → Network Security → Campus Networks 部分
   - 点现有规则（比如 `B-17-17`）的「Edit」
   - 把 **CIDR** 字段从 `192.168.x.x/24` 改成学校的公网段，比如：
     ```
     161.142.150.0/24
     ```
     （这个例子覆盖 `161.142.150.0` 到 `161.142.150.255`）
   - **或者**直接新增一条规则，Label 填 "Campus Public IP"，CIDR 填上面那个
   - 点 **Save Rules**

3. **测试**
   - 让一个学生连上校园 WiFi
   - 打开 app 签到
   - 应该能成功，不会被拦

---

###### 方案 B：同时允许内网和公网（适合混合部署场景）

如果后端有时会跑在校内（比如你的笔记本在学校时），有时跑在云上，就保留两套规则。

**操作步骤：**

1. **保留**现有的内网规则（`192.168.x.x/24`）
2. **新增**一条公网规则：
   - Label: `Campus Public IP`
   - CIDR: `161.142.150.0/24`（或你们实际的公网段）
   - SSID / BSSID 留空
   - is_active: 勾选
3. **Save Rules**

这样学生在校内连 WiFi，不管后端在哪，都能通过验证。

---

###### 方案 C：用 SSID/BSSID 替代 CIDR（最灵活，但容易被学生伪造）

如果学校的公网 IP 不固定（比如用的是运营商动态 IP），或者不想依赖 IP 匹配，可以只用 WiFi 名字和路由器编号。

**操作步骤：**

1. 连上校园 WiFi，在前端点「Re-Detect」，记下：
   - **SSID**（WiFi 名字，比如 "TARUMT-WiFi"）
   - **BSSID**（路由器 MAC 地址，比如 "AA:BB:CC:DD:EE:FF"）

2. 修改白名单规则：
   - 把 **CIDR** 字段**清空**（或者填 `0.0.0.0/0` 表示任意 IP）
   - **SSID** 填校园 WiFi 的名字
   - **BSSID Prefix** 填路由器 MAC 的前几位（比如 `AA:BB:CC` 可以匹配该厂商所有路由器）
   - **Save Rules**

3. **注意安全风险**：学生可以自己开热点，取名和校园 WiFi 一样，伪造 SSID/BSSID。所以这个方案**不如 CIDR 安全**，但胜在灵活。

---

###### 方案 D：暂时关闭位置验证（适合开发/测试阶段）

如果现在不需要限制签到位置（比如还在开发，或者改成线上课了），直接关掉这个功能。

**操作步骤：**

1. Admin → Network Security
2. 把「**Enable network verification**」开关**关掉**（变成灰色）
3. 学生在任何地方都能签到，不会被拦

需要的时候再打开，但记得先改好白名单规则。

---

##### 相关配置说明

所有配置都在 Admin → Network Security 页面：

| 配置项 | 当前状态 | 作用 |
|---|---|---|
| **Enable network verification** | ON（蓝色）| 总开关。关掉后不检查位置，任何地方都能签到 |
| **Fail-closed (block off-campus)** | ON（蓝色）| 验证失败时怎么办。ON = 拦住；OFF = 放行但记录 |
| **Trust X-Forwarded-For** | ON（蓝色）✅ | 已修复。信任 Azure 反向代理提供的真实 IP |
| **Demo mode** | OFF | 演示模式。可以假装「来自校园网」方便演示 |

---

##### 验证修复是否成功

1. 让一个学生连上校园 WiFi
2. 打开 app，登录，进签到页面
3. 点签到
4. **成功** → 修好了
5. **失败，提示「必须连接校园网络」** → 白名单规则还不对，重新检查 CIDR / SSID 是否填对

可以在后端日志里看到详细的验证过程：

```bash
# 如果后端跑在本地
tail -f logs/app.log | grep "network_verify"

# 如果在 Azure，用 Azure Portal 的 Log Stream
```

---

##### 技术细节（给开发者看的）

###### 代码位置

- **验证逻辑**：`fyp-backend/integrations/network_verify.py` → `verify_network()` 函数
- **调用点**：`fyp-backend/routers/sessions.py:282` 和 `:541`（学生和讲师签到）
- **配置读取**：`fyp-backend/domain/security_settings.py`
- **前端界面**：`fyp_web/src/pages/admin/CampusNetworkManager.tsx`

###### 验证逻辑优先级

`verify_network()` 按这个顺序检查：

1. **CIDR 匹配**：`source_ip` 在白名单的 IP 段里 → 通过
2. **SSID 匹配**：学生报的 WiFi 名字在白名单里 → 通过
3. **BSSID 匹配**：学生报的路由器编号在白名单里 → 通过
4. **Fallback 子网检查**（只在没有白名单规则时）：学生和服务器在同一个 `/24` 段 → 通过
5. **都不匹配** → 拒绝

只要 1/2/3 任意一条通过就算通过，是「或」的关系不是「且」。

###### `source_ip` 是怎么拿到的

```python
# fyp-backend/integrations/network_verify.py:19
def get_client_ip(request, trust_proxy_header: bool = False) -> str:
    if trust_proxy_header:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()  # 最左边是真实客户端
    client = request.client
    return client.host if client else ""
```

`trust_proxy_header` 来自数据库配置 `system_config.trust_proxy_header`。

###### Azure 为什么要加反向代理

Azure App Service 不是直接暴露容器的，架构是：

```
互联网 → Azure Front Door / Application Gateway
        → 内部负载均衡器（设置 X-Forwarded-For）
        → 你的容器（uvicorn 监听内网 IP）
```

这是 Azure 的标准做法，好处是自动处理 SSL、负载均衡、DDoS 防护。代价是必须信任 `X-Forwarded-For`。

###### 安全风险评估

**信任 `X-Forwarded-For` 的风险**：如果有人能绕过 Azure 直连你的容器，就能伪造 `X-Forwarded-For` 假装自己在校园网。

**Azure 的保护**：App Service 默认不暴露容器的真实 IP，只能通过 Azure 的反向代理访问，所以这个风险**可接受**。

除非你手动在 Azure 配置了 VNet 直连或者打开了某些特殊端口，否则容器不会被直接访问到。

---

##### 如果修复后还是有问题

###### 症状 1：学生报「必须连接校园网络」，但他确实在校内

**排查步骤：**

1. 让学生截图他的 WiFi 设置（确认连的是哪个网络）
2. Admin → Network Security → 点「Re-Detect」，看当前你自己的 IP
3. 如果你在校内，这个 IP 应该和学生的在同一个段
4. 检查白名单规则的 CIDR 是否覆盖了这个段
5. 如果用的是 SSID/BSSID 规则，让学生在 app 里看他上报的 SSID/BSSID 是什么（签到失败的记录里会有）

###### 症状 2：所有人都能签到，包括不在校内的

说明位置验证被绕过了，可能是：

1. 「Enable network verification」开关关着 → 打开
2. 「Fail-closed」开关关着 → 打开（不然验证失败也会放行）
3. 白名单规则太宽，比如填了 `0.0.0.0/0` → 改成实际的校园 IP 段

###### 症状 3：后端日志报 `SocketException` 或者 CIDR 解析错误

CIDR 格式写错了，标准格式是：

```
192.168.1.0/24        ✅ 对
192.168.1.0/255.255.255.0  ❌ 错（这是 subnet mask，不是 CIDR）
192.168.1.*           ❌ 错（通配符不行）
```

---

##### 联系人

如果还有问题，这个功能的代码主要在：

- 后端：`fyp-backend/integrations/network_verify.py`
- 前端：`fyp_web/src/pages/admin/CampusNetworkManager.tsx`

检查签到记录里的 `network_verified` 字段和 `verify_detail` 字段可以看到每次验证的结果。

### docs/QUICK-REFERENCE.md

#### 🚀 Azure vs Railway 环境对照表

##### 环境配置

| 组件 | Railway (生产) | Azure (测试) |
|------|---------------|--------------|
| **前端 URL** | `https://smart-web.up.railway.app` | `https://smartsystem.live` |
| **后端 URL** | `https://fyps.up.railway.app` | `https://api.smartsystem.live` |
| **数据库** | Supabase (共享) | Supabase (共享) |
| **状态** | ✅ 生产环境 | 🧪 测试环境 |

---

##### 快速命令

###### 编译 Railway 版本 Flutter App
```bash
cd fyp_flutter
flutter build apk
# 输出: build/app/outputs/flutter-apk/app-release.apk
# 连接 https://fyps.up.railway.app
```

###### 编译 Azure 版本 Flutter App
```bash
cd fyp_flutter
flutter build apk --dart-define=API_BASE_URL=https://api.smartsystem.live
# 输出: build/app/outputs/flutter-apk/app-release.apk
# 连接 https://api.smartsystem.live
```

---

##### 测试用户账号

建议创建专门的测试账号：
- Email: `azure-test@example.com`
- 只在 Azure 环境使用
- 避免污染 Railway 生产数据

---

##### 部署触发

###### Railway (自动)
```bash
git push origin main
# Railway 自动检测并部署
```

###### Azure (手动)
```bash
# 前端
gh workflow run azure-frontend-deploy.yml

# 后端
gh workflow run azure-backend-deploy.yml
```

---

##### 健康检查

###### Railway
```bash
curl https://fyps.up.railway.app/health
```

###### Azure
```bash
curl https://api.smartsystem.live/health
```

---

##### 成本对比

| 项目 | Railway | Azure (学生) |
|------|---------|--------------|
| 前端 | $0 (Hobby Plan) | $0 (Static Web Apps) |
| 后端 | ~$5/月 | ~$13/月 (B1) |
| 数据库 | $0 (Supabase) | $0 (Supabase) |
| **总计** | **$5/月** | **$13/月** (用学生 credit 抵扣) |

---

##### 故障处理

###### Azure 后端无法启动
```bash
# 查看日志
az webapp log tail --name fyp-backend-azure --resource-group fyp-azure-rg

# 常见问题：
# 1. 环境变量未设置 → 检查 DATABASE_URL
# 2. 内存不足 → 确认是 B1 规格
# 3. 容器启动超时 → 已设置 1800 秒
```

###### 前端 API 连接失败
```bash
# 检查 CORS 配置
az webapp config appsettings list \
  --name fyp-backend-azure \
  --resource-group fyp-azure-rg \
  --query "[?name=='ALLOWED_ORIGINS']"

# 应该包含 https://smartsystem.live
```

### docs/01-CurrentCode/README.md

#### 01-CurrentCode — 现行代码资料

这个目录只放**和当前代码一致**的资料。历史评审、旧计划、已完成的清单都在
[`../archive/`](../archive/)。

**对应代码版本**：`45da256`，alembic head `42c198406814`
**最后核对**：2026-07-30

| 文件 | 内容 |
|---|---|
| [backend-architecture.md](./backend-architecture.md) | 目录结构、分层、18 张表、课表模型、fail-closed 策略、环境变量、测试 |
| [backend-api-reference.md](./backend-api-reference.md) | 全部 81 个端点：权限门、请求体、响应形状 |
| [module1-face-recognition.md](./module1-face-recognition.md) | ArcFace + ML Kit 活体（无训练，预训练模型比对） |
| [module2-risk-prediction.md](./module2-risk-prediction.md) | RandomForest 出勤风险预测（唯一真正训练过的模型） |
| [module3-llm-query.md](./module3-llm-query.md) | Gemini text-to-SQL 自然语言查询（无训练） |

相关的在别的目录：
- [`02-Engineering/CONVENTIONS.md`](../02-Engineering/CONVENTIONS.md) —— 改代码前先看，每条规矩都对应一次真实事故
- [`02-Engineering/BACKEND-REVIEW.md`](../02-Engineering/BACKEND-REVIEW.md) —— 某个设计为什么是这样
- [`03-MLModel/`](../03-MLModel/) —— 风险模型的英文完整参考 + 训练脚本
  （BACKEND-REVIEW 引用它作为 ML fail-soft 的授权来源）

##### 怎么保持最新

API 参考和架构文档都是**从运行中的代码导出后逐条核对**的，不是手写清单。
重新核对的命令写在 backend-api-reference.md §11。

改了端点或 schema，改文档；对不上就改文档，别改代码去迁就文档。

##### 已知的历史错误（别再写回去）

以前的 `module-interfaces.md`（已删）里有这些和代码相反的说法：

| 错误说法 | 实际 |
|---|---|
| deepface 缺失时退回 mock embedding，跳过身份匹配 | **503 拒绝**，没有任何旁路 |
| 启动时跑幂等 `ALTER TABLE`，没有 Alembic | 启动时零 DDL，5 个 alembic migration |
| 有单设备锁，换设备 token 作废 | 没有。`device_id` 只被记录 |
| 有 `device_sessions` 表 | 不存在 |
| migration 在 `main.py` 里 | 在 `alembic/versions/` |
| 代码在 `backend/utils/models.py` | 在 `fyp-backend/db/models.py` |

同期的 `backend-api-reference.md` 还漏了 18 个端点、留着一个已删的
`GET /sessions/open`。

### docs/01-CurrentCode/backend-api-reference.md

#### Backend API Reference

> **生成方式**：从运行中的 FastAPI 应用导出路由表（`main.app.routes`），逐个对照
> 源码核对权限门、请求体、响应形状。不是手写清单。
> **对应代码版本**：commit `f3dcba1` 之后（alembic head `42c198406814`）。
> **最后核对**：2026-07-30

**81 个业务端点** + 4 个 FastAPI 自带文档路由（`/docs`、`/docs/oauth2-redirect`、
`/redoc`、`/openapi.json`），共 85 条。

改动 API 时的规矩见 [CONVENTIONS.md](../02-Engineering/CONVENTIONS.md)。架构分层见
[backend-architecture.md](./backend-architecture.md)。

---

##### 1. 全局约定

###### 1.1 认证

`POST /auth/login` 返回 JWT，之后所有受保护端点都要
`Authorization: Bearer <token>`。Token 里带 `user_id`，
[utils/security.py](../../fyp-backend/utils/security.py) 用它查 `users` 表。

四个依赖决定谁能进（`utils/security.py:64-93`）：

| 依赖 | 放行角色 | 失败码 |
|---|---|---|
| `get_current_user` | 任何登录用户 | 401 |
| `require_student` | `student` | 403 |
| `require_lecturer` | `lecturer` **或** `admin` | 403 |
| `require_admin` | `admin` | 403 |

`require_lecturer` 放行 admin 是故意的：admin 是 lecturer 的超集。
所以「lecturer 端点」admin 一律能调。

token 缺失/无效/过期 → **401**；token 有效但角色不对 → **403**。

**没有单设备锁。** `LoginRequest` 和 `AttendanceSubmit` 都收 `device_id`，
但后端只记录，不用它作废别的 token。任意数量的设备可以同时持有同一个账号的
有效 token。

###### 1.2 缓存

[main.py](../../fyp-backend/main.py) 挂了 `ETagMiddleware`，GET 响应带
`ETag`，客户端回 `If-None-Match` 命中就 **304**。

但 `NO_STORE_PREFIXES`（`main.py:23-32`）里的路径强制 `Cache-Control: no-store`：

- `/sessions/*`
- `/students/me/active-sessions`
- `/students/me/attendance`
- `/admin/sessions`（含 `/sessions` 本身）

原因写在代码注释里：这些端点决定「现在能不能签到」，缓存 30 秒会让学生看不到
刚开的课、还看得到刚关的课。

###### 1.3 常见响应形状

- `MessageResponse` = `{message, user_id?}`
- 删除/更新类端点多半返回 `MessageResponse`
- 创建类端点返回 **201** + 资源体

###### 1.4 时区

服务器时间统一用 `Asia/Kuala_Lumpur`
（[utils/timeutil.py](../../fyp-backend/utils/timeutil.py) 的 `CAMPUS_TZ`），
不读宿主机时区偏移。DB 里存 UTC。

---

##### 2. Auth — 8 条

[routers/auth.py](../../fyp-backend/routers/auth.py)，前缀 `/auth`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/auth/register` | 公开 | 注册 |
| POST | `/auth/login` | 公开 | 登录，发 JWT |
| GET | `/auth/server-time` | 公开 | 服务器时间（客户端校时用） |
| GET | `/auth/me` | 登录 | 当前用户资料 |
| PUT | `/auth/me/settings` | 登录 | 改偏好设置 |
| PUT | `/auth/me/change-password` | 登录 | 改密码 |
| PUT | `/auth/me/avatar` | 登录 | 改头像 |
| PUT | `/auth/me/admin-profile` | 登录 | admin 改自己的名字/邮箱/编号 |

**`POST /auth/register`** → 201
请求 `RegisterRequest{email, password, role, name, code?, class_group?}`。
`role` ∈ `student` / `lecturer` / `admin`。学生要 `code`（学号）和 `class_group`。
邮箱域名有校验（`utils/db_helpers.py` 的 `require_email_domain`）。

**`POST /auth/login`**
请求 `LoginRequest{password, email?, identifier?, device_id?, portal?}` —
`email` 和 `identifier` 二选一（`identifier` 可以是学号/职工号）。
响应 `TokenResponse{access_token, token_type, role, user_id, profile_id?, name?,
code?, email?, is_face_registered?}`。
`device_id` 只被记录，不作废别的会话（见 §1.1）。

**`GET /auth/me`** 返回 16 个键：账号字段 + 8 个偏好设置 + `avatar_url`。

**`PUT /auth/me/settings`**
请求 `UserSettingsUpdate`，8 个字段全可选：`theme_preference`、
`font_size_preference`、`language_preference`、`notifications_enabled`、
`email_notifications`、`push_notifications`、`in_app_notifications`、
`two_factor_enabled`。

**`PUT /auth/me/change-password`** 请求 `{current_password, new_password}`。
旧密码不对 → 400。

**`PUT /auth/me/avatar`** 请求 `{avatar_url}`。
**`PUT /auth/me/admin-profile`** 请求 `{name, email, code}`，三个都必填。

---

##### 3. Sessions / 考勤 — 9 条

[routers/sessions.py](../../fyp-backend/routers/sessions.py)，前缀 `/sessions`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/sessions/open` | lecturer | 开课签到 |
| POST | `/sessions/{id}/close` | lecturer | 关课 |
| POST | `/sessions/{id}/attend` | student | **学生签到（核心）** |
| GET | `/sessions/{id}/attendance` | lecturer | 实时签到名单 |
| GET | `/sessions/active` | lecturer | 我开着的 session |
| GET | `/sessions/my-courses` | lecturer | 我教的课 |
| GET | `/sessions/course/{course_id}/sessions` | lecturer | 某课的历史 session |
| PUT | `/sessions/attendance/{session_id}/{student_id}` | lecturer | 手改考勤 |
| POST | `/sessions/verify-network` | **公开** | 单独测网络是否在校园网 |

> 以前有个 `GET /sessions/open`，和 `/students/me/active-sessions` 回答同一个问题
> 但响应形状不同，没有调用方，已删（`sessions.py:193-196`）。**不要再加回来。**

**`POST /sessions/open`** → 201
请求 `SessionCreate{course_id, class_group?}`（`class_group` 默认 `"All"`）。
响应 `SessionResponse{id, course_id, opened_at?, closed_at?, is_open, class_group}`。
- 不教这门课 → **403**（`require_course_access`）
- 不在课表时间窗内 → **400**（`validate_session_opening`）
- 这个组已经有开着的 session → **400**

只给指定组开。开 G1 不会让 G2/G3 的学生能签到；`"All"` 是全课的 lecture。

**`POST /sessions/{id}/close`** 已经关了 → **400**。

**`GET /sessions/{id}/attendance`**
响应 `SessionAttendanceResponse{session_id, course_name, course_code, class_group,
is_open, attendance_list[]}`，list 里是 `StudentAttendanceStatus`。
只能看自己教的课，admin 不限（`sessions.py:350-353`）。

**`PUT /sessions/attendance/{session_id}/{student_id}`**
讲师只能改自己教的组的学生。

**`POST /sessions/verify-network`** — **无需登录**。
请求体可选 `{}`，服务端看真实来源 IP 比对 `campus_networks` 白名单。
调试工具，不产生考勤记录。

###### 3.1 `POST /sessions/{id}/attend` — 签到闸门顺序

请求 `AttendanceSubmit`：

| 字段 | 必填 | 用途 |
|---|---|---|
| `wifi_ssid` | ✅ | 客户端上报的 SSID |
| `image_base64` | ✅ | 现场人脸照 |
| `liveness_passed` | 默认 false | 客户端 ML Kit 活体结果 |
| `bssid` | | AP MAC |
| `gateway_ip` | | 网关 IP |
| `local_ip` | | 内网 IP |
| `liveness_challenge_ms` | | 完成手势用了多少毫秒 |
| `device_id` | | 只记录，不作校验 |

闸门按这个顺序，**任何一关不过就整笔拒绝，不写记录**
（`sessions.py:199-343`）：

| # | 检查 | 不过 | 说明 |
|---|---|---|---|
| 1 | session 存在 | 404 | |
| 2 | 超过课表结束时间 | 400 | 顺手把 session 标成关闭 |
| 3 | session 已关 | 400 | |
| 4 | 有学生档案 | 404 | |
| 5 | 选了这门课 **且** 在这个组 | **403** | `require_session_enrolment`；`"All"` 组放行所有已选课学生 |
| 6 | 没签过 | 400 | |
| 7 | 在允许签到的时间窗内 | 403 | `validate_student_checkin` |
| 8 | `liveness_passed` 为真 | 400 | |
| 9 | 图片非空 | 400 | 不接受占位符 |
| 10 | 已注册人脸 | 400 | |
| 11 | **ArcFace 身份比对** | **403** | cosine 距离 > 0.40 |
| 12 | 校园网验证 | **403** | 仅当 `network_check_enabled` 且 `fail_closed` |
| 13 | 写入唯一约束 | 400 | 并发双击的兜底 |

**没有 mock / dev 降级。** deepface 装不上时第 11 关抛 **503**，不是放行。
这是防代签的核心机制，绕不过去。

关于第 12 关：`network_check_enabled` 关掉时 `network_verified` 直接记 `True`；
开着但 `fail_closed` 关掉时，验证失败只记录不拦人。两个开关都在
`security_settings` 表里。

`liveness_challenge_ms < 800` 不拦人，只把 `liveness_suspicious` 记成 `True`
供后台审查。`liveness_passed`（客户端报的）和 `liveness_suspicious`（速度可疑）
是两列，别再合并。

成功返回 `AttendanceResponse`，含 `confidence_score`（= `1 - cosine距离`）、
`network_verified`、`verify_detail`、`liveness_suspicious`。

---

##### 4. 学生自助 — 7 条

分在两个 router，前缀都是 `/students/me`：
[routers/students.py](../../fyp-backend/routers/students.py)（4 条）和
[routers/student_self.py](../../fyp-backend/routers/student_self.py)（3 条）。
拆分只是文件组织，对客户端是同一组端点。

| 方法 | 路径 | 权限 | 文件 |
|---|---|---|---|
| POST | `/students/me/face` | student | students.py |
| GET | `/students/me/courses` | student | students.py |
| GET | `/students/me/active-sessions` | student | students.py |
| GET | `/students/me/attendance` | student | students.py |
| GET | `/students/me/profile` | student | student_self.py |
| GET | `/students/me/enrolments` | student | student_self.py |
| GET | `/students/me/announcements` | student | student_self.py |

**`POST /students/me/face`** 请求 `{image_base64}`。
以 `enforce_detection=True` 抽取 ArcFace 向量 —— 照片里必须真的有脸，
否则不会把垃圾向量存成这个学生的身份。已有记录则覆盖。
返回 `{status, message}`。**deepface 缺失 → 503**，同签到。

**`GET /students/me/courses`** 每个 (课, 角色) 一条：
`{id, course_id, course_code, course_name, class_group, schedule_day,
schedule_start, schedule_end, schedule_room, lecturer_name, role,
attendance_rate}`。`role` ∈ `Lecture` / `Tutor` / `Practical`。
`id` 是 `meeting_key`，不是数据库主键。

**`GET /students/me/active-sessions`** 现在能签到的课：
`{id, course_id, course_code, course_name, class_group, is_open,
already_checked_in}`。`no-store`。

**`GET /students/me/attendance`** 历史，最新在前：
`{course_code, course_name, class_group, status, marked_at, network_verified,
liveness_passed, verify_detail}`。`no-store`。

**`GET /students/me/profile`** →
`{id, user_id, name, student_code, is_face_registered, email, programme_id,
programme_name}`。

**`GET /students/me/enrolments`** →
`{id, student_id, course_id, course_code, course_name, credit_hours, semester,
class_group, schedule_day/start/end/room, attendance_rate}`。
课表来自 `class_meetings` 的 lecture 行。

**`GET /students/me/announcements`** 见 §8 公告可见性。

---

##### 5. 讲师 — 5 条

[routers/lecturers.py](../../fyp-backend/routers/lecturers.py)，前缀 `/lecturers`，
全部 `require_lecturer`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/lecturers/me/courses` | 我教的课 |
| GET | `/lecturers/me/timetable` | 我的课表（按 meeting 展开） |
| GET | `/lecturers/me/alerts` | 低出勤预警记录 |
| POST | `/lecturers/me/alerts` | 手动发预警 |
| GET | `/lecturers/me/announcements` | 给我看的公告 |

**`GET /lecturers/me/courses`** →
`{id, course_code, course_name, credit_hours, schedule_day/start/end/room,
enrolled_students_count, lecturer_id, lecturer_name}`。
「我教的课」= `my_course_ids()`：`Course.lecturer_id` 直接挂的 +
`course_staff_assignments` 派的。

**`GET /lecturers/me/timetable`** 比上面细一层，每个 meeting 一条，多了
`class_group` 和 `role`。Lecture 的 `id` 是 `Lecture-{course_id}`，
Tutor/Practical 的 `id` 是 `meeting_key_for(role, course_id, assignment_id,
class_group)` —— 带组后缀，因为一个 assignment 可能对应多个组各一行。

**`GET /lecturers/me/alerts`** →
`{id, student_id, student_name, student_code, course_id, course_code,
course_name, alert_type, email_body, triggered_by, triggered_at, sent_at}`。

**`POST /lecturers/me/alerts`** 请求 `{student_id, course_id}`。
后端生成邮件正文，`alert_type="manual_warning"`、`triggered_by="lecturer"`。

---

##### 6. Analytics（风险预测）— 2 条

[routers/analytics.py](../../fyp-backend/routers/analytics.py)，前缀 `/analytics`，
`require_lecturer`。模型细节见
[module2-risk-prediction.md](./module2-risk-prediction.md)。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/analytics/recompute` | 重算全部风险分 |
| GET | `/analytics/risk-scores` | 读风险分 |

**`POST /analytics/recompute`** → `{recomputed: <条数>}`。

**`GET /analytics/risk-scores`** 查询参数 `course_id?`、`student_id?`。响应
`{student_id, student_name, student_code, course_id, course_code, course_name,
attendance_rate, risk_score, risk_label, risk_factors, updated_at}`。
lecturer 只看得到自己教的课，admin 全看。

**ML 模型缺失时是 fail-soft**：`ml/risk_model.pkl` 加载失败会退回规则打分，
不报错。这是有意设计，理由见 [ml_risk_predict_desc.md](../03-MLModel/ml_risk_predict_desc.md)。
和人脸识别的 fail-closed 相反 —— 风险分算错只是排序不准，人脸放行错了就是代签。

---

##### 7. LLM 自然语言查询 — 1 条

[routers/llm.py](../../fyp-backend/routers/llm.py)，`require_lecturer`。
细节见 [module3-llm-query.md](./module3-llm-query.md)。

| 方法 | 路径 | 请求体 |
|---|---|---|
| POST | `/query/natural` | `{question}` |

响应 `{answer, sql_used?, success, row_count?}`。

生成的 SQL 过 `validate_sql()` 白名单校验（只允许 SELECT）才执行。

---

##### 8. 公告可见性（三个端点共用一套规则）

`GET /students/me/announcements`、`GET /lecturers/me/announcements`、
`GET /public/announcements` 都走
[domain/announcements.py](../../fyp-backend/domain/announcements.py)。
以前学生视图和讲师视图各有一份 60 行的近似副本，改一边漏一边就会把通知发错人。

定向是 **scope × role** 两个维度：

| `target_scope` | 受众 |
|---|---|
| `all`（默认） | 所有人 |
| `programme` | `target_programme_code` 匹配的专业 |
| `course` | `target_course_code` 匹配的课 |

| `target_role` | 受众 |
|---|---|
| `all`（默认） | 学生 + 教职工 |
| `students` | 只学生 |
| `staff` | 只教职工 |

两个维度上 `all` 都表示该维度不限制。专业/课程代码比较**不区分大小写**。

草稿（`is_draft`）和发布窗口（`publish_start` / `publish_end`）在 **SQL 层**过滤。

排序：`priority` 高的在前（High=3 / Medium=2 / Low=1，**认不出的值当 Medium**，
所以打错字不会让通知沉底），同级按 `created_at` 倒序。

响应形状由 `announcement_dict()` 唯一定义（15 个字段），三个端点 + 公开端点全用它，
免得某个字段只出现在一个界面上。

---

##### 9. 公开端点 — 4 条

定义在 [main.py](../../fyp-backend/main.py) 里，**都不需要 token**。

| 方法 | 路径 | 响应 |
|---|---|---|
| GET | `/` | `{status: "online", message}` 健康检查 |
| GET | `/public/logo` | `{logo_url}` |
| GET | `/public/announcements` | 公告数组（`announcement_dict` 形状） |
| GET | `/api/v1/system/languages` | `{supportedLanguages, translations}` |

**`/public/logo`** 三级回退：`security_settings.system_logo_base64` →
`system_logo_url` → 硬编码的 Supabase 默认图。

**`/public/announcements`** 只过滤 `is_draft == False`，**不做 scope/role 过滤** ——
它服务未登录的登录页，没有身份可以匹配。

**`/api/v1/system/languages`** 读 `languages.json`，先找 `fyp-backend/` 下的，
再找仓库根目录的。都没有则返回空结构。

---

##### 10. Admin — 45 条

七个 router，除两处例外全部 `require_admin`：

| 文件 | 前缀 | 条数 |
|---|---|---|
| [admin_academic.py](../../fyp-backend/routers/admin_academic.py) | `/admin` | 16 |
| [admin_config.py](../../fyp-backend/routers/admin_config.py) | `/admin` | 11 |
| [admin_students.py](../../fyp-backend/routers/admin_students.py) | `/admin` | 5 |
| [admin_staff.py](../../fyp-backend/routers/admin_staff.py) | `/admin` | 4 |
| [admin_reports.py](../../fyp-backend/routers/admin_reports.py) | `/admin/reports` | 4 |
| [admin_attendance.py](../../fyp-backend/routers/admin_attendance.py) | `/admin` | 3 |
| [admin_audit.py](../../fyp-backend/routers/admin_audit.py) | `/admin/audit` | 2 |

**两个例外**（用 `require_lecturer`，讲师也能调）：
`GET /admin/students` 和 `GET /admin/enrolments`。讲师排课和看名单需要。

###### 10.1 学术数据（16）

| 方法 | 路径 | 请求体 |
|---|---|---|
| GET | `/admin/programmes` | — |
| POST | `/admin/programmes` | `ProgrammeCreate{name, code}` |
| PUT | `/admin/programmes/{id}` | 同上 |
| DELETE | `/admin/programmes/{id}` | — |
| GET | `/admin/courses` | — |
| POST | `/admin/courses` | `CourseCreate` |
| PUT | `/admin/courses/{id}` | 同上 |
| DELETE | `/admin/courses/{id}` | — |
| GET | `/admin/assignments` | — |
| POST | `/admin/assignments` | `AssignmentCreate{course_id, lecturer_id, role}` |
| DELETE | `/admin/assignments/{id}` | — |
| GET | `/admin/enrolments` | — （**lecturer 可调**） |
| POST | `/admin/enrolments` | `dict` |
| DELETE | `/admin/enrolments/{id}` | — |
| GET | `/admin/timetable` | — |
| PUT | `/admin/timetable/{meeting_id}` | `{day, start, end, room}` |

`CourseCreate` = `{course_name, course_code, credit_hours?, lecturer_id?,
programme_id?}`。`AssignmentCreate.role` ∈ `Lecture` / `Tutor` / `Practical`。

**`GET /admin/timetable`** 读 `class_meetings`（课表唯一真相），每行返回
`{meeting_id, id, course_code, course_name, schedule_day/start/end/room,
lecturer_name, role}`。`meeting_id` 用来定位要改哪一格。

**`PUT /admin/timetable/{meeting_id}`** 改单格时间/教室，带时间合法性和撞课校验。

> `courses` 表上的 `schedule_day` / `schedule_start` / `schedule_end` /
> `schedule_room` 四列**已经删了**（migration `42c198406814`）。课表只在
> `class_meetings`。

###### 10.2 学生（5）

| 方法 | 路径 | 请求体 / 参数 |
|---|---|---|
| GET | `/admin/students` | `skip?`, `limit?`, `search?`（**lecturer 可调**） |
| POST | `/admin/students` | `AdminStudentCreate{email, password, name, student_code}` |
| PUT | `/admin/students/{id}` | `AdminStudentUpdate`（四个字段全可选） |
| PUT | `/admin/students/{id}/programme` | `{programme_id?}` |
| DELETE | `/admin/students/{id}` | — |

###### 10.3 教职工（4）

| 方法 | 路径 | 请求体 / 参数 |
|---|---|---|
| GET | `/admin/staff` | `skip?`, `limit?`, `search?` |
| POST | `/admin/staff` | `AdminStaffCreate{email, password, name, staff_id, role?}` |
| PUT | `/admin/staff/{lecturer_id}` | `AdminStaffUpdate`（全可选） |
| DELETE | `/admin/staff/{lecturer_id}` | — |

###### 10.4 考勤管理（3）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/sessions` | 全部 session（`no-store`） |
| GET | `/admin/sessions/{session_id}/attendance` | 某 session 的名单 |
| PUT | `/admin/attendance/{session_id}/{student_id}` | 手改考勤 |

**`GET /admin/sessions`** →
`{id, course_id, course_code, course_name, lecturer_name, lecturer_role,
class_group, opened_at, closed_at, is_open, status}`。

**`GET /admin/sessions/{id}/attendance`** 每个已选课学生一条，含
`confidence_score`、`network_verified`、`source_ip`、`verify_detail`、
`liveness_passed`。
`wifi_verified` 是 `network_verified` 的**兼容别名**，同一个值 —— 老客户端读
`wifi_verified`。物理列早就改叫 `network_verified` 了。

**`PUT /admin/attendance/{session_id}/{student_id}`** 请求
`AdminAttendanceUpdate{status, wifi_verified?, liveness_passed?}`。
admin 不受「只能改自己教的班」限制。

###### 10.5 系统配置（11）

| 方法 | 路径 | 请求体 |
|---|---|---|
| GET | `/admin/announcements` | — |
| POST | `/admin/announcements` | `AnnouncementCreate` |
| PUT | `/admin/announcements/{id}` | 同上 |
| DELETE | `/admin/announcements/{id}` | — |
| GET | `/admin/campus-networks` | — |
| POST | `/admin/campus-networks` | `CampusNetworkCreate` |
| PUT | `/admin/campus-networks/{net_id}` | `CampusNetworkUpdate` |
| DELETE | `/admin/campus-networks/{net_id}` | — |
| GET | `/admin/detect-connection` | — |
| GET | `/admin/security-settings` | — |
| PUT | `/admin/security-settings` | `{settings: dict}` |

`AnnouncementCreate` = `{title, content, faculty, department, is_draft?,
priority?, publisher?, image_base64?, publish_start?, publish_end?,
target_scope?, target_role?, target_programme_code?, target_course_code?}`。
后四个字段的语义见 §8。

`CampusNetworkCreate` = `{label, cidr?, ssid?, bssid_prefix?, is_active?}`。
`cidr` 会过 `_validate_cidr()`，格式不对 → 400。

**`GET /admin/detect-connection`** 报告当前请求方的 IP，给 admin 加白名单时参考。
读 `trust_proxy_header` 时和签到路径用**同一个** `is_enabled()`，
所以两边对「可信 IP」的判断一致。客户端在 loopback 时会去解析本机 LAN IP。

**`GET/PUT /admin/security-settings`** 五个开关，默认值在
[domain/security_settings.py](../../fyp-backend/domain/security_settings.py)：

| key | 默认 | 作用 |
|---|---|---|
| `network_check_enabled` | `true` | 网络验证总开关 |
| `fail_closed` | `true` | 验证不过就拒绝签到 |
| `trust_proxy_header` | `false` | 是否信 `X-Forwarded-For` |
| `demo_simulate_network` | `false` | demo：用假 IP 覆盖真实 IP |
| `demo_simulated_ip` | `""` | demo 用的假校园 IP |

值是字符串，`truthy()` 认 `1` / `true` / `yes` / `on`（不分大小写）。
**行缺失时退到上表的安全默认**，不是退到 `or ""` 碰巧的结果。

###### 10.6 报告（4）

| 方法 | 路径 | 请求体 |
|---|---|---|
| GET | `/admin/reports/feedback` | — |
| PUT | `/admin/reports/feedback/{feedback_id}` | `{status, admin_notes?}` |
| GET | `/admin/reports/mc` | — |
| PUT | `/admin/reports/mc/{record_id}` | `{status}` |

`StudentFeedbackResponse` = `{id, student_id?, student_name, student_code,
subject, category, message, status, admin_notes?, created_at}`。

`MCReportResponse` = `{id, student_id, student_name, student_code, course_name,
course_code, mc_proof_url?, timestamp, status, flag_reason?}`。

###### 10.7 审计日志（2）

| 方法 | 路径 | 请求体 / 参数 |
|---|---|---|
| GET | `/admin/audit/logs` | `category?`（`admin`/`staff`/`all`）、`search?` |
| POST | `/admin/audit/logs` | `{action, category?, details?, ip_address?}` → 201 |

`AuditLogResponse` = `{id, user_id?, user_name, user_role, category, action,
details?, ip_address?, created_at}`。

服务端自己写日志走 [domain/audit.py](../../fyp-backend/domain/audit.py) 的
`log_audit_event()`，不经过这个 POST。

---

##### 11. 端点数核对

| 章节 | 条数 |
|---|---|
| §2 Auth | 8 |
| §3 Sessions | 9 |
| §4 学生自助 | 7 |
| §5 讲师 | 5 |
| §6 Analytics | 2 |
| §7 LLM | 1 |
| §9 公开 | 4 |
| §10 Admin | 45 |
| **合计** | **81** |

加 4 条 FastAPI 文档路由 = 85，和 `main.app.routes` 一致。

###### 怎么重新核对

```bash
cd fyp-backend
VIRTUAL_ENV=.venv .venv/Scripts/python.exe -c "
import main
rs=[]
for r in main.app.routes:
    ms=getattr(r,'methods',None)
    if not ms: continue
    for m in sorted(ms-{'HEAD','OPTIONS'}):
        rs.append((getattr(r.endpoint,'__module__','').split('.')[-1], m, r.path))
rs.sort()
print(len(rs))
for mod,m,p in rs: print(f'{mod:20} {m:6} {p}')
"
```

改了端点就跑一次，对不上就改这份文档 —— 别反过来。

> **venv 是 uv 建的，没有 pip。** 装包用
> `VIRTUAL_ENV=.venv uv pip install <pkg>`。

### docs/01-CurrentCode/backend-architecture.md

#### Backend 架构

> 替代原来的 `module-interfaces.md`。那份写于 2026-07-17，里面有几处已经和代码相反
> （最严重的是「deepface 缺失时退回 mock embedding」—— 实际是直接 503）。
> **对应代码版本**：commit `f3dcba1` 之后，alembic head `42c198406814`。
> **最后核对**：2026-07-30

端点清单见 [backend-api-reference.md](./backend-api-reference.md)。
写代码的规矩见 [CONVENTIONS.md](../02-Engineering/CONVENTIONS.md)。

---

##### 1. 目录结构

```
fyp-backend/
├── main.py              # 应用装配：CORS、ETag 中间件、挂 router、4 个公开端点
├── schemas.py           # 跨 router 共用的 Pydantic 模型
├── seed.py              # 演示数据播种（只在 __main__ 下跑）
├── run_backend.bat      # 本地启动脚本（迁移 + uvicorn）
├── test_backend_fixes.py# 13 项回归检查
├── alembic/versions/    # 5 个 migration
├── db/
│   ├── database.py      # engine / SessionLocal / get_db
│   └── models.py        # 18 张表的 ORM 定义
├── domain/              # 业务规则（不碰 HTTP）
│   ├── scheduler.py     # 课表：时段分配、meeting_key、签到时间窗
│   ├── attendance.py    # 选课校验、出勤率
│   ├── announcements.py # 公告可见性 + 序列化
│   ├── security_settings.py
│   ├── session_sync.py  # 按课表补建 class_sessions
│   └── audit.py
├── integrations/        # 外部依赖包装
│   ├── face.py          # deepface / ArcFace
│   └── network_verify.py# IP / CIDR / SSID / BSSID 比对
├── ml/
│   ├── features.py
│   └── risk_model.pkl   # 必须进 git，analytics.py 加载它
├── routers/             # 14 个 HTTP 层文件
└── utils/
    ├── security.py      # JWT + 4 个权限依赖
    ├── db_helpers.py    # get_or_404 / ensure_unique / require_email_domain / …
    └── timeutil.py      # CAMPUS_TZ = Asia/Kuala_Lumpur
```

##### 2. 分层规则

```
router  →  domain  →  db
router  →  integrations
```

- **router 不 import router。** 以前 `students.py` 从别处 import 人脸函数，
  现在人脸逻辑在 `integrations/face.py`。
- **domain 不 import router，也不认识 HTTP**（除了少数直接抛 `HTTPException`
  的校验 helper）。
- 一条业务规则只写一处。公告可见性曾有两份 60 行副本，学生视图和讲师视图各一份。

---

##### 3. 数据库

Postgres，通过 **psycopg v3** 连接。
[db/database.py](../../fyp-backend/db/database.py) 会把 `postgresql://` 改写成
`postgresql+psycopg://`，所以 `DATABASE_URL` 用哪种写法都能连。

###### 3.1 18 张表

| 表 | 用途 |
|---|---|
| `users` | 账号（邮箱、密码哈希、role、偏好设置） |
| `programmes` | 专业 |
| `students` | 学生档案 |
| `lecturers` | 教职工档案 |
| `courses` | 课程 |
| `course_staff_assignments` | 谁教哪门课的什么角色 |
| `class_meetings` | **课表唯一真相** |
| `enrolments` | 选课（**组别的真实来源**：`class_group`） |
| `class_sessions` | 一次具体的开课签到 |
| `attendance_records` | 考勤记录 |
| `face_embeddings` | 512 维 ArcFace 向量 |
| `risk_scores` | 风险预测结果 |
| `campus_networks` | 校园网白名单 |
| `announcements` | 公告 |
| `security_settings` | 五个策略开关（见 API 参考 §10.5） |
| `alerts` | 低出勤预警 |
| `audit_logs` | 审计日志 |
| `student_feedback` | 学生反馈 |

（没有 `device_sessions` 表 —— 单设备锁已经不存在了。）

###### 3.2 Migration 用 Alembic

**启动时不再有任何建表或改表动作。** `main.py` 里以前有一串幂等的
`ALTER TABLE ... IF NOT EXISTS`，现在全部删了。改 schema 只走 alembic。

5 个 migration，链序：

| revision | 内容 |
|---|---|
| `71c97fdeebc7` | baseline（空。用 `alembic stamp head` 打的，因为当时线上库和 models.py 本来就不一致，autogenerate 会生成错的东西） |
| `e1fd21d5715b` | 删 4 个影子列，分三个时代回填 `marked_at` |
| `0f375205742a` | 加 `uq_attendance_student_session` + 5 个索引 |
| `edb760bda0ab` | `class_meetings.class_group` + 按组拆行 + CHECK 约束 |
| `42c198406814` | 删 `courses.schedule_*` 四列 |

```bash
cd fyp-backend
VIRTUAL_ENV=.venv .venv/Scripts/alembic.exe current
VIRTUAL_ENV=.venv .venv/Scripts/alembic.exe upgrade head
```

Postgres 的 DDL 是事务性的 —— 可以 DROP 一个约束再回滚，用来验证 migration 很方便。

###### 3.3 两条硬规矩

**① `attendance_records` 上不准有 `@property` 遮盖物理列。**
曾经有 4 个：改名之后把旧名字留成了转发 property，SQLAlchemy 于是不再映射真正的列，
所有行的数据对 API 全部消失。要改名就改列名；外部名字必须不同的话，用 Pydantic 的
`Field(validation_alias=AliasChoices(...))` 表达。
`test_backend_fixes.py` 里有一项专门检查这个。

**② `(student_id, session_id)` 唯一约束是权威兜底。**
handler 里那句「你已经签过了」查询挡不住两个并发请求同时通过。约束把竞态变成
`IntegrityError`，handler 再翻译成 400。应用层检查和 DB 约束都要有，不是二选一。

###### 3.4 `liveness_passed` 和 `liveness_suspicious` 是两个独立信号

不是互为反义。前者是客户端报的活体结果，后者标记「手势快得可疑」
（< 800 ms）。以前有个 property 从一个推导另一个，结果两者塌成一列，
客户端报上来的真实结果被静默丢弃。

---

##### 4. 课表：`class_meetings` 是唯一真相

[domain/scheduler.py](../../fyp-backend/domain/scheduler.py)

`courses.schedule_day/start/end/room` **已删除**。任何地方要课表就读
`class_meetings`。这条已经记在项目记忆里了。

###### 4.1 每个 (assignment, 组) 一行

一门课的 tutorial 有 G1/G2 两个组上，就是 **两行** `class_meetings`，
`class_group` 分别是 `G1`、`G2`。

`class_group` 为 NULL **只对 Lecture 合法**，含义是「全课都来」。
Tutorial / Practical 必须说明自己属于哪个组，由 CHECK 约束
`ck_class_meetings_group` 强制。

> 约束的语义是「每一行 tutorial/practical 必须说明自己属于哪个组」，
> **不是**「每个组都必须有时段」。某个组真的没有这门课的 tutorial 不违反约束 ——
> 别为了凑约束去造不存在的课。

**组别的真实来源是 `enrolments.class_group`。**
`course_staff_assignments` 上没有这一列。

###### 4.2 `meeting_key` 必须带上每个唯一性维度

```python
def meeting_key_for(role, course_id, assignment_id, class_group=None) -> str:
    if role == "Lecture":
        return f"Lecture-{course_id}"
    return f"{role}-{assignment_id}-{class_group}"
```

组后缀不是可选的。Tutor/Practical 以前的 key 是 `f"{role}-{assignment_id}"`，
一个 assignment 拆成多行之后这个 key 会重复 —— `meeting_key` 有 UNIQUE 约束会
直接报错，而 `calculate_schedule` 拿它当 dict 键，重复会**静默丢时段**。

###### 4.3 签到时间窗只看本组的时段

`get_course_group_slots(db, course_id, class_group)`：

- `class_group == "All"` → 只返回这门课的 **Lecture** 时段
- 其他值 → 只返回**该组自己的** tutorial / practical

返回全部组的 tutorial 会让学生拿别的组的时段满足时间校验，
并且让窗口计算取到数据库碰巧排在第一的那个。

`slot_on_day()` 按「session 是哪天开的」选时段，不是取 `slots[0]`。
一个组可能同时有 tutorial 和 practical；同一天有两个时段时取**结束更晚**的，
这样窗口能覆盖整段。

`session_window_utc()` 在当天没有时段时返回 `(None, opened_at + 2h)` ——
未排课 session 一直用的两小时默认。

学生签到时间窗（`validate_student_checkin`）：课开始前 1 小时内算「来早了」，
返回 403 并提示等到点；完全不在时间段内返回 403 并列出该组的所有时段。
**该组没有任何时段时直接放行**（`if not slots: return`）。

---

##### 5. 人脸识别（fail-closed）

[integrations/face.py](../../fyp-backend/integrations/face.py)。
算法细节见 [module1-face-recognition.md](./module1-face-recognition.md)。

放在 `integrations/` 而不是 router 里，是因为两个 router 都要用它：
注册（`routers/students.py`）和签到（`routers/sessions.py`）。
让 sessions 去 import students 等于一个 HTTP 层依赖另一个 HTTP 层。

- 模型 **ArcFace**，输出 **512 维**，存成 512 个小端 C float（2048 字节）
- 比对用 **cosine 距离**，阈值 **0.40**（`_FACE_MATCH_THRESHOLD`）
- `confidence_score` = `1 - 距离`
- 注册用 `enforce_detection=True`（照片里必须有脸，否则不存）
- 签到用 `enforce_detection=False`（容错；认错人由阈值兜住）

###### deepface 缺失 = 503，不是放行

```python
if not _DEEPFACE_AVAILABLE:
    raise HTTPException(status_code=503, detail="Face recognition is unavailable: …")
```

**没有 mock embedding，没有 dev 模式旁路。** 静默跳过人脸比对会写进一笔
没人验证过的考勤 —— 那正是这套系统要防的代签。

> 旧版 `module-interfaces.md` 写的是「deepface 没装则退回 mock embedding 并跳过
> 真实身份匹配」。这句话和代码相反，也和同目录的 API 参考自相矛盾。已删。

活体检测在客户端（ML Kit），后端只收结果 + 用完成耗时做行为生物特征判断。
两层是独立的：ML Kit 管「是不是活人」，ArcFace 管「是不是本人」。

---

##### 6. 网络位置验证

[integrations/network_verify.py](../../fyp-backend/integrations/network_verify.py)

`verify_network()` 比对四种信号，任一命中活跃白名单即通过：

| 信号 | 来源 |
|---|---|
| 来源 IP ∈ CIDR | 服务端观测（不信客户端） |
| 上报的网关 IP / 内网 IP | 客户端 |
| SSID | 客户端 |
| BSSID 前缀 | 客户端（MAC 归一化后比较：`-` 转 `:`，转大写） |

**没有任何活跃规则时返回通过**，`detail = "No active network restriction rules enforced"`。

`get_client_ip(request, trust_proxy_header)` —— 只有开了
`trust_proxy_header` 才读 `X-Forwarded-For`。默认关，因为这个头客户端可以随便写。
签到路径和 `/admin/detect-connection` 读的是**同一个** `is_enabled()`，
以前两处各有一套「什么算 true」的判断，`"1"` 在一条路径上生效在另一条上不生效。

---

##### 7. fail-closed 还是 fail-soft

依赖缺失时的行为**不统一，而且是刻意的**：

| 依赖 | 缺失时 | 为什么 |
|---|---|---|
| deepface / ArcFace | **503 拒绝** | 放行 = 一笔没人验证的考勤 = 代签 |
| 校园网白名单 | **403 拒绝**（`fail_closed=true` 时） | 同上，位置没验证过 |
| `ml/risk_model.pkl` | **退回规则打分** | 风险分算错只是排序不准，不产生假考勤 |
| `GEMINI_API_KEY` | 报错返回 | 查询失败，不影响考勤 |

判断标准：**错误会不会造出一条假的考勤记录**。会 → fail-closed。

---

##### 8. 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `DATABASE_URL` | 无 | Postgres 连接串，`postgresql://` 会被改写成 `+psycopg` |
| `JWT_SECRET_KEY` | **无，缺了直接启动失败** | 不给猜得到的默认值 |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_EXPIRE_MINUTES` | `1440` | |
| `ALLOWED_ORIGINS` | 一组硬编码本地地址 | 逗号分隔 |
| `GEMINI_API_KEY` | 无 | LLM 查询用 |
| `PORT` | `8000` | 云平台（Railway）注入，只在 `main.py:182` 用 |
| `BACKEND_PORT` | `8003` | **本地** dev 端口，`run_backend.bat` / `stop_backend.bat` 共用 |

`JWT_SECRET_KEY` 缺失时抛 `RuntimeError` 而不是用默认值 —— 用可猜的密钥签 token
等于没有认证。

`PORT` 和 `BACKEND_PORT` 是两件事：前者给云平台，后者只管本地。本地是 8003 而
不是 8000，因为 Windows 的 IP Helper 服务（iphlpsvc）绑了 `127.0.0.1:8000`，
而更具体的绑定优先于 uvicorn 的 `0.0.0.0:8000` —— 表现是每个请求都
`ERR_CONNECTION_RESET`。详见 [CONVENTIONS §3.4](../02-Engineering/CONVENTIONS.md)。

###### venv 与 pip

venv 原本是 uv 建的、不含 pip；07-31 已用 `ensurepip` 补回 pip 24.0，两种都能用：

```bash
.venv/Scripts/python.exe -m pip install <pkg>   # 现在可用
VIRTUAL_ENV=.venv uv pip install <pkg>          # 也可用
```

**必须 Python 3.11** —— tensorflow 2.14 没有 cp312 wheel。详见
[CONVENTIONS §10.1](../02-Engineering/CONVENTIONS.md)。

numpy 要锁 `<2`，Python 3.11（deepface / TF 的约束）。
详见项目记忆 `fyp-face-recognition-env`。

---

##### 9. 回归测试

[test_backend_fixes.py](../../fyp-backend/test_backend_fixes.py) —— **13 项检查**。

```bash
cd fyp-backend
VIRTUAL_ENV=.venv .venv/Scripts/python.exe test_backend_fixes.py
```

| 检查 | 守住什么 |
|---|---|
| `check_model_fields` | 没有 `@property` 遮盖物理列 |
| `check_no_synthetic_ids` | 不返回拼出来的假 ID |
| `check_meeting_key_derived` | `meeting_key` 带全部唯一性维度 |
| `check_attendance_policy` | 出勤率算法 |
| `check_course_access_guard` | 讲师只能碰自己教的课 |
| `check_announcement_visibility` | 公告不发错受众 |
| `check_session_window` | 时间窗按当天时段算 |
| `check_uuid_path_params` | 路径参数类型 |
| `check_model_matches_db` | ORM 和实际 schema 一致 |
| `check_duplicate_checkin_rejected` | 一人一 session 一条记录 |
| `check_override_enrolment_rule` | 没选课的人不能被手动加考勤 |
| `check_group_slots_isolated` | 组之间时段不串 |
| `check_no_5xx_on_reads` | 全部 GET × 三种角色不出 5xx |

写新测试的规矩（含变异测试、取样陷阱）见 [CONVENTIONS.md](../02-Engineering/CONVENTIONS.md) §11。

---

##### 10. 客户端

| 目录 | 技术 | 服务对象 |
|---|---|---|
| [fyp_flutter/](../../fyp_flutter/) | Flutter | 学生 App（相机、活体） |
| [fyp_web/](../../fyp_web/) | TypeScript | admin / 讲师后台 |

**`fyp_flutter/build/web/` 必须留在 git 里** —— `fyp_flutter/Dockerfile` 直接
`COPY build/web`，它不跑 `flutter build web`。
**`fyp-backend/ml/risk_model.pkl` 必须留在 git 里** —— `analytics.py:55` 加载它。

改动 API 形状时，这份文档、API 参考、两个客户端要在同一次改动里一起改。

### docs/01-CurrentCode/module1-face-recognition.md

#### 模块一：人脸识别考勤

> **一句话**：ML Kit 管「是不是活人」，ArcFace 管「是不是本人」，两个独立的层。
> **注意**：这个模块**没有训练过程**，用的是预训练模型做特征比对。

---

##### 1. 用了什么（Tech Stack）

| 层 | 库 / 模型 | 版本 | 跑在哪 | 干什么 |
|---|---|---|---|---|
| 活体检测 | `google_mlkit_face_detection` | ^0.13.2 | **手机本地** | 检测眨眼 / 转头 / 点头 |
| 摄像头 | `camera` | ^0.12.0+1 | 手机本地 | 取实时帧 |
| 身份特征 | `deepface` (ArcFace) | 0.0.100 | **后端** | 人脸 → 512 维向量 |
| 推理引擎 | `tensorflow` + `tf-keras` | 2.14.0 / 2.15.0 | 后端 | 跑 ArcFace 的底层 |
| 图片解码 | `opencv-python` | 4.11.0.86 | 后端 | base64 → 像素矩阵 |
| 向量打包 | `struct` (Python 内建) | — | 后端 | 512 floats ↔ 2048 bytes |

**为什么活体在手机、身份在后端？**
活体要**每秒分析很多帧**，传上去太慢；身份比对只需要**一张照片**，且必须在后端做（客户端可被篡改）。

---

##### 2. 全局数据流

```
┌─ 阶段 A：注册（一次性）────────────────────────────────┐
│                                                        │
│  学生拍脸 ──► base64 ──► POST /students/me/face        │
│                              │                         │
│                     DeepFace.represent()               │
│                     model_name = "ArcFace"             │
│                     enforce_detection = TRUE  ◄── 严格 │
│                              │                         │
│                     [512 个 float]                     │
│                              │                         │
│                     struct.pack("f"×512)               │
│                              │                         │
│                     2048 bytes ──► face_embeddings 表  │
│                                    students.is_face_   │
│                                      registered = True │
└────────────────────────────────────────────────────────┘
```

```
┌─ 阶段 B：签到（每次上课）──────────────────────────────────────┐
│                                                                │
│  【手机端 · 本地，不上传】                                      │
│    摄像头 ──► 每 3 帧取 1 帧（省电）                            │
│              │                                                 │
│         ML Kit FaceDetector                                    │
│         enableClassification = true  (要眨眼概率)              │
│         performanceMode = accurate                             │
│              │                                                 │
│         随机抽 2 个动作（4 种里选，不重复上次那对）              │
│         每个动作 4 秒 ──► 共 8 秒预算                           │
│              │                                                 │
│         2 个都过 ─► 拍 1 张照 + 记 challengeMs（总耗时）        │
│                                                                │
│  【后端】POST /sessions/{id}/checkin                            │
│         image_base64 + liveness_passed + challengeMs           │
│              │                                                 │
│         ① 闸门检查（见下面第 4 节表）                           │
│         ② DeepFace.represent(enforce_detection=FALSE) ◄── 宽松 │
│         ③ cosine_distance(live_vec, stored_vec)                │
│         ④ 校园网络验证（IP / gateway / SSID / BSSID）           │
│              │                                                 │
│         写入 attendance_records                                │
│           status = "present"                                   │
│           confidence_score = 1 - distance                      │
└────────────────────────────────────────────────────────────────┘
```

---

##### 3. 活体检测：4 种动作怎么判定

ML Kit 每帧回传 3 个数值，代码对着阈值比：

| 动作 | 看哪个值 | 判定条件 | 含义 |
|---|---|---|---|
| **Blink** | `eyeOpenProbability` | 降到接近 0 | 眼睛闭了 |
| **Turn Left** | `headEulerAngleY` (yaw) | `≥ +20.0°` | 头向左转 |
| **Turn Right** | `headEulerAngleY` (yaw) | `≤ -20.0°` | 头向右转 |
| **Nod** | `headEulerAngleX` (pitch) | `abs() ≥ 12.0°` | 头上下点 |

**动作是随机抽 2 个**，而且 `_lastPair` 记住上一次那对，下次不会重复 —— 防止学生预录一段视频反复用。

```
4 种动作 ──► shuffle ──► 取 2 个
                │
        跟上次那对一样？（不看顺序）
                │
        ├─ 是 ──► 重抽（最多试 12 次）
        └─ 否 ──► 用这对
```

---

##### 4. 签到闸门表（if → then）

按顺序过，任何一关不过就直接返回，**不会写考勤记录**：

| # | 条件 | 结果 | HTTP |
|---|---|---|---|
| 0 | 已经签过这个 session | 拒绝 | `400` |
| 1 | `liveness_passed == false` | 拒绝 | `400` |
| 2 | `image_base64` 是空的 | 拒绝 | `400` |
| 3 | 数据库里没有注册过的脸 | 拒绝 | `400` |
| 4 | ArcFace 模型没装（deepface 缺失） | 拒绝 | `503` |
| 5 | 图片里抽不出人脸特征 | 拒绝 | `400` |
| 6 | **`distance > 0.40`** | **拒绝（核心防代考）** | `403` |
| 7 | 开了网络检查 + 验证失败 + fail_closed | 拒绝 | `403` |
| 8 | 并发重复提交（撞 DB unique 约束） | 拒绝 | `400` |
| ✅ | 全过 | 写 `attendance_records` | `200` |

**注意第 6 关不是「闸门」而是「刻度」**：它不返回布尔值，返回一个连续距离，所以 `confidence_score` 是可审计的 —— 讲师能看到这次签到到底有多像。

---

##### 5. cosine distance 是什么（一图看懂）

两个 512 维向量的**夹角**，不管长度。范围 `[0, 2]`：

```
distance = 1 - (A·B) / (|A| × |B|)

   0.0 ─────── 0.40 ─────── 0.68 ─────── 1.0 ─────── 2.0
    │            │            │            │           │
  完全           你的        DeepFace     完全无关     完全相反
  同一个人      阈值 ✂       官方阈值
    │            │            │
    └─ 通过 ─────┘            │
                 └─ 你故意砍掉的这段 ─┘
                    （官方会放行，你不放）
```

---

##### 6. 为什么阈值是 0.40 而不是官方的 0.68

**这是答辩最容易被问的一题。**

DeepFace 给 ArcFace 调好的阈值是 `0.68`（见 `deepface/config/threshold.py`）。`0.40` 其实是 **Facenet** 的 cosine 值，不是 ArcFace 的。

你**故意**收紧了约 41%，理由是两类错误代价不对称：

| 错误类型 | 后果 | 代价 |
|---|---|---|
| **False Rejection**（误拒本人） | 学生重拍一张照 | 小 — 只是麻烦 |
| **False Acceptance**（误收他人） | 产生一条代考记录 | **大 — 系统失去意义** |

宁可让真学生多拍一次，也不能让一个冒名者过关 —— 因为**防代考就是这个系统存在的理由**。

**要诚实说的**：FAR / FRR 还**没有实测**。代码注释里已经写明留到 Project II，用真实的 genuine vs impostor 向量对去扫不同阈值，如果误拒率在真实教室光线下太高就放宽。

---

##### 7. 两处 `enforce_detection` 为什么不一样

| 场景 | 参数 | 为什么 |
|---|---|---|
| **注册** | `True`（严格） | 检测不到脸就报错 —— 绝不能把垃圾向量存成某人的身份 |
| **签到** | `False`（宽松） | 容忍差一点的取景，因为**错的脸有第 6 关的距离阈值兜着** |

逻辑：注册是「写入身份」，错了会永久污染；签到是「比对身份」，错了下一关会挡。

---

##### 8. 附加：行为生物特征（防自动化）

```
challengeMs = 学生按下「Detect Face」到 2 个动作都完成的总毫秒数

challengeMs < 800ms ?
    │
    ├─ 是 ──► liveness_suspicious = True   （仍然放行，但打标记）
    └─ 否 ──► liveness_suspicious = False
```

正常人做完 2 个动作至少要 ~1600ms。低于 800ms 说明是**脚本自动化 / 回放攻击 / 伪造的手势事件**。

**注意**：这个不拒绝签到，只打标记给管理员事后审计（`admin_attendance.py` 会读）。

---

##### 9. 代码位置

| 内容 | 文件 |
|---|---|
| 特征抽取 / cosine / 阈值 | [integrations/face.py](../../fyp-backend/integrations/face.py) |
| 注册端点 | [routers/students.py](../../fyp-backend/routers/students.py)（`register_face`） |
| 签到闸门 | [routers/sessions.py](../../fyp-backend/routers/sessions.py)（`student_check_in`） |
| 活体检测 UI + 判定 | [face_scanner_screen.dart](../../fyp_flutter/lib/screens/student/face_scanner_screen.dart) |

### docs/01-CurrentCode/module2-risk-prediction.md

#### 模块二：At-Risk 预测（唯一真正训练过的模型）

> **一句话**：用 3 个出勤特征，预测这个学生**期末会不会被 bar**（出勤 < 80%）。
> **模型**：RandomForest，从 4 个候选里选出来的。

---

##### 1. 用了什么（Tech Stack）

| 用途 | 库 | 版本 | 为什么锁这个版本 |
|---|---|---|---|
| 训练 + 推理 | `scikit-learn` | **1.9.0** | `risk_model.pkl` 是用它 pickle 的，**跨小版本反序列化不保证兼容** |
| 模型存取 | `joblib` | 1.5.3 | 存 / 读 `.pkl` |
| 数据处理 | `pandas` | 2.2.3 | 读 CSV、构造推理时的 DataFrame |
| 数值底层 | `numpy` | **1.26.4** | 锁 `<2.0`，因为模块一的 TensorFlow 2.14 跟 numpy 2.x 不兼容 |
| 造数据 | `random` (内建) | — | 固定 `SEED=42`，结果可复现 |

---

##### 2. 两条独立的路（先分清）

```
┌─────────────────────────────────────────────────────────┐
│  路 A：训练（离线，跑一次就够，不属于交付物）              │
│  位置：docs/ml_model_builder/                            │
│                                                          │
│   generate_data.py                                       │
│      │  模拟 3000 个学生的整学期                          │
│      ▼                                                   │
│   training_data.csv  （5628 行）                          │
│      │                                                   │
│      ▼                                                   │
│   train_risk_model.py                                    │
│      │  对比 4 个方案，选最好的                           │
│      ▼                                                   │
│   fyp-backend/ml/risk_model.pkl  ★ 产物                  │
└─────────────────────────────────────────────────────────┘
                          │
                          │  （.pkl 被 commit 进 git）
                          ▼
┌─────────────────────────────────────────────────────────┐
│  路 B：线上推理（每次有人点「Recompute」）                 │
│                                                          │
│   POST /analytics/recompute                              │
│      │  遍历所有 enrolment                                │
│      ▼                                                   │
│   4 层漏斗（见第 6 节）── 只有第 4 层用到 .pkl            │
│      ▼                                                   │
│   risk_scores 表 ──► GET /analytics/risk-scores          │
│                        ──► AtRisk.tsx 仪表板              │
└─────────────────────────────────────────────────────────┘
```

**关键设计**：`ml/features.py` 被**两条路共用**。保证模型上线后看到的特征，和训练时算的**完全一致**（避免 train/serve skew）。

---

##### 3. 只有 3 个特征

| 特征 | 怎么算 | 范围 | 意思 |
|---|---|---|---|
| `attendance_rate` | Σ(出席 × 小时) / Σ(小时) | 0.0 ~ 1.0 | 按**小时**加权的出勤率 |
| `consecutive_absent` | 最长连续缺课**次数** | 0, 1, 2... | 行为信号 —— 长连缺 = 正在脱离 |
| `trend` | 后半段率 − 前半段率 | -1.0 ~ +1.0 | **负数 = 正在下滑 = 更危险** |

**为什么按小时不按次数？** 一个学期混着 2h lecture 和 1h tutorial，漏掉 2h 的伤害应该比 1h 大。校规本身也是 `attended_hours / total_hours >= 80%`。

```
例：序列 [1,1,0,0,0,1]   小时 [2,2,2,1,1,2]
                                  ↑ 连缺 3 次

attendance_rate = (1×2 + 1×2 + 0 + 0 + 0 + 1×2) / 10 = 6/10 = 0.60
consecutive_absent = 3
前半 [1,1,0] 小时[2,2,2] → 4/6  = 0.667
後半 [0,0,1] 小时[1,1,2] → 2/4  = 0.500
trend = 0.500 - 0.667 = -0.167   （下滑）
```

---

##### 4. 为什么要 ML 而不是公式（★ 最重要的论证）

###### 4.1 训练数据里故意加了「行为惯性」

如果期末结果只是当前出勤率的**直线外推**，那 `if rate < 0.80` 一行公式就够了，ML 完全是白做的。

所以造数据时加了 momentum：

```
                每上一节课
                     │
        ┌────────────┴────────────┐
        │                          │
     缺课了                      出席了
        │                          │
  momentum += 0.15            momentum -= 0.18
  （上限 0.5）                 （下限 0.0）
        │                          │
        └────────────┬─────────────┘
                     ▼
        下一节的出席概率 p = engage - momentum

  ► 效果：正在连缺的学生「更容易继续缺」（脱离螺旋）
         稳定的学生「保持稳定」
  ► 结论：期末结果取决于【模式】，不只是【当前数值】
         ── 这才是分类器能学、公式学不到的东西
```

而且 drift（漂移）跟投入度**相关**：
```
lean = (base - 0.62) / (0.99 - 0.62)      # 0=弱  1=强
drift ~ Gauss(-0.022 + 0.026 × lean, 0.006)

  投入强（lean≈1）► drift ≈ +0.004  ► 基本持平
  投入弱（lean≈0）► drift ≈ -0.022  ► 一路下滑
```

###### 4.2 对比结果

| 模型 | Accuracy | **Recall** | Precision | F1 |
|---|---|---|---|---|
| LogisticRegression | 77.5% | 78.3% | 67.0% | 72.2% |
| DecisionTree | 77.1% | **82.3%** | 65.4% | 72.9% |
| **RandomForest（部署）** | **77.7%** | 81.7% | 66.4% | **73.3%** |
| 公式 `rate < 0.80` | 77.3% | **54.9%** ⚠ | 77.9% | 64.4% |

**看 Recall 那一列，不要看 Accuracy。**

```
Accuracy 对比：  ML 77.7%  vs  公式 77.3%   ──► 几乎一样，ML 好像白做
Recall   对比：  ML 81.7%  vs  公式 54.9%   ──► 差 27 个百分点 ★

Recall = 真的会被 bar 的学生里，抓到了几成

  公式：100 个真高危 ──► 抓到 55 个，【漏掉 45 个】
  ML  ：100 个真高危 ──► 抓到 82 个，漏掉 18 个
```

早期预警系统的成本结构就是这样：**漏掉一个真高危学生，代价远大于误报一个安全学生**（引 Marbouti et al. 2016）。所以牺牲 precision 换 recall 是对的。

###### 4.3 选型不是简单挑 Recall 最高

```
Recall 最高的是 DecisionTree (82.3%)，不是 RandomForest (81.7%)
                        │
                        ▼
       规则：在「recall 差距 ≤ 2 个百分点」的候选里
             优先选 RandomForest
                        │
                        ▼
       理由：集成模型的概率是【平滑单调】的
             单棵深树会因为同叶子节点的原因，
             把 84% 的学生排得比 88% 的还危险
             ──► 在讲师仪表板上看起来就像坏了
```

**「工程可用性参与模型选择」** —— 这点值得主动讲。

---

##### 5. 训练超参数

| 模型 | 超参数 |
|---|---|
| LogisticRegression | `max_iter=1000, class_weight="balanced"` |
| DecisionTree | `max_depth=4, class_weight="balanced"` |
| **RandomForest** | `n_estimators=150, max_depth=6, class_weight="balanced"` |
| 公式基线 | `attendance_rate < 0.80`（不是 ML，是对照组） |

- `class_weight="balanced"`：at-risk 是少数类，不加权模型会偷懒全猜「安全」
- `max_depth` 限制：防过拟合
- `test_size=0.25, random_state=42, stratify=y`：分层抽样，保证测试集里 at-risk 比例一致

---

##### 6. ★ 线上推理：4 层漏斗（if-else 决策树）

这是你要的那张图。每个 (学生, 课程) 组合都走一遍：

```
                      START
              进来 3 个特征 + held_hours + total_hours
                        │
                        ▼
        ┌───────────────────────────────────┐
        │ Layer 0  冷启动                    │
        │ held_hours < 30% × total_hours ?   │
        └───────────────┬───────────────────┘
                 是 ────┤──── 否
                  │     │      │
                  ▼     │      ▼
        score = 0.0     │   继续 Layer 1
        label = "observing"
        因 = "Too early to assess"
        ✋ 停止，不给判决
                        │
                        ▼
        ┌───────────────────────────────────────────────┐
        │ Layer 1  确定性（坏结果已锁死）                 │
        │ best_case = (已出席h + 剩余h) / 总h            │
        │ best_case < 0.80 ?                            │
        │ （= 剩下每一节都来，也到不了 80%）              │
        └───────────────┬───────────────────────────────┘
                 是 ────┤──── 否
                  │     │      │
                  ▼     │      ▼
        score = 1.0     │   继续 Layer 1b
        label = "high"
        因 = "Cannot reach 80% (best case N%)"
        ✋ 停止，ML 用不上（已是算术事实）
                        │
                        ▼
        ┌───────────────────────────────────────────────┐
        │ Layer 1b 确定性（好结果已锁死）  ◄ 与 L1 对称   │
        │ worst_case = 已出席h / 总h                     │
        │ worst_case >= 0.80 ?                          │
        │ （= 剩下全部翘掉，也还是够 80%）                │
        └───────────────┬───────────────────────────────┘
                 是 ────┤──── 否
                  │     │      │
                  ▼     │      ▼
        score = 0.0     │   继续 Layer 2
        label = "low"
        因 = "Requirement already secured"
        ✋ 停止
                        │
                        ▼
        ┌───────────────────────────────────────────────┐
        │ Layer 2  ML（还有救的中间地带）★                │
        │ RandomForest.predict_proba(3 个特征)[0][1]     │
        │   = 期末被 bar 的【概率】                       │
        └───────────────┬───────────────────────────────┘
                        ▼
              score < 0.35  ──► "low"
              score < 0.60  ──► "medium"
              否则           ──► "high"
                        │
                        ▼
              生成 risk_factors 解释文字（见第 8 节）
                        │
                        ▼
                    写 risk_scores 表
```

**为什么要 Layer 1 / 1b？** 结论已经**算术上锁死**的时候，就没有东西可「预测」了 —— ML 该让位给算术。两个闸门是对称的：一个锁坏结果，一个锁好结果。

**训练分布也对齐了这点**：`generate_data.py` 里，已经注定被 bar 的快照**不进训练集**（`if best_case < 0.80: continue`），因为生产环境那些走 Layer 1 不走 ML。

---

##### 7. 4 层漏斗速查表（if → then）

| 层 | 条件 | score | label | 显示的理由 |
|---|---|---|---|---|
| 0 | 学期过了 < 30% | `0.0` | `observing` | Too early to assess |
| 1 | 全勤也到不了 80% | `1.0` | `high` | Cannot reach 80% (best case N%) |
| 1b | 全翘也还有 80% | `0.0` | `low` | Requirement already secured |
| 2 | ML 概率 < 0.35 | 模型给 | `low` | Consistent attendance（若无硬因素） |
| 2 | ML 概率 0.35 ~ 0.60 | 模型给 | `medium` | 至少一条硬因素 |
| 2 | ML 概率 ≥ 0.60 | 模型给 | `high` | 至少一条硬因素 |

###### 具体数字例子

假设某课 `planned_total_hours = 40`：

| 情况 | 已上 h | 已出席 h | 走哪层 | 算式 | 结果 |
|---|---|---|---|---|---|
| 学期刚开始 | 8 | 6 | **L0** | 8 < 0.30×40 = 12 ✓ | `observing` |
| 缺太多没救了 | 30 | 18 | **L1** | (18+10)/40 = 70% < 80% ✓ | `high` 1.0 |
| 已经稳了 | 36 | 32 | **L1b** | 32/40 = 80% ≥ 80% ✓ | `low` 0.0 |
| 还有救 | 20 | 16 | **L2** | best=90% worst=40% → 交给 ML | 看模型 |

**注意 Layer 1 用 `math.floor` 不是 `round`**：79.9% 不能显示成「80%」，否则 UI 上自相矛盾（说到不了 80%，却显示 80%）。

---

##### 8. 解释文字（risk_factors）怎么生成

仪表板上要给讲师一句人话，不能只丢一个数字：

```
        收集所有触发的硬因素
                │
    ├─ rate < 0.80        ──► "Below 80% requirement"
    ├─ consecutive ≥ 3    ──► "Missed N classes in a row"
    └─ trend ≤ -0.10      ──► "Attendance dropping in recent weeks"
                │
                ▼
        label 是 "low" ?
                │
        ├─ 是 ──► 有因素就列，没有就 "Consistent attendance"
        │
        └─ 否（medium/high）
                │
                ▼
           一条因素都没有 ?
                │
        ├─ 是 ──► 补一条 "At-risk attendance pattern"（诚实说是模式）
        └─ 否 ──► 用「;」拼起来
```

**为什么要保证 medium/high 至少一条理由？** 否则会出现「出勤 89% 但标 HIGH，理由空白」这种看起来像 bug 的输出。ML 有时候靠 trend + streak 判高危，但那两个数不在表格列里，必须用文字说出来。

---

##### 9. 数据来源：出勤序列怎么拼出来

```
课程的所有【已关闭】session ──► 按 opened_at 升序（老的在前）
        │
        │  每个 session 的小时数 = closed_at - opened_at（默认 2h）
        │
        ▼
   这个 session 算不算这个学生的？
        │
   class_group == "All"  或  == 学生的 class_group ?
        │
   ├─ 否 ──► 跳过（不是他的班）
   └─ 是 ──► 加进序列
                │
                ▼
   学生在这个 session 的记录 status ?
        │
   ├─ "present" ──► 1（出席）
   ├─ "leave"   ──► 1（批准的病假也算出席）★
   └─ "absent" / 没记录 ──► 0
```

**`leave` 算出席**是政策决定：批准过的医疗假不该算在学生头上。

---

##### 10. ⚠ 现状 / 已知问题（开会前必须知道）

| 问题 | 现状 | 说法 |
|---|---|---|
| **没有定时任务** | 前端函数叫 `runNightlyRiskScorerJob`，但其实只是手动点按钮调 `/analytics/recompute`。`domain/scheduler.py` 是排课用的，不是 cron | 老师问「多久更新一次」→ **诚实说是手动触发**，cron 留下一阶段。别说成自动 |
| **`generate_data.py` 现在跑不起来** | 第 31 行硬编码 `...\Desktop\fyp-main\fyp-backend\ml`，但项目文件夹现在叫 `fyp`。`sys.path.insert` 指到不存在的路径 → import 失败 | 已生成的 CSV 和 .pkl **都还在、线上功能不受影响**，只是现在没法重新生成数据 |
| **训练数据是合成的** | 3000 个模拟学生，不是真实学生数据 | 主动说：真实数据要一整个学期才攒得出来，且涉及隐私。合成数据的价值在于**能控制生成机制**，从而证明 ML 比公式强 |
| **表格数字待复核** | 若之后改过 `generate_data.py` 参数但没重跑训练，表里数字可能是旧的 | 要稳的话重跑一次 `train_risk_model.py` |

---

##### 11. 代码位置

| 内容 | 文件 |
|---|---|
| 特征计算（两条路共用） | [ml/features.py](../../fyp-backend/ml/features.py) |
| 4 层漏斗 | [analytics.py:113-148](../../fyp-backend/routers/analytics.py#L113-L148) |
| 阈值常量 | [analytics.py:46-67](../../fyp-backend/routers/analytics.py#L46-L67) |
| 解释文字 | [analytics.py:90-110](../../fyp-backend/routers/analytics.py#L90-L110) |
| 序列拼装 | [domain/attendance.py](../../fyp-backend/domain/attendance.py) |
| 造数据 | [generate_data.py](../03-MLModel/ml_model_builder/generate_data.py) |
| 训练 + 选型 | [train_risk_model.py](../03-MLModel/ml_model_builder/train_risk_model.py) |
| 前端仪表板 | [AtRisk.tsx](../../fyp_web/src/pages/staff/AtRisk.tsx) |

### docs/01-CurrentCode/module3-llm-query.md

#### 模块三：自然语言查询（LLM / Text-to-SQL）

> **一句话**：讲师用人话问问题 → Gemini 写 SQL → 后端跑 → Gemini 再翻成人话。
> **注意**：这里**没有训练**，是调用 Google 的云端 API。

---

##### 1. 用了什么（Tech Stack）

| 用途 | 库 / 服务 | 版本 | 跑在哪 |
|---|---|---|---|
| LLM SDK | `google-generativeai` | 0.7.2 | 后端（发 HTTP 到 Google） |
| **模型** | `gemini-flash-lite-latest` | — | **Google 云端，不在你机器上** |
| SQL 执行 | `sqlalchemy` (`text()`) | 2.0.30 | 后端 |
| 数据库 | PostgreSQL (`psycopg`) | — | 后端 |
| Web 框架 | `fastapi` | 0.111.0 | 后端 |
| 关键字过滤 | `re`（Python 内建正则） | — | 后端 |
| 前端 | React + axios | — | 浏览器 |

**API key 从环境变量读**：`genai.configure(api_key=os.getenv("GEMINI_API_KEY"))` —— key 不在代码里。

**为什么选 flash-lite？**

| Gemini 型号 | 速度 | 成本 | 适合 |
|---|---|---|---|
| Pro | 慢 | 高 | 复杂推理 |
| Flash | 中 | 中 | 通用 |
| **Flash-Lite（你用的）** | **最快** | **最低** | 简单结构化任务 ✓ |

写 SQL 是「模式匹配 + 套模板」，不需要深度推理。而且讲师是**交互式等结果**的，快比聪明重要。

---

##### 2. 两个关键参数是什么意思

###### 2.1 `temperature = 0.1`

**temperature 控制模型输出的随机性。** LLM 每次生成下一个词时，其实手上有一串候选词 + 各自的概率。temperature 决定它有多敢挑低概率的那个。

```
问：「有多少学生缺课？」

temperature = 0.0  【完全确定】
  跑 5 次 ──► 5 次都是同一句 SQL
  SELECT COUNT(*) FROM attendance_records WHERE status='absent'

temperature = 0.1  【你的设置】★
  跑 5 次 ──► 4~5 次一样，偶尔换个写法但意思相同

temperature = 1.0  【默认，创意模式】
  跑 5 次 ──► 5 种不同写法，可能有一两个是错的
  有时 COUNT(*)，有时 COUNT(id)，有时莫名多个 JOIN

temperature = 2.0  【几乎失控】
  开始胡说八道，编不存在的表名
```

用一张刻度图看：

```
  0.0 ────── 0.1 ────── 0.5 ────── 1.0 ────── 2.0
   │          │          │          │          │
 死板       你在这      平衡       默认       疯狂
 每次       ★         有点变化    有创意     瞎编
 一样
   └── 适合：SQL、代码、抽取 ──┘  └─ 适合：写作、头脑风暴 ─┘
```

**为什么选 0.1 不选 0.0？** SQL 只要**语义**对就行，写法可以有一点弹性；留一点点余量在遇到奇怪问法时反而更容易生成能跑的语句。选 0.1 而不是 1.0 的核心理由是：**同一个问题应该得到同一个答案**，讲师问两次拿到两个不同数字是不可接受的。

###### 2.2 `max_output_tokens = 512`

**token 是模型处理文本的基本单位**，约等于「词的碎片」。英文里大致 1 token ≈ 4 个字符 ≈ 0.75 个单词。

```
"SELECT COUNT(*) FROM students"  ≈  8 tokens
一句完整的 SQL 查询（带 JOIN）    ≈  50~150 tokens
512 tokens                       ≈  一段 350~400 字的英文
```

512 的作用是**硬性上限**：

```
        模型想输出很长的东西
                │
        到 512 tokens 就【强制截断】
                │
                ▼
        ► 好处：防止失控（比如它想 dump 整个 schema 说明）
        ► 好处：成本可控（按 token 计费）
        ► 风险：如果结果很多，总结可能被切掉尾巴
```

对这个用途够用：一句 SQL 远不到 512，一段结果总结也不该超过。

---

##### 3. 完整数据流

```
【浏览器】Chatbot.tsx
   讲师输入：「Which students missed more than 3 classes in CS101?」
        │
        │  api.post('/query/natural', { question })
        ▼
【后端】POST /query/natural
        │
        ▼
   ┌────────────────────────────────────────┐
   │ 鉴权：Depends(require_lecturer)         │
   │ 不是讲师/管理员 ──► 401/403 直接挡      │
   └────────────────┬───────────────────────┘
                    ▼
   ┌────────────────────────────────────────┐
   │ ① 组 prompt，喂给 Gemini                │
   │   ├─ SCHEMA_CONTEXT（8 张表的字段）      │
   │   ├─ Join Guidelines（4 条连表规则）     │
   │   ├─ Rules（3 条行为规则）               │
   │   └─ User: {question}                   │
   └────────────────┬───────────────────────┘
                    ▼
            Gemini 返回一段文字
                    │
   ┌────────────────────────────────────────┐
   │ ② 正则抽 SQL                            │
   │   re.search(r"(SELECT[\s\S]+)")         │
   │   ── 剥掉 markdown ``` 和废话前缀        │
   └────────────────┬───────────────────────┘
                    ▼
            是 SELECT 开头吗？
                    │
        ├─ 否 ──► 当成闲聊/拒绝，原文返回给前端，结束
        │         （success = true，sql_used = null）
        │
        └─ 是 ──► 继续
                    ▼
   ┌────────────────────────────────────────┐
   │ ③ validate_sql()  应用层白+黑名单       │
   │   见第 5 节表                            │
   └────────────────┬───────────────────────┘
                    │
        ├─ 不安全 ──► HTTPException 400，结束
        └─ 安全 ──► 继续
                    ▼
   ┌────────────────────────────────────────┐
   │ ④ execute_sql()                         │
   │   engine.connect().execution_options(   │
   │       postgresql_readonly = True )  ★   │
   │   fetchmany(500)  ── 最多 500 行         │
   └────────────────┬───────────────────────┘
                    │
        ├─ DB 报错 ──► 返回错误信息 + sql_used，success=false
        └─ 成功 ──► rows（list of dict）
                    ▼
   ┌────────────────────────────────────────┐
   │ ⑤ 再喂 Gemini 一次，把 rows 翻成人话     │
   │   prompt 里额外强调：                    │
   │   「这是只读查询，不要暗示改过任何数据」  │
   └────────────────┬───────────────────────┘
                    ▼
        返回 { answer, sql_used, success, row_count }
                    │
                    ▼
【浏览器】Chatbot.tsx 显示 answer，并可展开看 sql_used
```

**注意 Gemini 被调用了 2 次**，两次任务完全不同：

| 第几次 | 输入 | 输出 | 干什么 |
|---|---|---|---|
| 1 | schema + 规则 + 问题 | SQL 语句 | **翻译**（人话 → SQL） |
| 2 | 问题 + 查询结果 | 一段人话 | **总结**（数据 → 人话） |

第 2 次是必要的：直接把 `[{'name': 'Ali', 'cnt': 4}, ...]` 甩给讲师看太原始了。

---

##### 4. ★ 三层纵深防御（Defence in Depth）

这是这个模块最该讲的设计。**同一件事防了 3 遍，在 3 个不同的层。**

```
       讲师输入：「delete all students」（恶意 / 手滑）
                        │
                        ▼
   ┌──────────────────────────────────────────────────┐
   │ 第 1 层 · Prompt 层（让模型自己拒绝）              │
   │                                                   │
   │ Rule 3: 如果用户要 insert/update/delete/drop，     │
   │         不要生成 SELECT，回复固定的道歉句          │
   │                                                   │
   │ ► 挡下来 ──► 返回 "I apologize, but I am only     │
   │              able to assist with database         │
   │              attendance queries..."                │
   │ ► 弱点：prompt injection 可能绕过（LLM 不可靠）    │
   └──────────────────┬───────────────────────────────┘
                      │ 万一漏过去
                      ▼
   ┌──────────────────────────────────────────────────┐
   │ 第 2 层 · 应用层（确定性代码，不靠 LLM）           │
   │                                                   │
   │ validate_sql()：                                  │
   │   ├─ 白名单：必须 SELECT 开头                     │
   │   ├─ 黑名单：INSERT UPDATE DELETE DROP            │
   │   │           ALTER TRUNCATE CREATE               │
   │   ├─ 禁 PG_*（系统表）                            │
   │   └─ 禁 INFORMATION_SCHEMA（元数据）              │
   │                                                   │
   │ ► 挡下来 ──► HTTPException 400                    │
   │ ► 弱点：黑名单原理上可能有漏网写法                 │
   └──────────────────┬───────────────────────────────┘
                      │ 万一还漏过去
                      ▼
   ┌──────────────────────────────────────────────────┐
   │ 第 3 层 · 数据库层（最终兜底，绕不过）★            │
   │                                                   │
   │ postgresql_readonly = True                        │
   │ ► PostgreSQL 自己在只读事务里【拒绝任何写操作】    │
   │ ► 就算前两层全被绕过，这里物理上写不进去           │
   └──────────────────────────────────────────────────┘
```

**为什么要 3 层？** 因为第 1 层是**概率性**的（LLM 可能被骗），第 2 层是**枚举性**的（黑名单可能不全），只有第 3 层是**结构性**的（数据库引擎级别的保证）。安全设计不能只靠一层，尤其不能只靠 LLM。

---

##### 5. 安全检查速查表（if → then）

`validate_sql()` 顺序执行：

| # | 检查 | 不通过时 |
|---|---|---|
| 1 | 去空格转大写后，是否 `SELECT` 开头 | `"Only SELECT queries are allowed."` |
| 2 | 是否含 `INSERT`（整词匹配 `\b`） | `"Forbidden keyword detected: INSERT"` |
| 3 | 是否含 `UPDATE` | 同上 |
| 4 | 是否含 `DELETE` | 同上 |
| 5 | 是否含 `DROP` | 同上 |
| 6 | 是否含 `ALTER` | 同上 |
| 7 | 是否含 `TRUNCATE` | 同上 |
| 8 | 是否含 `CREATE` | 同上 |
| 9 | 是否含 `PG_` | `"Access to system tables is not allowed."` |
| 10 | 是否含 `INFORMATION_SCHEMA` | `"Access to metadata is not allowed."` |
| ✅ | 全过 | 放行到只读事务执行 |

**用 `\b` 整词匹配的原因**：不然 `SELECT ... FROM updated_records` 里的 `update` 会误伤。

**为什么禁 `PG_` 和 `INFORMATION_SCHEMA`？** 那是数据库的**自我描述**表 —— 能读它就能摸清全库结构，是攻击的第一步侦查。讲师查考勤完全不需要它们。

---

##### 6. 输出结果的 3 种形态

```
                POST /query/natural
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  【闲聊/拒绝】     【查询成功】     【查询失败】

  answer: 道歉句     answer: 人话总结   answer: 错误说明
  sql_used: null    sql_used: SQL      sql_used: SQL
  success: true ★   success: true      success: false
                    row_count: N
```

**闲聊为什么 `success: true`？** 因为「正确地拒绝一个无关问题」是**成功的行为**，不是系统故障。`false` 只留给真正的失败（LLM 连不上、SQL 跑挂了）。

**`sql_used` 一定回传给前端** —— 讲师能看到实际执行了什么，这是**可审计性**。系统不是黑盒。

---

##### 7. Prompt 里到底塞了什么

```
system_prompt = 三块拼起来：

  ┌─ SCHEMA_CONTEXT ────────────────────────┐
  │  8 张表 + 字段 + 外键关系                │
  │  users / students / lecturers /          │
  │  courses / enrolments / class_sessions / │
  │  attendance_records / risk_scores        │
  └─────────────────────────────────────────┘
  ┌─ Join Guidelines（4 条）─────────────────┐
  │  明确告诉它怎么连表，例如：               │
  │  attendance_records.session_id           │
  │      = class_sessions.id                 │
  └─────────────────────────────────────────┘
  ┌─ Rules（3 条）───────────────────────────┐
  │  1. 只回 SQL，SELECT 开头                │
  │  2. 打招呼/无关问题 ──► 固定道歉句        │
  │  3. 要改数据 ──► 固定拒绝句               │
  └─────────────────────────────────────────┘
```

**为什么要手写 Join Guidelines？** 不给的话模型会**猜**连表方式，猜错就生成跑不通或结果错的 SQL。这是把领域知识注入 prompt，比让模型自己推断可靠得多。

**注意 schema 是硬编码的字符串**，不是从数据库动态读的。好处是可控（不暴露多余表）；代价是**改了表结构要手动同步这段**，否则 LLM 用旧 schema 写 SQL 会报错。

---

##### 8. ⚠ 现状 / 局限（老师可能会问）

| 点 | 现状 |
|---|---|
| **500 行硬上限** | `fetchmany(500)`。避免偶发的大查询把整表读进内存。超过 500 行会**静默截断**，总结可能不完整 |
| **schema 手动维护** | 硬编码在 `SCHEMA_CONTEXT`，改表要记得同步 |
| **没有对话记忆** | 每次请求独立，不能问「那他们呢？」这种指代上文的问题 |
| **依赖外部 API** | 断网 / key 过期 / Google 限流 → 功能不可用，会返回 `LLM Connection Error` |
| **prompt injection 未实测** | 第 1 层理论上可被绕过，但第 2、3 层兜底。**没做过渗透测试** |
| **成本按 token 计费** | 每个问题调 2 次 Gemini。报告 §2.3.2 定位为**低频功能**（讲师偶尔查），不是高并发场景 |

---

##### 9. 代码位置

| 内容 | 文件 |
|---|---|
| 全部后端逻辑（137 行） | [llm.py](../../fyp-backend/routers/llm.py) |
| Gemini 配置 + 参数 | [llm.py:13-19](../../fyp-backend/routers/llm.py#L13-L19) |
| Schema 上下文 | [llm.py:24-34](../../fyp-backend/routers/llm.py#L24-L34) |
| 安全校验 | [llm.py:37-50](../../fyp-backend/routers/llm.py#L37-L50) |
| 只读执行 | [llm.py:52-62](../../fyp-backend/routers/llm.py#L52-L62) |
| 前端聊天界面 | [Chatbot.tsx](../../fyp_web/src/pages/staff/Chatbot.tsx) |
| API 调用 | [api.ts:356-359](../../fyp_web/src/services/api.ts#L356-L359) |

### docs/02-Engineering/README.md

#### 02-Engineering — 工程规范与评审

写代码前看 `CONVENTIONS.md`；想知道某个设计为什么长这样，查 `BACKEND-REVIEW.md`。

| 文件 | 行数 | 内容 |
|---|---|---|
| [CONVENTIONS.md](./CONVENTIONS.md) | 499 | 12 节规矩，**每条都对应一次真实事故** |
| [BACKEND-REVIEW.md](./BACKEND-REVIEW.md) | 1879 | 后端评审 + 修复的完整执行记录 |

---

##### CONVENTIONS.md 讲什么

不是通用风格指南。每一条都是这个项目真的踩过的坑：

| 节 | 主题 | 起因 |
|---|---|---|
| 1 | Schema 与数据 | 4 个 `@property` 遮盖物理列，全表数据对 API 消失 |
| 2 | 课表单一真相 | 两套课表并存，admin 改了签到引擎不认 |
| 3 | 一条规则一个地方 | 公告可见性有两份 60 行副本；端口写了 5 份，改一处漏四处 |
| 4 | 时间 | 读宿主机时区偏移 |
| 5 | fail loud | 静默 fallback 放过未验证的签到 |
| 6 | 分层 | router 之间互相 import |
| 7 | 缓存 | 实时端点被缓存 30 秒 |
| 8 | 删代码之前 | 「得确保是死代码，别删掉了突然发现别的地方有用」 |
| 9 | 修复的形状 | 改症状还是改成因 |
| 10 | 环境 | Python 3.11 硬约束、requirements 非 ASCII 崩 pip、venv 外的隐藏依赖 |
| 11 | 测试 | 变异测试、取样陷阱、断言业务后果 |
| 12 | 文档 | 代码是真相 |

---

##### BACKEND-REVIEW.md 怎么读

1879 行，不要通读。按需跳：

| 想知道 | 看 |
|---|---|
| 一共做了什么 | 开头的「状态」+ §5.0 执行记录 |
| 某条修复的完整推理 | §2 / §3 / §4 的对应条目 |
| **哪些历史判断被推翻了** | **附录 C** |
| 有意偏离原方案的地方 | §8.5（3 处，已追认） |
| 13 项回归测试守什么 | §6.3 |

**附录 C 最重要。** 早期三份审查文档（现在 `../archive/`）的部分结论后来被证伪，
比如「ML 模型加载失败静默退化是 bug」——复核后确认是故意的 fail-soft 设计
（依据见 [../03-MLModel/ml_risk_predict_desc.md](../03-MLModel/ml_risk_predict_desc.md) §7）。
引用旧文档前先查这里。

---

##### 状态

§6.1 的 12 步 + §2/§3/§4 的 25 条全部落地，已提交并推送：
`e10bfeb`（gitignore）→ `0c912bc`（后端）→ `45da256`（客户端）。

验证：13/13 回归测试通过 · 6/6 变异测试 · 111 个（角色 × GET 路由）组合 0 个 5xx ·
1993 条考勤记录 0 丢失 0 重复 · `tsc -b` 干净 · `flutter analyze` 仅一个既有告警。

### docs/02-Engineering/BACKEND-REVIEW.md

#### Backend Review — 唯一现行文档

> **这是 backend 审查的单一真相源。** 三份历史文档已归档到 [`archive/`](../archive/)，
> 内容已合并进本文，**不要再更新它们**：
> `backend_review_2026-07-18.md` · `backend-architecture-audit_2026-07-29.md` · `backend-review_2026-07-30.md`

- **范围：** `fyp-backend/` 全量（14 routers + 11 utils + ml，5,825 行，78 条路由）+
  两端客户端调用点核对（`fyp_web/src`、`fyp_flutter/lib`）
- **最后更新：** 2026-07-30（第四轮：**§6.1 全部 12 步已执行完毕**）
- **状态：✅ 全部完成并验证，已提交并推送**（`e10bfeb` gitignore → `0c912bc` 后端 →
  `45da256` 客户端）。§6.1 的 12 步 + §2/§3/§4 原 25 条已全部落地；
  [§6.3](#63-重构前应补的测试) 的 5 条回归测试也已补齐
  （`test_backend_fixes.py` 8 → **13** 个 check，13/13 通过，mutation-tested 6/6）。
  唯一有意不做的是 Nit 第 5 条，按实测驳回，理由见 [§8.5 ②](#85-执行中偏离文档的-3-处需确认)。
  执行记录与实测数字见 [§5.0](#50-第四轮执行--61-全部-12-步2026-07-30)；
  执行中偏离文档的 3 处见 [§8.5](#85-执行中偏离文档的-3-处需确认)。
- **已拍板：** 全部 10 项见 [§8.1](#81-已拍板2026-07-30)、[§8.2](#82-已拍板补充2026-07-30-第二批)、
  [§8.3](#83-已拍板执行期追加2026-07-30-第三批)。**已无待决问题。**
- **执行结果概览：** 5 个 Alembic migration 落库 · `utils/` 1,393 → 183 行 ·
  `test_backend_fixes.py` **13/13**（mutation-tested 6/6）· 111 个（角色 × GET 路由）组合
  0 个 5xx · `tsc -b` 干净 · `flutter analyze` 无新增 · 1993 行出席数据零丢失
- **验证方式：** 所有事实性结论都对 live Supabase 执行过 SQL 或对代码做过 grep 统计。
  「读代码推断」和「跑过验证」在本文中严格区分标注。
- **⚠️ 文中文件路径已按步骤 5 的新结构更新**（`db/models.py` → `db/models.py` 等）。
  **行号是执行前的快照**，仅供追溯当时的问题位置，不再与当前代码对应。

##### 用户既定要求

以下是贯穿本文所有建议的硬约束，来自用户明确表述：

1. **企业级标准结构** —— 「一个资深 software engineer 会做的方式，一种干净标准的结构」。
2. **修法必须是「A 错了改对 A」，不是「A 错了加 B 去补 A」。** 用户原话：
   「a错了 加b去修复a的问题（这样我觉得很不好 屎山代码）」。**这一条推翻了本文前身
   文档的部分修法** —— 见 [§2.1](#21-影子列--四对同名列-orm-只认一半)。
3. **优先级：跟 report 跑通 > 简化。** report 已提交，不改已记录的设计
   （deepface + ArcFace + cosine + 512d、阈值 0.40、只做网络验证）。
4. **能用库/原生特性就不要 hardcode，最大化复用 helper，命名要一秒能懂。**

---

##### 目录

- [1. 结论](#1-结论)
- [**5.0 第四轮执行记录**](#50-第四轮执行--61-全部-12-步2026-07-30) ← **先看这里：这轮做了什么、实测多少**
- [**8.5 执行中偏离文档的 3 处**](#85-执行中偏离文档的-3-处需确认) ← **需要你确认**
- [2. ✅ 已修复（原 Must fix）](#2--已修复原-must-fix)
- [3. ✅ 已修复（原 Should fix：结构 / 重复）](#3--已修复原-should-fix结构--重复)
  - [3.0 目标结构 —— 已达成](#30-目标结构企业级但不过度分层)
  - [3.10 三个客户端死调用](#310-三个客户端死调用web--flutter-都在调不存在的端点)
- [4. ✅ 已修复 8/9（原 Nit）](#4--已修复-89原-nit)
- [5. 已修复归档](#5-已修复归档)
- [6. 执行路线](#6-执行路线)
- [7. 做得好的部分](#7-做得好的部分)
- [8. 决策记录（已全部拍板）](#8-决策记录已全部拍板)
- [附录 A — 验证记录](#附录-a--验证记录)
- [附录 D — 执行细则 + 执行后修正](#附录-d--执行细则给动手的人) ← 命令、SQL、import 对照表
- [附录 B — 已排除的误报](#附录-b--已排除的误报)
- [附录 C — 三份历史文档的判断修正表](#附录-c--三份历史文档的判断修正表)

---

##### 1. 结论

###### 1.1 四轮审查的共同教训

| 轮次 | 当时的第一优先级 | 事后证明真正的第一优先级 |
|---|---|---|
| 07-18 | 报告一致性 + 正确性 bug | 基本正确 |
| 07-29 | 「router 层职责过多」，建议 20 文件重构 | **6 个运行时契约断裂**，约 20 个端点无条件 500/422。一个文件都不用移 |
| 07-30（审查） | 重复代码 / helper 未复用 | **schema 漂移**：4 对影子列 + 丢失的唯一约束 |
| 07-30（执行） | 照文档执行 | **文档本身有 3 处错**：引用不存在的列、自相矛盾、算错一个数。见 [§8.5](#85-执行中偏离文档的-3-处需确认) |

**结论：这个 codebase 真正的问题不是结构，是 schema 漂移。** 四轮里有两轮，最严重的
发现都是「model 说一套、数据库是另一套」。

**第四轮追加一条：** 审查文档也会错，而且错法与代码同源 —— 未执行过的结论会
系统性地把假设当事实。三处都是动手查库才暴露的（`course_staff_assignments`
根本没有 `class_group` 列；`liveness_passed` 该不该保留在同一节里有两个相反答案；
`network_verified` 的目标数字是两个不相交集合相加算错的）。
**照文档执行时，每一步的前提都要重查一遍。**

###### 1.2 根因已定位到单个 commit

```
54abaf4  "Fix Supabase ID Column to UUID"
```

这一个 commit 造成了迄今为止**最严重的 4 类缺陷**：

| 它删掉的东西 | 造成的后果 | 状态 |
|---|---|---|
| `FaceEmbedding.is_active`、`Alert.email_body/triggered_by/sent_at` | 4 个端点无条件 500（含人脸签到） | ✅ 已修（`f3dcba1`） |
| `UniqueConstraint("student_id","session_id")` + 对应迁移块 | **回归了 07-18 已完成并验证的修复**，并发重复签到再次无兜底 | ❌ 见 §2.2 |
| `confidence_score` / `wifi_verified` / `liveness_passed` / `marked_at` 四个 `Column` 声明 | 四对影子列，1793 条记录对外显示错误数据 | ❌ 见 §2.1 |
| 把 id 类型改成 UUID 但 13 个端点仍声明 `int` | 全部 admin 编辑/删除 422 | ✅ 已修（`f3dcba1`） |

git 证据见[附录 A6](#a6-根因-commit-54abaf4)。

###### 1.3 因此真正的企业级缺口

**这个项目没有迁移工具。** [`main.py:16-82`](../../fyp-backend/main.py#L16-L82) 是 60 行手写
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，在 **import 时**执行，外面包
`except Exception: print(warning)`。

这套机制的结构性缺陷：

- 无版本号 —— 不知道 DB 处于哪个状态
- 不能回滚
- 改名时只 `ADD` 新列、永不 `DROP` 旧列 → **必然产生影子列**
- 只 `ADD COLUMN`，不管约束和索引 → 约束被删了也没人知道
- 失败只打印一行 stdout，应用照常启动（07-18 文档 C 项记录了这个坑真的发生过：
  `DO $$` 块没 catch `duplicate_table`，整个迁移大事务回滚，而 app 假装启动成功）

**所以修数据之前要先上 Alembic。** 否则修完这四对影子列，下次改名还会长出新的 ——
这正是用户不想要的「屎山」形成机制。

###### 1.4 目录结构：要改，但不是 07-29 那套

**要改。** 实测 `utils/` 1,393 行里 **1,188 行（85%）不是 utility** —— `models.py`（数据层）、
`schemas.py`（契约层）、`network_verify.py`（集成）、`scheduler.py` / `attendance.py` /
`audit.py`（领域），以及最刺眼的 `session_sync.py`：**一个会 commit、被 7 个 GET handler
调用的 149 行 service，藏在一个意思是「杂物」的目录名下。** 这正是它的副作用长期没人
注意到的原因。

**但不是 07-29 那套 20 文件布局。** 那里面 `queries/`（4 模块）和 `services/`（8 模块）
多数是为单实现新建的抽象 —— 反例很清楚：07-29 建议新建含 5 个函数的
`session_window_service`，复核发现需要的只是**让已存在的 `get_course_group_slots`
被调用**。

正确做法是**给现有文件一个诚实的位置，零新抽象**：`domain/` + `integrations/` + `db/`，
`utils/` 瘦身到名副其实的 205 行。移动只碰 18–51 处 import，机械替换。
完整布局与成本见 [§3.0](#30-目标结构企业级但不过度分层)。**用户已批准。**

---

##### 2. ✅ 已修复（原 Must fix）

> **本节 4 条已于 2026-07-30 全部执行完毕并验证。** 问题描述与判据原样保留，
> 每条末尾加了「执行结果」。实测数字见 [§5.0](#50-第四轮执行--61-全部-12-步2026-07-30)。

###### 2.1 影子列 —— 四对同名列，ORM 只认一半

**位置：** [`db/models.py:180-212`](../../fyp-backend/db/models.py#L180-L212)

`54abaf4` 把四个 `Column` 声明换成了同名 `@property`：

```python
@property
def marked_at(self):          return self.timestamp
@property
def confidence_score(self):   return self.confidence
@property
def wifi_verified(self):      return bool(getattr(self, 'network_verified', False))
@property
def liveness_passed(self):    ...   # 由 liveness_suspicious + confidence 推导
```

**这四个 property 名字在数据库里各自都是真实存在的物理列。** property 遮蔽了它们，
SQLAlchemy 永远不会映射，而历史数据全部躺在被遮蔽的那一侧。

实测同一行数据，两种读法：

| 字段 | ORM 读到（= API 返回值） | 数据库真实值 |
|---|---|---|
| `confidence_score` | `None` | `1.0` |
| `wifi_verified` | `False` | `True` |
| `marked_at` | `2026-07-26 13:35:16` | `2026-07-10 07:48:11` |

全表规模（1993 行）：

```sql
select count(*) from attendance_records where marked_at is distinct from timestamp;
-- 1993   ← 每一行都不一致
```

| 列 | ORM 映射的（API 读到） | 被遮蔽的物理列 | 用户可见后果 |
|---|---|---|---|
| 时间 | `timestamp` —— **仅 4 个不同值**，1793 行塌在 `2026-07-26 13:35:16` | `marked_at` —— 16 个不同值，07-10 → 07-29 | 学生出席历史 90% 记录时间戳相同，排序失去意义 |
| 置信度 | `confidence` —— **1993 行全 NULL** | `confidence_score` —— 1154 行有值 | 讲师/admin 名单 confidence 一律空白 |
| 网络 | `network_verified` —— 仅 1 行 true | `wifi_verified` —— 1153 行 true | 1153 条已验证记录显示「未验证」 |
| 活体 | `liveness_suspicious` —— 200 行 true | `liveness_passed` —— 1153 行 true | 影响较小，property 有推导逻辑 |

**旁证：** `confidence` 列 1993 行全 NULL —— 说明 property 引入后没有任何一次成功签到
写入过。这与人脸签到端点在 `f3dcba1` 之前无条件 500 的事实吻合。

###### 时间列的真相分布：不是「哪一列对」，是按行分三个时代

**这一节是 2026-07-30 深查的结果，推翻了「选一列 backfill」的假设。**

判据：签到必然发生在开课当天，所以拿每行比对它父 session 的 `opened_at` 日期。

| 情况 | 行数 |
|---|---|
| 只有 `marked_at` 与 session 同日 | 443 |
| 只有 `timestamp` 与 session 同日 | 100 |
| 两列都同日 | 50 |
| **两列都不同日** | **1400** |
| 孤儿行（无 session 或 `opened_at` 为空） | 0 |

按 session 日期逐组看，规律非常干净：

```
session 日期    marked_at      timestamp
2026-02-16      07-10  ✗       07-26  ✗     ← 2/3 月全部如此
2026-03-11      07-10  ✗       07-26  ✗
2026-07-13      07-13  ✓       07-26  ✗     ← marked_at 是真的
2026-07-22      07-22  ✓       07-26  ✗
2026-07-27      07-29  ✗       07-27  ✓     ← 翻转，timestamp 是真的
2026-07-29      07-29  ✓       07-29  ✓
```

**三个时代：**

1. **2/3 月的 1400 行 —— demo seed 数据，两列都是垃圾。**
   session 被回填成学期日期，出席行没跟着改。`marked_at` 全是 `07-10 07:48:11`
   （一次批量插入的同一时刻），`timestamp` 全是 `07-26 13:35:16`（加列时 `DEFAULT now()`）。
2. **7/13–7/22 的 443 行 —— property 引入前。** 真实签到时间在 `marked_at`，
   `timestamp` 是加列时的默认值。
3. **7/27 之后的 100 行 —— property 引入后，方向翻转。** 写入走 `timestamp`，
   物理 `marked_at` 拿的是 DB 默认值 `now()`。

**这解释了为什么 `/students/me/attendance` 看起来「只有 4 个时间戳」** —— 1793 行里
绝大部分是第 1 类 seed 数据。

**backfill 规则（一个 `CASE` 表达式，不是选一列）：**

```
优先取与 s.opened_at 同日的那一列
两列都不同日  →  取 s.opened_at（第 1 类 seed 行）
```

第三条分支覆盖那 1400 行。**这是数据修复而非妥协** —— 它们现在的时间戳是纯噪音，
推导自 session 至少与 `class_sessions` 自洽，出席率计算本来也只用 session 维度。

**规则 dry-run（实测各分支落多少行）：**

```
derive from opened_at  → 1400
keep marked_at         →  493
take timestamp         →  100
```

###### ⚠️ 附带发现：`liveness_passed` 与 `liveness_suspicious` 在签到时互相覆盖

查 liveness 列时发现的**新 bug**，不在此前任何文档中。

[`sessions.py:466`](../../fyp-backend/routers/sessions.py#L466) 和
[`:475`](../../fyp-backend/routers/sessions.py#L475) 在**同一个构造器里同时写两者**：

```python
record = AttendanceRecord(
    ...
    liveness_passed=liveness_passed,        # :466  ← setter 会写 liveness_suspicious = not value
    ...
    liveness_suspicious=liveness_suspicious, # :475  ← 直接写同一列，覆盖上面那句
)
```

`liveness_passed` 是 property，其 setter 就是 `self.liveness_suspicious = not value`。
SQLAlchemy 的声明式构造器按 kwargs 顺序赋值，所以 **:475 覆盖 :466** ——
`body.liveness_passed`（客户端上报的活体结果）被静默丢弃，只有
`liveness_suspicious = challenge_ms < 800`（手势过快标记）留下。

**两个本来独立的信号被挤进同一列：**「活体检测是否通过」和「手势快得可疑」。
学生活体通过但手势 < 800ms 时，记录会显示 `liveness_passed = False`。

这正是 §2.1 主结论的又一个实例 —— **property 遮蔽物理列会让两个概念塌成一个**。
修法与影子列同批：`liveness_passed` 恢复为独立物理列，`liveness_suspicious`
保持独立，两者不再互为反义。

###### 四列的 backfill 方向各不相同 —— 不要写成一个循环

| 目标列（保留） | 数据来源 | 方向与规则 |
|---|---|---|
| `marked_at` | 自身 + `timestamp` + `s.opened_at` | 三时代 `CASE`（上表） |
| `confidence_score` | 自身 | **无需 backfill** —— `confidence` 全 NULL，无数据可迁 |
| `network_verified` | `wifi_verified` | 单向覆盖（`wifi_verified` 1153 true vs `network_verified` 1 true） |
| `liveness_suspicious` | `liveness_passed` | ⚠️ **不能无条件 `NOT liveness_passed`** —— 见下 |

**`liveness` 那列的实测分布：**

```
lp=True   ls=False  status=present  n=1153     ← property 前写入，物理列有真值
lp=False  ls=False  status=absent   n= 640     ← property 前的缺席行
lp=NULL   ls=True   status=absent   n= 200     ← property 后的缺席行
```

第三组是 [`session_sync.py:146`](../../fyp-backend/domain/session_sync.py#L146) 标缺席时
写 `liveness_passed=False` → 经 setter 变成 `liveness_suspicious=True` 留下的。
**这 200 行的 `ls=true` 不代表「行为可疑」，只是缺席标记的副产物。**

而且 **0 行携带真正的行为生物特征 flag** —— 因为 property 引入后没有任何成功签到
（`confidence` 全 NULL），`challenge_ms < 800` 那条路径从未落库。

所以 backfill 时：`liveness_passed IS NOT NULL` 的行取 `NOT liveness_passed`；
那 200 行的 `liveness_suspicious` 应当**重置为 false**（它们是缺席行，
「手势可疑」对缺席没有意义），真实语义由 `status='absent'` 承载。

###### 修法（已按用户要求 #2 修正）

**前身文档 `backend-review_2026-07-30.md` 的修法是错的，在此更正。**

那份文档写「backfill 后 DROP 影子列 + 删掉 4 个 property」。问题：这四个名字是
[`schemas.py`](../../fyp-backend/schemas.py) 里的对外 API 字段，web 和 Flutter 都在读。
删 property 会连带改 API 契约 —— **等于为了修 B 又去动前端，正是用户不要的模式。**

**这四个 `@property` 本身就是「A 错了加 B 去补」的产物** —— 有人改了列名（A 断了），
不去改 14 个 router 的调用点，而是加了一层转发器（B）。B 现在就是 bug。

正确方向：**删掉 B（property 层），让 A 恢复正确**，而不是在 B 上再加 C。

四条要分开判断，不能一刀切：

| 字段 | 性质 | 修法 |
|---|---|---|
| `marked_at` | 纯改名事故。`marked_at` 比 `timestamp` 语义更准 | 恢复成真 `Column`，backfill 后 `DROP timestamp` |
| `confidence_score` | 同上，且 `confidence_score` 是 API 契约名 | 恢复成真 `Column`，backfill 后 `DROP confidence` |
| `network_verified` | **真的语义升级**（从「只看 wifi」到「看整个网络」），新名字更准 | 保留 `network_verified` 做列，从 `wifi_verified` backfill 后 `DROP wifi_verified`。对外的 `wifi_verified` 字段名改由 **Pydantic 的 `alias` 或 `computed_field`** 提供 |
| `liveness_passed` | 确实该是推导值，不该是列 | 物理列 backfill 进 `liveness_suspicious` 后 `DROP`。推导放到 **schema 层**，不放 ORM |

改完之后：**ORM model 里零 property 遮蔽物理列**，API 契约不变，前端零改动。

**风险：** 涉及 1993 行生产数据。执行前必须先导出备份。本次审计未执行。

---

###### 2.2 唯一约束被回归 —— 07-18 修好过，`54abaf4` 删了

**位置：** [`routers/sessions.py:479-487`](../../fyp-backend/routers/sessions.py#L479-L487)

代码注释仍然声称这个约束存在：

```python
except IntegrityError:
    # The DB unique constraint on (student_id, session_id) is the authoritative
    # backstop — one record per student per session.
```

实测 `attendance_records` 全部约束：

```
attendance_records_pkey             | PRIMARY KEY (id)
attendance_records_session_id_fkey  | FOREIGN KEY (session_id) ...
attendance_records_student_id_fkey  | FOREIGN KEY (student_id) ...
```

**没有这个约束。** 所以 `except IntegrityError` 整段是死代码，并发双击时两个请求都能
通过 [`sessions.py:369-374`](../../fyp-backend/routers/sessions.py#L369-L374) 的检查然后都
INSERT 成功。当前 0 条重复 —— 是运气（单 worker + 低并发），不是防护生效。

**这是回归，不是新问题。** 07-18 文档 C 项状态写的是「✅ 已完成并验证（app 层 + model +
迁移去重去约束都做了，真跑迁移：0 重复、约束已落库）」。`54abaf4` 同时删掉了
`models.py` 的 `UniqueConstraint(...)` 和 `main.py` 的 `DO $$ ADD CONSTRAINT` 迁移块。

**修法：** 恢复约束（DDL + model 声明）。这是「改对 A」—— 死代码立刻变成生效的兜底，
不需要在应用层加锁。属于 ponytail 阶梯第 4 档（DB constraint 优于 app code）。

```sql
ALTER TABLE attendance_records
  ADD CONSTRAINT uq_attendance_student_session UNIQUE (student_id, session_id);
```

**注意 07-18 踩过的坑：** 约束已存在时 Postgres 报的是 `duplicate_table`(42P07) 而不是
`duplicate_object`。当时 `DO $$` 块只 catch 后者 → 整个迁移大事务回滚 → 连带公告新列
也没建成，而 `except: print` 让 app 假装启动成功。**上 Alembic 之后这类坑自动消失。**

---

###### 2.3 `get_course_group_slots` 没有真正按 class_group 过滤

**位置：** [`routers/sessions.py:69-89`](../../fyp-backend/routers/sessions.py#L69-L89)

```python
def get_course_group_slots(db, course_id, class_group) -> list:
    if class_group == "All":
        slot = schedule_map.get(f"Lecture-{course_id}")
    else:
        assignments = db.query(CourseStaffAssignment).filter(
            CourseStaffAssignment.course_id == course_id,
            CourseStaffAssignment.role.in_(["Tutor", "Practical"])
        ).all()          # ← 这门课所有 Tutor + Practical，与 class_group 无关
```

`class_group` 只被当成 `All / 非All` 的二元开关。非 All 分支返回这门课**全部** Tutor 和
Practical 时段，调用方取 `slots[0]`。

实测：**有 1 门课同时挂了 Tutor 和 Practical**，这条路径已被真实数据踩到。

两个后果：

1. **窗口计算取错时段。** 所有调用方（`students.py`、`sessions.py` 三处、
   `admin_attendance.py`）都用 `slots[0]` 算课程结束时间。`slots[0]` 由数据库返回顺序
   决定，等于任意选一个。
2. **跨组签到绕过。** [`validate_student_checkin:143-166`](../../fyp-backend/routers/sessions.py#L143-L166)
   遍历所有 slot，**任一**时段命中就 `valid = True; break`。Practical 组学生能在 Tutor
   时段通过时间校验。

**根因在 schema：** [`ClassMeeting`](../../fyp-backend/db/models.py#L108-L122) 没有
`class_group` 列。物理上无法把「G1 的 Practical」映射到「G1 专属时段」。

**修法：** 给 `class_meetings` 加 `class_group` 列（migration）+ **按组拆行**（每个
(assignment, group) 一行），然后**删掉** `slots[0]` 那套猜测逻辑。这是「改对 A」——
补上缺失的维度，删掉围绕缺失所建的 workaround。拆行的原因和步骤见
[§6.1 步骤 3 的回填](#步骤-3-的回填一个组一行2026-07-30-追加用户拍板)。

**这条必须先定，因为 §3.1 的 helper 依赖它** —— 否则只是把 bug 集中到一处。

---

###### 2.4 Admin 覆盖出席不校验选课关系

**位置：** [`routers/admin_attendance.py:171-209`](../../fyp-backend/routers/admin_attendance.py#L171-L209)

admin 版本只做两件事：

```python
session = get_or_404(db, ClassSession, session_id, "Session")
student = get_or_404(db, Student, student_id, "Student")
```

讲师版本 [`sessions.py:683-694`](../../fyp-backend/routers/sessions.py#L683-L694) 会校验
enrolment + class group：

```python
if not enrolment:
    raise HTTPException(400, "That student is not enrolled in this course")
if session.class_group != "All" and session.class_group != enrolment.class_group:
    raise HTTPException(400, "That student is in group ... not this session's group ...")
```

admin 打错一个 `student_id`，就给一个从未选过这门课的学生凭空造一条出席记录 —— 而这条
记录会直接进入风险模型和出席率计算。

**历史：** 07-18 文档 F 项修的是**讲师端**同样的问题（已完成）。07-29 记录 admin 端仍缺，
至今未修。

**修法：** 复用讲师版本已有校验，**不写新的**。这也正是应该提取的 helper 之一
（见 §3.5）。

---

##### 3. ✅ 已修复（原 Should fix：结构 / 重复）

> **本节 11 条已于 2026-07-30 全部执行完毕并验证。** §3.0 的目标结构已达成
> （`utils/` 1,393 → **183** 行，比预估的 205 更瘦）；§3.1–3.5 的 helper 已提取；
> §3.10 的三个客户端死调用已处理。详见 [§5.0](#50-第四轮执行--61-全部-12-步2026-07-30)。

###### 3.0 目标结构（企业级，但不过度分层）

用户要求「一个资深 software engineer 会做的方式」。对 5,825 行的 FastAPI 项目，那不等于
最大化分层，而是**边界清晰**：

> **修正（2026-07-30）。** 本节前一版写「不建议动目录结构」。**那个结论是错的**，
> 用户指出「好多 core function 的东西都在 utils」—— 实测证实了这一点。前一版把两件
> 不同的事混为一谈：07-29 提议的 20 文件布局（含 `queries/` 那种为单实现新建的抽象）
> 确实不值得，但**给现有文件一个诚实的位置**是另一回事，而且很便宜。用户已批准改结构。

###### 为什么必须动：85% 的 `utils/` 不是 utility

实测 `utils/` 1,393 行的成分（**执行前**的快照）：

| 名副其实的 utility | 行数 | 其实是别的东西 | 行数 |
|---|---:|---|---:|
| `security.py` | 94 | `models.py`（数据层） | 346 |
| `db_helpers.py` | 57 | `schemas.py`（对外契约层） | 287 |
| `database.py` | 37 | `network_verify.py`（外部集成） | 175 |
| `timeutil.py` | 17 | `session_sync.py`（**149 行 service，带 commit 副作用**） | 162 |
| | | `scheduler.py`（领域：课表真相源） | 133 |
| | | `attendance.py`（领域：出席政策） | 51 |
| | | `audit.py`（领域：审计日志） | 34 |
| **205** | | **1,188** | |

最刺眼的是 `session_sync.py` —— 一个**会写库、会 commit、被 7 个 GET handler 调用**的
service，藏在一个意思是「杂物」的目录名下面。**这正是它的副作用长期没人注意到的原因。**
07-29 已指出「The current location in `utils/` hides its side effects」，判断是对的。

###### 目标结构

```
fyp-backend/
├── alembic/              ← 新增。schema 唯一变更通道
│   └── versions/
├── main.py               ← 瘦身：只建 app + 注册 router。零 DDL、零 seed、零 import 期副作用
├── routers/              ← 薄 HTTP 层：解析、鉴权、调用、序列化
├── domain/               ← 业务规则。一条规则一处实现
│   ├── attendance.py     ← 出席率政策（单一真相源，已存在）
│   ├── scheduler.py      ← 课表（单一真相源，已存在）
│   ├── session_sync.py   ← 自动开/关课 + 标缺席。副作用在名字里可见
│   └── audit.py          ← 审计日志
├── integrations/         ← 外部世界。可选依赖的 fail-soft 边界
│   ├── network_verify.py ← 校园网验证
│   └── face.py           ← 人脸（从 routers/students.py 搬出，消除唯一的 router→router 依赖）
├── db/
│   ├── models.py         ← 存储真相。一个概念一个名字，禁止 property 遮蔽物理列
│   └── database.py       ← engine / SessionLocal / get_db
├── schemas.py            ← 对外契约。名字与存储不同时用 alias / computed_field
├── utils/                ← 只剩真正的 utility（205 行，名副其实）
│   ├── security.py
│   ├── timeutil.py
│   └── db_helpers.py
└── test_backend_fixes.py ← 已存在，扩展它
```

**✅ 已达成（2026-07-30），与上图的差异：**

```
utils/          实际 183 行（比预估的 205 更瘦：schemas.py 移走后没有残留）
                后续修「我教哪些课」时加了 my_course_ids（21 行）→ 现为 204 行
domain/         多了两个模块，各有 2+ 调用方、且拷贝已漂移过，符合 §3.0 的判据：
                ├── announcements.py     ← §3.3 的可见性 + 序列化（原 2 份 60 行拷贝 + 3 份 dict）
                └── security_settings.py ← §4 的配置读取（原 sessions.py 私有函数 + admin_config 内联）
seed.py         新增（步骤 0 从 main.py 摘出的两个 seed，只在 __main__ 下跑）
```

依赖方向实测：`router → router` **0 处**、`domain/integrations/db → router` **0 处**。

**依赖方向：** `router → domain → db` / `router → integrations`。禁止 `router → router`。

###### 移动成本（实测 import 站点数）

```
session_sync   4      network_verify  1      audit      1
attendance     4      scheduler       8      → 领域/集成小计 18 处
models        24      schemas         8      database  19  → 数据层小计 51 处
```

**把 5 个领域/集成模块搬出去只碰 18 处 import**，机械替换，零逻辑改动。
`db/` 那 51 处更多但同样机械。**没有一个新抽象、没有一个新接口** —— 纯粹是
`from utils.X import` → `from domain.X import`。

###### 三条规则，足以防住已发生的全部缺陷

1. **schema 变更只走 Alembic。** 手写 `ALTER TABLE` 一律禁止。（防影子列 + 防约束丢失）
2. **`models.py` 不允许 `@property` 与物理列同名。** 需要改名时改列，不加转发器。（防 §2.1）
3. **存储名 ≠ 对外名时，由 Pydantic 处理**（`alias` / `computed_field`），不由 ORM 处理。
   这是 Pydantic 的本职 —— 用户要求 #4「能用库的原生特性就不要 hardcode」。

###### 仍然不做的部分

07-29 那套布局里的 `queries/`（4 个模块）和 `services/`（8 个模块）**不采纳**：

- `queries/` —— 为「批量加载」新建 4 个文件，而实际需要的是把已有查询移出循环（§3.7）。
- `services/` 8 个模块 —— 其中 `session_window_service` 复核后发现只需要**调用已存在的
  helper**（§3.1）；`course_access_service` 已经以一个函数的形式做完了。

**判据：一个模块只有一个实现、且没有第二个调用方时，它不该是一个模块。**

###### 3.1 窗口计算 6 份拷贝 —— helper 早已存在，8 处只有 2 处在用

`tz_offset = local_now - utc_now` 出现 **6 次**：

| 位置 |
|---|
| [`admin_attendance.py:45`](../../fyp-backend/routers/admin_attendance.py#L45) |
| [`sessions.py:255`](../../fyp-backend/routers/sessions.py#L255) |
| [`sessions.py:307`](../../fyp-backend/routers/sessions.py#L307) |
| [`sessions.py:578`](../../fyp-backend/routers/sessions.py#L578) |
| [`students.py:291`](../../fyp-backend/routers/students.py#L291) |
| [`session_sync.py:30`](../../fyp-backend/domain/session_sync.py#L30) |

`schedule_map.get(f"Lecture-...")` 出现 **9 次**。`calculate_schedule(db)` 被调用 **9 次**
（每次全表扫 `class_meetings`）。

**关键：** `get_course_group_slots` **已定义在 `sessions.py:69`**，但只有同文件的
`validate_session_opening`(:93) 和 `validate_student_checkin`(:134) 在调用 ——
**同一个文件里另外 3 段（:263、:309、:586）是手抄的同样逻辑。**

每份拷贝都是这个形状：

```python
schedule_map = calculate_schedule(db)
local_now = datetime.now()
tz_offset = local_now - utcnow()
opened_at_local = s.opened_at + tz_offset
sched_end_time = datetime.strptime(slot["end"], "%H:%M").time()
sched_end_dt_utc = datetime.combine(opened_at_local.date(), sched_end_time) - tz_offset
```

**修法 —— 两个 helper，名字一秒能懂：**

```python
# utils/timeutil.py —— 和 utcnow() 放一起，同一个时钟的两面
def local_offset():
    """本地时区相对 UTC 的偏移。整个 app 只算一处。"""

# domain/scheduler.py（步骤 5 之后；当前是 domain/scheduler.py）
def session_end_utc(db, session):
    """这节课几点结束（naive UTC）。找不到时段时回落 opened_at + 2h。"""
```

`session_end_utc` 一个函数替掉 5 处约 10 行的块。**净减行**，不是新增抽象层。

> **依赖 §2.3。** 现在 `slots[0]` 语义有歧义；歧义解决前固化到 helper 等于集中一个 bug。

**部署提醒：** `tz_offset` 依赖容器本地时区，而 Dockerfile / Procfile **均未设置 `TZ`**。
本地（Windows UTC+8）与容器（默认 UTC）行为不同 —— 提取 helper 时顺手用
`ZoneInfo("Asia/Kuala_Lumpur")` 显式化，比依赖环境更可靠（用户要求 #4）。

###### 3.2 「我教的课」查询 5 份拷贝，其中 1 处规则不一致

`(Course.lecturer_id == lecturer.id) | (Course.id.in_(assigned_course_ids))`：

| 位置 | 用途 |
|---|---|
| [`lecturers.py:33`](../../fyp-backend/routers/lecturers.py#L33) | 课程列表 |
| [`lecturers.py:77`](../../fyp-backend/routers/lecturers.py#L77) | 预警列表 |
| [`lecturers.py:148`](../../fyp-backend/routers/lecturers.py#L148) | 课表 |
| [`analytics.py:262`](../../fyp-backend/routers/analytics.py#L262) | 风险分数过滤 |
| [`sessions.py:569`](../../fyp-backend/routers/sessions.py#L569) | 进行中课堂 |

`require_course_access`（[`sessions.py:60-63`](../../fyp-backend/routers/sessions.py#L60-L63)）
内联算了第 6 遍。

**不一致点：** [`sessions.py:627`](../../fyp-backend/routers/sessions.py#L627)
`get_my_taught_courses` **只用 `Course.lecturer_id`**：

```python
courses = db.query(Course).filter(Course.lecturer_id == lecturer.id).all()
```

只挂 Tutor/Practical 的讲师在 mobile staff dashboard 看到空课表。
**这和 `f3dcba1` 修的 `/sessions/active` 是同一个 bug，当时漏了这处** —— 典型的
「同一条规则抄 6 遍，修的时候只修到 5 遍」。

**修法：**

```python
# utils/db_helpers.py —— 和 require_own_profile 同层
def my_course_ids(db, lecturer_id) -> list:
    """这位讲师负责的课：自己是 owner 的 + 被派为 staff 的。"""
```

6 处调用，顺带修掉那处不一致。

###### 3.3 公告可见性 2 份 60 行拷贝，序列化 dict 3 份

[`student_self.py:130-214`](../../fyp-backend/routers/student_self.py#L130-L214) 与
[`lecturers.py:238-318`](../../fyp-backend/routers/lecturers.py#L238-L318) 几乎逐行相同，
只有两处差异：role gate 方向相反；programme 匹配一个是单 code 相等、一个是 `in` 一个 set。

重复内容：draft 过滤、publish 窗口、role gate、scope gate、优先级排序、17 键返回 dict。

附带：

- `priority_weight = {'High': 3, 'Medium': 2, 'Low': 1}` 两份
  （[`lecturers.py:293`](../../fyp-backend/routers/lecturers.py#L293)、
  [`student_self.py:189`](../../fyp-backend/routers/student_self.py#L189)）
- 那个 17 键 dict **三份**，第三份在 [`main.py:216-230`](../../fyp-backend/main.py#L216-L230)

**修法：**

```python
def visible_announcements(db, role, prog_codes, course_codes) -> list
def announcement_dict(a) -> dict
```

**顺带修性能：** 两边都是 `filter(is_draft == False).all()` 全捞再用 Python 过滤。
`publish_start` / `publish_end` 放进 SQL 是一行的事（用户要求 #4）。

###### 3.4 `lecture_by_course` 同一个 map 建了 4 次

完全相同的 4 份：[`admin_academic.py:74`](../../fyp-backend/routers/admin_academic.py#L74)、
[`lecturers.py:46`](../../fyp-backend/routers/lecturers.py#L46)、
[`sessions.py:631`](../../fyp-backend/routers/sessions.py#L631)、
[`student_self.py:75`](../../fyp-backend/routers/student_self.py#L75)。

一个 `lecture_meetings(db, course_ids)` 解决。

###### 3.5 出席覆盖逻辑：讲师端与 admin 端两套

见 §2.4（正确性部分）。结构上是同一件事：**enrolment/group 校验 + 记录构造**应该一处
实现，授权可以按角色不同。

07-29 建议新建 `services/attendance_override_service.py`。按 §3.0 的规则，放
`domain/attendance.py`（已存在，正是出席政策的单一真相源）更合适 —— 不为一个函数新建目录。

###### 3.6 `Course.schedule_*` 是死列，但 schema 还在收

`CourseCreate` / `CourseResponse`（[`schemas.py:212-228`](../../fyp-backend/schemas.py#L212-L228)）
仍声明 4 个 `schedule_*` 字段，`Course` model（[`models.py:86-89`](../../fyp-backend/db/models.py#L86-L89)）
仍有这 4 列，`main.py:21-24` 仍在迁移里 `ADD COLUMN`。

但 `grep -rn "body.schedule_"` → **0 命中**。`create_course` / `update_course` 从不读。
客户端传 `schedule_day` 会拿到 200 然后什么都不发生 —— 静默失败的 API 契约。

实测：2 门课里 1 门 `schedule_day` 非空，是迁移前残留。

**修法：纯删除。** ponytail 阶梯最省的一档。与 07-18 I 项的结论一致
（`class_meetings` 是课表唯一真相源）。

###### 3.7 循环内 N+1，以及循环内取时钟

**N+1**（`CourseStaffAssignment` 在 session 循环内逐条查）：
[`sessions.py:269`](../../fyp-backend/routers/sessions.py#L269)、
[`sessions.py:592`](../../fyp-backend/routers/sessions.py#L592)、
[`students.py:301`](../../fyp-backend/routers/students.py#L301)、
[`admin_attendance.py:57`](../../fyp-backend/routers/admin_attendance.py#L57)。

46 session / 55 学生下无感。§3.1 的 helper 顺手批量化 ——
[`session_sync.py:39-44`](../../fyp-backend/domain/session_sync.py#L39-L44) 已有正确示范
（`assignments_by_course` 预索引）。

其余循环内查询：[`students.py:163`](../../fyp-backend/routers/students.py#L163)、
[`student_self.py:86`](../../fyp-backend/routers/student_self.py#L86)。

**循环内取时钟 —— 这条是正确性问题：**
[`admin_attendance.py:41-45`](../../fyp-backend/routers/admin_attendance.py#L41-L45) 把
`utcnow()` 和 `tz_offset` 放在 **per-session 循环内部**。同一个 HTTP 响应里不同行用不同
时刻判断「是否已结束」，跨午夜或时段边界时同一份列表自相矛盾。**修法：提到循环外。**

###### 3.8 model 声明的索引在数据库里不存在

`AttendanceRecord.session_id` / `student_id`、`ClassSession.course_id`、
`Enrolment.student_id` / `course_id` 在 model 上都写了 `index=True`。实测：

```
attendance_records : ['attendance_records_pkey']     ← 只有主键
class_sessions     : ['class_sessions_pkey']          ← 只有主键
enrolments         : ['enrolments_pkey']              ← 只有主键
```

原因：表在 `create_all` 之前就存在，`create_all` 不给已存在的表补索引。

1993 行下全表扫无感。**真正的问题是这又一次「model 说一套、DB 是另一套」** —— 与 §2.1、
§2.2 同源。**Alembic 上了之后这类漂移自动消失**（autogenerate 会检测出来）。

附带：[`models.py:4`](../../fyp-backend/db/models.py#L4) import 了 `Index` 和
`UniqueConstraint`，全文件 0 处使用 —— 死 import（`UniqueConstraint` 正是 `54abaf4`
删掉声明后留下的孤儿）。

###### 3.9 ETag 中间件给所有 GET 挂 30 秒缓存

[`main.py:102-139`](../../fyp-backend/main.py#L102-L139) 对每个 200 JSON 响应无条件加
`Cache-Control: private, max-age=30`，覆盖 `/sessions/open`、
`/students/me/active-sessions`、`/sessions/{id}/attendance`。

讲师刚开课学生看不到；讲师刚关课学生仍看到入口。签到流程上比较敏感。

**修法：** 对签到相关路由排除或改 `no-store`。**这是本文唯一一条真「新增」**
（需要一个路由排除表），其余全是删除或改对。

###### 3.10 三个客户端死调用（web + Flutter 都在调不存在的端点）

> **✅ 三条已处理（2026-07-30）。** `tsc -b` 干净、`flutter analyze` 无新增。
> **学生端 `student_dashboard_screen.dart` 零 diff**（这是最要紧的一点），
> `device_id` 审计链路 5 处完好。web 的 `UserProfileModal.tsx` 减 173 行。

用 live app 的路由表验证（`{r.path for r in app.routes}`，不是 grep 推断）：

```
404  /auth/active-sessions        ← fyp_web/src/services/api.ts:617  (getUserActiveSessions)
                                  ← fyp_flutter/lib/services/user_service.dart:113  (fetchActiveSessions)
404  /auth/logout-session         ← fyp_web/src/services/api.ts:620  (logoutSession)
                                  ← fyp_flutter/lib/services/user_service.dart:127  (logoutSession)
404  /attendance/active-sessions  ← fyp_flutter/.../staff/staff_dashboard_screen.dart:107
OK   /students/me/active-sessions
OK   /sessions/active
```

###### ⚠️ 陷阱：Flutter 有三个同名 `fetchActiveSessions`，打不同 URL

**按名字批量删会删掉一个活的端点调用。** 严格核对结果：

| 位置 | URL | 状态 | 调用者 | 处置 |
|---|---|---|---|---|
| [`user_service.dart:110`](../../fyp_flutter/lib/services/user_service.dart#L110) | `/auth/active-sessions` | **404** | **0** | 删 |
| [`student_dashboard_screen.dart:244`](../../fyp_flutter/lib/screens/student/student_dashboard_screen.dart#L244) | `/students/me/active-sessions` | OK | 6 | **别动** |
| [`staff_dashboard_screen.dart:105`](../../fyp_flutter/lib/screens/staff/staff_dashboard_screen.dart#L105) | `/attendance/active-sessions` | **404** | 4 | 改 URL |

###### 前两个：DeviceSession 功能的残骸 → **删客户端代码**

`/auth/active-sessions` + `/auth/logout-session` 是「已登录设备列表 / 远程登出」功能。
**07-18 的 L 项已按用户决定删掉整个单设备锁**（`DeviceSession` 模型、登录时注册 binding、
`get_current_user` 里的绑定校验全部移除，`main.py:56` 还留着
`DROP TABLE IF EXISTS device_sessions`），但**两端客户端代码没跟着清理**。

**Flutter 侧 = 纯死代码，零风险。** `user_service.dart` 的 `fetchActiveSessions`(:110) 与
`logoutSession`(:127) 经 grep 确认**零调用者**（`UserService.fetchActiveSessions` /
`UserService.logoutSession` 全仓无命中）。直接删两个方法。

**Web 侧 = 删功能，不是删死代码。**
[`UserProfileModal.tsx:224-262`](../../fyp_web/src/components/UserProfileModal.tsx#L224-L262)
的 `catch` 分支会**兜底合成一条前端条目**：

```tsx
catch (e) {
  setSessions([{ id: 'current-session',
                 device_name: clientDevice.deviceName,   // 从 navigator.userAgent 推导
                 platform: clientDevice.platform,
                 is_current: true }]);
}
```

所以用户看到的**不是空白列表，而是一行「Current Active Computer (Windows)」** —— 纯前端
合成，永远只有当前这一台。真正坏的是 [:321](../../fyp_web/src/components/UserProfileModal.tsx#L321)
的登出按钮：点击打 `/auth/logout-session` → 404 → 失败。

> **本文前一版写「用户看到一个永远空白的设备列表」，这是错的。** 有前端兜底，
> 列表永远显示一行合成的当前设备。这个区别决定了它是「删死代码」还是「删功能」。

**用户已确认设备锁功能不需要**（2026-07-30），因此删除。但要明确这是**可见变更**：
Profile 弹窗里整个「Active Device Sessions」section 会消失
（[:833](../../fyp_web/src/components/UserProfileModal.tsx#L833) 起的卡片），不是删掉一段
没人看见的代码。

**按原则 #2「A 错了改对 A」：后端删得对，错的是客户端还在调。修法是删客户端代码，
不是给后端补一个 stub 端点。** 补 stub 就是典型的「加 B 去补 A」—— 为了让一个已经
废弃的调用不报错，去复活一个已经删掉的功能。

要删的清单：

| 文件 | 内容 |
|---|---|
| [`fyp_web/src/services/api.ts:616-622`](../../fyp_web/src/services/api.ts#L616) | `getUserActiveSessions` + `logoutSession` 两个方法 |
| [`UserProfileModal.tsx`](../../fyp_web/src/components/UserProfileModal.tsx) | `loadSessions`(:226)、`getBrowserDeviceInfo`(:188)、`sessions` state、「Active Device Sessions」卡片(:826-875)、登出 handler(:321) |
| [`user_service.dart:110-140`](../../fyp_flutter/lib/services/user_service.dart#L110) | `fetchActiveSessions` + `logoutSession` 两个方法（零调用者） |

###### ⚠️ 必须保留：`device_id` 是活的

07-18 的 L 项决定是「**删锁，但签到时记设备指纹做审计**」。后半部分正常工作，**不要连带删**：

```
main.dart:787-796          签到 payload 带 device_id          → 活
sessions.py:476            device_id=body.device_id           → 写入 attendance_records
models.py:175              device_id = Column(String)         → 审计字段
schemas.py:23, 87          AttendanceSubmit.device_id         → 活
local_cache_service.dart:137  getOrCreateDeviceId()           → 活
```

`main.dart:403-413` 登录时也发 `device_id`，后端**收但忽略**（07-18 有意保留，让旧客户端
仍能登录）。这个可以留着不动。

唯一要改的是一句过时注释：[`local_cache_service.dart:21`](../../fyp_flutter/lib/services/local_cache_service.dart#L21)
写「sent as `device_id` in the login request for **multi-device session binding**」——
binding 已于 07-18 删除，注释该改成「签到审计用」。

###### 第三个：staff dashboard —— 不是死代码，是「活的但一直坏的」

**这条比前两条严重，因为它是个真 bug，不是清理项。**

[`staff_dashboard_screen.dart:105`](../../fyp_flutter/lib/screens/staff/staff_dashboard_screen.dart#L105)
调 `/attendance/active-sessions`，但**没有任何 router 用 `/attendance` 前缀**（实测 14 个
router 的 prefix 里没有）。正确的是 `/sessions/active`。

它有 **4 个调用者**，其中 [:60](../../fyp_flutter/lib/screens/staff/staff_dashboard_screen.dart#L60)
是一个 **10 秒轮询 Timer**：

```dart
_poller = Timer.periodic(const Duration(seconds: 10), (_) => fetchActiveSessions());
```

`myActiveSessions` 驱动两处 UI：

| 位置 | 用途 | 当前实际行为 |
|---|---|---|
| [:828](../../fyp_flutter/lib/screens/staff/staff_dashboard_screen.dart#L828) | `isAlreadyOpen` —— 判断这节课是否已开签到 | 恒 `false`，可能允许讲师重复点「开启签到」 |
| [:1023](../../fyp_flutter/lib/screens/staff/staff_dashboard_screen.dart#L1023) | `activeSessionsToShow` —— 显示进行中课堂 | 永远空白 |

因为打 404，`myActiveSessions` **永远是空数组**。讲师在 Flutter app 上的「进行中课堂」
一直是空的，而且每 10 秒发一次 404 请求。

而且同一段代码还有第二个 bug：

```dart
final staffSessions = data.where((s) => s['createdById'] == widget.staffId).toList();
```

`SessionResponse` 的字段是 `['id','course_id','opened_at','closed_at','is_open','class_group']`
—— **没有 `createdById`**。所以即使 URL 改对，这个过滤也会把所有行滤掉（每行
`s['createdById']` 都是 `null`）。

而 `/sessions/active` **已经在服务端按讲师过滤**（`f3dcba1` 修好的 owned-or-assigned
规则），客户端这层过滤本来就是多余的。

**修法：URL 改成 `/sessions/active`，删掉那行客户端过滤。** 两处都是「改对 A」。

> **注：** 这条是 §8 原「决策 #4」的替代。原来问的是「保留哪个重复端点」，
> 查完客户端后发现真正的问题不是端点重复，而是三个死调用 —— 而修法由四条原则直接
> 推出，不需要产品决策。

---

##### 4. ✅ 已修复 8/9（原 Nit）

> **9 条里 8 条已执行。** 第 5 条（统一 `verify_detail` / `flag_reason` / `risk_factors`）
> **按实测驳回** —— 三者不是同一概念，理由见 [§8.5](#85-执行中偏离文档的-3-处需确认)。

按用户要求 #4「命名要一秒能懂」审。

| 位置 | 问题 | 修法 | 性质 |
|---|---|---|---|
| [`students.py:141-143`](../../fyp-backend/routers/students.py#L141-L143) | `_require_student_profile` 是 `require_own_profile` 的 2 行空壳 wrapper，3 处调用，零额外逻辑 | 删掉，直接调 | 删除 |
| [`admin_reports.py:76`](../../fyp-backend/routers/admin_reports.py#L76)、[`:147`](../../fyp-backend/routers/admin_reports.py#L147) | 整句话传给了 `name` 参数而非 `detail=` → 错误消息变成 `"Feedback report not found not found"` | 改用 `detail=` | 改对。**用户可见** |
| [`auth.py:102`](../../fyp-backend/routers/auth.py#L102)、[`:191`](../../fyp-backend/routers/auth.py#L191) | 仍用 `datetime.utcnow()`，而 `utils/timeutil.py` 整个模块就是为替掉它而建（Python 3.12 起弃用；项目后来锁回 3.11，故不再是即时告警，但仍应统一口径）。07-18 N 项替换了 26 处，这 2 处是后来加回的 | 改用 `utils.timeutil.utcnow()` | 改对 |
| `sessions.py::get_active_student_sessions` ↔ `students.py::get_my_active_sessions` | 两端点做同一件事，名字不同，返回结构也不同 | 保留一个（07-29 P2 已列，需先查两端客户端） | 删除 |
| `verify_detail` / `flag_reason` / `risk_factors` | 三个名字表示同一概念：「给人看的原因说明」 | 统一命名 | 改对 |
| `_get_settings` / `_truthy`（[`sessions.py:32-45`](../../fyp-backend/routers/sessions.py#L32-L45)） | 私有函数在 `sessions.py`，读的却是 `admin_config.py` 管的 security settings；配置读取分散两处 | 移到 `utils/`，两边共用 | 改对 |
| [`session_sync.py:9-11`](../../fyp-backend/domain/session_sync.py#L9-L11) | `_is_syncing` / `_last_sync_time` 是模块级变量，多 worker 失效；跳过时静默无输出 | 当前单 uvicorn 进程成立。**加一行注释标明这个天花板和升级路径**，不现在换方案 | 文档化 |
| [`session_sync.py:157-159`](../../fyp-backend/domain/session_sync.py#L157-L159) | 149 行函数整体包在 `except Exception: print(...)`，自动开课/关课/标缺席失败只留一行 stdout | 至少区分「预期跳过」与「真失败」 | 改对 |
| [`models.py:214`](../../fyp-backend/db/models.py#L214) | 注释写 `# 128-d Face Embeddings`，实际是 ArcFace 512 维（[`students.py:37`](../../fyp-backend/routers/students.py#L37) 明确写 512） | 改成 512 | 改对 |

**归类小结（回答用户要求 #2）：** 本节 9 条 —— 3 条纯删除、5 条改对、1 条文档化。**零新增。**

---

##### 5. 已修复归档

保留于此以便追溯。每条都跑过验证，不是读代码推断。

###### 5.0 第四轮执行 —— §6.1 全部 12 步（2026-07-30）

**已提交并推送**（`e10bfeb` / `0c912bc` / `45da256`，三个提交按 gitignore → 后端 →
客户端拆分）。原 §2 / §3 / §4 的 25 条全部落地。执行方式：后端 11 步串行
（共用同一个 live DB 与同一条 migration 链），客户端 8a–8c 由两个 subagent 并行。

###### 5 个 Alembic migration（按落库顺序）

| revision | 内容 | 实测 |
|---|---|---|
| `71c97fdeebc7` | baseline：现有 schema 登记为版本 1 | 空 `upgrade()` + `stamp head`，零 DDL |
| `e1fd21d5715b` | 影子列 backfill + DROP 三列 | 三时代 `CASE` 分支落 **1400 / 493 / 100**，与 §2.1 预测完全一致；孤儿行 0 |
| `0f375205742a` | 恢复唯一约束 + 补 5 个缺失索引 | 加约束前重复 0；实测重复 insert 被 `IntegrityError` 拒绝 |
| `edb760bda0ab` | `class_meetings.class_group` 按组拆行 + CHECK | 4 → **6** 行；CHECK 双向验证会咬 |
| `42c198406814` | 删 `Course.schedule_*` 四列 + `planned_total_hours` backfill | 两门课都是 70.0 |

###### 逐步结果

| 步 | 关键实测 |
|---|---|
| **0** Alembic | `main.py` 从 99 行 DDL/seed 降到零 import 期副作用；seed 移到 `seed.py`（跑两次幂等，`security_settings` 7 行、`class_meetings` 不变）；`Procfile`/`Dockerfile` 改成 `alembic upgrade head && uvicorn` —— 迁移失败即阻止启动 |
| **1** 影子列 | 4 个 property 全删，ORM 零遮蔽。同一行 ORM 现在读到 `confidence_score=1.0`、`network_verified=True`、`marked_at` 与 session 同日；`distinct marked_at` 4 → **38**；对外 `wifi_verified` 由 Pydantic `AliasChoices` 保留，前端零改动 |
| **2** 约束 + 索引 | `uq_attendance_student_session` 落库；三张表索引补齐；`except IntegrityError` 从死代码变回真兜底 |
| **3** 组维度 | `meeting_key_for` 带组后缀，6 个 key 零碰撞；`get_course_group_slots` 按组匹配 —— **G1 只拿 G1 时段，跨组绕过消除**；讲师课表按组分行（Dr. Low 从 3 行变 6 行）；`slots[0]` 猜测逻辑全删，改由 `session_end_utc` 按开课星期几取时段 |
| **4** admin 校验 | 抽 `require_session_enrolment` 到 `domain/attendance.py`，讲师端 / admin 端 / 学生签到三处共用。实测：未选课 → 400、错组 → 400、正常 → 通过 |
| **5** 目录 | `git mv` 保留历史；`utils/` 1,393 → **183** 行；人脸函数移入 `integrations/face.py`，**router→router 依赖归零**；**77 处** import 机械替换（比预估 69 多 8 处 —— 漏算了测试文件、`alembic/env.py` 和 migration 内部） |
| **6** helper | `local_offset`（`ZoneInfo`）· `session_window_utc` / `session_end_utc` · `my_course_ids`（顺带修掉 §3.2 那处不一致）· `lecture_meetings` · `visible_announcements` / `announcement_dict`（新建 `domain/announcements.py`）· `get_settings` / `truthy`（新建 `domain/security_settings.py`） |
| **7** 死列 | 四列已删；先核对过 web 建课不发不读、Flutter 读的是 `class_meetings` 那条路径 |
| **8a–c** 客户端 | staff dashboard URL 改 `/sessions/active` + 删失效的 `createdById` 过滤；Flutter 两个零调用方法删除；web 删 2 方法 + 「Active Device Sessions」卡片（−173 行）；过时注释改对。**学生端 dashboard 零 diff，`device_id` 审计链路 5 处完好** |
| **9** 时钟 + N+1 | `now_utc` 提到循环外；`students.py` / `student_self.py` 的 per-course 查询批量化。实测出席率 **34 对 (student,course) 零差异** |
| **10** ETag | `NO_STORE_PREFIXES` 排除表；实测签到相关端点 `no-store` 无 ETag、其余仍 `max-age=30` + ETag |
| **11** Nit | 8 条完成（删空壳 wrapper、`detail=` 修错误消息、2 处 `datetime.utcnow` 归一、`128-d` 注释改 512、配置读取集中、多 worker 天花板文档化、`session_sync` 异常分两支、删零调用的 `GET /sessions/open`）；第 5 条驳回见 §8.5 |
| **§6.3** 测试 | 5 条回归测试补齐，`test_backend_fixes.py` 8 → **13** 个 check、13/13 通过、mutation-tested **6/6**。明细见 [§6.3](#63-重构前应补的测试) |

###### 验证覆盖

```
py_compile              全部 .py 绿
test_backend_fixes.py   13/13（8 个原有 + §6.3 补的 5 个），mutation-tested 6/6
跨角色 GET 冒烟          111 个（角色 × 路由）组合，0 个 5xx
出席率一致性             34 对 (student,course)，0 差异
约束生效性               重复 insert 被拒 / CHECK 双向被拒（显式事务 + ROLLBACK，非假 rollback）
数据完整性               attendance_records 1993 行零丢失
web                     tsc -b 干净
flutter                 flutter analyze 仅剩 1 条既有 assets 警告（pubspec.yaml 零 diff）
路由数                   86 → 85（删掉 1 个零调用死端点）
```

> **冒烟测试期间 `attendance_records` 1993 → 1995、`class_sessions` 46 → 47。**
> 是 `sync_class_sessions` 自动开课并标缺席，不是数据损坏 —— 新行 `status='absent'`、
> `verify_detail='System on ...'`、`liveness_passed` 为 NULL。其中一条是 **G2 场次**，
> 正是拆组后 G2 第一次拥有自己的时段。重复行仍为 0。

###### 顺带修掉的、本文未列的 2 个问题

| 位置 | 问题 |
|---|---|
| `/public/announcements` | 缺 `faculty` / `department`，而 Flutter 登录页读这两个字段 —— 一直是 null。改用共享 `announcement_dict` 后修掉 |
| `admin_config.py:100` | 读 `trust_proxy_header` 只认字符串 `"true"`，而签到路径的 `_truthy` 还认 `"1"`/`"yes"`/`"on"` —— 同一个开关两套口径。已统一到 `domain/security_settings.truthy` |

###### 5.1 2026-07-30 修复（commit `f3dcba1`，10 文件 +167/−112）

6 个运行时契约断裂，约 20 个端点原本无条件 500/422。**一个文件都没移动。**

| # | 问题 | 原表现 | 验证 |
|---|---|---|---|
| 1 | `54abaf4` 删掉 `FaceEmbedding.is_active` + `Alert.email_body/triggered_by/sent_at`，但 DB 有列、router 在用 | 4 个端点无条件 500（含人脸签到、首次人脸注册、讲师预警读写） | 恢复列声明；write-then-read 三字段全部持久化 |
| 2 | 13 个端点声明 `id: int`，实际是 UUID | FastAPI 在 handler 前 422 —— 全部 admin 编辑/删除失效 | 19 个 route/param 组合从 422 → 401（路由匹配、鉴权运行） |
| 3 | `c.id * 10 + 1` 合成 id | UUID 上 `*10` 产生 360 字符垃圾串（静默）；`*10+1` 抛 TypeError | 改用 `meeting_key`；先查过消费端（web 只当 React key，Flutter 不读） |
| 4 | `open_session`/`close_session` **零 ownership 校验** | 任何讲师可开关任何课 | 新增 `require_course_access` 服务 5 个 handler；跨讲师 4 操作全 403，owner/admin 200 |
| 5 | 出席率两套算法 | 同一学生 App 与 web 数字不同（实测 60.0 vs 62.7、90.0 vs 88.2） | `students.py` 改调共享 helper；15 对 (student,course) **0 差异** |
| 6 | `meeting_key` 存的是迁移前整数 id（`Lecture-8`） | 每个 `schedule_map.get()` 全部 miss → 课表空、签到窗口静默回落默认值 | 改为从外键**推导** `meeting_key`；4/4 命中 |
| 7 | `/students/me/attendance` `ORDER BY` 一个 `@property` | `'property' object has no attribute 'desc'` → 500 | 改 order by `timestamp`，返回 200 / 39 条 |
| 8 | `requirements.txt` 描述了一个跑不起来的环境（5 个 pin + 1 个包名错） | 干净机器 `pip install` 后 deepface import 失败 | 改为已验证组合；注明 scikit-learn 必须留 1.9.0（pkl 依赖） |

> **⚠️ 第 7 条留下了尾巴。** 当时「审计了另外三个 property 别名有无同样误用 —— 未发现」。
> 结论对（没有别的 `ORDER BY` property），但**漏了更严重的一层**：这四个 property 各自
> 都在遮蔽一个有数据的物理列。那就是 §2.1。

**当时的验证覆盖：** model/DB 列逐一比对 · 117 个 (GET route × role) 组合无 5xx ·
mutation testing 7/7 reverts 被抓到 · `py_compile` 全绿 · 测试数据已清理并确认行数恢复。

###### 5.2 2026-07-18 修复

| 项 | 内容 | 状态 |
|---|---|---|
| A | 签到缺 deepface 时静默跳过人脸验证 → 改 fail-loud 503，与注册端一致 | ✅ |
| C | 重复签到竞态 + 唯一约束 | ✅ 当时完成并验证 → **❌ 被 `54abaf4` 回归，见 §2.2** |
| D | 公告 staff_specific 过滤是空操作（`if`/`else` 都 append） | ✅ 改为 scope × role 三层定向 |
| E | 开一个组的 session 连带开所有组 | ✅ 改为只开请求的那组 |
| F | **讲师端**改考勤不校验选课/组 | ✅ 已加校验。**额外发现**：查看名单端点原本零授权，任何讲师可看任意班 —— 已补 |
| G | `open_session` 可能返回 None → 500 | ✅ 随 E 解决 |
| H | 建课不校验 FK，坏 id → 500 而非 400 | ✅ |
| I | 两套并行课表系统脱节 | ✅ 采用 Option A 混合版：新表 `class_meetings` 为唯一真相 + 自动排课 + 手动改课（含防撞校验） |
| J | 多个 GET 端点在写库 commit | ✅ 改为内存内判断 + 只读；持久化交给 `sync_class_sessions` |
| K | 学生端出席率与风控模型口径不一致 | ✅ 抽出 `domain/attendance.py` 单一真相源，98/98 一致 |
| L | 单设备锁可绕过 | ✅ 用户决定删掉锁，`device_id` 改为签到时记录（审计用） |
| M | `demo_simulate_network` 是活体检查绕过 | ✅ 用户决定不加 dev 门控，仅核实三态有效 |
| N | 小项批量（密码 min_length、email→EmailStr、role→enum、`utcnow` 统一 26 处等） | ✅ |
| S1 | 抽公共 helper → 新建 `utils/db_helpers.py`（`get_or_404` 27 处、`require_own_profile` 22 处、`ensure_unique` 14 处、`require_email_domain` 5 处） | ✅ |
| S3 | stale-close 块重复 | ✅ |
| S4 | create_staff/student 重复 | ✅ 只让**校验**走 helper，profile 创建保持显式（拒绝了原方案的错误抽象） |
| S5 | 死码清理 | ✅ 死码部分完成；内联 import 上提有意保留（pandas/joblib/deepface 是可选重依赖） |
| S6 | analytics 重复算特征 | ✅ recompute 98 行 0 差异 |
| B | ~~ML 模型加载失败静默退化~~ | ❌ **撤销** —— 复核 `ml_risk_predict_desc.md` §7 确认是故意的 fail-soft 设计 |
| S2 | 22 个 GET 手搓 dict → Pydantic response_model | ⏸️ **主动跳过** —— 需与 web+flutter 逐字段比对 JSON 契约，高风险低回报，要动需单独立项 |

###### 5.3 教训沉淀

| 事件 | 教训 |
|---|---|
| 07-18 加约束时 `DO $$` 只 catch `duplicate_object`，实际报 `duplicate_table` → 整个迁移大事务回滚，而 `except: print` 让 app 假装启动成功 | 手写迁移 + fail-silent = 你以为修好了其实没修。**这是上 Alembic 的直接理由** |
| 07-18 自查时误用「假 rollback」（delete_/update_ 端点内部自 commit），真删了 course 7 + 移动了 course 8 大课 | **破坏性操作绝不用假 rollback 验证** |
| `54abaf4` 一个 commit 造成 4 类严重缺陷，其中 1 类是回归已验证的修复 | 大范围 schema 改动必须有 migration + 测试把关，不能靠人眼 review |
| 07-29 审计把「结构」排第一，把 UUID/int 不匹配（最大 blast radius）排第四 | **先跑代码，再谈结构。** 未执行过的审计会系统性地误判严重度 |

---

##### 6. 执行路线

###### 6.1 顺序与理由

> **✅ 全部 12 步已于 2026-07-30 按此顺序执行完毕。** 实际执行顺序与本表一致
> （0 → 1 → 2 → 3 → 4 → 7 → 5 → 6 → 9 → 10 → 11，客户端 8a–8c 并行）。
> 逐步实测结果见 [§5.0](#50-第四轮执行--61-全部-12-步2026-07-30)。
>
> **一处顺序微调：** 步骤 6 的两个 helper（`local_offset`、`session_end_utc`）
> 提前到步骤 3 落地 —— 步骤 3 删掉 `slots[0]` 那套猜测后，5 处手抄的窗口计算
> 当场就需要替代实现，不能留到步骤 6。

用户已拍板的三项标注在下表「决定」列。

| # | 项目 | 性质 | 前置 | 决定 |
|---|---|---|---|---|
| **0** | **Alembic 接管 schema** —— 现有 schema 做成 baseline migration；`Procfile` 改成 `alembic upgrade head && uvicorn ...`；`main.py` 那 60 行手写 DDL 删除 | 新增基础设施 | — | ✅ **现在就上** |
| 1 | 影子列（§2.1）—— 按三时代 `CASE` 规则 backfill，drop 影子列，删 4 个 property | **删除** B 层 | 步骤 0 | ✅ 规则已定；**无需备份**（数据全为 demo） |
| 2 | 唯一约束（§2.2） | 恢复被 `54abaf4` 删的声明 | 步骤 0 | — |
| 3 | `class_meetings.class_group`（§2.3） | 补缺失维度 + 按组拆行 + 删 workaround | 步骤 0 | ✅ **加，Lecture 允许 NULL；Tutor/Practical 一组一行**（见下） |
| 4 | admin 覆盖校验（§2.4） | **删重复**（复用讲师端现成校验） | — | — |
| 5 | **目录结构调整（§3.0）** —— `domain/` `integrations/` `db/`，`utils/` 瘦身到 205 行 | **纯移动**，零新抽象 | 步骤 0–4 | ✅ **已批准** |
| 6 | helper 提取（§3.1–3.5） | **删重复**，净减约 200 行 | 步骤 3、5 | — |
| 7 | 死列删除（§3.6） | **纯删除** | 步骤 0 | — |
| 8a | **Flutter staff dashboard URL 修正**（§3.10 第三个）—— 改 `/sessions/active` + 删失效的 `createdById` 过滤 | 改对 | — | ⚠️ **真 bug，优先级高于其余清理**：讲师端「进行中课堂」一直空白 |
| 8b | DeviceSession 客户端残骸（§3.10 前两个）—— 删 web 2 方法 + UI 卡片、Flutter 2 方法 | **删除** | — | ✅ 已验证死代码 + 用户批准删功能 |
| 8c | `local_cache_service.dart:21` 过时注释（提「multi-device session binding」，该功能 07-18 已删） | 改对 | — | — |
| 9 | 循环内时钟 + N+1（§3.7） | 改对 | 步骤 6 | — |
| 10 | ETag 路由排除（§3.9） | **新增**（唯一一条） | — | — |
| 11 | Nit（§4） | 3 删 / 5 改对 / 1 文档化 | — | — |

**步骤 5 放在 1–4 之后**：先让 schema 和正确性落地，再搬文件。反过来会让 migration 的
diff 和文件移动的 diff 混在一起，出问题时无法二分定位。

###### 步骤 3 的设计约束（用户指定）

`class_meetings.class_group` **可为 NULL**，语义分两类：

- **Lecture 行 → `NULL`**，表示适用该课全部组。一个 course 的所有学生共用一个 Lecture 时间。
- **Tutor / Practical 行 → 必填具体组别**（`G1`/`G2`/…）。

配套要按这个区分处理，**不要把 Lecture 也强制要求填组**：

1. **`calculate_schedule` 的 key 逻辑** —— Lecture 仍用 `Lecture-<course_id>`（不带组），
   Tutor/Practical 的 key 需要带上组维度，否则 §2.3 的 `slots[0]` 歧义只是换了地方。
2. **防撞校验**（`update_timetable_slot`）—— Lecture 与任何组的 Tutor/Practical 都可能撞
   （同一批学生），所以 `class_group IS NULL` 要视为「与所有组重叠」，不能当成一个普通值比较。
3. **DB 约束** —— 建议加 CHECK：`role = 'Lecture'` 时 `class_group IS NULL`，
   `role IN ('Tutor','Practical')` 时 `class_group IS NOT NULL`。让数据库保证这个不变式，
   而不是靠每个写入点自觉（原则 #4：能让库做的不要在应用层 hardcode）。

###### 步骤 3 的回填：一个组一行（2026-07-30 追加，用户拍板）

**执行中发现的问题：** 组别来源写错了。`course_staff_assignments` **没有** `class_group`
列（[models.py:97-105](../../fyp-backend/db/models.py#L97-L105)），组别维度只存在于
[`enrolments.class_group`](../../fyp-backend/db/models.py#L131)。原 D3 的回填 SQL 引用了不存在的列。

同时暴露出更深的一层：现在每个 assignment 的 Tutor / Practical **各只有一行**
`class_meetings`，而一门课可能有多个组（实测 BMCS3413 有 G1 = 48 人、G2 = 2 人）。
一行无法同时表示两个组的时段 —— 加了列也填不出值。

**决定：按组拆行。** 每个 (assignment, class_group) 组合一行 `class_meetings`，用
`pick_slot_for_new` 给新增的行分配时段。

被否掉的两个替代方案，以及否掉的理由：

| 方案 | 为什么不行 |
|---|---|
| 只回填主组 G1，G2 留 NULL | 把「G2 没有时段」这个 demo 数据缺口固化成线上行为 —— G2 学生签到时静默跳过时间窗校验。原则 #2：这是加 fallback 补数据缺口，不是改对。 |
| 暂缓 CHECK 约束，先允许 NULL | 等于步骤 3 没做完。且 NULL 会同时表示「适用全部组」（Lecture）和「尚未指派」（Tutor/Practical），一列两种语义。 |

拆行后必须同步改的两处，**只加数据不改这两处等于没修**：

1. **`meeting_key_for`**（[scheduler.py:27-32](../../fyp-backend/domain/scheduler.py#L27-L32)）——
   Tutor/Practical 的 key 现在是 `f"{role}-{assignment_id}"`，拆行后同一个 assignment 有多行，
   key 会撞（`meeting_key` 有 UNIQUE 约束，且 `calculate_schedule` 用它当 dict 键 —— 撞了会
   静默丢时段）。改成带组：`f"{role}-{assignment_id}-{class_group}"`。Lecture 不变。
   `test_backend_fixes.py:95-97` 的三条断言要一起更新。
2. **`get_course_group_slots`**（§2.3）—— 按 `class_group` 匹配，Lecture 的 NULL 视为匹配全部组，
   并删掉 `slots[0]` 取第一个的写法。

**CHECK 约束的语义边界：** 约束要求的是「每一行 Tutor/Practical 都说明自己属于哪个组」，
**不是**「每个组都必须有时段」。某个组确实没有这门课的 Tutorial 是合法的 —— 不要为了凑约束
去造不存在的课。

###### 6.2 修法性质统计（回答用户「是不是加 B 补 A」）

全文 25 条未修复项：

| 性质 | 条数 | 说明 |
|---|---:|---|
| 删除 / 删重复 | 14 | 影子列 property 层、5 个 helper 提取、死列、空壳 wrapper、DeviceSession 客户端残骸 |
| 改对 A | 8 | schema 补维度、循环内时钟、索引对齐、Flutter URL、命名、`datetime.utcnow` |
| 纯移动（零抽象） | 1 | 目录结构（§3.0），18–51 处 import 机械替换 |
| 恢复被删的声明 | 1 | 唯一约束（§2.2，属回归修复） |
| **真新增** | **1** | ETag 路由排除表（§3.9） |
| 新增基础设施 | 1 | Alembic（步骤 0，为了让上面 24 条不再复发） |

**没有一条是「加 B 去补 A」。** 两个最典型的对照：

- §2.1 的正确修法是**删掉前人加的 B**（四个 `@property` 转发器），让 A 恢复正确 ——
  而不是在 B 之上再加一层兼容。
- §3.10 前两个死调用的修法是**删客户端代码**，而不是给后端补 stub 端点 ——
  补 stub 就是为了让废弃调用不报错而复活一个已删功能，正是「加 B 补 A」。

###### 6.3 重构前应补的测试

[`test_backend_fixes.py`](../../fyp-backend/test_backend_fixes.py) 已覆盖 schema 漂移、
UUID 契约、出席率一致性，且 mutation-tested（7/7）。**扩展它，不新建框架。**

按优先级补：

1. **窗口计算**（§3.1 提取前必须有）—— 当前 0 覆盖，却是重复最多的一块
2. **公告可见性**（§3.3 提取前必须有）—— 当前 0 覆盖
3. 重复签到被幂等拒绝（§2.2 修完后应该由约束保证）
4. admin 与讲师覆盖执行同一 enrolment 规则（§2.4）
5. 学生不能签别组的 session（§2.3 修完后）

07-29 列的 8 条最小测试里，1/5/7/8 已覆盖或已文档化，2/3/4/6 仍值得补 —— 且现在**真的
能写了**（当时几条会因为端点 500/422 而失败，原因与重构无关）。

###### ✅ 已完成（2026-07-30，5 条全部补上）

`test_backend_fixes.py` 从 8 个 `check_` 扩到 **13 个**，**13/13 通过**。不新建框架。

| # | 新增的 check | 断言什么 |
|---|---|---|
| 1 | `check_session_window` | 时段按**开课那天的星期几**取，不按列表顺序（正反两次传入结果相同）；同日双节取结束最晚的；无匹配时段回落 `+2h`；`local_offset()` 必须来自命名时区（断言 = 8h，不靠宿主时钟碰巧对） |
| 2 | `check_announcement_visibility` | role gate 对两种 viewer 各切一刀且都不挡 `all`；scope 只命中对应 programme/course；**代码比对大小写不敏感**（学生端曾两边 `.upper()`、讲师端只一边）；优先级 High 在前、无法识别的值不沉到 Low 之下；**draft 与发布窗口必须走 SQL**（断言 3 个 filter 参数到达 query）；`announcement_dict` 含 `faculty`/`department`/`publisher` |
| 3 | `check_duplicate_checkin_rejected` | 约束按名存在；重复 insert 被 `IntegrityError` 拒；**探针零泄漏**（前后行数相等）；全表 0 重复。用显式事务 + 原生 SQL + `ROLLBACK`，**不调会自 commit 的 endpoint**（§5.3 那次真删了 course 7 的教训） |
| 4 | `check_override_enrolment_rule` | 两个覆盖 handler 的源码都必须出现 `require_session_enrolment`（防再次各写一套）；未选课 → 400、错组 → 400、正常 → 通过；同一规则在学生路径上是 403 |
| 5 | `check_group_slots_isolated` | 每行 meeting 要么是 Lecture 且无组、要么有组；`calculate_schedule` 的 key 数 == 行数（**防 key 碰撞静默丢时段**）；每个组只拿到自己的 slot；**具体组不得混进 Lecture**（那会放宽签到窗口）；`All` 只拿 Lecture |

**mutation testing 6/6 全部被抓到** —— 逐个把修复改回原 bug，确认对应测试会失败：

```
CAUGHT  check_session_window            slot_on_day 退回 slots[0]（原 bug）
CAUGHT  check_group_slots_isolated      get_course_group_slots 不按组过滤（原 bug）
CAUGHT  check_announcement_visibility   role gate 移除
CAUGHT  check_override_enrolment_rule   group 校验移除
CAUGHT  check_override_enrolment_rule   enrolment 校验移除
CAUGHT  check_duplicate_checkin_rejected 唯一约束 DROP（事务内，已回滚复原）
```

> **写测试时抓到一次自己的错：** 第 4 条最初挑「在别的课上有 enrolment 的学生」当
> 「未选本课」样本 —— 但学生通常选多门课，那个人**同时也选了本课**，所以被接受是对的。
> 改成 `~Student.id.in_(本课 enrolment)` 才是真的 outsider。
> **样本选错会让测试假绿，也会让它假红。**

###### 补之前的实况（保留作记录）

本轮先做了提取、后补的测试。当时只**改了**两个已有 check 的断言，没有新增函数：

| 改动 | 内容 |
|---|---|
| `check_model_fields` | 原断言「`marked_at` 没有 `.desc()`」已反转，改为通用规则：**任何 `@property` 与 mapped column 同名即失败** + 四个对外字段必须是可排序的列 |
| `check_meeting_key_derived` | 三条断言按新 key 形状更新，并加一条「同 assignment 的两个组必须产生不同 key」 |

**5 条的实际验证方式是一次性脚本，不是留存的测试**（脚本已丢弃）：

| # | 当时怎么验的 | 结果 |
|---|---|---|
| 1 窗口计算 | 打印 `calculate_schedule` 的 6 个 key + 三个组各自的 slots | 无碰撞、按组正确 |
| 2 公告可见性 | 临时插一条公告，比对 student / staff / public 三端点的 key 集合 | 三者一致，探针已删 |
| 3 重复签到 | 显式事务内 raw SQL 重复 insert + ROLLBACK | 被 `IntegrityError` 拒绝 |
| 4 admin vs 讲师同规则 | 直接调 `require_session_enrolment` 三种输入 | 未选课 400 / 错组 400 / 正常通过 |
| 5 跨组签到 | `get_course_group_slots` 对 All / G1 / G2 | G1 只拿 G1 时段 |

**为什么那样不够（Rule 9）：** 跑过一次不等于留下了「业务逻辑改坏时会失败」的测试。
脚本删了就没了，下次有人改坏没人会知道。第 1、2 条尤其要紧 —— 文档写的是
「提取前**必须有**」，因为那两处提取（`session_end_utc`、`visible_announcements`）
动的正是重复最多、且当时 0 覆盖的逻辑。

**这 5 条已于同日补齐（见上一小节），现在由 13 个 check 覆盖，mutation-tested 6/6。**

---

##### 7. 做得好的部分

不是客套 —— 重构时不要弄坏这些：

- [`utils/db_helpers.py`](../../fyp-backend/utils/db_helpers.py) /
  [`domain/attendance.py`](../../fyp-backend/domain/attendance.py) /
  [`utils/timeutil.py`](../../fyp-backend/utils/timeutil.py) —— **正确尺寸**的 helper：
  没有单实现的抽象，注释写「为什么」而非「做什么」。`attendance.py` 顶部把出席率政策写成
  可执行的契约说明，是本仓库文档质量最高的一段。
- [`scheduler.py:35-50`](../../fyp-backend/domain/scheduler.py#L35-L50) `calculate_schedule`
  从外键**推导** `meeting_key` 而不是读存储列 —— 这个决定让「存储列漂移」不会再复发，
  正是 §2.1 / §3.8 那类问题的正确解法示范。
- `require_course_access`（[`sessions.py:48-66`](../../fyp-backend/routers/sessions.py#L48-L66)）
  一个函数管住 5 个 handler 的授权规则，注释说明了不这么做的后果。
- [`llm.py`](../../fyp-backend/routers/llm.py) `validate_sql` + `postgresql_readonly=True`
  双层防御 + `_MAX_ROWS` 硬上限。LLM 生成 SQL 这条路径纵深防御做对了。
- [`test_backend_fixes.py`](../../fyp-backend/test_backend_fixes.py) mutation-tested
  （7/7 reverts 被抓到），DB 相关检查无库时自动 skip。不是「改什么都绿」的测试。
- [`lecturers.py:38-43`](../../fyp-backend/routers/lecturers.py#L38-L43) 已用 `GROUP BY`
  批量算 enrol count。
- [`security.py:20-24`](../../fyp-backend/utils/security.py#L20-L24) `JWT_SECRET_KEY` 缺失
  直接 `RuntimeError`，不回落默认值 —— fail loud 做对了。
- [`network_verify.py`](../../fyp-backend/integrations/network_verify.py) 顶部把「哪一层不可伪造、
  哪一层只是佐证」讲清楚了。安全模块最需要这个。
- 07-18 / 07-29 两轮修复中，多次**拒绝了审计提出的错误抽象**（S4 参数化 `_create_account`、
  `services/session_window_service` 五函数版）—— 判断力比执行力更值得保留。

---

##### 8. 决策记录（已全部拍板）

###### 8.1 已拍板（2026-07-30）

| # | 问题 | 决定 |
|---|---|---|
| 1 | 是否先上 Alembic？ | ✅ **要，现在就上。** 先把现有 schema 做成 baseline migration；`Procfile` 改成先 `alembic upgrade head` 再启动 uvicorn |
| 2 | `marked_at` vs `timestamp` 哪个是真相？ | ✅ **深查完成 —— 两个都不是。** 真相按行分三个时代，backfill 用 `CASE`，见 [§2.1](#时间列的真相分布不是哪一列对是按行分三个时代) |
| 3 | `class_meetings` 的 group 维度怎么补？ | ✅ **加 `class_group` 列，Lecture 行允许 NULL**（NULL = 适用全部组）。仅 Tutor/Practical 必填。防撞校验与 `calculate_schedule` 的 key 逻辑都要按此区分，见 [§6.1](#步骤-3-的设计约束用户指定) |
| 4 | 客户端死调用怎么处理？ | ✅ **由四条原则直接推出，无需拍板。** 两个 DeviceSession 残骸 → 删客户端代码；一个 URL 写错 → 改对并删失效过滤。见 [§3.10](#310-三个客户端死调用web--flutter-都在调不存在的端点) |
| 5 | 要不要改 folder / file 结构？ | ✅ **已批准。** `domain/` `integrations/` `db/`，`utils/` 瘦身到 205 行。纯移动零新抽象，见 [§3.0](#30-目标结构企业级但不过度分层) |
| 6 | 索引现在补还是等数据量上来？ | ✅ **随步骤 0 一起补。** Alembic autogenerate 本来就会检测出 model 已声明但 DB 缺失的索引，单独推迟反而要写例外 |
| 7 | `planned_total_hours` 空值怎么办？ | ✅ **backfill。** 2 门课里 1 门为空，风险模型 Layer 0/1 依赖它 |

###### 8.2 已拍板（补充，2026-07-30 第二批）

| # | 问题 | 决定 |
|---|---|---|
| 8 | 影子列 migration 前要备份吗？ | ✅ **不需要。** 用户确认：「我现在的数据都是假的，全是 demo 随机做出来的」。因此 backfill 可直接执行，无需先导出确认。**三时代 `CASE` 规则仍照做** —— 它同时是数据修复，能让 1400 行 seed 行的时间戳与 `class_sessions` 自洽 |
| 9 | 删「Active Device Sessions」UI？ | ✅ **删。** 用户确认：「设备锁这个功能我是不需要了」。**但要求先严格验证是死代码** —— 验证已完成，见下表 |

###### 8.3 已拍板（执行期追加，2026-07-30 第三批）

| # | 问题 | 决定 |
|---|---|---|
| 10 | 一门课有多个组，但 Tutor/Practical 只有一行 `class_meetings`，`class_group` 填不出值，怎么办？ | ✅ **按组拆行**：每个 (assignment, class_group) 一行，`pick_slot_for_new` 给新行分配时段。同步改 `meeting_key_for`（加组后缀）和 `get_course_group_slots`。否掉了「只回填 G1」（等于给 G2 加静默 fallback，违反原则 #2）和「暂缓 CHECK」（一列两种语义）。详见 [§6.1](#步骤-3-的回填一个组一行2026-07-30-追加用户拍板) 与 [D3](#d3-步骤-3class_meetingsclass_group) |

###### 死代码验证结果（用户要求「得确保！是死代码」）

| 目标 | 验证方式 | 结论 |
|---|---|---|
| `user_service.dart` 的 `fetchActiveSessions` / `logoutSession` | grep `UserService.fetchActiveSessions` / `UserService.logoutSession` 全仓 | **零调用者 → 真死代码，安全删** |
| web `getUserActiveSessions` / `logoutSession` | grep 调用点 | 各 1 个调用者（`UserProfileModal`），端点 404 |
| web「Active Device Sessions」卡片 | 读 `loadSessions` 的 catch 分支 | **⚠️ 不是死代码。** 有前端兜底合成一行当前设备，用户看得见。删它属「删功能」，已获用户批准 |
| `device_id`（签到审计） | grep 后端 + Flutter 全链路 | **✅ 活的，5 处在用 → 绝对不动**（07-18 有意保留） |
| `staff_dashboard_screen.dart` 的 `fetchActiveSessions` | grep 调用者 + 追 `myActiveSessions` 消费点 | **⚠️ 不是死代码。** 4 个调用者含 10s 轮询，驱动 2 处 UI。是真 bug → 改 URL，不是删 |
| `student_dashboard_screen.dart` 的 `fetchActiveSessions`（同名） | 核对 URL | **打的是活端点，6 个调用者 → 别动** |

**结论：三个同名方法里只有 1 个能删，1 个要改 URL，1 个完全不能碰。**
按名字批量删会破坏学生端 dashboard。

###### 8.4 已排除的旧决策点

| 旧问题 | 为什么不再是决策 |
|---|---|
| 「重复端点 `/sessions/open` vs `/students/me/active-sessions` 保留哪个？」 | 查完客户端后发现两者服务不同角色（讲师开课 vs 学生看可签到课程），**不是重复**。真正的问题是三个死调用，见 §3.10 |

> **执行期补充：** `POST /sessions/open`（讲师开课）确实活着且不可动。但同路径的
> **`GET /sessions/open`** 是另一回事 —— 它和 `/students/me/active-sessions` 回答同一个
> 问题、返回不同结构，全仓 grep 确认**零调用者**，已删除。别把同路径的两个方法混为一谈。

###### 8.5 执行中偏离文档的 3 处（需确认）

执行时发现文档自相矛盾或与实测不符的 3 处。已按「取更晚更具体的那份」+「实测优先」
处理，**但需要你追认**。

###### ① `liveness_passed` 保留为独立物理列（未按 §2.1 表格删列）

**文档内部矛盾：** [§2.1 修法表](#修法已按用户要求-2-修正)写「确实该是推导值，不该是列 ——
物理列 backfill 进 `liveness_suspicious` 后 `DROP`」；但同节
[附带发现](#-附带发现liveness_passed-与-liveness_suspicious-在签到时互相覆盖)
和 [附录 D2 的 models.py 块](#d2-步骤-1影子列-migration)都写它保留为独立列
（`liveness_passed = Column(Boolean, nullable=True)  # 独立列，不再是 not suspicious`）。

**取后者。** 理由：这两个是**两个独立信号** —— 「客户端上报的活体结果」与
「手势快于下限」。把它们塌成一列正是 §2.1 主结论描述的缺陷，也正是
`sessions.py:466`/`:475` 互相覆盖那个 bug 的成因。

**连带：不执行附录 D2 的第 ③ 步**（`liveness_suspicious = NOT liveness_passed`）——
那会把 640 行 `lp=false` 的**缺席**行标成「行为可疑」，而 §2.1 自己论证过
「0 行携带真正的行为生物特征 flag」。改为把 `liveness_suspicious` 全部重置 false，
真实信号只留在 `liveness_passed`。

实测结果：`liveness_passed` 为真 1153 行，`liveness_suspicious` 为真 **0** 行。

###### ② Nit 第 5 条（统一三个命名）驳回

[§4](#4--已修复-89原-nit) 写「`verify_detail` / `flag_reason` / `risk_factors`
三个名字表示同一概念：给人看的原因说明 → 统一命名」。**实测不成立：**

```
verify_detail  → 全是 'System on Wed 15/07/26 11:00PM'   ← 这条记录怎么产生的
flag_reason    → 当前全空                                  ← 为何被标记
risk_factors   → 'Cannot reach 80% (best case 68%)'        ← 风险分数的依据
```

三者是三件事，而且 `verify_detail` 与 `flag_reason` **同在 `attendance_records` 表上**，
物理上无法共用一个名字。改名会把三个独立信号塌成一个 —— 与 §2.1 同类错误。**未改动。**

###### ③ 附录 D2 的验证目标 `network_verified = 1153` 算错了，实际 1154

[附录 A2](#a2-影子列21) 自己记的是两个**不相交**集合：
「`wifi_verified=true` 而 `network_verified≠true`：1153 行」+「`network_verified` 为真：1 行」。
backfill 取并集 → **1154**。migration 只做并集、未覆盖任何已有真值，结果正确。

---

##### 附录 A — 验证记录

所有查询针对 live Supabase 执行（`fyp-backend/.venv`）。

###### A1 规模基线

```
students 55 | courses 2 | enrolments 100
class_sessions 46 | attendance_records 1993
class_meetings: Lecture 2, Tutor 1, Practical 1
Python 5,825 行 | 78 路由 | 14 router | 1 测试文件
```

###### A2 影子列（§2.1）

```sql
select count(*) from attendance_records where marked_at is distinct from timestamp;
-- 1993   (= 全表)
```

```
marked_at   非空 1993 | 16 个不同值 | 2026-07-10 07:48 → 2026-07-29 15:59
timestamp   非空 1993 |  4 个不同值 | 2026-07-26 13:35 → 2026-07-29 15:00
            └ 1793 行塌在 2026-07-26 13:35:16.257994

confidence_score 非空 1154  |  confidence          非空 0
wifi_verified    为真 1153  |  network_verified     为真 1
liveness_passed  为真 1153  |  liveness_suspicious  为真 200

confidence_score 有值而 confidence 为 NULL：1154 行
wifi_verified=true 而 network_verified≠true：1153 行
```

同一 `present` 行，ORM vs 直接 SQL：

```
ORM :  confidence_score=None  wifi_verified=False  marked_at=2026-07-26 13:35:16
SQL :  confidence_score=1.0   wifi_verified=True   marked_at=2026-07-10 07:48:11
```

列定义：

```
col                  | nullable | default
confidence           | YES      | None
confidence_score     | YES      | None
liveness_passed      | YES      | None
liveness_suspicious  | YES      | false
marked_at            | YES      | now()
network_verified     | YES      | false
timestamp            | YES      | now()
wifi_verified        | YES      | None
```

###### A3 唯一约束（§2.2）

```
attendance_records_pkey             | PRIMARY KEY (id)
attendance_records_session_id_fkey  | FOREIGN KEY (session_id) → class_sessions(id) ON DELETE CASCADE
attendance_records_student_id_fkey  | FOREIGN KEY (student_id) → students(id) ON DELETE CASCADE
```

无 `(student_id, session_id)` 唯一约束。当前重复行：**0**。
`grep -c "ADD CONSTRAINT\|uq_attendance" fyp-backend/main.py` → **0**。

###### A4 Tutor / Practical 并存（§2.3）

```sql
select count(*) from (
  select course_id from course_staff_assignments
  where role in ('Tutor','Practical') group by 1 having count(distinct role) > 1
) t;
-- 1
```

###### A5 重复统计（§3.1–3.4）

```
tz_offset = local_now - utc_now                      6 处
schedule_map.get(f"Lecture-...")                     9 处
calculate_schedule(db)                               9 处
get_course_group_slots                               定义 1，调用 2（同文件另有 3 段手抄）
sync_class_sessions(db)                              被 7 个 GET handler 调用
(Course.lecturer_id == …) | (Course.id.in_(…))        5 处 + require_course_access 内联 1
assigned_course_ids 构建                             6 处
priority_weight = {'High': 3, …}                     2 处
announcement 17 键返回 dict                          3 处（含 main.py）
lecture_by_course map                                4 处
```

###### A5b 时间列三时代判据（§2.1）

```sql
select
  count(*) filter (where date(a.marked_at)=date(s.opened_at) and date(a.timestamp)<>date(s.opened_at)) as only_marked_at,
  count(*) filter (where date(a.timestamp)=date(s.opened_at) and date(a.marked_at)<>date(s.opened_at)) as only_timestamp,
  count(*) filter (where date(a.marked_at)=date(s.opened_at) and date(a.timestamp)=date(s.opened_at)) as both,
  count(*) filter (where date(a.marked_at)<>date(s.opened_at) and date(a.timestamp)<>date(s.opened_at)) as neither,
  count(*) as total
from attendance_records a join class_sessions s on a.session_id=s.id
where s.opened_at is not null;
```

```
only_marked_at 443 | only_timestamp 100 | both 50 | neither 1400 | total 1993
孤儿行（无 session 或 opened_at 为空）: 0
```

两列都落在父 session 的 `[opened_at, closed_at]` 窗口内的行数：**均为 0**
（`marked_at` 平均偏离 opened_at 约 102 天，`timestamp` 约 114 天）—— 因为 1400 行
seed 数据的 session 日期被回填到 2/3 月，而出席行没跟着改。

###### A5c 目录成分与移动成本（§3.0）

```
utils/ 共 1,393 行
  真 utility  : security 94 + db_helpers 57 + database 37 + timeutil 17          =   205
  非 utility  : models 346 + schemas 287 + network_verify 175 + session_sync 162
                + scheduler 133 + attendance 51 + audit 34                       = 1,188

import 站点数（不含模块自身）
  session_sync 4 | attendance 4 | scheduler 8 | network_verify 1 | audit 1   → 18
  models 24 | database 19 | schemas 8                                        → 51
```

###### A5d 客户端死调用（§3.10）

用 live app 路由表验证：

```python
from main import app
paths = {r.path for r in app.routes}
```

```
404  /auth/active-sessions
404  /auth/logout-session
404  /attendance/active-sessions
OK   /students/me/active-sessions
OK   /sessions/active
OK   /sessions/open
OK   /sessions/my-courses
OK   /api/v1/system/languages
```

14 个 router 的 prefix 里**没有** `/attendance`：

```
/admin (×5) · /admin/audit · /admin/reports · /analytics · /auth
/lecturers · /query · /sessions · /students · /students/me
```

`SessionResponse` 实际字段（Flutter 过滤用的 `createdById` 不在其中）：

```
['id', 'course_id', 'opened_at', 'closed_at', 'is_open', 'class_group']
```

`DeviceSession` 后端残留：仅 `main.py:56` 的 `DROP TABLE IF EXISTS device_sessions;`
—— 模型与端点已于 07-18 全部移除。

###### A6 根因 commit `54abaf4`

```
$ git log --oneline -S "uq_attendance_student_session"
54abaf4 Fix Supabase ID Column to UUID          ← 删除
691dce9 feat: enforce face verification, dedupe attendance, ...  ← 引入

$ git show 54abaf4 -- fyp-backend/db/models.py
-    confidence_score = Column(Float)
-    wifi_verified    = Column(Boolean, default=False)
-    liveness_passed  = Column(Boolean, default=False)
-    marked_at        = Column(DateTime, server_default=func.now())
-    network_verified     = Column(Boolean, default=False)
-    liveness_challenge_ms = Column(Integer, nullable=True)
-    liveness_suspicious   = Column(Boolean, default=False)
+    timestamp              = Column(DateTime, server_default=func.now())
+    confidence             = Column(Float, nullable=True)
+    liveness_challenge_ms  = Column(Integer, nullable=True)
+    liveness_suspicious    = Column(Boolean, default=False)
-        UniqueConstraint("student_id", "session_id", name="uq_attendance_student_session"),
```

四个 `@property` 别名由后续 commit `1582c21` 加入（作为兼容层）。

###### A7 死代码（§3.6、§3.8）

```
grep -rn "body.schedule_" --include="*.py" .      → 0 命中
courses.schedule_day 非空                          → 1 / 2（迁移前残留）
courses.planned_total_hours 为空                   → 1 / 2（风险模型依赖）
models.py:4 import Index, UniqueConstraint          → 文件内 0 处使用
```

###### A8 索引实况（§3.8）

```
attendance_records : ['attendance_records_pkey']
class_sessions     : ['class_sessions_pkey']
enrolments         : ['enrolments_pkey']
face_embeddings    : ['face_embeddings_pkey']
students           : ['students_student_code_key', 'students_pkey', 'students_student_code_idx']
class_meetings     : ['ix_class_meetings_meeting_key', 'class_meetings_pkey']
```

###### A9 部署上下文

- `Dockerfile` / `fyp-backend/Dockerfile`：`python:3.11-slim`（tensorflow 2.14 无 cp312 wheel，硬约束），`alembic upgrade head && uvicorn main:app`（单进程，无 `--workers`）
- `Procfile`：`web: alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`（同样单进程）
- **任何位置均未设置 `TZ`** —— §3.1 的 `tz_offset` 依赖容器本地时区，本地（Windows UTC+8）
  与容器（默认 UTC）行为不同
- `nginx.conf` 只服务前端静态资源，不代理 API → `trust_proxy_header` 默认 `false` 是对的

**执行后（2026-07-30）：**

- `Procfile` / `Dockerfile` 均已改为 `alembic upgrade head && uvicorn ...`，
  单进程不变（`session_sync` 的模块级节流仍成立，见 §4 那条已文档化的天花板）
- `TZ` 仍未设置，但**不再依赖它** —— `utils/timeutil.local_offset()` 用
  `ZoneInfo("Asia/Kuala_Lumpur")` 显式命名时区（用户要求 #4）
- **venv 是 uv 建的，没有 pip。** 装包必须
  `VIRTUAL_ENV=.venv uv pip install "pkg==x.y.z"`；`python -m pip` 会报 `No module named pip`
- **驱动是 psycopg v3。** `db/database.py` 把 `postgresql://` 重写成
  `postgresql+psycopg://`。`alembic/env.py` 复用了它的 engine，没有自己拼 URL ——
  否则 `ModuleNotFoundError: psycopg2`

---

##### 附录 D — 执行细则（给动手的人）

> **✅ 已按本附录执行完毕（2026-07-30）。** 内容保留作为执行记录。
> **执行中被证伪的 3 处，已在原位标注 ⛔：**
>
> | 位置 | 文档写的 | 实际 |
> |---|---|---|
> | D3 回填 SQL | 从 `course_staff_assignments.class_group` 取组 | **那一列不存在**。组别在 `enrolments.class_group`。已改为按组拆行，见 [§6.1](#步骤-3-的回填一个组一行2026-07-30-追加用户拍板) |
> | D2 验证项 | `network_verified` 应为 1153 | **1154**（附录 A2 的两个集合不相交，并集是 1154）。见 [§8.5 ③](#85-执行中偏离文档的-3-处需确认) |
> | D2 第 ③ 步 | `liveness_suspicious = NOT liveness_passed` | **未执行** —— 会把 640 行缺席行标成「行为可疑」。见 [§8.5 ①](#85-执行中偏离文档的-3-处需确认) |
>
> D4 的 import 对照表实测是 **77 处**（不是 69）—— 漏算了 `test_backend_fixes.py`、
> `alembic/env.py` 和 migration 文件内部的 import。

本附录是为了让执行者**不必重新查数据库**。所有数字与路径均已实测。

###### D1 步骤 0：Alembic baseline

**现状（实测）：**

```
alembic 已安装？      否（ModuleNotFoundError；requirements.txt 中也没有）
alembic/ 或 alembic.ini 存在？   否
alembic_version 表存在？        否
现有表（18 张）：alerts announcements attendance_records audit_logs campus_networks
  class_meetings class_sessions course_staff_assignments courses enrolments
  face_embeddings lecturers programmes risk_scores security_settings
  student_feedback students users
```

###### ⚠️ 不要直接 `alembic revision --autogenerate` 做 baseline

原因：**现有 DB 与 `models.py` 本来就不一致**，autogenerate 出来的第一个 migration 会把
「想要的修复」和「不想要的东西」混在一起：

| autogenerate 会检测到 | 是否想要 |
|---|---|
| `attendance_records` 缺 3 个索引、`class_sessions` / `enrolments` 缺索引（§3.8） | ✅ 想要 |
| 缺 `(student_id, session_id)` 唯一约束（§2.2） | ✅ 想要 —— 但 model 里已被 `54abaf4` 删掉声明，得先加回 model 才会被检测到 |
| 四个影子列（§2.1） | ❌ **不想要** —— autogenerate 只看到「DB 有 4 个 model 没声明的列」，会生成 `DROP COLUMN`，**在 backfill 之前就把数据删掉** |
| `Course.schedule_*` 四列（§3.6） | 视顺序而定 —— 若 model 已删则生成 `DROP`，那正是步骤 7 想要的 |

**正确顺序：**

```bash
# 1. 装 alembic，写进 requirements（用户要求 #4：pin 住版本）
# ⛔ 实际执行时：venv 是 uv 建的，没有 pip。必须用：
#    VIRTUAL_ENV=.venv uv pip install "alembic==1.13.2"
pip install "alembic==1.13.2"        # 写入 requirements.txt

# 2. 初始化
alembic init alembic

# 3. 配置：env.py 里指向 models 的 Base，url 从环境变量读
#    target_metadata = Base.metadata
#    config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
#    ⚠️ 不要把 DATABASE_URL 写进 alembic.ini（会进 git）

# 4. 空 baseline —— 只登记「当前 DB 就是起点」，不生成任何 DDL
alembic revision -m "baseline: existing schema as of 2026-07-30"
#    手工确认生成的文件里 upgrade()/downgrade() 都是 pass
alembic stamp head

# 5. 之后每一步修复各自一个 migration（见 D2 / D3）
```

**`stamp head` 是关键** —— 它写入 `alembic_version` 表但不执行 DDL，等于宣告
「现有 schema 是版本 1」。这样后续 migration 只需要描述**增量**，不必重述 18 张表。

###### `main.py` 要删的内容（实测 99 行里的 1-99）

| 行 | 内容 | 处置 |
|---|---|---|
| 13 | `Base.metadata.create_all(bind=engine)` | **删** —— 由 Alembic 负责建表 |
| 16-82 | 整个 `try: with engine.begin() ... except: print(warning)` 块 | **删** —— 其中 26 条 `ADD COLUMN IF NOT EXISTS` 已全部反映在现有 DB 里，baseline 之后不再需要 |
| 56 | `DROP TABLE IF EXISTS device_sessions;` | **删** —— 表已不存在（实测 18 张表里没有它），每次启动重复执行无意义 |
| 64-79 | security_settings 默认值 seed | **移出** → 一个显式的 `seed.py` 或 Alembic data migration。5 个键：`network_check_enabled` `fail_closed` `trust_proxy_header` `demo_simulate_network` `demo_simulated_ip=10.52.13.77` |
| 85-99 | `_seed_class_meetings()` 及其调用 | **移出** → 同上。import 期跑 seed 是 07-29 P4 指出的问题 |

删完后 `main.py` 只剩：建 FastAPI app、CORS、ETag 中间件、注册 14 个 router。

**Procfile / Dockerfile（用户已指定）：**

```
web: alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT
```

Dockerfile 的 `CMD` 同样改。**这样 migration 失败会阻止启动** —— 正是 07-18 那次事故
（`except: print` 让 app 假装启动成功）需要的行为。

###### D2 步骤 1：影子列 migration

**顺序很重要 —— backfill 必须在 DROP 之前，且 model 改动在最后。**

```sql
-- ① marked_at：三时代 CASE（1400 / 493 / 100 行）
UPDATE attendance_records a
SET    marked_at = CASE
         WHEN date(a.marked_at) = date(s.opened_at) THEN a.marked_at
         WHEN date(a.timestamp) = date(s.opened_at) THEN a.timestamp
         ELSE s.opened_at
       END
FROM   class_sessions s
WHERE  a.session_id = s.id;

-- ② network_verified ← wifi_verified（1153 行）
UPDATE attendance_records
SET    network_verified = COALESCE(wifi_verified, FALSE)
WHERE  wifi_verified IS TRUE;

-- ⛔ ③ 未执行（见 §8.5 ①）。liveness_passed 保留为独立列，两者不再互为反义，
--    所以「NOT liveness_passed」会把 640 行 lp=false 的缺席行标成「行为可疑」。
--    实际执行的是：全表重置，真实信号只留在 liveness_passed。
UPDATE attendance_records SET liveness_suspicious = FALSE;
--
-- 原文档写的（不要照抄）：
--   UPDATE attendance_records SET liveness_suspicious = NOT liveness_passed
--   WHERE  liveness_passed IS NOT NULL;
--   UPDATE attendance_records SET liveness_suspicious = FALSE
--   WHERE  liveness_passed IS NULL AND status = 'absent';

-- ④ confidence_score：无需 backfill（confidence 全 NULL，无数据可迁）

-- ⑤ 确认无误后再 DROP
ALTER TABLE attendance_records
  DROP COLUMN timestamp,
  DROP COLUMN confidence,
  DROP COLUMN wifi_verified;
  -- ⛔ liveness_passed 未 DROP：它保留为独立物理列（见 §8.5 ①）。
  --    实际只删了 3 列，不是 4 列。
```

> **无需备份** —— 用户已确认数据全为 demo 随机生成（§8.2 决策 8）。

**配套的 `models.py` 改动（在 migration 之后）：**

```python
# 删掉 §2.1 引用的 4 个 @property + 4 个 setter（models.py:180-212，共 33 行）
# 恢复为真实 Column：
marked_at            = Column(DateTime, server_default=func.now())
confidence_score     = Column(Float, nullable=True)
network_verified     = Column(Boolean, default=False)   # 名字保留（语义比 wifi_ 准）
liveness_suspicious  = Column(Boolean, default=False)
liveness_passed      = Column(Boolean, nullable=True)   # 独立列，不再是 not suspicious
```

**配套的调用点改动：**

| 位置 | 改动 |
|---|---|
| [`students.py:378`](../../fyp-backend/routers/students.py#L378) | `order_by(AttendanceRecord.timestamp)` → `.marked_at`（`f3dcba1` 当时改成 timestamp 是权宜之计） |
| [`sessions.py:466`+`:475`](../../fyp-backend/routers/sessions.py#L466) | **修覆盖 bug**：两者现在是独立列，各写各的，不再互相覆盖 |
| [`llm.py:32`](../../fyp-backend/routers/llm.py#L32) | LLM 的 schema 提示词列的正是 `confidence_score, wifi_verified, liveness_passed, marked_at` —— `wifi_verified` 要改成 `network_verified` |
| `schemas.py` | 若要保留对外字段名 `wifi_verified`，用 Pydantic `alias` / `computed_field`，**不要**在 ORM 加 property（原则 #2） |

**验证（migration 后必跑）：**

```sql
-- 应为 0：不再有列与 session 日期不符（除 seed 行已被改为 opened_at 本身）
SELECT count(*) FROM attendance_records a JOIN class_sessions s ON a.session_id=s.id
WHERE date(a.marked_at) <> date(s.opened_at);
-- 应为 1153
SELECT count(*) FROM attendance_records WHERE network_verified IS TRUE;
-- 应为 4：影子列已消失
SELECT count(*) FROM information_schema.columns
WHERE table_name='attendance_records'
  AND column_name IN ('timestamp','confidence','wifi_verified','liveness_passed');  -- 期望 1（只剩 liveness_passed）
```

###### D3 步骤 3：`class_meetings.class_group`

```sql
ALTER TABLE class_meetings ADD COLUMN class_group VARCHAR;   -- 可为 NULL

-- 让数据库保证不变式（原则 #4：能让库做的不在应用层 hardcode）
ALTER TABLE class_meetings ADD CONSTRAINT ck_class_meetings_group CHECK (
  (role = 'Lecture'                 AND class_group IS NULL) OR
  (role IN ('Tutor','Practical')    AND class_group IS NOT NULL)
);
```

**回填不是一条 UPDATE，是拆行。** 组别来源是 `enrolments.class_group`（不是
`course_staff_assignments` —— 那张表没有这一列）。Lecture 行保持 NULL，不动。

```sql
-- 每门课实际有哪些组（回填的依据）
SELECT course_id, class_group, count(*) AS students
FROM   enrolments GROUP BY 1, 2 ORDER BY 1, 2;
```

拆行用 Python 做，不用 SQL —— 新增的行需要 `pick_slot_for_new` 分配不撞的时段，
这是应用层逻辑：

1. 对每个 Tutor/Practical 的 `class_meetings` 行，查出它 `course_id` 下的组列表。
2. 第一个组：原地 `UPDATE`，写 `class_group`，时段不变（保留已有分配）。
3. 其余每个组：`INSERT` 一行，`pick_slot_for_new` 给时段，`meeting_key` 带组后缀。
4. 组列表为空的课（没人选）：该行保持无组 —— 会违反 CHECK，所以**先删这些孤儿行**，
   或确认 demo 数据里不存在。加约束前用下面这条查。

```sql
-- 加 CHECK 前必须为 0：拆行后仍无组的 Tutor/Practical 行
SELECT count(*) FROM class_meetings
WHERE role IN ('Tutor','Practical') AND class_group IS NULL;
```

配套代码改动见 [§6.1 步骤 3 的回填：一个组一行](#步骤-3-的回填一个组一行2026-07-30-追加用户拍板)。

**✅ 执行结果（2026-07-30）：** 4 行 → 6 行。孤儿行 0（第 4 点那种情况在 demo 数据里
不存在；代码里改成 fail loud —— 组列表为空时抛 `RuntimeError`，不静默跳过也不造假组）。

```
Lecture    NULL  Lecture-<c1>              Wednesday 12:00   ← 不动
Lecture    NULL  Lecture-<c2>              Monday    20:00   ← 不动
Tutor      G1    Tutor-<a1>-G1             Monday    10:00   ← 原地 UPDATE，时段保留
Tutor      G2    Tutor-<a1>-G2             Tuesday   18:00   ← 新增，pick_slot_for_new
Practical  G1    Practical-<a2>-G1         Tuesday   02:00   ← 原地 UPDATE，时段保留
Practical  G2    Practical-<a2>-G2         Wednesday 10:00   ← 新增，pick_slot_for_new
```

按组过滤实测：`All` → 只有 Lecture；`G1` → 只有 G1 的 Tutor+Practical；
`G2` → 只有 G2 的 —— **跨组签到绕过消除**。

###### D4 步骤 5：目录调整的 import 对照表

**实测每种 import 写法的出现次数**（全部是 `from utils.X import ...` 形式，
无 `import utils.X` 也无 `from utils import X`，所以是干净的机械替换）：

| 现在 | 改成 | 处数 |
|---|---|---:|
| `from utils.models import` | `from db.models import` | 24 |
| `from utils.database import` | `from db.database import` | 19 |
| `from utils.security import` | *(不变)* | 16 |
| `from utils.db_helpers import` | *(不变)* | 12 |
| `from utils.schemas import` | `from schemas import` | 8 |
| `from utils.scheduler import` | `from domain.scheduler import` | 8 |
| `from utils.timeutil import` | *(不变)* | 7 |
| `from utils.session_sync import` | `from domain.session_sync import` | 4 |
| `from utils.attendance import` | `from domain.attendance import` | 4 |
| `from utils.network_verify import` | `from integrations.network_verify import` | 1 |
| `from utils.audit import` | `from domain.audit import` | 1 |
| | **需改动合计** | **69** |

**✅ 执行结果：实际改了 77 处，不是 69。** 差的 8 处在预估时漏算了：
`test_backend_fixes.py`（9 处）、`alembic/env.py`（2 处）、以及 migration 文件内部
为跑 Python 拆行而 import 的 model / scheduler。用 `git mv` 移动以保留文件历史。

**额外一项（消除唯一的分层违规）：**
[`sessions.py:24`](../../fyp-backend/routers/sessions.py#L24) 从 `routers.students` import 人脸
函数 —— 把那些函数移到 `integrations/face.py`，两个 router 都从那里 import。

**顺序建议：** 先建目录 + 移文件 + 改 import，跑 `py_compile` 全绿 + `test_backend_fixes.py`
通过，**再**做 §3.1–3.5 的 helper 提取。两件事混在一个 diff 里会失去二分定位能力。

###### D5 步骤 8a-c：客户端改动清单

| 文件 | 改动 |
|---|---|
| [`staff_dashboard_screen.dart:107`](../../fyp_flutter/lib/screens/staff/staff_dashboard_screen.dart#L107) | URL `/attendance/active-sessions` → `/sessions/active` |
| [`staff_dashboard_screen.dart:115`](../../fyp_flutter/lib/screens/staff/staff_dashboard_screen.dart#L115) | 删 `.where((s) => s['createdById'] == widget.staffId)` —— 字段不存在，服务端已按讲师过滤 |
| [`user_service.dart:110-140`](../../fyp_flutter/lib/services/user_service.dart#L110) | 删 `fetchActiveSessions` + `logoutSession`（零调用者） |
| [`local_cache_service.dart:21`](../../fyp_flutter/lib/services/local_cache_service.dart#L21) | 注释改：不再是 "multi-device session binding"，改为签到审计用途 |
| [`api.ts:616-622`](../../fyp_web/src/services/api.ts#L616) | 删 `getUserActiveSessions` + `logoutSession` |
| [`UserProfileModal.tsx`](../../fyp_web/src/components/UserProfileModal.tsx) | 删 `getBrowserDeviceInfo`(:188)、`loadSessions`(:226)、`sessions` state、登出 handler(:321)、「Active Device Sessions」卡片(:826-875) |

**不要动**：`getOrCreateDeviceId()`、签到 payload 的 `device_id`、
`student_dashboard_screen.dart:244` 的同名 `fetchActiveSessions`（活的，6 个调用者）。

**验证**：web 跑 `tsc -b`；Flutter 跑 `flutter analyze`。

---

##### 附录 B — 已排除的误报

不要被这些带偏（来自 07-18 subagent 深审）：

| 误报 | 事实 |
|---|---|
| 「ML 训练脚本不存在」 | 脚本在 `docs/ml_model_builder/train_risk_model.py`。subagent 只搜了 `fyp-backend/` |
| 「阈值方向错 / GPS 缺失」 | report 原文（391-427 行）只说 "cosine similarity, if similarity high enough"，**未写死 0.40、未提 GPS**。代码用 distance ≤ 0.40 + 仅网络验证，不违背 report |
| 「ML 模型加载失败静默退化是 bug」 | `ml_risk_predict_desc.md` §7 明确写降级到公式是为了 "so the endpoint never crashes" —— **故意的 fail-soft** |
| 「3 层漏斗不在 report」 | 同上文档 §7 完整记录 Layers 0/1/1b/2，有据的故意设计 |
| 「`RiskScore` 必填字段会导致 commit 失败」 | live 表两列都是 `is_nullable = YES`，插入成功。model 写 `nullable=False` 是漂移，非运行时故障（已对齐） |
| 「学生/员工 CRUD 是近乎平行的拷贝」 | 已共享 4 个 helper，删除路径真的不同（staff 级联 courses→sessions→attendance）。残留约 15 行，不值得抽象 |

---

##### 附录 C — 三份历史文档的判断修正表

| 来源 | 原判断 | 本文结论 |
|---|---|---|
| 07-18 C | 唯一约束「已完成并验证，约束已落库」 | **❌ 已被 `54abaf4` 回归。** 当前 DB 无此约束，`main.py` 无对应迁移 |
| 07-18 K | 出席率已统一，98/98 一致 | ✅ 但 `students.py` 后来又分叉，07-30 再统一了一次（15/15 一致） |
| 07-29 执行摘要 | 主要问题是「router 层职责过多」 | 结构问题真实，但**两轮下来最严重的发现都是 schema 漂移**，不是结构 |
| 07-29 目标结构 | `services/`+`queries/`+`integrations/`+`schemas/`（约 20 文件） | **不建议。** 至今暴露的严重缺陷没有一个是它能防住的。见 §3.0 |
| 07-29 P1.1 | 新建 `session_window_service` 含 5 函数 | 需要的只是**已存在的 `get_course_group_slots` 被调用** + 2 个小 helper |
| 07-29 修复项 7 | 「审计了另外三个 property 别名有无同样误用 —— 未发现」 | 结论对（无别的 `ORDER BY` property），但**漏了这四个 property 各自遮蔽一个有数据的物理列** → §2.1 |
| 07-29 P4 | 「改 startup 行为在提交前风险大于收益」 | **推翻。** 正是这个 pattern 造出了 §2.1 §2.2 §3.8。Alembic 现在是步骤 0 |
| 07-30 §1 修法 | 「backfill 后 DROP 影子列 + 删掉 4 个 property」 | **不完整。** 会连带改 API 契约（web/Flutter 在读这四个名字）。正确修法按列分四类处理，见 §2.1 |
| 07-30 全文 | 未追根因 | 根因是单个 commit `54abaf4`，见 §1.2 |
| 07-30 §8 决策 4 | 「重复端点保留哪个？需先查客户端」 | **问题问错了。** 查完发现两端点服务不同角色，不重复；真问题是**三个死调用**，见 §3.10 |
| 本文前一版 §3.10 | 「用户看到一个永远空白的设备列表」 | **错。** `loadSessions` 的 catch 分支兜底合成一行当前设备，用户看得见。这决定了它是「删功能」而非「删死代码」 |
| 本文前一版 §3.10 | 把三个同名 `fetchActiveSessions` 当成一件事 | **错。** 三个方法打三个不同 URL：1 个真死代码、1 个是活端点（学生端，6 调用者）、1 个是 404 但有 10s 轮询和 2 处 UI 消费。按名字批量删会破坏学生端 |
| 本文前一版 §3.0 | 「不建议动目录结构」 | **错。** 用户指出「core function 都在 utils」，实测 85%（1,188/1,393 行）确非 utility，其中 `session_sync.py` 是带 commit 副作用的 service。移动只碰 18–51 处 import。已改为推荐并获批准 |
| 本文前一版 §2.1 | 隐含「`marked_at` 是真相列」 | **两列都不是。** 真相按行分三时代，1400 行两列皆为垃圾。见 §2.1 三时代表 |

###### C1 本文自身的修正记录

保留于此，因为「审计文档自己也会错」是这三轮下来最实用的一条经验：

| 修正 | 触发原因 |
|---|---|
| §2.1 backfill 规则从「选一列」改为「三时代 `CASE`」 | 用户要求深查 `marked_at` vs `timestamp` 的关系 —— 一查发现假设本身错了 |
| §3.0 从「不建议动结构」改为「推荐并已批准」 | 用户凭记忆指出 core function 都在 utils，实测证实 |
| §3.10 从「哪个端点保留」改为「三个死调用」 | 决定去查客户端而不是继续问用户 |
| §3.10 「永远空白的列表」改为「兜底合成一行」 | 用户要求「得确保是死代码」→ 去读 catch 分支才发现有前端兜底 |
| §3.10 三个同名方法拆开处理 | 同上验证过程中发现 URL 各不相同 |

五次修正的共同点：**原判断都是「没去查就下的结论」。** 与 §1.1 那张表是同一个教训。

最后两次尤其值得记：用户那句「**得确保!是死代码 别删掉了 突然发现别的地方有用**」直接
避免了一次真实破坏 —— 若按方法名批量删，会连带删掉学生端 dashboard 那个**活的**同名方法
（6 个调用者，打的是正常端点）。

### docs/02-Engineering/CONVENTIONS.md

#### 本项目的约定

> **这不是 Python 风格指南。** 下面每一条都对应一次真实事故 —— 违反它的代码曾经进过
> main，并且造成了具体后果。通用规范（命名、类型标注、docstring）不在此列。
>
> 事故细节见 [`BACKEND-REVIEW.md`](./BACKEND-REVIEW.md)。本文只留结论和判据。
>
> **判断标准：** 一条约定能进这里，必须满足「照着写不会错、写反了会坏，而且已经坏过」。

---

##### 1. Schema 与数据

###### 1.1 `models.py` 里禁止 `@property` 与物理列同名

**事故。** 有人改列名（`timestamp` → `marked_at` 等 4 组），不去改 14 个 router 的调用点，
而是把旧名字留成 `@property` 转发到新列。SQLAlchemy 于是**永远不映射那 4 个物理列**，
而历史数据全躺在被遮蔽的那一侧：1993 行里 `confidence_score` 有 1154 个值，
API 读到的却是 `None`；1153 行 `wifi_verified=true`，API 读到 `False`。
另一个后果更直接：`ORDER BY` 一个 property 抛
`'property' object has no attribute 'desc'`，整个端点 500。

**要改列名就改列，然后改调用点。** 转发器本身就是新 bug。

`test_backend_fixes.py::check_model_fields` 现在会断言这件事 —— 任何 property
与 mapped column 同名即失败。

###### 1.2 Schema 变更只走 Alembic

**事故。** `main.py` 曾有 60 行手写 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，
在 **import 时**执行，外面包 `except Exception: print(warning)`。两次事故：

1. 加唯一约束时 `DO $$` 只 catch `duplicate_object`，而 Postgres 实际报的是
   `duplicate_table`（42P07）→ 整个迁移大事务回滚 → 连带公告的新列也没建成，
   而 `except: print` 让 app **假装启动成功**。
2. 那套机制改名时只 `ADD` 新列、永不 `DROP` 旧列 → 必然产生影子列（见 1.1）。
   只管列、不管约束和索引 → 约束被删了也没人知道。

**现在：** `alembic revision` + `alembic upgrade head`。`Procfile` 和 `Dockerfile`
都是 `alembic upgrade head && uvicorn ...` —— **迁移失败必须阻止启动**，
这正是上面第 1 条事故需要的行为。

**不要用 `--autogenerate` 做第一个 migration。** 当时 live DB 与 `models.py` 本就不一致，
autogenerate 会把「想要的修复」和「不想要的 DROP COLUMN」混在一个文件里，
在 backfill 之前就把数据删掉。baseline 用空 `upgrade()` + `alembic stamp head`。

###### 1.3 数据修复：backfill 在 DROP 之前，model 改动在最后

顺序不是风格问题。`DROP COLUMN` 之后数据就没了，没有第二次机会。

而且 **backfill 规则要先 dry-run。** 时间列那次，本来的假设是「选一列对的」，
实际 dry-run 打出来是三个时代：493 行 `marked_at` 对、100 行 `timestamp` 对、
**1400 行两列都是垃圾**（seed 数据）。假设错了，规则得是一个 `CASE` 而不是一次 `UPDATE`。

###### 1.4 存储名 ≠ 对外名时，由 Pydantic 处理，不由 ORM 处理

`network_verified` 是列名（语义比 `wifi_verified` 准），但两端客户端读的是
`wifi_verified`。做法是 schema 层 `Field(validation_alias=AliasChoices(...))`，
**不是**在 model 上加 property —— 那就退回 1.1 了。

这是 Pydantic 的本职。同理：需要推导的对外字段用 `computed_field`。

###### 1.5 两个独立信号不能塌进一列

`liveness_passed`（客户端上报的活体结果）和 `liveness_suspicious`（手势快于下限）
是两件事。曾经 `liveness_passed` 是 property，setter 写
`self.liveness_suspicious = not value`，于是：

- `sessions.py` 的构造器同时传两者，**按 kwargs 顺序后者覆盖前者**，
  客户端上报的活体结果被静默丢弃；
- `session_sync` 标缺席时写 `liveness_passed=False`，经 setter 变成
  200 行 `liveness_suspicious=True` —— 这些行并不「可疑」，只是缺席标记的副产物。

**判据：如果两个名字能同时为真、或同时无意义，它们就是两列。**

###### 1.6 DB 约束是兜底，不是应用层检查

签到 handler 的「是否已签到？」查询挡不住并发双击 —— 两个请求都能通过再都 INSERT。
`(student_id, session_id)` 上的唯一约束才是兜底，它把竞态变成 handler 已经会接的
`IntegrityError`。

这条约束曾经被建好、验证过，又被一个 commit 连同 model 声明一起删掉，
于是 `except IntegrityError` 整段变成死代码 —— 而代码注释仍然声称它是
"the authoritative backstop"。**注释不是保证，约束才是。**

同理：`class_meetings` 的「Lecture 无组、Tutor/Practical 必须有组」这个不变式，
由 `ck_class_meetings_group` CHECK 约束保证，不靠每个写入点自觉。

###### 1.7 `model` 声明了 `index=True` 不等于 DB 有索引

`create_all` 不给**已存在**的表补索引。三张表的 `index=True` 声明了很久，
实测只有主键。这类「model 说一套、DB 是另一套」的漂移，上了 Alembic 之后
`autogenerate` 会检测出来 —— 这是 1.2 的附带收益。

---

##### 2. 课表（`class_meetings`）

###### 2.1 课表只在 `class_meetings` 里

`Course.schedule_day/start/end/room` 四列曾长期存在，`grep "body.schedule_"` **零命中** ——
建课/改课从不读它们。客户端传 `schedule_day` 会拿到 200 然后什么都不发生，
**静默失败的 API 契约比 400 更糟**。四列已删。

对外的 `schedule_*` 字段名保留，但数据来自 `class_meetings`。

###### 2.2 `meeting_key` 必须包含让一次 meeting 唯一的每个维度

`meeting_key_for()` 现在是 `Lecture-<course_id>` / `<role>-<assignment_id>-<class_group>`。

**组维度是后补的，补的时候差点漏掉 key。** 一个 assignment 按组拆成多行后，
旧格式 `<role>-<assignment_id>` 会撞：`meeting_key` 有 UNIQUE 约束 → insert 报错；
而 `calculate_schedule` 拿它当 dict 键 → **撞了会静默丢时段**。
两种失败一个响一个不响，后者更危险。

**加维度时先问：这个 key 现在还唯一吗？**

###### 2.3 key 从外键推导，不读存储的 `meeting_key` 列

UUID 迁移把 `course_id`/`assignment_id` 转对了，却留下 `meeting_key = 'Lecture-8'`
（迁移前的整数 id）。于是每个 `f"Lecture-{course.id}"` 查找全 miss → 课表空、
签到窗口静默回落默认值。

`calculate_schedule` 现在从外键**推导** key。存储列漂移了也不影响。

###### 2.4 `class_group IS NULL` 只对 Lecture 成立，含义是「全课适用」

- Lecture → `NULL`（全课学生共用一个时间）
- Tutor / Practical → **必填**具体组别

两个直接后果，都不是可选的：

1. **防撞校验里 `NULL` 要视为「与所有组重叠」。** Lecture 和任何组的 Tutor 都是
   同一批学生，不能把 `NULL` 当普通值比较。
2. **按组过滤时不要把 Lecture 混进组时段。** `get_course_group_slots` 里
   `"All"` 只取 Lecture，具体组只取该组的 Tutor/Practical —— 把 Lecture 也加进去
   会放宽签到窗口。（我第一版就写错了这个，改回来了。）

组别的唯一来源是 **`enrolments.class_group`**。`course_staff_assignments`
**没有**这一列 —— 文档曾写从那里取，那段 SQL 直接报错。

###### 2.5 CHECK 约束说的是「每行申报自己的组」，不是「每组都得有时段」

某个组确实没有这门课的 tutorial 是合法的。**不要为了凑约束去造一节不存在的课。**

---

##### 3. 一条规则只写一遍

###### 3.1 抄 N 遍的规则，一定会有一遍是错的

三个实例，都是真 bug 而非洁癖：

| 规则 | 抄了几遍 | 漂移后果 |
|---|---|---|
| 「我教的课」= owned OR assigned | 6 | 有一遍只查 `Course.lecturer_id` → 纯 tutor 的讲师在 staff dashboard 看到**空课表** |
| 出席率算法 | 2 | 同一学生 App 与 web 数字不同（实测 60.0 vs 62.7） |
| 公告可见性 | 2（各 60 行） | 两份 role gate 方向相反，任一处漂移就把通知发给错误受众 |

现在分别是 `my_course_ids()`、`domain/attendance.py`、`domain/announcements.py`。

**修同类 bug 时先 grep 有几份拷贝。** `/sessions/active` 那次修了 5 处漏了第 6 处，
就是没数。

###### 3.2 helper 已经存在时，先看它为什么没被调用

`get_course_group_slots` 早就定义在 `sessions.py`，只有同文件两处在用 ——
**另外 3 段是手抄的同样逻辑**。审查报告曾建议为此新建一个含 5 个函数的 service，
复核发现需要的只是让已存在的 helper 被调用。

###### 3.3 一个模块只有一个实现、且没有第二个调用方时，它不该是一个模块

这条是上一条的反面。`queries/`（4 模块）和 `services/`（8 模块）那套布局被否掉，
理由就是多数是为单实现新建的抽象。

反过来，`domain/announcements.py` 和 `domain/security_settings.py` 够格 ——
各有 2+ 个调用方，且拷贝已经漂移过。

###### 3.4 配置值也算规则：一个值一个源，但按服务分，不搞跨端统一文件

后端 dev 端口曾在 5 个地方各写一遍（`launch_backend.py`、`stop_backend.bat`、
`fyp_web/.env`、`fyp_flutter/env.json`、`app_config.dart`）。`3e6f0aa` 把后端从
8003 改成 8000，前端没跟上 —— 登录直接 `ERR_CONNECTION_REFUSED`。

现在后端侧只有一个源：`fyp-backend/.env` 的 `BACKEND_PORT`，
`run_backend.bat` 和 `stop_backend.bat` 都从那读。

**但不要建"一个 JSON 喂三端"。** Vite 是编译期把变量烘进 bundle，Flutter 只认
编译期 `--dart-define`，Python 运行时读 env —— 三者天生读不了同一个文件，硬统一
就得写生成器。企业级的做法也不是共读一个文件：真源在部署层（ConfigMap / Parameter
Store），**注入**成各服务自己的 env，应用代码依然各读各的。没有编排层时，
per-service `.env` + committed `.env.example` 就是这个模式的正确小规模形态。

**每个有 `.env` 的服务都必须有 committed 的 `.env.example`。** 这是配置契约，
也是这次事故的真正根因：两个 `.gitignore` 早就写了 `!.env.example` 例外，但文件
从没建过，于是 git 里没有任何东西记录着"web 也配了端口"，改后端的人看不到。

---

##### 4. 时间

###### 4.1 一个请求一个时钟，取在循环外

`admin_attendance` 曾把 `utcnow()` 放在 per-session 循环**内部**。同一个 HTTP 响应里
不同行用不同时刻判断「是否已结束」，跨午夜或时段边界时**同一份列表自相矛盾**。

###### 4.2 本地时区用命名时区，不要拿宿主时钟推

```python
tz_offset = datetime.now() - utcnow()   # ❌ 出现过 6 次
```

这依赖容器本地时区，而 `Dockerfile` / `Procfile` **都没设 `TZ`** ——
本地（Windows UTC+8）与容器（默认 UTC）行为不同，同一段代码把课排到差 2 小时的位置。

现在是 `utils/timeutil.local_offset()`，内部 `ZoneInfo("Asia/Kuala_Lumpur")`。

###### 4.3 全 app 一个时钟口径：naive UTC，用 `utils.timeutil.utcnow()`

不要用 `datetime.utcnow()`（3.12 起弃用；本项目锁 3.11 所以暂时不报警，但别留下 3.12 一升就坏的代码）。
也不要改用 `datetime.now(timezone.utc)` —— 那返回 **aware** datetime，
而 DB 列全是 naive，每个 naive-vs-aware 比较都会 `TypeError`。

`timeutil.utcnow()` 返回 naive UTC，值与旧的一样，只是不弃用。
这条曾统一替换过 26 处，后来又有 2 处加回了 `datetime.utcnow()` —— **改完要防回归。**

###### 4.4 「这节课几点结束」由开课那天的星期几决定

一个组可能同时有 Tutor 和 Practical，`slots[0]` 取第一个等于**让数据库返回顺序决定业务语义**。
现在 `session_end_utc()` 取与 `opened_at` 同星期几的时段，同日多个则取结束最晚的。

找不到时段时回落 `opened_at + 2h` —— 这是原有行为，保持不变。

---

##### 5. 失败要响

###### 5.1 可选重依赖：用到那一刻 fail loud，不静默跳过

`deepface` 是可选依赖。缺它时**签到端点返回 503**，绝不静默跳过人脸验证 ——
那会记下一条没人验证过的出席。`integrations/face.py` 顶部的注释写了这个理由。

同理 `security.py`：`JWT_SECRET_KEY` 缺失直接 `RuntimeError`，不回落默认值。

###### 5.2 `except Exception: print(...)` 不算错误处理

`sync_class_sessions` 149 行整体包在里面，自动开课/关课/标缺席失败只留一行 stdout，
而触发它的请求照常返回 200。现在分两支：

- `IntegrityError` → 并发下的预期情况（唯一约束在干活），静默 rollback
- 其余 → `logger.exception`，带 traceback

**判据：能区分「预期跳过」和「真失败」时，就必须区分。**

###### 5.3 fail-soft 要有出处

不是所有降级都是 bug。ML 模型加载失败降级到公式**是故意的**
（`ml_risk_predict_desc.md` §7 明确写 "so the endpoint never crashes"）。
审查曾把它列为缺陷，复核后撤销。

**判据：降级行为有文档记录 → 保留；没有 → 是 bug。**

---

##### 6. 分层

###### 6.1 依赖方向：`router → domain → db`、`router → integrations`。禁止 `router → router`

`sessions.py` 曾 `from routers.students import _extract_face_embedding, ...` ——
两个 HTTP 层互相依赖。共用的东西搬到 `integrations/face.py`。

###### 6.2 `utils/` 只放真正的 utility

曾经 1,393 行里 1,188 行不是 utility：数据层、契约层、外部集成、三个领域模块，
以及最刺眼的 `session_sync.py` —— **一个会 commit、被 7 个 GET handler 调用的 service，
藏在一个意思是「杂物」的目录名下**。这正是它的副作用长期没人注意到的原因。

现在 `utils/` = `security.py` + `timeutil.py` + `db_helpers.py`，183 行（重组后的净值；
之后加入 `my_course_ids` 使其变为 204 行）。
**放东西进 `utils/` 前先问：它是工具，还是业务规则？**

###### 6.3 GET handler 不该写库

多个 GET 端点曾在 commit。现在：内存内判断 + 只读，持久化交给 `sync_class_sessions`。
`/students/me/active-sessions` 这类端点里，「已过时段的 session」是**从响应里排除**，
不是顺手改 DB。

###### 6.4 模块级状态假设单 worker，要写明

`session_sync` 的 `_is_syncing` / `_last_sync_time` 是模块级变量，多 worker 下失效。
当前部署是单 uvicorn 进程，所以成立 —— 但**天花板和升级路径写在注释里**
（advisory lock 或 DB 行）。多 worker 下的失败模式是浪费查询，不是坏数据，
因为唯一约束兜住了（见 1.6）。

---

##### 7. 缓存

**ETag 中间件对签到相关路由必须 `no-store`。**

它曾对每个 200 JSON 无条件加 `Cache-Control: private, max-age=30`，覆盖了
`/sessions/open`、`/students/me/active-sessions`、`/sessions/{id}/attendance`。
后果：**讲师刚开课学生看不到；讲师刚关课学生仍看到入口。**

排除表在 `main.py::NO_STORE_PREFIXES`。**新增签到相关的 GET 端点时要加进去。**

---

##### 8. 删代码之前

###### 8.1 按 URL 和实际调用者追，不要按方法名

Flutter 有**三个同名 `fetchActiveSessions`**，打三个不同 URL：

| 位置 | URL | 调用者 | 处置 |
|---|---|---|---|
| `user_service.dart` | `/auth/active-sessions` | **0** | 删 |
| `student_dashboard_screen.dart` | `/students/me/active-sessions` | 6 | **别动** |
| `staff_dashboard_screen.dart` | `/attendance/active-sessions`（404） | 4（含 10s 轮询） | 改 URL |

**按名字批量删会删掉学生端一个活的调用。** 用户当时那句「得确保是死代码，
别删掉了突然发现别的地方有用」直接避免了一次真实破坏。

###### 8.2 「看起来没人用」和「有前端兜底所以用户看得见」是两回事

web 的「Active Device Sessions」卡片，`loadSessions` 的 `catch` 分支会**兜底合成一条**
当前设备条目。所以用户看到的不是空列表，而是一行「Current Active Computer (Windows)」。
删它属于**删功能**（需要用户批准），不是删死代码。

**读 catch 分支再下结论。**

###### 8.3 死端点要确认零调用者才删

`GET /sessions/open` 与 `/students/me/active-sessions` 回答同一个问题、返回不同结构。
全仓 grep 确认前者零调用（同路径的 **POST** 在用，别混淆），才删的。

###### 8.4 破坏性操作绝不用「假 rollback」验证

自查时曾以为在事务里回滚，实际 `delete_`/`update_` 端点内部**自己 commit** ——
真删了 course 7、移动了 course 8 的大课。

**要验证约束是否生效，用显式事务 + 原生 SQL + `ROLLBACK`**，
不要调用会自 commit 的 endpoint。（本轮验证唯一约束和 CHECK 约束都是这么做的。）

---

##### 9. 修法的形状

###### 9.1 A 错了改对 A，不要加 B 去补 A

用户原话：「a错了 加b去修复a的问题（这样我觉得很不好 屎山代码）」。

两个对照，都是本轮真实决策：

| 情况 | 加 B 补 A（❌） | 改对 A（✅） |
|---|---|---|
| 列名改了，14 个 router 在用旧名 | 加 4 个 `@property` 转发 | 改列 + 改调用点 |
| 客户端在调已删除的端点 | 后端补 stub 端点 | 删客户端那两个方法 |

**第二个尤其值得记：补 stub 等于为了让废弃调用不报错，去复活一个已经删掉的功能。**

###### 9.2 改动前先归类：删除 / 改对 / 纯移动 / 新增

本轮 25 条的分布：14 条删除或删重复、8 条改对、1 条纯移动、1 条恢复被删的声明、
**只有 1 条是真新增**（ETag 排除表）。

**如果一个「修复」的净效果是加代码，先停下来问是不是在补 A。**

###### 9.3 `get_or_404` 的 `name` 参数只传实体名

```python
get_or_404(db, X, id, "Feedback report not found")   # ❌ → "Feedback report not found not found"
get_or_404(db, X, id, detail="Feedback report not found")  # ✅ 或 name="Feedback report"
```

用户可见的错误消息，出现过两处。

---

##### 10. 环境

跟代码质量无关但会直接卡住的坑：

- **驱动是 psycopg v3，不是 psycopg2。** `db/database.py` 把 `postgresql://`
  重写成 `postgresql+psycopg://`。**任何新的 DB 入口（如 `alembic/env.py`）
  必须复用 `db.database` 的 engine**，不要自己拼 URL —— 否则
  `ModuleNotFoundError: psycopg2`。
- **venv 原本是 uv 建的、没有 pip**（`python -m pip` 报 `No module named
  pip`）。07-31 已用 `python -m ensurepip --upgrade` 补回 pip 24.0，现在
  `python -m pip` 和 `uv pip` 都能用，`setup_backend.bat` 也会自己检测并补。

依赖版本一律 pin（`alembic==1.13.2`）。`scikit-learn` **必须留 1.9.0** ——
`ml/risk_model.pkl` 是用它 pickle 的。

###### 10.1 Python 3.11 是硬约束，不是偏好

`tensorflow-intel==2.14.0`（Windows 上 tensorflow 的实际实现包）只发
`cp39/cp310/cp311` 三个 wheel，**没有 cp312** —— 3.12 上装不了，不是"没验证
过"。第一个带 cp312 wheel 的是 TF 2.16，而它拉 numpy 2.x，正好触发
`pywrap_ml_dtypes.bfloat16()` 崩溃，所以 `numpy` 必须 `<2.0`。

锁 3.11 的地方共 5 处，改一处就要全改：`Dockerfile`、`fyp-backend/Dockerfile`、
`runtime.txt`、`fyp-backend/runtime.txt`、`setup_backend.bat`。07-31 之前前四处
还停在 3.12，部署会直接装不上。

###### 10.2 requirements.txt 只用 ASCII

pip 用**系统 locale** 解码 requirements 文件。中文 Windows 上是 gbk，注释里
一个 em dash 就让整个安装在依赖解析之前挂掉：

```
UnicodeDecodeError: 'gbk' codec can't decode byte 0x94 in position 108
```

07-31 踩到，3 处 em dash。注释里不要用 `—`、`·`、中文标点。这个坑只在非 UTF-8
locale 触发，所以在别人机器上装得好不代表没问题。

###### 10.3 装完要验证「能用」，不是「pip 退出码 0」

`pip install` 成功不等于依赖能用。deepface 尤其危险 —— 装上了但
numpy/TF 版本错配时，它是 import 失败而不是报错。`setup_backend.bat`
装完会跑：`pip check`、真 import numpy/tensorflow/sklearn、
`from deepface import DeepFace`、检查 ArcFace 权重是否存在。

**有些依赖不在 venv 里，删 venv 重装碰不到它们**：ArcFace 权重
（`%USERPROFILE%\.deepface\weights\arcface_weights.h5`，137 MB，本网络自动下载
会失败）、各服务的 `.env`、远端 Supabase 库、Python 3.11 解释器本身。
所以"删 venv 跑 setup"验证不了交接流程的大部分风险。

---

##### 11. 测试

扩展 `test_backend_fixes.py`，不新建框架。它没有 fixture、没有 conftest，
DB 相关的 check 在无库时自动 skip。现在 13 个 check。

###### 11.1 测试必须能失败 —— 改回原 bug 时要变红

**每加一条 check，就把它守的那个修复改回原样跑一遍**（mutation testing）。
本轮 6 个 mutation 全部被抓到才算完：

```
slot_on_day 退回 slots[0]              → check_session_window          必须红
get_course_group_slots 不按组过滤       → check_group_slots_isolated    必须红
role gate 移除                         → check_announcement_visibility 必须红
enrolment / group 校验移除              → check_override_enrolment_rule 必须红
唯一约束 DROP（事务内，回滚复原）        → check_duplicate_checkin_rejected 必须红
```

**「跑过一次、看输出是对的」不算测试。** 一次性脚本删了就没了，
下次有人改坏没人会知道 —— 这正是 `BACKEND-REVIEW.md` §6.3 要防的事。

###### 11.2 样本选错会让测试假绿，也会让它假红

**真踩到的：** 验「未选本课的学生要被拒」时，样本挑的是「在别的课上有 enrolment 的学生」。
但学生通常选多门课 —— 那个人**同时也选了本课**，所以被接受是对的，测试却报红。
正确写法是 `~Student.id.in_(本课的 enrolment)`。

**判据：断言之前先确认样本真的满足前提**，尤其是「不属于 X」这种否定条件。

###### 11.3 断言业务后果，不只断言返回值

几个例子，都比「返回了非空」有用：

- `calculate_schedule` 的 **key 数必须等于行数** —— 这才是「key 碰撞会静默丢时段」
- 具体组的 slots 里**不得混进 Lecture** —— 混进去会放宽签到窗口
- `local_offset()` 断言 **= 8h**，不断言「与宿主时钟一致」—— 后者在 UTC 机器上碰巧也过
- 覆盖出席的两个 handler，断言**源码里出现共享 helper 的名字** ——
  防的是「又各写一套」，而不只是当前行为对
- 探针数据插入后断言**前后行数相等** —— 防测试自己污染库

###### 11.4 验证约束用显式事务 + 原生 SQL + `ROLLBACK`

见 [§8.4](#84-破坏性操作绝不用假-rollback验证)。Postgres 的 DDL 也在事务里，
所以连「把约束 DROP 掉验测试会不会红」都能安全做完再回滚。

---

##### 12. 文档

###### 11.1 文档与代码矛盾时，先对 live DB 查一遍

本轮三次踩到：

- 附录 D3 的回填 SQL 引用 `course_staff_assignments.class_group` —— **那一列不存在**
- §2.1 的表格说 `liveness_passed` 该删列，同节「附带发现」和附录 D2 说保留为独立列 ——
  **同一份文档自相矛盾**
- 附录 D2 的验证目标写 `network_verified` 应为 1153，实际是 1154 ——
  文档自己记的两个数（1153 + 1）不相交，并集是 1154

**两份文档冲突时取更晚、更具体的那份**，并在文档里记下取舍理由。

###### 11.2 「读代码推断」和「跑过验证」要分开标注

`BACKEND-REVIEW.md` 全文严格区分这两者。三轮审查的教训是：
**未执行过的审计会系统性误判严重度** —— 有一轮把「结构问题」排第一，
把 UUID/int 不匹配（约 20 个端点无条件 422，最大 blast radius）排第四。

**先跑代码，再谈结构。**

### docs/03-MLModel/README.md

#### 03-MLModel — At-Risk 风险预测模型

三个模块里**唯一真正训练过**的模型。RandomForest，用 3 个出勤特征预测学生期末会不会
被 bar（出勤 < 80%）。

| 内容 | 去哪 |
|---|---|
| 完整实现参考（英文，15 节） | [ml_risk_predict_desc.md](./ml_risk_predict_desc.md) |
| 中文讲解（答辩用） | [../01-CurrentCode/module2-risk-prediction.md](../01-CurrentCode/module2-risk-prediction.md) |
| 数据生成 / 训练 / 播种脚本 | [ml_model_builder/](./ml_model_builder/) |

---

##### 两份文档怎么分工

同一个主题，两个受众，**都要留**：

| | `ml_risk_predict_desc.md` | `module2-risk-prediction.md` |
|---|---|---|
| 语言 | 英文 | 中文 |
| 行数 | 525 | 355 |
| 给谁看 | 接手代码的人 | 答辩现场的你 |

重叠的是核心论证（为什么用 ML 不用公式、3 个特征、4 层漏斗、模型对比表），约占
module2 的六成。

**只有英文版有**：合成数据生成机制（§5）、DB schema 全表（§10）、前端 dashboard
（§12）、demo seed 的学生原型设计（§13）、**已知局限 7 条**（§14）、
从零复现的完整命令（§15）。

**只有 module2 有**：4 层漏斗 if→then 速查表、带具体数字的走查例子、
§10「开会前必须知道的四件事」现状表。

---

##### ml_model_builder/ 脚本

| 脚本 | 作用 |
|---|---|
| `generate_data.py` | 模拟学生 → `training_data.csv`（5,628 行） |
| `train_risk_model.py` | 对比 4 个候选模型 → 存 `fyp-backend/ml/risk_model.pkl` |
| `test_model.py` | 单独测已训练的模型 |
| `seed_demo_data.py` | 播种 demo 课程 BMCS3413（50 学生），幂等 |
| `cleanup_demo_data.py` | 撤销上面那个 |

###### ⚠ `generate_data.py` 现在跑不起来

第 31 行硬编码了旧项目路径：

```python
BACKEND_ML = r"c:\Users\sungs\OneDrive\Desktop\fyp-main\fyp-backend\ml"
```

项目文件夹现在叫 `fyp`，不是 `fyp-main`，所以 `sys.path.insert` 指向不存在的路径，
`from features import ...` 会失败。

**影响范围有限**：已生成的 `training_data.csv` 和 `risk_model.pkl` 都还在，
线上功能不受影响 —— 只是暂时没法重新生成数据。要修就把那行改成相对路径。

老师问「多久更新一次风险分」→ **诚实说是手动触发**。前端函数名叫
`runNightlyRiskScorerJob`，但它只是点按钮调 `/analytics/recompute`，没有 cron。

---

##### 两个关键设计点

**ML 是 fail-soft 的。** `risk_model.pkl` 加载失败会退回规则打分，不报错。这是**故意
的**（`ml_risk_predict_desc.md` §7 写明 "so the endpoint never crashes"）。和人脸识别
的 fail-closed 相反 —— 判断标准是**错误会不会造出一条假的考勤记录**：风险分算错只是
排序不准，人脸放行错了就是代签。

**训练数据是合成的。** 3000 个模拟学生，不是真实数据。可辩护的说法是**结构性**的
（对比公式的 recall 优势，§2），不是「实际准确率 77%」。真实数据要攒一整个学期，
还涉及隐私；合成数据的价值在于**能控制生成机制**，从而证明 ML 比公式强。

### docs/03-MLModel/ml_risk_predict_desc.md

#### Attendance Risk Prediction — Full Implementation Reference

> One document that explains the **entire** attendance at-risk prediction feature:
> the idea, the data, the model, the serving logic, the API, the database, the UI,
> and the demo seed. If you read only this file, you know the whole system.

---

##### 0. Table of Contents

1. [What the feature does](#1-what-the-feature-does)
2. [Why ML and not a formula (the core argument)](#2-why-ml-and-not-a-formula)
3. [End-to-end data flow](#3-end-to-end-data-flow)
4. [The 3 features](#4-the-3-features)
5. [Synthetic training data generation](#5-synthetic-training-data-generation)
6. [Model training & selection](#6-model-training--selection)
7. [The live prediction funnel (Layers 0/1/1b/2)](#7-the-live-prediction-funnel)
8. [Risk score → label thresholds](#8-risk-score--label-thresholds)
9. [Reason text (explanations)](#9-reason-text-explanations)
10. [Database schema](#10-database-schema)
11. [API endpoints](#11-api-endpoints)
12. [Frontend dashboard](#12-frontend-dashboard)
13. [Demo seed data](#13-demo-seed-data)
14. [Known limitations (for the report)](#14-known-limitations)
15. [File map & how to reproduce](#15-file-map--how-to-reproduce)

---

##### 1. What the feature does

For every `(student, course)` pair, the system predicts whether the student is at
risk of being **barred from the final exam** — the university rule is:

> A student needs **attended_hours / total_planned_hours ≥ 80%**. Below 80% ⇒ barred.

The output per student is stored in the `risk_scores` table and shown on the
lecturer's **At-Risk Early-Warning Dashboard**:

- `risk_score` — probability (0.0–1.0) of ending up barred
- `risk_label` — `low` / `medium` / `high` / `observing`
- `attendance_rate` — current hours-weighted attendance
- `risk_factors` — plain-English reason(s) for the verdict

The lecturer can then dispatch a warning email (that part is a teammate's feature,
preserved and integrated, not covered in depth here).

---

##### 2. Why ML and not a formula

This is the single most important design point (and the most likely exam question).

A naive **formula** would just say: *"current attendance < 80% ⇒ at risk"*. The
problem: it only reacts **after** a student has already dropped below the bar. It is
blind to a student who is currently at 84% but **sliding downward fast** — that
student will very likely be barred by week 14, but the formula calls them "safe".

The ML model learns from the **pattern** (rate + absence streak + trend), so it can
flag a *currently-safe-but-declining* student **early**, while there is still time to
intervene. That is the whole value proposition.

Measured on the held-out test set (see §6), the gap is concrete:

| Model | Accuracy | **Recall** | Precision | F1 |
|---|---|---|---|---|
| LogisticRegression | 77.5% | 78.3% | 67.0% | 72.2% |
| DecisionTree | 77.1% | 82.3% | 65.4% | 72.9% |
| **RandomForest (deployed)** | **77.7%** | **81.7%** | 66.4% | 73.3% |
| Formula (`rate < 0.80`) | 77.3% | **54.9%** | 77.9% | 64.4% |

**Recall = % of truly-barred students the model catches.** The formula misses ~45%
of them (it can't see decline coming); the ML catches ~82%. That ~27-point recall
gap is the answer to *"why not just a formula?"*. Recall is prioritised because a
**false negative** (missing a student who gets barred) is worse than a false
positive (Marbouti et al., 2016).

> Note on accuracy: ~77% is realistic, not inflated. It matches the range reported
> by Yağcı (2022). The point is **not** raw accuracy (which is meaningless on
> synthetic data) but the **structural** advantage in recall over a formula.

---

##### 3. End-to-end data flow

```
OFFLINE (dev machine, one-time / when retraining)
────────────────────────────────────────────────
 generate_data.py   ──►  training_data.csv   ──►  train_risk_model.py  ──►  risk_model.pkl
 (simulate 3000                (5,628 rows,           (compares 4 models,        (RandomForest,
  students w/ momentum)          3 features+label)      picks best by recall)      copied into backend)

ONLINE (every time the lecturer opens the dashboard or clicks "Recompute")
──────────────────────────────────────────────────────────────────────────
 DB (attendance)  ──►  build per-student sequence+hours  ──►  compute_features()
                                                                     │
                                                          ┌──────────┴──────────┐
                                                          │   _assess() funnel   │
                                                          │  L0 cold start       │
                                                          │  L1 can't reach 80%  │
                                                          │  L1b already secured │
                                                          │  L2 RandomForest .pkl│
                                                          └──────────┬──────────┘
                                                                     ▼
                                              write risk_scores row (score/label/rate/factors)
                                                                     ▼
                                              GET /analytics/risk-scores  ──►  React dashboard
```

Key idea: `compute_features()` is the **single source of truth** — the exact same
function is called during training (`generate_data.py`) and during live serving
(`analytics.py`), so the model always sees features computed identically. No
train/serve skew.

---

##### 4. The 3 features

File: `fyp-backend/ml/features.py` → `compute_features(sequence, hours)`.

**Inputs:**
- `sequence`: list of `1` (attended: present *or* approved leave) / `0` (absent), in
  chronological order, oldest session first.
- `hours`: contact hours per session, same length/order. Attendance is credited by
  **hours**, not class count — missing a 2h lecture hurts more than a 1h tutorial.
  If omitted, every session = 1 hour (backward-compatible count mode).

**Outputs (fixed order `FEATURE_ORDER = [attendance_rate, consecutive_absent, trend]`):**

| Feature | Formula | Meaning |
|---|---|---|
| `attendance_rate` | Σ(attended·hours) / Σ(hours) | Hours-weighted attendance so far, 0.0–1.0 |
| `consecutive_absent` | longest run of consecutive `0`s (by count) | Behavioural signal — a long streak = disengaging |
| `trend` | rate(2nd half) − rate(1st half) | Negative ⇒ attendance **declining** ⇒ riskier |

`trend` splits the sequence at `mid = n // 2` and subtracts the first-half
hours-rate from the second-half hours-rate. A student who came early then stopped
has a strongly negative trend even if their overall rate still looks OK.

**Live feature importances** of the deployed model (how much each drives the
prediction): `attendance_rate` ≈ 0.60, `consecutive_absent` ≈ 0.26, `trend` ≈ 0.15.

---

##### 5. Synthetic training data generation

File: `ml_model_builder/generate_data.py` → outputs `training_data.csv`.
Seeded with `SEED = 42` (fully reproducible). `N_STUDENTS = 3000`.

> ⚠️ Data is **synthetic** — there is no real barred-student dataset. This is the
> project's biggest academic limitation; see §14. It is honest to state this.

###### 5.1 Why the data is built with "behavioural momentum"

If the simulated final outcome were just a straight-line extrapolation of current
attendance, then a **formula** would predict it perfectly and ML would be pointless.
To make the problem genuinely ML-shaped, each student is simulated with **momentum**:

- Each student has a hidden `base` engagement (0.62–0.99) and a weekly `drift`.
- `drift` is **correlated with engagement**: strong students stay flat (drift ≈ 0),
  weak students spiral downward. This makes *early behaviour genuinely predictive*
  of the final outcome — which is what lets ML beat a formula.
- `momentum`: after an absence, the probability of the next absence **rises**
  (disengagement spiral); after attending, it **recovers**. So a run of absences
  tends to continue — the outcome depends on the **pattern**, not just the rate.

###### 5.2 Simulation per student (`simulate_semester`)

1. Pick a weekly template of contact hours (a course mixes lecture/practical/tutorial):
   `[2,2,1]`, `[2,1]`, `[3]`, or `[1]` hours.
2. Semester length: `14, 14, 7` weeks (mostly full, some short — generalisation).
3. Walk week by week, session by session, drawing attend/absent with the
   momentum-adjusted probability above.

###### 5.3 Labelling & snapshots

- **Label** = `1` (at-risk) if the **final** hours-attendance `< 0.80`, else `0`.
- Instead of one row per student, take **snapshots** at `30% / 50% / 70%` of the
  semester elapsed (`SNAPSHOTS = [0.40, 0.60, 0.80]` are the *cut points*; note the
  code samples at those elapsed fractions). Each snapshot's features + the student's
  **final** label = one training row. This teaches the model to predict the final
  outcome from a **partial** mid-semester view (Marbouti's multi-checkpoint setup).
- **Exclusion rule (critical):** a snapshot is skipped if the student is already
  mathematically doomed at that point (`best_case < 0.80`). Those cases are handled
  by the certainty layer (Layer 1) in production, **not** ML — so excluding them
  from training avoids train/production mismatch.

Result (current run): **5,628 rows** from 3,000 students; **37.4%** labelled at-risk.
(269 rows sit in the "high rate, flat trend" hard zone — the cases a formula gets
wrong — so the model has enough examples to learn that boundary.)

---

##### 6. Model training & selection

File: `ml_model_builder/train_risk_model.py` → outputs
`fyp-backend/ml/risk_model.pkl`.

###### 6.1 Setup

- Features `X = [attendance_rate, consecutive_absent, trend]`, label `y = at_risk`.
- **75/25 train/test split**, `random_state=42`, `stratify=y` (keeps class balance).
- All classifiers use `class_weight="balanced"` (the at-risk class is the minority).

###### 6.2 Candidates compared (per Yağcı 2022 / Marbouti 2016, who benchmark several)

| Model | Hyperparameters |
|---|---|
| LogisticRegression | `max_iter=1000, class_weight=balanced` |
| DecisionTree | `max_depth=4, class_weight=balanced` |
| **RandomForest** | `n_estimators=150, max_depth=6, class_weight=balanced` |
| Formula baseline | `attendance_rate < 0.80` (not ML — the comparison target) |

###### 6.3 Selection rule

Priority is **recall** (minimise missed at-risk students). But among models within
**2 percentage points** of the best recall, **RandomForest is preferred** because its
ensemble produces **smooth, monotonic probabilities**. A single deep tree can rank an
84% student as *riskier* than an 88% one (same-leaf artifacts), which looks broken on
a lecturer's dashboard. Smoothness ⇒ a trustworthy, explainable UI.

→ Deployed model: **RandomForest**, recall 81.7%, F1 73.3% (see table in §2).

###### 6.4 What gets saved

`joblib.dump()` serialises the fitted RandomForest to `risk_model.pkl`. The backend
loads this exact file. The `.pkl` embeds `feature_names_in_` so column order is
enforced at predict time.

---

##### 7. The live prediction funnel

File: `fyp-backend/routers/analytics.py` → `_assess(sequence, hours, held_hours, total_hours)`.

This is the heart of serving. Each `(student, course)` passes through **four gates**.
The design principle: **once the outcome is arithmetically certain, ML steps aside**
— it is wrong to "predict" something that is already a mathematical fact. ML only
runs on the genuinely uncertain middle band.

Constants: `BAR_THRESHOLD = 0.80`, `COLD_START_FRACTION = 0.30`.
`held_hours` = hours of sessions held so far; `total_hours` =
`course.planned_total_hours` (may be `None` if the lecturer didn't set it).

###### Layer 0 — Cold start
```
if total_hours and held_hours < 0.30 * total_hours:
    → label "observing", score 0.0, factors "Too early to assess"
```
Too little of the semester has elapsed to make a fair prediction.

###### Layer 1 — Certainty (bad outcome locked in)
```
best_case = (attended_hours + all_remaining_hours) / total_hours
if best_case < 0.80:
    → label "high", score 1.0, factors "Cannot reach 80% (best case NN%)"
```
Even attending **every** remaining hour can't reach 80%. The bar is unavoidable →
guaranteed HIGH. `NN` uses `math.floor` (so 79.9% never displays as "80%").

###### Layer 1b — Certainty (good outcome locked in)  ← symmetric to Layer 1
```
worst_case = attended_hours / total_hours
if worst_case >= 0.80:
    → label "low", score 0.0, factors "Requirement already secured"
```
The student has already banked ≥80% of **total** hours; even skipping every
remaining class keeps them ≥80%. Guaranteed safe → LOW. (Only fires late in the
semester; at week 9 of 14 nobody can be locked-safe yet, so it's dormant in the demo
but correct for real deployment.)

###### Layer 2 — ML (the uncertain middle)
```
score = RandomForest.predict_proba(features)[at_risk]   # 0.0–1.0
label = threshold(score)                                # §8
factors = _reasons(...)                                 # §9
```
The student is still mathematically recoverable **and** not yet secured — the only
place a prediction is meaningful. The classifier outputs the probability of ending
barred.

> **Fallback:** if `total_hours` is `None` (lecturer never set planned hours),
> Layers 1/1b are skipped and everything goes straight to ML. If the `.pkl` itself
> fails to load, `_ml_probability` degrades to the formula `1 - attendance_rate` so
> the endpoint never crashes.

**Real demo breakdown (course 8, 50 students, week 9):** 0 in Layer 0, 11 decided by
Layer 1 (pure arithmetic), **39 decided by ML** (scores spanning 0.12–0.95). So ML
drives 78% of verdicts — the certainty layers only take over where ML shouldn't run.

---

##### 8. Risk score → label thresholds

`_risk_label(score)` in `analytics.py`:

| Condition | Label |
|---|---|
| `score < 0.35` | `low` |
| `0.35 ≤ score < 0.60` | `medium` |
| `score ≥ 0.60` | `high` |

Plus the two certainty labels set directly by the funnel: `observing` (Layer 0) and
the forced `high`/`low` from Layers 1/1b.

> **Honesty note:** `0.35` and `0.60` are hand-tuned so the dashboard shows a sensible
> low/medium/high spread. They are not derived from a cost function — a documented
> limitation (§14). The rationale is Marbouti's "prefer catching risk", so the bands
> lean toward flagging.

---

##### 9. Reason text (explanations)

`_reasons(feats, rate, label)` builds the `risk_factors` string shown in the "Why"
column. Rules (multiple can combine, joined with `;`):

| Condition | Text |
|---|---|
| `rate < 0.80` | `Below 80% requirement` |
| `consecutive_absent ≥ 3` | `Missed N classes in a row` |
| `trend ≤ -0.10` | `Attendance dropping in recent weeks` |
| label `low` and none of the above | `Consistent attendance` |
| flagged (medium/high) but no hard factor fired | `At-risk attendance pattern` |

Plus the funnel's own strings: `Too early to assess` (L0),
`Cannot reach 80% (best case NN%)` (L1), `Requirement already secured` (L1b).

The `At-risk attendance pattern` fallback guarantees a flagged student is **never**
shown with an empty/contradictory reason (e.g. "89%" but HIGH with no explanation).

> **Important honesty point:** these reasons are a **rule-based explanation layer**
> written on top of the model — they are *post-hoc*, not the RandomForest's actual
> internal decision path. The `risk_score` is genuinely the model's output; the
> worded reason is our human-readable approximation of why. This is standard practice
> but worth stating in the report if asked about explainability.

---

##### 10. Database schema

Two nullable columns support this feature, so existing courses/data are untouched:

```sql
courses.planned_total_hours   DOUBLE PRECISION NULL
risk_scores.risk_factors      VARCHAR NULL
```

> **Updated 2026-07-30.** These were originally added by idempotent
> `ALTER TABLE ... IF NOT EXISTS` statements running at import time in `main.py`.
> That is gone — schema changes now go through Alembic only
> (`fyp-backend/alembic/versions/`, head `42c198406814`), and the backend applies
> no DDL at startup. Migration `42c198406814` also backfills
> `planned_total_hours`. See
> [CurrentCodeInfo/backend-architecture.md](../01-CurrentCode/backend-architecture.md) §3.2.

**`courses.planned_total_hours`** — total planned contact hours for the whole
semester (denominator of the 80% rule). If `NULL`, Layers 1/1b are skipped for that
course (ML-only).

**`risk_scores` table** (`fyp-backend/db/models.py`):

| Column | Type | Meaning |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | FK students | |
| `course_id` | FK courses | |
| `risk_score` | float | 0.0–1.0 probability of being barred |
| `risk_label` | string | low / medium / high / observing |
| `attendance_rate` | float | hours-weighted rate at compute time |
| `risk_factors` | string (nullable) | the "Why" explanation |
| `updated_at` | datetime | last recompute time |

One row per `(student, course)`; updated in place on recompute.

---

##### 11. API endpoints

Both live in `analytics.py`, both require a lecturer/admin session
(`require_lecturer`).

###### `POST /analytics/recompute`
Recomputes **all** enrolments. Steps:
1. Load all enrolments, courses' `planned_total_hours`, and all closed sessions
   (ordered oldest-first per course).
2. Per session, contact hours = `clamp(closed_at − opened_at, 0.5h, 6h)`, default
   `2.0h` if timestamps missing.
3. Attendance set = records with status `present` **or** `leave` (approved medical
   leave counts as attended; only `absent` counts against the student).
4. For each enrolment, build the chronological `sequence`+`hours` (a session counts
   if its `class_group` is `"All"` or matches the student's group), run `_assess()`,
   upsert the `risk_scores` row.
5. `db.commit()`, return `{"recomputed": N}`.

Everything is batch-queried up front (no N+1). Fine for demo scale; see §14 for
large-scale note.

###### `GET /analytics/risk-scores?course_id=&student_id=`
Returns the latest scores as JSON, **filtered by what the lecturer is allowed to see**
(their own courses + assigned courses), sorted by `risk_score` desc. Each row
includes `student_name/code`, `course_code/name`, `attendance_rate`, `risk_score`,
`risk_label`, `risk_factors`, `updated_at`.

---

##### 12. Frontend dashboard

File: `fyp_web/src/pages/staff/AtRisk.tsx` (React + TypeScript + Tailwind).
Type: `RiskScore` in `fyp_web/src/services/api.ts`.

Shows:
- **4 summary cards** (High / Medium / Low / Observing counts) — click to filter.
- **Course filter** dropdown (appears when >1 course) — so different courses don't
  mix in one list.
- **Risk register table**: Student · Course · Attendance% · Risk badge · **Why**
  (`risk_factors`) · Alert action. Attendance colour: red `<80%`, orange `<88%`, else
  dark. The "Alert" button is disabled for low/observing students.
- **Email Dispatch Logs** panel + **warning-email modal** — this is the teammate's
  email feature, preserved as-is (`triggerManualAlert`, `getAlertLogs`). The email
  body auto-includes the student's `risk_factors`.
- **"Recompute Risk Scores"** button → `POST /analytics/recompute`.

Sidebar theme (brand-blue) is untouched — only this page was redesigned.

---

##### 13. Demo seed data

File: `docs/ml_model_builder/seed_demo_data.py` (a **demo helper, not production**;
formerly `fyp-backend/scratch/reseed_demo_risk.py`, which no longer exists.
Clean up with `cleanup_demo_data.py` in the same folder).
Seeds course **BMCS3413**: 50 students, 27 held sessions of a 14-week /
70-hour semester (i.e. **week 9**, so the ML layer is active and Layer 1b dormant).

Instead of random simulation (which gave an alarm-heavy spread), students are
assigned **designed archetypes** with explicit early/late attendance rates, so the
demo reliably shows a teachable distribution:

| Archetype | early→late rate | count | Expected tier |
|---|---|---|---|
| safe_high | 0.99→0.99 | 12 | LOW |
| safe_mild | 0.93→0.90 | 8 | LOW |
| declining_above80 | 1.00→0.60 | 10 | MED/HIGH (≥80% but sliding — the star case) |
| borderline_flat | 0.85→0.83 | 8 | MED |
| failing_recoverable | 0.78→0.62 | 7 | HIGH (ML) |
| doomed | 0.55→0.40 | 5 | HIGH (certainty) |

Enrolments are queried with `ORDER BY id` so the same student always gets the same
archetype across reruns (reproducible demo). Resulting distribution: ~**16 low /
12 medium / 22 high**. The `declining_above80` group is the key demo: students still
at 83–89% that a formula calls "safe" but ML flags — proving §2.

---

##### 14. Known limitations

State these honestly in the report — owning them is stronger than being caught out.

1. **Synthetic data.** No real barred-student dataset exists, so the model trains on
   simulated behaviour. Accuracy on synthetic data doesn't prove real-world accuracy.
   The defensible claim is **structural** (recall advantage over a formula, §2), not
   "77% accurate in reality".
2. **Hand-tuned label thresholds** (0.35 / 0.60) — chosen for a sensible dashboard
   spread, not derived from a cost/ROC analysis. Future work: calibrate on real data.
3. **No "time remaining" feature.** The model can't distinguish "82% in week 5" from
   "82% in week 13" (the latter is safer — less time to fall). Layers 1/1b partly
   compensate at the extremes, but the ML band itself is time-blind. Adding weeks
   remaining as a 4th feature is future work.
4. **Post-hoc explanations** (§9) — the reason text approximates, doesn't extract,
   the RandomForest's true decision path.
5. **Session hours inferred** from `closed_at − opened_at` (clamped 0.5–6h). If a
   lecturer forgets to close a session, the hours can be off; a real system should
   use scheduled timetable durations.
6. **Full recompute** loads all enrolments into memory and loops in Python — fine for
   demo scale, would need batching/incremental updates for thousands of students.
7. **Model loaded once at import** — retraining requires a backend restart, and the
   `.pkl` is tied to the scikit-learn version it was trained with.

---

##### 15. File map & how to reproduce

| File | Role |
|---|---|
| `fyp-backend/ml/features.py` | The 3-feature extractor — **shared** by train & serve |
| `ml_model_builder/generate_data.py` | Simulate students → `training_data.csv` |
| `ml_model_builder/train_risk_model.py` | Compare models → save `risk_model.pkl` |
| `ml_model_builder/training_data.csv` | Generated dataset (5,628 rows) |
| `fyp-backend/ml/risk_model.pkl` | Deployed RandomForest |
| `fyp-backend/routers/analytics.py` | Funnel + `/recompute` + `/risk-scores` |
| `fyp-backend/db/models.py` | `RiskScore`, `Course.planned_total_hours` |
| `fyp-backend/alembic/versions/` | Schema migrations (no startup DDL) |
| `docs/ml_model_builder/seed_demo_data.py` | Demo seed for BMCS3413 |
| `docs/ml_model_builder/cleanup_demo_data.py` | Removes the demo bundle |
| `fyp_web/src/pages/staff/AtRisk.tsx` | Lecturer dashboard UI |
| `fyp_web/src/services/api.ts` | `RiskScore` type + API calls |

###### Reproduce from scratch
```bash
# 1. regenerate synthetic data
cd ml_model_builder
python generate_data.py           # -> training_data.csv

# 2. train & compare models, save the best
python train_risk_model.py        # -> fyp-backend/ml/risk_model.pkl (prints the comparison table)

# 3. (demo) seed the showcase course — same folder
python seed_demo_data.py          # cleanup_demo_data.py reverses it

# 4. apply migrations (the backend no longer does this at startup)
cd ../../fyp-backend
VIRTUAL_ENV=.venv .venv/Scripts/alembic.exe upgrade head

# 5. run backend (loads the .pkl) and frontend
#    then click "Recompute Risk Scores" on the At-Risk dashboard
```

###### Retrain only (data unchanged)
Just run step 2 — it re-reads the CSV and overwrites the `.pkl`. Restart the backend
to load the new model.

---

*End of reference. This document reflects the code as implemented; if you change any
`.py`/`.tsx` listed in §15, update the matching section here.*

### docs/archive/backend-architecture-audit_2026-07-29.md

> **已归档 — 不要更新这份文档。**
>
> 内容已合并进 [`02-Engineering/BACKEND-REVIEW.md`](../02-Engineering/BACKEND-REVIEW.md)
> （backend 审查的唯一现行文档）。本文档的部分判断已被修正 —— 见其「附录 C」。
>
> ⚠ **原文已丢失。** 2026-07-30 整理目录时，根目录的同名墓碑文件被 `mv` 覆盖到了
> 这里的完整原件上（原约 41KB）。`docs/` 在 gitignore 内，无 git 历史可恢复；
> OneDrive 版本历史当时可用但用户决定不回滚 —— 内容已并入 BACKEND-REVIEW.md，
> 丢的是原始审计证据。

### docs/archive/backend-review_2026-07-30.md

> **已归档 — 不要更新这份文档。**
>
> 内容已合并进 [`02-Engineering/BACKEND-REVIEW.md`](../02-Engineering/BACKEND-REVIEW.md)
> （backend 审查的唯一现行文档）。本文档的部分判断已被修正 —— 见其「附录 C」。
>
> ⚠ **原文已丢失。** 2026-07-30 整理目录时，根目录的同名墓碑文件被 `mv` 覆盖到了
> 这里的完整原件上（原约 32KB）。`docs/` 在 gitignore 内，无 git 历史可恢复；
> OneDrive 版本历史当时可用但用户决定不回滚 —— 内容已并入 BACKEND-REVIEW.md，
> 丢的是原始审计证据。

### docs/archive/backend_review_2026-07-18.md

> **已归档 — 不要更新这份文档。**
>
> 内容已合并进 [`02-Engineering/BACKEND-REVIEW.md`](../02-Engineering/BACKEND-REVIEW.md)
> （backend 审查的唯一现行文档）。本文档的部分判断已被修正 —— 见其「附录 C」。
>
> ⚠ **原文已丢失。** 2026-07-30 整理目录时，根目录的同名墓碑文件被 `mv` 覆盖到了
> 这里的完整原件上（原约 35KB）。`docs/` 在 gitignore 内，无 git 历史可恢复；
> OneDrive 版本历史当时可用但用户决定不回滚 —— 内容已并入 BACKEND-REVIEW.md，
> 丢的是原始审计证据。

### docs/archive/manual_test_checklist.md

#### 手动测试清单 — S1/S4/S5 重构验证

> 本批改动是**重构(行为不变)**:把重复的 404 / 400 / 邮箱校验收进
> `utils/db_helpers.py` 四个 helper(`get_or_404` / `ensure_unique` /
> `require_email_domain` / `require_own_profile`)。
> 最该验的是**出错路径**,因为那些正是被搬进 helper 的代码。
> 标 ⭐ 的项 = 会踩到本次改动。

Backend: `http://127.0.0.1:8003`

---
1 = correct, 2= wrong/error
##### 🔐 一、登录 / 注册 (auth.py)

- [1 ] 1. 现有 admin 账号登录 → 进 admin 后台
- [1 ] 2. lecturer 账号登录 → 进讲师端
- [ 1] 3. student 账号登录 → 进学生端
- [1 ] 4. ⭐ 注册学生,邮箱**不是** `@student.school.edu` → ❌ "must end with @student.school.edu"
- [ 1] 5. ⭐ 注册学生,邮箱用**已存在**的 → ❌ "Email already registered"
- [1 ] 6. ⭐ 注册学生,学号用**已存在**的 → ❌ "Student code already exists"
- [(no roles choosing,register student and satff is on different page , just remain current one) ] 7. 注册时选 role=lecturer → ❌ "cannot be registered directly"
- [ 1] 8. 用错密码登录 → ❌ 登录失败

(USER)Comment : 
- admin add student page the search function only search for current pages ,search all registered students, check also same things for admin add staff page , and also add first and last page not only previous and next
- wrong password or email login didnt not have a notification, add a notification
- currently login page student and satff/admin login portal is two different page but didnt really differentiate , means that student can enter there student page with the staff/admin portal, same for staff and admin also can enter there own page in student login portal
---

##### 🛠️ 二、Admin — 人员管理 (admin_staff / admin_students)

- [ ] 9. 新建讲师,填完整 → ✅ 成功
- [ ] 10. ⭐ 新建讲师,邮箱不是校方后缀 → ❌ 后缀错误
- [ ] 11. ⭐ 新建讲师,staff_id/email 用重复的 → ❌ 重复报错
- [ ] 12. ⭐ 新建学生(同上重复 / 邮箱测试)→ ❌ 对应报错
- [ ] 13. ⭐ 编辑某学生资料并保存 → ✅ 成功
- [ ] 14. ⭐ 编辑**不存在的** ID(URL 里 id 改成 999999)→ ❌ 404 "not found"
- [ ] 15. ⭐ 删除一个学生 / 讲师 → ✅ 成功

(USER)Comment : 
- improve the UIUX for the roles choosing when register staff the dropdown list is ugly 
- currently when all fireld is correctand register a staff will turn to white screen and when i reload nothing happen (wrong format or correct also same white screen), i will continue test the section 2 after this bug fix
- 
---

##### 📚 三、Admin — 学术管理 (admin_academic)

- [ ] 16. 新建 Programme → ✅ 成功
- [ ] 17. ⭐ 新建重复 code 的 Programme → ❌ 重复报错
- [ ] 18. 新建 Course → ✅ 成功
- [ ] 19. ⭐ 新建重复 code 的 Course → ❌ 重复报错
- [ ] 20. ⭐ **编辑 Course 但不改 code,保存 → ✅ 成功(不该报"已存在")**
- [ ] 21. ⭐ 编辑不存在的 course id → ❌ 404
- [ ] 22. 给学生做选课 / 排课,查看时间表 → ✅ 正常

> #20 是重点:`ensure_unique` 带了 `exclude_id`,自己改自己不该判重复。务必试。

---

##### 🧑‍🏫 四、Lecturer 端 (lecturers / sessions)

- [ ] 23. ⭐ 看"我的课程"列表 → ✅ 正常 (require_own_profile)
- [ ] 24. ⭐ 打开某节课,开启点名 session → ✅ 生成 session
- [ ] 25. ⭐ 看某 session 的出勤名单 → ✅ 名单正常
- [ ] 26. ⭐ 手动改某学生出勤 (present/absent) → ✅ 保存成功
- [ ] 27. ⭐ 打开一个不存在的 session id → ❌ 404

---

##### 🎓 五、Student 端 (student_self / students / sessions)

- [ ] 28. ⭐ 看学生 dashboard(课程、出勤率)→ ✅ 数字正常 (require_own_profile)
- [ ] 29. ⭐ 看"我的时间表" → ✅ 正常(joinedload 两处**有意保留未改**)
- [ ] 30. 注册人脸 / 更新人脸 → ✅ 成功
- [ ] 31. ⭐ 对进行中的 session 做人脸打卡 → ✅ 记为 present
- [ ] 32. ⭐ 对已结束 / 不存在的 session 打卡 → ❌ 报错
- [ ] 33. 看自己的出勤率 % → ✅ 与讲师端 / admin 端一致

---

##### 📊 六、Admin — 出勤 + 分析 + 配置 (admin_attendance / analytics / admin_config)

- [ ] 34. ⭐ Admin 看全局 sessions 列表 → ✅ 正常
- [ ] 35. ⭐ Admin 改某条出勤记录 → ✅ 成功
- [ ] 36. 触发"重算风险 / 出勤"(recompute)→ ✅ 跑完,数字不乱
- [ ] 37. ⭐ 看 at-risk 学生分析页 → ✅ 列表 + 原因显示
- [ ] 38. ⭐ 打开安全设置(network check 等)→ ✅ 能读能改

---

##### ✅ 最快一次过(只跑这 8 个就覆盖四个 helper)

- [ ] **#4** 邮箱后缀错 → `require_email_domain`
- [ ] **#5** 重复邮箱 → `ensure_unique`
- [ ] **#20** 改课不改 code 不报重复 → `ensure_unique(exclude_id)`
- [ ] **#14** 编辑不存在 id → `get_or_404`
- [ ] **#23 / #28** 讲师、学生进各自主页 → `require_own_profile`
- [ ] **#26** 讲师改出勤 → `get_or_404`
- [ ] **#31** 学生人脸打卡 → `get_or_404` + 核心业务
- [ ] **#36** recompute → 数字与改动前一致

**这 8 个全绿 = 本批重构行为没变。**

### docs/archive/plan_class_meetings_sync.md

#### I — 课表单一真相:class_meetings 表(播种 + 防撞校验)

##### 目标
消灭"两套课表"矛盾:让 DB 成为课表的**唯一真相**,admin 能改、显示页和签到引擎都读同一处。**不碰坏正在工作的签到引擎**——靠"播种时字节级等于现在算法输出"来保证第一天行为零变化。

##### 核心手法(为什么低风险)
`calculate_schedule(db)` 现在返回 dict:`{"Lecture-3":{day,start,end,room}, "Tutor-5":{...}, ...}`,被 6 个文件 20 处调用,全都是 `map.get(key)["day"/...]`。
→ 把 `calculate_schedule` 改成**从新表读、返回一模一样的 dict** → **20 个调用点一行都不改**,签到引擎接口不变。

##### 后端改动

###### 1. 新表 `class_meetings`(models.py)
一行 = 一节固定课(一门课的 Lecture,或一个 Tutor/Practical 分配)。
```
id            PK
meeting_key   String unique   # "Lecture-{course_id}" / "Tutor-{assign_id}" / "Practical-{assign_id}"
course_id     FK courses ON DELETE CASCADE
assignment_id FK course_staff_assignments ON DELETE CASCADE, nullable  # 仅 Tutor/Practical
role          String          # Lecture / Tutor / Practical
day start end room  String
lecturer_id   FK lecturers, nullable
```
`meeting_key` 就是现在 dict 的 key,读回来重建 dict 是 O(1)。

###### 2. 迁移 + 播种(main.py migrations 块)
建表;若 `class_meetings` 为空 → 跑一次现有确定性算法(种子42),把每个 slot 落成一行。
**关键:播种输出 = 现在算法输出,逐条一致 → 第一天课表/签到窗口零变化。**
迁移块用 fail-loud(承接 C 项发现的教训,单独 try 段、出错抛出而非静默 print)。

###### 3. scheduler.py 重写
- `calculate_schedule(db)` → 改为 `SELECT * FROM class_meetings`,重建并返回同形 dict。删掉内存缓存 + `invalidate_schedule_cache`(死码,不再需要:一次索引查询比旧算法便宜)。
- 保留算法逻辑,改名 `generate_clashfree_slots(db, existing_rows)` —— 只在"播种"和"建课/建分配时给新行找不撞格子"用。

###### 4. 写端点挂"自动排一节 + 落表"(admin_academic.py)
- `create_course`:插入后,给它的 Lecture 用 `generate_clashfree_slots` 挑一个不撞的格子 → 插 class_meetings 行。挑不到 → 400(和现在"slots fully booked"行为一致)。
- `create_assignment`(Tutor/Practical):同理插一行。
- `update_course` / `delete_*`:删掉对 `Course.schedule_*` 的写(那 4 列作废);course/assignment 删除靠 FK CASCADE 带走 meeting 行。
- 删死码 `assign_random_schedule`。

###### 5. admin 编辑课表(新端点)
- `PUT /admin/timetable/{meeting_id}`:body {day,start,end,room}。**防撞校验**:查 class_meetings 有没有别的行占了同 (day,start,room) 或同 (day,start,lecturer_id),撞了 → 400 报清楚撞谁。通过则更新行。
- `GET /admin/timetable`(已存在,已读算法)→ 返回里带上 `meeting_id` 供编辑。

###### 6. 显示端点改读表(消除矛盾的关键)
现在仍读 `Course.schedule_*` 的 3 处,改成读 class_meetings(即 `calculate_schedule` 里那节课的时间),让所有屏幕一致:
- `admin_academic.py:get_courses`(admin 课程列表)
- `lecturers.py:get_lecturer_courses`(讲师"我的课程")
- `student_self.py:get_enrolments`(学生"我的选课")
这样"我的选课"和"我的课程"两页显示同一时间,矛盾消失。

##### 前端改动(web)
- `staff/Timetable.tsx`(admin 视角已用 `adminGetTimetable`):在"Semester Timetable By Course"表格每行加「编辑」按钮 → 弹窗改 day/start/end/room → 调新 `adminUpdateTimetableSlot`。讲师视角保持只读。
- `services/api.ts`:加 `adminUpdateTimetableSlot(meetingId, {day,start,end,room})`;timetable 类型加 `meeting_id`。
- 其余不动:课程列表/选课页 API 形状不变(只是数据来源从算法列变成表),前端无感。

##### Course.schedule_* 那 4 列怎么办
**保留不删**(避免破坏性迁移),但作废——不再读、不再写。显示全部走 class_meetings 单一真相。答辩可说明是历史遗留列、已弃用。

##### 验证计划(确保签到不坏)
1. 迁移前先抓一份当前 `calculate_schedule` 输出存下。
2. 迁移播种后,重新读表构建 dict,**逐 key 比对完全一致**(证明第一天零变化)。
3. import 冒烟 + 跑 session_sync、open/close、check-in 路径确认正常。
4. 建一门新课 → 确认自动落一行且不撞;admin 改一节 → 确认防撞校验 + 显示三页一致。
5. web `tsc` 编译通过。

##### 影响与代价
- **收益**:单一真相在 DB、SQL 直接查、admin 真能改课表、三页时间一致、符合真实大学"自动排+人工微调"模式(答辩加分)。
- **代价**:较大改动(新表+迁移+scheduler 重写+4 端点+显示3处+前端)。但引擎接口不变、有逐条比对兜底,风险可控。
- **不做**:不动签到引擎的读取接口;不删旧列(非破坏)。

