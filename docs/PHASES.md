# PollWise — Build Phases

Paste **one phase prompt at a time** into Claude Code. Let it plan, review the plan, approve, let it
build, check the result yourself, commit, then move on. Don't paste two phases at once.

Every prompt below starts the same way on purpose — it makes Claude Code re-read the rules each time.

---

## Phase 0 — Scaffold the monorepo

```
Read CLAUDE.md, docs/SPEC.md, docs/DESIGN.md §2 and docs/SECURITY.md §8 in full before doing anything.

Phase 0: scaffold the PollWise monorepo. Plan first and show me the plan before writing files.

1. Root package.json with npm workspaces: shared, server, admin, mobile. Root scripts: dev:server,
   dev:admin, dev:mobile, lint, format, test. Prettier + ESLint shared config. .gitignore covering
   node_modules, .env*, build outputs, .expo. .editorconfig. Initialise git.
2. shared/ (@pollwise/shared, plain ESM JavaScript, no build step):
   - constants.js — roles, personnel roles with display labels, lesson types, question types, statuses,
     reveal modes, error codes.
   - xp.js — the XP table from SPEC §8.3 and streak milestones.
   - tokens.js — copy brand/tokens.js exactly.
   - schemas/ — zod schemas shared by server and admin for course, module, lesson, assessment and every
     question type (with the answer-key fields).
   - copy.js — the copy banks from DESIGN §8.
3. server/ — Express 5 app skeleton (ESM): src/{config,routes,controllers,services,models,middleware,
   utils,jobs}, env validation with zod that exits on missing or weak values, .env.example with every
   variable commented, pino logger with the redaction paths from SECURITY §8, health route
   GET /api/v1/health, vitest + supertest + mongodb-memory-server wired with one passing test.
4. Geo seed: server/scripts/seed-geo.js that loads states and LGAs from a reliable public dataset (tell
   me which one you use and its licence), verifies every per-state count against
   docs/data/lga-counts.json, and fails loudly on any mismatch. Store the cleaned data as
   server/data/geo.json so seeding never needs the network again.
5. admin/ — Vite + React (JavaScript, not TypeScript) + Tailwind configured from shared/tokens.js,
   Nunito loaded, React Router with a placeholder login page showing the logo from brand/svg.
6. mobile/ — create-expo-app with the JavaScript template, Expo Router, Nunito via
   @expo-google-fonts/nunito, theme provider reading shared/tokens.js, app.json with name "PollWise",
   slug "pollwise", icon brand/png/icon.png, Android adaptive icon foreground brand/png/adaptive-icon.png
   with background colour #1A8257, splash using brand/png/splash-icon.png on #1A8257. Confirm Metro
   resolves @pollwise/shared. One placeholder screen showing Tally.
7. scripts/make-sounds.js — pure Node, no dependencies, writes the seven WAV files described in DESIGN §4
   to mobile/assets/sounds/. Keep each under 25 KB.
8. docs/DECISIONS.md — start the log.

Done when: npm install at the root works, the server test passes, the admin dev server shows the login
placeholder, the mobile app opens in Expo Go and shows Tally, the geo seed passes its count check, and
the sound files exist. Then stop and summarise.
```

---

## Phase 1 — Server: foundation, auth and security

```
Read CLAUDE.md, docs/SPEC.md §2, §5 (User, RefreshToken, PasswordReset, Geo, AuditLog, Settings), §6
(Public/auth and the /me routes) and all of docs/SECURITY.md before planning.

Phase 1: build the server foundation. Plan first.

- Mongoose connection with strictQuery and sanitizeFilter set globally; models for User, RefreshToken,
  PasswordReset, State, Lga, AuditLog, Settings (singleton with defaults).
- Middleware: helmet, CORS allowlist from env, compression, JSON limit 200kB, request ID, pino-http,
  rate limiters per SECURITY §5, trust proxy, zod validate(schema) helper for body/query/params,
  requireAuth (checks tokenVersion and status), requireRole, central error handler that never leaks
  internals in production.
- Auth exactly as SECURITY §1: learner register/login (email or phone), refresh rotation with family
  reuse detection, logout, forgot/reset password with emailed 6-digit codes via nodemailer SMTP, account
  lockout, admin two-step login with TOTP, TOTP setup with QR and recovery codes, admin invitation flow.
- Registration modes from Settings (open / access_code).
- /me routes: get, patch, patch profile (validate stateCode and lgaCode against geo data and that the LGA
  belongs to the state), delete (pending_deletion + the anonymisation job in src/jobs).
- /geo routes, /settings/public.
- npm run create-super-admin -w server: interactive CLI, no defaults, prints the TOTP setup URI.
- Audit log writes for every admin auth event.

Tests: register, login by email and by phone, wrong password, lockout and unlock timing, refresh rotation,
refresh token reuse revokes the family, logout, reset-password happy path and expiry, admin login
requires TOTP, role checks, profile LGA-not-in-state rejected, cannot set role/xp/status via PATCH /me,
rate limit returns 429, env validation rejects a short JWT secret.

Finish with the SECURITY §12 checklist, then stop and summarise.
```

---

## Phase 2 — Server: content and admin course APIs

```
Read CLAUDE.md, docs/SPEC.md §4, §5 (Course, Module, Lesson, Assessment, Question), §6 (Admin routes), §7,
§8.5, and docs/SECURITY.md §2, §3, §4, §7 before planning.

Phase 2: build everything an admin needs to create content. Plan first.

- Models: Course, Module, Lesson, Assessment with embedded Question subdocuments (all seven types), with
  versioning on question edits.
- Admin routes from SPEC §6 for courses, modules, lessons, assessments and question banks, including
  reorder endpoints. Content admins: own courses only. Super admins: any.
- TipTap JSON validator with the node/mark allowlist from SECURITY §4.
- YouTube lookup: strict ID extraction for every URL form in SPEC §7 plus the public oEmbed call; return
  title and thumbnail. Unit-test the extractor against valid and malicious inputs.
- Signed Cloudinary uploads and post-upload verification per SECURITY §7.
- Publish checklist (SPEC §8.5) returning every failure at once; unpublish; delete-or-archive rule.
- Preview endpoint.
- Audit log for every content action.

Tests: content admin cannot edit another admin's course; publish fails with a full list of problems and
succeeds once fixed; each question type rejects an invalid answer key; reorder keeps order consistent;
oEmbed failure handled; SVG upload rejected.

Finish with the SECURITY §12 checklist, then stop and summarise.
```

---

## Phase 3 — Server: the learning engine

```
Read CLAUDE.md, docs/SPEC.md §6 (Learner routes), §7, §8 (all of it) and docs/SECURITY.md §3 before
planning. This is the most important phase — get the rules exactly right.

Phase 3: build the learner side of the API. Plan first.

- Catalogue and course outline with per-learner lock state (SPEC §8.1).
- Enrolment, lesson fetch with 423 when locked, video heartbeat with segment merging and the jump rule,
  text/document completion with the minimum-time rule, practice answers.
- Attempts: start (draw, shuffle, snapshot), resume, answer once, grade by type (SPEC §8.2), submit,
  auto-expire, attempt limits, reveal rules. serializeQuestionForLearner() as the only learner path.
- XP via XpEvent with the unique index; streak and freezes in Africa/Lagos days; daily goal; readiness;
  course completion; certificates with Crockford base32 codes; PDF generation with pdfkit using
  brand/png/pollwise-logo@2x.png; public /verify/:code.
- Every mutating learner endpoint returns the events array from SPEC §8.8.
- /me/stats.

Tests — one per rule, minimum:
- locking: lesson 2 locked until lesson 1 done; assessment locked until all lessons done; module 2
  locked until module 1 passed
- grading for every question type including fill_blank normalisation and multi_choice exact-set
- second answer to the same question → 409
- score at exactly 70% passes; 69% fails; assessment passMark override beats the default
- editing a question mid-attempt does not change grading of that attempt
- XP never awarded twice under concurrent duplicate requests
- streak: same day, next day, one missed day with and without a freeze, two missed days, midnight in
  Africa/Lagos (use fake timers), freeze earned at 7 and capped at 2
- video: seeking to the end does not complete; continuous watching to 90% does
- the answer-leak test from SECURITY §3, run against every learner route
- learner A cannot read learner B's attempt, progress or certificate

Finish with the SECURITY §12 checklist, then stop and summarise.
```

---

## Phase 4 — Server: super admin, reports, users

```
Read CLAUDE.md, docs/SPEC.md §6 (Super admin only), §9 and docs/SECURITY.md §10, §11 before planning.

Phase 4: users, reports, admin management, settings, audit log. Plan first.

- Users list with filters and pagination, streamed CSV export, user detail with per-module progress and
  attempt history (answers visible to super admins), activate/deactivate (revokes sessions), send reset,
  grant one extra attempt.
- Reports: overview KPIs and 30-day series, per-course stats, geography (state → LGA drill-down). Use
  aggregation pipelines with indexes; each report must respond in under 500 ms on 50,000 users — write a
  seed script that generates that much fake data and measure.
- Admins: list, invite, revoke. Settings get/patch. Audit log query.
- Index review across all collections; document indexes in DECISIONS.md.

Tests: content admin gets 403 on every route here; CSV export is audit-logged; deactivated user's token
stops working immediately; filters combine correctly.

Finish with the SECURITY §12 checklist, then stop and summarise.
```

---

## Phase 5 — Admin web: shell, auth and course builder

```
Read CLAUDE.md, docs/DESIGN.md §2, §3, §7 and docs/SPEC.md §4 before planning. The admin must look
crafted and confident — not a default template. Use the tokens; no hard-coded colours.

Phase 5: build the admin website up to publishing a course. Plan first, including the component list.

- App shell per DESIGN §7: ink sidebar with the white logo, top bar, route transitions with motion,
  skeleton loaders, toasts.
- Auth: login, TOTP step, TOTP setup with QR and recovery codes, invitation acceptance, access token in
  memory with silent refresh via the httpOnly cookie + CSRF header, route guards by role.
- Course list (cards with cover, status pill, module count, last edited) with search and status filter.
- Course builder: three panes (outline tree with drag-and-drop via @dnd-kit, editor, live phone preview
  that renders lessons and questions with the mobile look). Editors for course details, module, each
  lesson type (video lookup with auto duration via the YouTube IFrame API on youtube-nocookie.com, TipTap
  text with the allowlist, document upload, practice), and the assessment (settings panel, question bank,
  type picker, an editor per question type with inline validation).
- Publish checklist modal with clickable failures; the one tasteful confetti burst on success.
- Preview-as-learner mode.

Done when: I can sign in as a content admin, create a course with two modules, add a video, a text and a
document lesson, build a 10-question assessment using every question type, see it in the phone preview,
fix every checklist error, and publish it. Then stop and summarise.
```

---

## Phase 6 — Admin web: super admin area

```
Read CLAUDE.md, docs/DESIGN.md §7 and docs/SPEC.md §4, §6, §9 before planning.

Phase 6: dashboard, users, reports, admins, settings, audit log, public verify page. Plan first.

- Dashboard with KPI count-ups and Recharts charts styled with the tokens (rounded bars, no chart junk,
  jade/amber/sky series colours, readable axis labels).
- Users table with combined filters (LGA list filtered by chosen state), CSV export, user detail page
  with enrolments, per-module progress bars, expandable attempt history showing each answer and whether
  it was right, certificates, and actions with confirm dialogs.
- Reports with state → LGA drill-down.
- Admins management, Settings form (pass mark, registration mode and access codes, election date and
  label, support email, privacy URL, about text), Audit log with filters.
- /verify/:code public page.
- Content admins never see these routes in the nav and get a friendly 403 page if they try the URL.

Done when every screen works against the Phase 4 API with the 50,000-user seed. Then stop and summarise.
```

---

## Phase 7 — Mobile: foundation, onboarding, first lesson

```
Read CLAUDE.md, all of docs/DESIGN.md, and docs/SPEC.md §3 before planning. This app must feel alive and
delightful — Duolingo-level polish — on a cheap Android phone. Every value from tokens. Every animation
on the UI thread with Reanimated, with a reduced-motion path.

Phase 7: plan first, starting with the component library.

1. Core components (build and show these in a hidden /dev/kitchen-sink screen before any real screens):
   LipButton (primary, secondary, coral, amber, ghost; pressed and disabled states; haptics), OptionTile,
   ProgressBar with spring fill and shine sweep, Chip, Card, BottomSheet wrapper, Toast, Skeleton with
   shimmer, Confetti (adaptive particle count), CountUp, ProgressRing, and <Tally mood="happy|cheer|
   thinking|wave"> built from the layers in brand/svg with blinking, looking, squash-and-stretch.
   Create the thinking and wave moods yourself in the same style (never sad).
2. Sound + haptics service (expo-audio, preloaded, respects prefs and silent mode).
3. API client: fetch wrapper with access token, automatic refresh, retry once, offline queue for
   heartbeats and completions, typed error codes → friendly messages.
4. Session store (zustand) with tokens in expo-secure-store.
5. Screens: splash, welcome slides, sign up, log in, forgot/reset password, the six "about you" questions
   one per screen with auto-advance, the "You're all set" celebration — then straight into lesson 1 of
   the recommended course.
6. Local reminder notifications at the chosen time, with the copy rules from DESIGN §8.

Done when: a new user can install via Expo Go, sign up, complete onboarding, and land in their first
lesson with the celebrations working; and the kitchen-sink screen shows every component in every state.
Test on an Android emulator configured with 2 GB RAM and say how it performed. Then stop and summarise.
```

---

## Phase 8 — Mobile: the path, courses and lessons

```
Read CLAUDE.md, docs/DESIGN.md §3, §5, §6.5–6.7, §6.11 and docs/SPEC.md §7, §8.1 before planning.

Phase 8: plan first.

- Learn tab: sticky header with streak chip, XP chip and daily-goal ring (each opens its detail sheet),
  countdown card, tip card, course switcher, and the winding path with module banners, all four node
  states, the bouncing current node with its START tooltip, Tally beside it, node popover sheet, locked
  node shake, auto-scroll to the current node.
- Courses tab: search, role chips, course cards, course detail, enrolment.
- Lesson player shell: close confirm, progress bar.
- Video lesson with react-native-youtube-iframe, 10-second heartbeats, resume, key points revealed at
  25/50/75%, completion toast, offline card.
- Text lesson rendered natively from TipTap JSON into swipeable cards with callouts.
- Document lesson open-and-confirm flow.
- Practice lesson using the question components (build them here; Phase 9 reuses them).
- Lesson complete screen and the celebration queue consuming server events.
- Offline banner and queued progress.

Done when a learner can work through a full module of mixed lessons and see every animation and state.
Then stop and summarise.
```

---

## Phase 9 — Mobile: assessments, gamification, progress, profile

```
Read CLAUDE.md, docs/DESIGN.md §3, §4, §5, §6.8–6.10, §8 and docs/SPEC.md §8.2–8.8 before planning.

Phase 9: plan first.

- Assessment intro, question screen with all seven answer components (matching with tap-to-pair and
  colour pairs; ordering with drag and accessible up/down buttons), Check → feedback sheet (correct and
  not-quite variants with sound, haptics, shake, Tally), combo chip, resume of an in-progress attempt,
  timer if set.
- Results: pass (ring count-up, confetti, XP breakdown rows, Continue → unlock animation on the path) and
  not-yet (thinking Tally, missed topics with links to lessons, Try again).
- Every celebration in DESIGN §5 through the queue: streak extended and milestone, freeze earned and used,
  daily goal, course completed with the certificate reveal.
- Welcome-back sheet. Progress tab (streak card, XP chart, readiness ring, certificates grid, certificate
  view with PDF download and share). Profile and settings including delete account with two-step
  confirm.

Done when a learner can fail an assessment, review, retry, pass, unlock the next module, finish the
course and download the certificate — with every celebration firing once, in order, and never on top of
a question. Then stop and summarise.
```

---

## Phase 10 — Hardening and release

```
Read CLAUDE.md and all of docs/SECURITY.md before planning.

Phase 10: plan first.

- Full SECURITY §12 checklist across the whole codebase, plus a written security review of every route
  (method, auth, role, ownership check, validation, rate limit) as docs/ROUTE_REVIEW.md.
- Accessibility pass on mobile and admin per DESIGN §9; reduced-motion pass; font scale 1.3× pass.
- Performance: profile the path screen and the question screen on a low-end Android emulator; fix any
  dropped frames; check bundle size; compress images.
- End-to-end smoke test script covering the full learner journey against a seeded server.
- Deployment docs (docs/DEPLOY.md): MongoDB Atlas (network rules, least-privilege user, backups), server
  on a Node host with HTTPS, admin as a static site, environment variables, the create-super-admin step,
  the geo seed.
- EAS: eas.json with a "preview" profile producing an installable APK and a "production" profile
  producing an AAB for Google Play and an iOS build. Do not run any build that uploads anywhere — give me
  the commands.

Then stop and give me a launch checklist.
```
