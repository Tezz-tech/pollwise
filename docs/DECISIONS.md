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
