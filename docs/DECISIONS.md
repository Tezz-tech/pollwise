# Decisions log

One line per decision: date — decision — why. Claude Code appends here whenever the spec is ambiguous.

- 2026-11-06 — Videos hosted on the client's YouTube channel as unlisted — no recurring hosting cost; client requirement.
- 2026-11-06 — Default pass mark 70%, configurable by the super admin — client decision.
- 2026-11-06 — Grading is all-or-nothing per question in v1 — simpler to explain to learners and to audit.
- 2026-11-06 — No hearts, gems, shop or leagues — mandatory training must never lock a learner out; ranking states is unwise in an election context.
- 2026-11-06 — Reminders are local notifications only — free, no push service needed.
- 2026-11-06 — Geography captured to LGA level only; ward and polling unit are optional free text — 774 LGAs is reliable public data; the polling unit register is out of scope.
- 2026-11-06 — Geo source is xosasx/nigerian-local-government-areas `lgas.json` (MIT licence) — it matches all 37 per-state counts in docs/data/lga-counts.json exactly; cleaned copy committed as server/data/geo.json.
- 2026-11-06 — State codes are the dataset's two-letter codes (e.g. AB, FC) and LGA codes are `STATECODE-NAME-SLUG` — stable, readable, and unique (checked at seed time).
- 2026-11-06 — The geo seed verifies and produces geo.json in Phase 0; loading State/Lga into MongoDB waits for the Phase 1 models — avoids writing a model before its phase.
- 2026-11-06 — Routes for the learner app live in `mobile/app/` (CLAUDE.md), not `src/app/` as the Expo template's AGENTS.md suggests; non-route code lives in `mobile/src/` — CLAUDE.md is the project rule.
- 2026-11-06 — Mobile is JavaScript (the Expo template was generated with the blank JS template and `.claude/` plugin settings were removed) — CLAUDE.md forbids TypeScript.
- 2026-11-06 — Sound files are 16-bit mono WAV at 11,025 Hz, not 44.1 kHz — at 44.1 kHz the 1-second `pass` sound alone is ~88 KB, over the 25 KB limit; the tones sit below 2 kHz so the lower rate is inaudible in practice.
- 2026-11-06 — `reflection` questions ignore any submitted points and are always worth 0 — SPEC §5 says points are forced to 0, so the input is dropped rather than rejected.
- 2026-11-06 — Environment is read with Node's built-in `process.loadEnvFile` instead of dotenv — dotenv is not in the approved stack, and Node 22+ provides the same behaviour.
- 2026-11-06 — `compression` (SECURITY §6) is NOT installed — it is not in the approved stack; needs approval before it is added. Deferred to Phase 10 hardening.
- 2026-11-06 — `@hookform/resolvers` (needed to connect react-hook-form to zod) is NOT installed yet — not in the approved stack; needs approval before Phase 5.
- 2026-11-06 — Admin Tailwind theme is generated from shared/tokens.js by admin/scripts/build-theme.js, so no colour is hard-coded in admin components — CLAUDE.md token rule.
- 2026-11-06 — Nunito font files for the admin are copied from `@expo-google-fonts/nunito` (SIL OFL) into admin/public/fonts — one font source for web and mobile, no CDN call (CSP stays `'self'`).
- 2026-11-06 — Tally uses the exported PNG in Phase 0; the animated react-native-svg version (DESIGN §3) is built in Phase 7 — keeps Phase 0 small.
- 2026-11-06 — `mongodb-memory-server` install script is approved for that exact version (`allowScripts` in package.json) — the test database needs its binary; dev-only dependency.
- 2026-11-06 — Audit: `npm audit --omit=dev` has 5 moderate findings (expo, @expo/cli, @expo/fingerprint, glob, minimatch), and the dev audit adds @eslint/js/eslint via minimatch. No high or critical. The only offered fix downgrades expo to 53, so it is not applied; recheck at Phase 10.
- 2026-11-06 — Node's `process.loadEnvFile` does not override variables already set in the real environment — production secrets set by the host win over any file.
- 2026-11-06 — Mongoose `sanitizeFilter` makes `{ $ne: null }` injected filters fail to cast, so they match nothing — tested in server/test/mongo.test.js.

Phase 1 — server foundation, auth and security

- 2026-11-06 — `compression` is NOT installed — the Phase 1 prompt and SECURITY §6 ask for it, but it is not in the approved stack; needs approval first. Deferred.
- 2026-11-06 — No QR image is generated on the server. TOTP setup returns the `otpauth://` URI and the base32 secret; the admin site draws the QR in Phase 5. A QR library is not in the approved stack, so it needs approval first.
- 2026-11-06 — The admin CSRF double-submit cookie is readable by the admin JavaScript only when the admin site and the API share an origin (for example, behind one reverse proxy). This is an assumption for deployment; if the two are on different origins, the design must change.
- 2026-11-06 — While an account is locked, the response is the same generic INVALID_CREDENTIALS, so the app cannot say "locked". Chosen so a lock never reveals that an account exists. The lock duration doubles per lockout (15 min, 30, 60 … capped at 24 h); the lockout count resets on a successful login.
- 2026-11-06 — `failedLogins` counts failures since the last lockout, not since the last success, so an expired lock cannot be ignored by a fresh attacker.
- 2026-11-06 — A deactivated or pending-deletion account is told so (ACCOUNT_DEACTIVATED) only after the right password is given; before that, every failure is generic.
- 2026-11-06 — Registration returns EMAIL_IN_USE / PHONE_IN_USE. That reveals whether an address is registered, which the spec does not address; limited to 5 attempts per hour per IP.
- 2026-11-06 — Nigerian phone numbers are accepted as 0XXXXXXXXXX, 234XXXXXXXXXX or +234XXXXXXXXXX, and must be a 10-digit national number starting 7, 8 or 9 (mobile ranges). libphonenumber is not in the approved stack, so the rule is kept in server/src/utils/phone.js.
- 2026-11-06 — The common-password list is the SecLists 10k most common (MIT licence), stored in server/data/common-passwords.txt.
- 2026-11-06 — Reset codes are argon2id-hashed (not SHA-256) because they are six digits. Five attempts per code, 15-minute expiry, and the code is spent on use.
- 2026-11-06 — Invitation and refresh tokens are 32 random bytes, stored as SHA-256 (they are not guessable, so a fast hash is correct).
- 2026-11-06 — Access tokens last 15 minutes. `requireAuth` reads the user from the database on every request (no cache), so a deactivation or tokenVersion bump takes effect immediately. SECURITY §2 allowed a brief cache; no cache is simpler and safer for now. Revisit under load.
- 2026-11-06 — Refresh reuse detection: an atomic claim (`findOneAndUpdate` with `revokedAt: null`) makes concurrent rotations impossible to both succeed; presenting an already-used token revokes the whole family.
- 2026-11-06 — Mongoose cannot cast `{ $exists: false }` on Date fields in this version, so "not revoked" is written as `revokedAt: null` (which matches missing and null).
- 2026-11-06 — `sanitizeFilter` blocks any operator in a query. Our own time-window operators are wrapped with `mongoose.trusted()`. This is intentional and each use is listed in the code.
- 2026-11-06 — Admin two-step login: the challenge is a random token, stored only as a hash on the user, valid 5 minutes, one use, five attempts. Recovery codes (10, argon2-hashed) are single-use and shown once.
- 2026-11-06 — TOTP codes are single-use within their 30-second step: the last accepted time step is stored and any code at or before it is refused (replay protection).
- 2026-11-06 — Content admins without TOTP sign in with the password alone. Super admins always need TOTP (SPEC §2, SECURITY §1).
- 2026-11-06 — Admin refresh cookies are always `Secure`. Chrome treats http://localhost as a secure context, so local development still works.
- 2026-11-06 — The `create-super-admin` CLI refuses an email that already exists, prints the TOTP secret and URI once, and reuses that pending secret at first sign-in (so the printed one is the one that works). It has no default account and no seeded password.
- 2026-11-06 — `POST /admin/admins` (invite) is built now because the invitation flow needs an entry point; listing and revoking admins remain Phase 4.
- 2026-11-06 — The anonymisation job runs once a day (unref'd timer) and is only started by server.js, never by createApp, so tests stay deterministic. Certificate revocation in the deletion step waits for the Certificate model (Phase 3).
- 2026-11-06 — Development without SMTP_HOST does not send reset codes or invitations; the log records that a mail was not sent and never the code or link. Production refuses to start without SMTP.
- 2026-11-06 — Rate-limit counters are in memory and per process (SECURITY §5). A shared store is required before running more than one server instance.
- 2026-11-06 — The default daily goal is 10 XP until onboarding sets it (SPEC §3 does not give a default).
- 2026-11-06 — Geography is loaded into MongoDB with `npm run seed:geo:load -w server` (upserts, idempotent, count-checked first). The reference data stays in server/data/geo.json.
- 2026-11-06 — Access codes are argon2-hashed; the management endpoints come in Phase 6.

Phase 2 — content and admin course APIs

- 2026-11-06 — Edits to a published course take effect at once; a learner's attempt keeps the question version it started with, so an edit never changes a live attempt (SPEC §8.2).
- 2026-11-06 — Content admins may read published courses by others but not drafts (a draft returns 404, so it is not revealed); they may change only their own courses, and super admins may change any course (SPEC §2).
- 2026-11-06 — Added `POST /admin/courses/:id/archive` (super admin). SPEC §6 says "archive instead" when a course has enrolments, but lists no route for it.
- 2026-11-06 — A cover image can only be attached after the course exists, because uploads are scoped to a course. Create therefore takes no image.
- 2026-11-06 — Every new module gets an empty assessment, so the publish checklist can see it from the start.
- 2026-11-06 — Item ids inside questions (options, ordering items, matching pairs) are random and chosen by the server. A learner sees these ids, so readable ids would leak the answer (SECURITY §3). Matching uses a separate random `rightId` for the right-hand column so the payload never shows which pairs match.
- 2026-11-06 — A question's version increases only when what a learner sees or the answer changes. The comparison uses words, not ids, because ids are regenerated on each save.
- 2026-11-06 — Publish returns 422 PUBLISH_CHECKLIST_FAILED with every problem as a list (SPEC §8.5).
- 2026-11-06 — Uploads: sign (one folder, one kind, five-minute window) → direct upload → confirm against Cloudinary (format, size, folder, host). Content may only reference confirmed uploads, and takes size and page count from the confirmed record, not from the request (SECURITY §7).
- 2026-11-06 — PDFs are uploaded with resource type `image` and format `pdf`, so Cloudinary reports page counts. Images accept JPEG, PNG and WebP only; SVG is refused at confirmation and removed.
- 2026-11-06 — YouTube lookup uses the public oEmbed endpoint with no API key (SPEC §7). Only the title is taken from the response; the thumbnail is always rebuilt from the video ID on YouTube's image host, and a video lesson's thumbnail is never accepted from the request.
- 2026-11-06 — Reorders must list every item exactly once; anything else is refused. Module and lesson `order` fields are kept equal to their index, and their indexes are not unique, because a reorder would otherwise collide with itself part-way through.
- 2026-11-06 — Deleting a course is refused once anyone has enrolled (409 COURSE_HAS_ENROLMENTS). The Enrollment model is defined in Phase 2 for this check.
- 2026-11-06 — Preview uses the same learner serializers as the app, so an admin previews exactly what a learner receives.
- 2026-11-06 — `cloudinary` and `pdfkit` installed (both in the approved stack). `pdfkit` is used in Phase 3.
- 2026-11-06 — Mongoose operator filters (`$in`, `$ne`, `$gt`) are wrapped in `mongoose.trusted()`, because `sanitizeFilter` otherwise turns them into literal matches.

Phase 3 — the learning engine

- 2026-11-06 — Practice lessons complete once every question is answered. XP is paid on completion as 5 + 2 per correct answer (SPEC §8.3), not per answer, so a practice cannot be farmed question by question.
- 2026-11-06 — A video heartbeat's own `durationSec` is ignored; completion uses the length stored by the admin. A client cannot shorten a video by reporting a short one.
- 2026-11-06 — Text and document minimum times count from the first time the lesson is opened (`openedAt`), set by the lesson GET. Completing before that is refused with 409 TOO_SOON.
- 2026-11-06 — A learner who has not opened a video cannot send heartbeats (409 TOO_SOON), so every watched second is tied to an opened lesson.
- 2026-11-06 — The streak counts a day when the learner completes a lesson or submits a check, pass or fail. SPEC §8.4 says "completed"; submitting is the closest event that a learner controls.
- 2026-11-06 — Streak updates use an optimistic concurrency check on the stored last-active day, retried up to three times, so two simultaneous completions cannot both extend the streak.
- 2026-11-06 — The daily goal is announced once per Lagos day by writing a zero-amount XP marker with the same unique index that protects XP.
- 2026-11-06 — First-pass XP is granted once per assessment: pass 20, first try +10 (first attempt only), perfect +10 (score 100). The claim is a conditional update on `passedModuleIds`, so a retry or a second attempt pays nothing.
- 2026-11-06 — `Enrollment` gained `passedModuleIds` (the unlock rules read it) and `bestScores` is updated with `$max`, so the best score survives any order of attempts.
- 2026-11-06 — Only one attempt may be open per learner and assessment. A partial unique index enforces it, and a concurrent start returns the attempt that won.
- 2026-11-06 — Attempts expire lazily: the first request after the time limit settles the attempt (grades what was answered, applies progression, marks it expired). A learner's answers are never lost. Any events from settling inside a GET are applied to XP but not returned to that request; the app refreshes `/me/stats` to pick them up.
- 2026-11-06 — Answering an expired attempt returns 409 ATTEMPT_EXPIRED, and the answers are already submitted.
- 2026-11-06 — When drawCount is set, the attempt draws that many from the whole bank (reflection included). The pass mark is taken from the assessment when the attempt starts, so a later settings change does not move it.
- 2026-11-06 — Learner answer responses include `correctAnswer` only when the assessment's reveal rule is `immediately`, and the explanation appears only after an answer. Submit returns a review only as the reveal rule allows (SPEC §8.2).
- 2026-11-06 — The catalogue defaults to the learner's own role ("For you", SPEC §6). `role=all` lifts the filter.
- 2026-11-06 — Locked lessons and checks return 423 LESSON_LOCKED / ASSESSMENT_LOCKED. Not being enrolled returns 403 NOT_ENROLLED, checked before the lock, so the reason is clear.
- 2026-11-06 — `/me/stats` returns readiness only when the learner's role has required courses; otherwise it is null and the app shows course progress instead (SPEC §8.7).
- 2026-11-06 — Certificates: code of ten Crockford base32 characters, unique by index; score is the rounded mean of the best module scores; the PDF is rendered on demand and never stored; the verify endpoint returns only validity, name, course and date.
- 2026-11-06 — Anonymising an account now revokes its certificates (SECURITY §11). This closes the Phase 1 deferral.
- 2026-11-06 — Learner routes attach authentication per route, not per router, so mounting order can never put a public route behind a login check.
- 2026-11-06 — Rate limits added: heartbeat 20/min per user, attempt answers 60/min per user, verify 30/min per IP (SECURITY §5).
- 2026-11-06 — The answer-leak test walks every learner response across catalogue, outline, lessons, practice, attempts and submit. It fails on any answer key, on the explanation before an answer, and on aligned matching pairs.
- 2026-11-06 — Certificate assets: the PollWise logo from brand/png and Nunito from the approved `@expo-google-fonts/nunito` package (SIL OFL), copied into server/assets.
- 2026-11-06 — `pdfkit` (approved stack) renders certificates. It uses the built-in font set only for what is not Nunito, so no font download happens at runtime.

Phase 4 — super admin, reports, users

- 2026-11-06 — Each enrolment carries the learner's state and LGA (`stateCode`, `lgaCode`), copied at enrolment and updated whenever the learner's profile changes. Geography reports read enrolments directly. The first version joined every enrolment to its learner and took 14 s on 50,000 learners; the copy brings it to about 400 ms.
- 2026-11-06 — Enrolments gained `extraAttempts` (keyed by assessment). A super admin's grant adds one; the attempt limit is `maxAttempts + granted`.
- 2026-11-06 — The CSV export is audit-logged before the first row is written, so an attempted export is recorded even if the download breaks off. It carries only the agreed columns (no hashes, codes or answers), and any cell starting with `= + - @` is prefixed with an apostrophe so it cannot run as a formula when opened.
- 2026-11-06 — Opening a learner's detail page (which shows answers) writes a `user.view` audit entry. SECURITY §10 does not list it, but answers are sensitive, so the view is recorded.
- 2026-11-06 — Deactivating a learner bumps their token version and revokes their refresh tokens in the same request, so the next call with an old token fails. A super admin cannot deactivate their own account (409), and a learner whose account is waiting for deletion cannot be changed.
- 2026-11-06 — Revoking an admin ends their sessions. A super admin cannot revoke themself, and the last active super admin cannot be revoked (409).
- 2026-11-06 — The reset sent by an admin uses the same code path as the public forgot-password route (`sendResetCode`), so the code rules (15 minutes, five attempts, single use) are identical.
- 2026-11-06 — Access codes can be added and switched off but not deleted, so their use counts remain accurate. Only argon2 hashes are stored, and settings responses carry labels and counts, never hashes.
- 2026-11-06 — The audit log is read-only through the API: the query route exists, and no route writes or deletes entries.
- 2026-11-06 — Report definitions: "active this week" means a sign-in in the last seven days; completion rate is completed enrolments ÷ enrolments; average score is the mean of submitted attempt scores; attempts per learner is submitted attempts ÷ enrolments on that course.
- 2026-11-06 — Performance (scripts/measure-reports.js, 50,000 learners, 72,919 enrolments, 145,869 attempts, in-memory MongoDB on Windows): overview 397 ms median / 445 ms worst; courses 381 / 399 ms; geography by state 414 / 437 ms; drill-down 19 / 20 ms; learner list 30 / 32 ms. All under 500 ms, but the margin is thin for three reports. Re-measure on the production Atlas cluster before launch.

Index review (Phase 4)

- users: `_id`, `email` (unique, sparse), `phone` (unique, sparse), `role+status`, `role+createdAt`, `role+lastLoginAt`, `role+profile.stateCode`, `role+profile.lgaCode`, `status+deletionRequestedAt`. The learner list and the overview run on the `role+…` indexes.
- enrollments: `userId+courseId` (unique), `courseId`, `startedAt`, `completedAt`, `stateCode+lgaCode`. The reports group on `courseId`, `stateCode` and the date fields.
- assessmentattempts: `userId`, `userId+assessmentId`, `userId+assessmentId+status` (partial unique for in-progress attempts), `courseId+status` (course report).
- lessonprogress: `userId+lessonId` (unique), `userId+courseId`.
- xpevents: `userId+reason+refId` (unique, the no-double-award guarantee), `userId+day`.
- auditlogs: `at`, `actorId`, `action`.
- certificates: `userId+courseId` (unique), `code` (unique).
- Development seed: `npm run seed:load -w server` (fake learners, clearly marked; refuses nothing, so never point it at production). `npm run measure:reports -w server` times the reports.

Phase 5 — admin website: shell, auth, course builder

- 2026-11-06 — The admin reaches the API through the same origin (Vite proxy in development, a reverse proxy in production). That keeps the refresh cookie scoped and lets the admin read the CSRF cookie; it is the assumption noted in Phase 1.
- 2026-11-06 — The access token is held in memory only. Silent refresh uses the httpOnly cookie plus the X-CSRF-Token header (SECURITY §1). No token is written to localStorage or sessionStorage (checked).
- 2026-11-06 — The TOTP setup screen shows the setup key and the otpauth link, with copy buttons. It does not draw a QR code: that needs a QR library, which is not in the approved stack. Needs approval before a QR is added.
- 2026-11-06 — Client-side validation uses zod with react-hook-form and no resolver package, because @hookform/resolvers is not approved. Server errors are mapped back to fields by their path.
- 2026-11-06 — The text editor allows only headings 2 and 3, paragraphs, bold, italic and lists (SECURITY §4). The allowed set lives in lib/richText.js and is tested against the server's validator.
- 2026-11-06 — Question drafts use temporary ids; the server replaces them with random ids (SECURITY §3). A question's type can be changed, which resets its answer part.
- 2026-11-06 — The learner preview shows the saved version of a lesson, check or course, not unsaved edits. Save first; the preview says so by design.
- 2026-11-06 — The video length is read once, with the YouTube IFrame API on youtube-nocookie.com, when a video lesson has none, and saved automatically (SPEC §7).
- 2026-11-06 — The publish confetti is a small motion-driven burst in brand colours. It is skipped entirely for reduced motion (DESIGN §3).
- 2026-11-06 — Dependencies added (all approved stack): motion, @dnd-kit/core, @dnd-kit/sortable, @tiptap/react, @tiptap/starter-kit, @tiptap/pm (required by the TipTap React package), sonner, lucide-react, react-hook-form, @tanstack/react-query, zod. The dnd-kit utilities package is not used; the transform is computed inline.
- 2026-11-06 — Routes for the courses list and the builder load lazily; the builder is the largest chunk (about 509 KB before compression).
- 2026-11-06 — Server fix found by the end-to-end run: course creation required `category`, but the field is documented as optional. Now optional, with a regression test.
- 2026-11-06 — Not built in this phase: the super admin screens (users, reports, admins, settings, audit log). Their API is complete and tested (Phase 4); the screens are a separate piece of work.
- 2026-11-06 — Verification limits: no browser was available in this session, so the screens were not seen or clicked. Verified instead: the production build, lint, 12 unit tests for the editors' pure logic, and an end-to-end run through the Vite proxy (sign-in, TOTP, cookie flags, CSRF refresh, course build, checklist and preview) against a real API and MongoDB.
- 2026-11-06 — The "done when" publish needs Cloudinary credentials: the cover image and the PDF lesson both go through the signed upload. Without them the checklist correctly reports the cover as missing.

Phase 6 — super admin screens

- 2026-11-06 — Dashboard charts use Recharts 3.10.1 (approved stack), coloured from the tokens: jade, amber and sky series, rounded bars, no gridline clutter. KPI figures count up, and the count-up is skipped for reduced motion.
- 2026-11-06 — The learner list waits 300 ms after typing before it queries, and it returns to page 1 when a filter changes. The LGA list is enabled only after a state is chosen, and changing the state clears the LGA.
- 2026-11-06 — CSV export is fetched with the access token in the header and saved from a blob. A plain download link would put a token in the URL or drop the Authorization header.
- 2026-11-06 — Reports drill down from state to LGA with the `stateCode` query. They read the denormalised area on enrolments, so no join runs on the 50,000-learner seed.
- 2026-11-06 — The public /verify/:code page shows only validity, the learner's name, the course and the issue date (SPEC §8.6). An unknown code and a revoked one look the same.
- 2026-11-06 — Content admins get a "not for your role" page on super-admin URLs, and the nav omits those links. The server still enforces the role on every route.
- 2026-11-06 — admin/.prettierignore was added because Prettier reads its ignore file from the working directory only. Without it, the admin lint gate failed on build output and the generated theme.
- 2026-11-06 — Smoke test through the Vite proxy against the 50,000-learner dev seed: 21 calls (session, users with each filter, CSV export, user detail, three reports, admins, settings, audit log, geo lists, verify) all returned 200 in 11–900 ms. Report timings (scripts/measure-reports.js): overview 396 ms median, 500 ms worst; courses 284 / 291 ms; geography 261 / 346 ms; drill-down 12 ms; learner list 22 / 76 ms.
- 2026-11-06 — Risk: the name, email and phone search took about 0.9 s on the 50k seed. It is not covered by the report timings. Before launch, add a text or prefix index for search, or search by prefix only.
- 2026-11-06 — Verification limits: no browser was available, so no screen was seen or clicked. Checked instead: admin lint (ESLint and Prettier), 12 admin unit tests, the production build, the 300 server tests, and the API smoke test above. No certificate exists in the dev data, so the valid branch of /verify was not exercised.
- 2026-11-06 — A dev-only super admin (dev-smoke@pollwise.test) was created in the local dev database for the smoke test. It is not in the repo. Remove it before any shared environment is used.

Phase 7 — mobile foundation, onboarding, first lesson

- 2026-11-06 — Routes stay in mobile/app/ (CLAUDE.md layout), not src/app/ as mobile/AGENTS.md suggests. CLAUDE.md is the project's rule and the Phase 0 layout already uses mobile/app/. Non-route code lives in mobile/src/.
- 2026-11-06 — Dependencies are all from the approved stack: reanimated, worklets, gesture-handler, svg, bottom-sheet, webview, youtube-iframe, zustand, @tanstack/react-query. No QR, compression, file-system or time-picker package was added; those need approval first.
- 2026-11-06 — react-native-gesture-handler is 3.5.0 and react-native-worklets 0.13.1, the versions expo-router 58.0.30 and reanimated require. The SDK list says 3.3.0 / 0.13.0, so expo-doctor flags them. The mobile package lists them under expo.install.exclude, which keeps one copy and a passing doctor. Revisit when expo-router moves.
- 2026-11-06 — Tokens: the API client, offline queue, error copy, phone and password rules, reminder planning, course ranking and the TipTap-to-card conversion are pure modules with 40 unit tests. Native wrappers (storage, sound, notifications, stores) sit on top and are not unit-tested.
- 2026-11-06 — Refresh tokens live in expo-secure-store; the access token is in memory only (SECURITY §1). Learners receive the refresh token in the JSON body, as the server sends it.
- 2026-11-06 — The offline queue stores one secure-storage key per item, so each value stays small. Heartbeats coalesce per lesson and are dropped first when the queue is full (MAX_QUEUED = 200). A network failure stops the flush; a server rejection drops the item, because retrying cannot help.
- 2026-11-06 — Reminders: no push. A week of dated local notifications is planned from the learner's time, rebuilt on every launch and after settings change. A learner who has learned today starts tomorrow. The election line appears on every third reminder, only when a date is set and still ahead.
- 2026-11-06 — The reminder time step offers four presets (07:30, 12:30, 18:30, none) rather than a free time picker, because no time-picker library is approved. Revisit when one is approved.
- 2026-11-06 — The sound and haptic settings are on by default; sound uses the silent switch on iOS (playsInSilentMode false). Tap sound is preloaded but not played by lip buttons, which keeps the DESIGN §4 "off by default" rule simple.
- 2026-11-06 — The celebration queue has two lanes: pop-ups (streak, goal, module pass, course) wait for the screen to finish, and module_unlocked waits for the Learn path to mount. XP and lesson_completed are shown inline on the lesson-complete screen.
- 2026-11-06 — Lessons pause the celebration queue (DESIGN §5: never over a question). The reading-time minimum is shown as a countdown on the last card, but the server still decides (SECURITY §3).
- 2026-11-06 — Tally is drawn with react-native-svg from the same geometry as brand/svg/tally-happy.svg, in layers: eyes blink on a random 3–6 s timer, pupils look toward the mood's target, arms rotate about their shoulders (transformOrigin), and the body squashes on landing. The "wave" arm is a repeat loop. Tally is never sad; the mouths are smile, big smile, and flat.
- 2026-11-06 — The splash waits at least 900 ms, then routes on the session state. Onboarding counts as complete once state, LGA and role are set; ward and polling unit can be skipped.
- 2026-11-06 — Confetti uses 24 particles on Android below API 30 and 60 otherwise. That is a heuristic, not a measured device tier.
- 2026-11-06 — The kitchen-sink route redirects in release builds (`__DEV__`), so it never ships to learners.
- 2026-11-06 — Verification: 40 unit tests pass; ESLint and Prettier are clean; `expo export --platform android` builds the Hermes bundle with every route; expo-doctor passes 20/20. A temporary live check against the dev API signed a learner in, read /me, found the recommended course and its first open lesson (a video), then removed itself.
- 2026-11-06 — Not verified: no Android emulator (2 GB RAM target) and no device, so no screen was seen, animated, or timed on hardware. No iOS bundle was built. The text-lesson completion path was not run live, because the first lesson in the dev data is a video; the server tests cover that path.

Phase 8 — mobile path, courses and lessons

- 2026-11-06 — Learn and Courses are the two tabs for now. Progress and Profile arrive with Phase 9 (DESIGN §6.9, §6.10). The Learn route is app/(tabs)/learn.js, so its URL stays /learn for the redirects.
- 2026-11-06 — The path is built from the server's outline only. The current node is the first open, unfinished lesson. A locked node shakes and explains why; a module check shows "Module checks open in the next update" until Phase 9.
- 2026-11-06 — Path geometry is computed from row heights, so the auto-scroll needs no layout measuring. Tally sits beside the current node, on the side away from the S-curve's offset.
- 2026-11-06 — The welcome-back sheet is deferred to Phase 9, where DESIGN §5 places it. It needs the previous login time, which the server only reports after the current login has updated it.
- 2026-11-06 — "Start course" enrols, then selects the course and opens the Learn tab. The course switcher lists enrolled courses only. The selection is held in memory and not persisted, so after a restart the first enrolled course is shown.
- 2026-11-06 — Opening a recommended lesson reads each outline before enrolling, so a learner is never enrolled in a course with nothing to open. At most eight outlines are read (startLesson.js MAX_CANDIDATES).
- 2026-11-06 — The offline banner is driven by requests that get no response, because no network-state library is approved. The next successful request clears it and sends any queued writes. There is no background retry.
- 2026-11-06 — The video lesson reports the playhead every 10 seconds while playing (SPEC §7) and once when it pauses or ends. A failed heartbeat is queued, keeping only the latest for each lesson. Continue unlocks only when the server returns completed. Key points reveal at 25, 50 and 75%, by the number of points. Resume seeks to the saved position unless it is within five seconds of the end.
- 2026-11-06 — A video that cannot load, or a phone that is offline, shows the "needs internet" card (DESIGN §6.7), not an error screen.
- 2026-11-06 — The document lesson opens the file in the phone's own viewer via Linking, because expo-file-system is not in the approved stack (DESIGN §6.7 names it). "I've read this" unlocks after the server's 10-second minimum, timed on the device; the server still checks it.
- 2026-11-06 — Practice: each answer is sent as it is checked, and the server's result decides the feedback. Reflection is saved, not marked, so it moves on at once. An answer that cannot be sent is queued and the learner continues; the server checks it when the connection returns. Ordering starts from the server's order and fill-in from empty blanks, so Check is never stuck on a null value.
- 2026-11-06 — Ordering uses up and down buttons only. The drag handle with gesture-handler is deferred to Phase 9, where the assessment's ordering component reuses it. The buttons are the accessible path and work on their own.
- 2026-11-06 — Matching: tap a left item, then a right item, to pair. Each pair gets its own token colour and a thick left edge, so the pairing never relies on colour alone; the tap to undo is shown in the screen reader label.
- 2026-11-06 — The feedback sheet plays the correct chime or the wrong note and buzzes for the outcome, and Tally nods or thinks (never sad). Its words come from the copy bank (DESIGN §8), and the right answer is shown only when the server sent one.
- 2026-11-06 — Correct-answer text is built from the question's own words, so an id from the server becomes the option text the learner saw.
- 2026-11-06 — Text cards split at each level-2 heading and at about 60 words (DESIGN §1). Only the node types the admin allowlist produces are rendered; any other node is ignored rather than shown as markup.
- 2026-11-06 — Tip of the day comes from a bank in the app (src/lib/tips.js). It is neutral and procedural. The admin site will take over that bank later.
- 2026-11-06 — Not built in this phase: the module check and assessments (Phase 9), the Progress and Profile tabs (Phase 9), the welcome-back sheet (Phase 9), the certificate reveal (Phase 9), drag-to-reorder (Phase 9), and any unlock animation beyond a scroll and a spring pop.
- 2026-11-06 — Verification: 56 unit tests (new: path states, the answer shapes the server grades, the correct-answer text, and the resume rule); ESLint and Prettier clean; `expo export --platform android` builds the bundle; every external name imported is present in its installed package. No device or emulator was used, so no screen was seen or timed. The video, document and practice paths were not run live: the dev data's first lesson is a video, and the video needs a real YouTube player.

Phase 9 — assessments, celebrations, progress, profile

- 2026-11-06 — The server gained three things the app needs: a two-minute certificate download link (GET /certificates/:id/pdf-link), the PDF route accepts that link in place of a bearer header, and POST /me/password. The download token has its own audience and is rejected as an access token; access tokens are rejected in the link slot. Request logs keep the path but not the query string, so a link never reaches the logs.
- 2026-11-06 — The public settings now include the support email and the privacy policy link (both already in admin settings), so the profile screen can link to them.
- 2026-11-06 — Certificate sharing sends the public check link (the admin site's /verify page), not the PDF. The PDF opens in the browser through the link, because expo-file-system is not approved.
- 2026-11-06 — module_passed is shown on the assessment results screen, not as a pop-up, so the same moment is never shown twice. course_completed is a certificate reveal in the queue: the card flips, a diagonal shine passes over it, and two buttons offer the certificate or the path.
- 2026-11-06 — Assessments: the intro shows the pass mark from the outline. The check starts or resumes through the server, which returns the attempt in progress rather than a new one. The timer is the server's end time; when it runs out the app submits and the server records what was answered. Closing a check asks first, and the timer keeps running.
- 2026-11-06 — Missed topics on the not-yet screen are the prompts of the questions answered wrongly. The server does not link a question to a lesson, so the screen offers the learning path rather than a link to a specific lesson. Missed topics appear only when the server's reveal rule allows the review.
- 2026-11-06 — Ordering can be dragged by its grip handle (gesture-handler), and the up and down buttons do the same job for anyone who cannot drag. Neighbours do not slide out of the way during a drag in this version; they move when the item is dropped.
- 2026-11-06 — The welcome-back sheet uses the app's own last-opened time in secure storage, because the server overwrites the login time on each sign-in. It shows once per app session, after three days away, and never mentions days missed.
- 2026-11-06 — Profile: changing state or area goes back through the About you questions, so the same rules apply. Changing the password signs the phone out everywhere (the server ends every session). Deleting the account is two confirmations, then a request; the server signs out at once and removes the account after seven days, and the copy says so. The app does not promise a way to cancel, because the server has none.
- 2026-11-06 — The Progress tab draws the seven-day XP chart with plain views and spring animation. No charting library is approved, and bars are labelled with their values, so colour is not the only signal.
- 2026-11-06 — Verification: 63 unit tests (new: assessment helpers, the welcome-back rule); server suite 311 passing plus the 11 new Phase 9 tests; ESLint and Prettier clean; the Android bundle builds; every new library name is present in its installed package. A MongoDB start failure once during the full server run was a flaky in-memory server, not a code failure; the test file passed when run alone.
- 2026-11-06 — Not verified on a device or emulator. The assessment, certificate and profile flows have not been run against a live server with a real attempt; the server side of attempts and certificates is covered by the existing server tests and the new Phase 9 tests.

Phase 10 — hardening and release

- 2026-11-06 — SECURITY §12 checklist, run across the codebase. Results: `npm audit --omit=dev` shows no high or critical advisories in the server, admin or mobile packages. Mobile has moderate advisories in `@expo/cli` (glob, minimatch): a developer command-line tool, not part of the app bundle. Accepted; re-check at each Expo upgrade.
- 2026-11-06 — Every route has a zod schema or none is needed, and a role or sign-in check. Both are enforced by test, not by review alone: `server/test/route-review.test.js` walks the live router and requires every non-public route to refuse an anonymous caller with 401, and every admin route to refuse a learner with 403. The route count is pinned at 76, so a new route fails until docs/ROUTE_REVIEW.md is updated.
- 2026-11-06 — Every admin write was traced from its controller to its service. All 25 write an audit entry (unpublish and archive through the shared status change). The checker first reported two false negatives (a parameter-list brace read as the body); corrected before the table was written.
- 2026-11-06 — No secret in the logs. The full server suite was run with logging on (1,080 lines): no password, no JWT-shaped token, no authorization header, no refresh-token field.
- 2026-11-06 — Every environment variable the config reads is in server/.env.example (16 of 16).
- 2026-11-06 — Error responses carry no stack trace. Unknown errors return a generic message and the request id.
- 2026-11-06 — The end-to-end journey (server/test/e2e.journey.test.js) runs through the HTTP API: sign-up, onboarding, enrolment, reading with the minimum reading time, practice with no answer key in the learner's copy, a module check, unlocking the next module, the course check, the certificate, its download through a two-minute link and its public check; and a second learner fails, sees no answers, retries and passes. Another learner gets 404 on the first learner's attempt.
- 2026-11-06 — Live check against the dev API (not committed): the seeded course's check started, graded each answer by type, passed at 50%, and returned module_passed, the three XP reasons, course_completed and the streak and goal events. A repeat submit returned no new events. The certificate downloaded as a 61 KB PDF through the link, and an access token was refused in the link slot.
- 2026-11-06 — Accessibility pass (learner app): every file with pressable controls has an accessibility role; the lip button's face and wrapper now grow with the font scale (minimum heights, not fixed ones). Not run on a device, so the 1.3× scale and screen-reader behaviour are unverified. The admin website was not re-audited in this phase; it is an open item.
- 2026-11-06 — Reduced-motion pass (learner app, by code review): every animated component reads the system setting and skips or shortens movement (confetti, shakes, count-ups, springs, the blink, the bounce, the skeleton shimmer, the certificate flip). Not run on a device.
- 2026-11-06 — Performance: the Android Hermes bundle is 4.9 MB. The learner app's images total about 0.4 MB (the largest is 70 KB); the unused Tally PNG was removed, since the mascot is drawn in SVG. Profiling on a low-end Android emulator, dropped-frame checks and image compression were not done: no emulator is available here, and no image tool is approved (compression needs approval).
- 2026-11-06 — docs/DEPLOY.md covers Atlas (network rules, least-privilege user, backups and a test restore), the Node host (HTTPS, proxy hops, health check), the admin static site (same domain as the API, because the sign-in cookie is SameSite=Strict), every environment variable, the first-run steps (geography load, create-super-admin, settings, content) and the EAS flow.
- 2026-11-06 — mobile/eas.json has three profiles: development (dev client), preview (Android APK, internal) and production (Android App Bundle, plus iOS). API and verify URLs are placeholders, to be filled in before the first build. No build or submit was run.
- 2026-11-06 — Learner account and profile: the password change and the account deletion request use the server's existing rules. The deletion copy says the account is removed after seven days; the server has no cancel route, so the app does not promise one.
- 2026-11-06 — Not done in this phase, and why: device and emulator testing (none available here), the admin accessibility audit, image compression (no approved tool), and store listings and data-safety forms (they need the client's accounts).

Phase 10 follow-up — the open items

- 2026-11-06 — Bug found by the admin accessibility run and fixed: the admin's readable CSRF cookie was scoped to /api/v1/auth. A browser exposes a cookie to the page only when the page path matches, so on any admin page after a reload the value was invisible, the refresh was refused, and the admin was signed out. The cookie is now scoped to /. Sign-in also clears the old copy, so only one value is sent. Tests: the path, the clearing header, and the existing CSRF tests (24 passing). The CSRF value is not a secret; the header must still match it (SECURITY §1).
- 2026-11-06 — Admin accessibility audit (axe-core 4.14, WCAG 2 A/AA and best practice, headless Chrome, signed in as the super admin, twelve screens). First run: three findings on the course builder and its preview (duplicate landmark names, a preview with no heading, a scrollable phone area with no keyboard access, one rated serious). Fixed: named landmarks, an unnamed group for each repeated question, a page heading, a focusable scroll area. Second run: no violations on any screen. Not covered: keyboard-only flows, screen-reader behaviour, the confirmation dialogs (not opened), and the learner-facing pages in the admin preview under a real screen reader.
- 2026-11-06 — Emulator profiling and dropped-frame checks: not done. This machine has no Android SDK, no emulator, no adb and no Java. Installing the Android toolchain is a large download and needs hardware virtualisation; it is the first thing to run on a machine that has Android Studio. The checklist for that run is in the launch checklist.
- 2026-11-06 — Image compression: the shipped PNGs were re-encoded in palette mode at the same dimensions (icon, adaptive icon, splash, PWA icon and favicon). About 150 KB saved, and the outputs were checked visually against the originals. The tool was `sharp`, installed in a scratch folder and not added to the project. The Nunito font files (about 516 KB) were not subset: that needs a font tool, which is not in the approved stack.
- 2026-11-06 — First-launch privacy notice (SECURITY §11): added. A "Before you start" sheet on the welcome screen, shown once and remembered in secure storage, with a link to the policy when the settings include one.
- 2026-11-06 — The account-deletion wording now matches what the server does: personal details removed after seven days, certificates revoked, learning results kept only as anonymous totals.
- 2026-11-06 — Store listings and data-safety answers: drafted in docs/STORE_LISTING.md, with a draft privacy policy for legal review. Nothing was submitted. The client's details are placeholders.
- 2026-11-06 — Test course: "Test course: polling unit basics" was built through the admin API (two modules, a reading lesson each, a practice lesson, two checks), given a cover through the signed Cloudinary upload, and published through the checklist. It lives in the dev database only. It has no video or document lesson: video needs an unlisted YouTube ID from the client's channel, and documents need a Cloudinary PDF.

Vercel deployment and the GitHub repository

- 2026-11-06 — The API runs on Vercel as one serverless function (server/api/index.js, server/vercel.json). Its handler connects to MongoDB once per warm instance, builds the Express app once, and never listens, starts a timer or exits. A failed start answers 503 with a retry header and a generic message; the variable names may be logged, the values never. The long-running entry point (src/server.js) is unchanged for VPS or local use.
- 2026-11-06 — The daily account deletion job runs as a Vercel Cron request to /api/v1/internal/cron/anonymise, protected by CRON_SECRET (at least 32 characters, compared in constant time on digests). Without the secret the endpoint refuses everyone. Covered by tests and by the route review (77 routes).
- 2026-11-06 — The MongoDB pool is capped at 5 per instance on Vercel (10 elsewhere), and server selection gives up after 8 seconds, inside the 30-second function limit.
- 2026-11-06 — The admin site is a second Vercel project. Its vercel.json rewrites /api to the API project, so sign-in cookies remain on the admin domain. The API project address is a placeholder to fill in at deploy time.
- 2026-11-06 — Trade-off recorded: an Atlas IP allowlist cannot be narrowed to the API on Vercel (shared, changing outbound addresses). Options are in docs/DEPLOY.md section 2.
- 2026-11-06 — Known limit: login and sign-up rate limits are per instance. A shared store would close this and needs approval before it is added.
- 2026-11-06 — Repository secret check before the first push: no secret values in the tracked files or the 25-commit history (the Cloudinary secret, the TOTP secret and the dev passwords are not in the repo). The test suite uses one throwaway password in its fixtures; it is not a credential. No .env file, node_modules or build output is tracked.
- 2026-11-06 — The repository Tezz-tech/pollwise was empty when checked (ls-remote returned no refs and no error). The local history was pushed to main as the first content. The phase branches stay local.

Owner decision — two-step sign-in removed for admins

- 2026-11-06 — The owner asked for TOTP two-step sign-in to be removed, because it is not needed. Super admins (and content admins) now sign in with email and password, like content admins already did. The TOTP code remains in the codebase but is used only for an account that has switched it on, and nothing in the app switches it on. This lowers the protection on super admin accounts, which previously required a second factor (CLAUDE.md rule 4, SPEC §2, SECURITY §1). A strong password and the account lockout after repeated failures are now the only protection. The owner accepted this on record.
- 2026-11-06 — create-super-admin no longer generates or prints a TOTP secret. It asks for an email, a password and a name, and refuses an email that already exists.
- 2026-11-06 — Tests updated: a super admin signs in with the password alone; the audit test covers failed and successful logins. Admin sign-in suite: 68 passing with the route review.
- 2026-11-06 — Recommended follow-up: rotate any existing super admin password, and remove the unused TOTP code path in a later cleanup once the owner confirms.
