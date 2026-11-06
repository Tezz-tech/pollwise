# PollWise — Product Specification

## 1. What it is

A learning platform with three parts:

- **Mobile app** (Android + iOS) for learners. Sign up, fill in your details, start learning straight
  away.
- **Admin dashboard** (web) for the client's staff to build courses and track learners.
- **API server** that holds all data and enforces all rules.

Content is organised **Course → Module → Lesson**, with an **Assessment at the end of every module**.
A learner must score **70% or more** (configurable) on a module's assessment to unlock the next module.
Finishing every module of a course issues a **certificate**.

Lesson videos live on the client's own **YouTube channel as unlisted videos** and are embedded in the app.

## 2. Roles

| Role            | Where      | Can do                                                                                                                                                                                                                                                         |
| --------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `learner`       | Mobile app | Register, complete profile, browse and enrol in published courses, take lessons and assessments, earn XP, keep a streak, receive certificates, delete own account                                                                                              |
| `content_admin` | Admin web  | Create courses; edit and publish **their own** courses; build modules, lessons and assessments; preview as a learner. Cannot delete courses, cannot see learners or reports.                                                                                   |
| `super_admin`   | Admin web  | Everything a content admin can do, on **any** course, plus: delete/unpublish courses, view and manage all users and their progress, reports and CSV export, create and revoke admin accounts, change platform settings, view the audit log. TOTP 2FA required. |

The first super admin is created with a CLI script (`npm run create-super-admin -w server`) that
prompts for email and password. There is no default account and no seeded password.

## 3. Learner journey

1. **Splash** — Tally waves. Check for a stored session; if valid, go to Home.
2. **Welcome** — three short slides: what PollWise is, how lessons work, what you get at the end.
   "Get started" / "I already have an account".
3. **Sign up** — full name, email, phone (Nigerian format), password (strength meter, min 10 chars).
   If registration mode is `access_code`, also an organisation access code.
4. **About you** (one question per screen, Duolingo-style, progress bar on top):
   1. Which state will you serve in? — searchable list of 36 states + FCT
   2. Which local government area? — searchable, filtered by the chosen state
   3. What will your role be? — illustrated cards: Party / polling agent · Security personnel ·
      ICT / BVAS operator · Collation officer · Election official · Other
   4. Ward and polling unit — optional free text, "Skip for now" allowed
   5. Daily goal — Casual 10 XP · Regular 20 XP · Serious 30 XP
   6. Reminder time — time picker, or "No reminders"
5. **Ready screen** — Tally cheers: "You're all set, {firstName}." One button: **Start your first
   lesson**. This opens lesson 1 of the recommended course for their role, auto-enrolling them.
6. **Home (Learn tab)** — the learning path of the current course; streak, XP and daily goal in the
   header; election-day countdown card if a date is set.
7. Lessons → module assessment → next module unlocks → … → course complete → certificate.

Login: email **or** phone + password. Forgot password: 6-digit code sent by email, valid 15 minutes.

## 4. Admin journeys

**Content admin:** sign in → _My courses_ → _New course_ (title, summary, description, cover image,
category, target roles, required for role yes/no, estimated minutes) → add modules → add lessons to each
module (video / text / document / practice) → build the module assessment → save draft → **Preview as
learner** (phone-frame preview) → **Publish** (runs the publish checklist in §8.5).

**Super admin:** everything above on any course, plus Dashboard (KPIs and charts) → Users (filter by
state, LGA, role, status, search; export CSV) → User detail (profile, enrolments, progress per module,
attempt history with answers, certificates, deactivate / reactivate, send password reset) → Reports
(completion by course, by state, by LGA within a state, score distribution) → Admins (invite content
admins, revoke) → Settings → Audit log.

## 5. Data model (Mongoose)

All collections have `createdAt` / `updatedAt` timestamps. `_id` is ObjectId unless stated.

### User

```
name, email (unique, lowercase), phone (unique, E.164), passwordHash
role: 'learner' | 'content_admin' | 'super_admin'          default 'learner'
status: 'active' | 'deactivated' | 'pending_deletion'      default 'active'
profile: {
  stateCode, lgaCode,                          // refs into geo data
  personnelRole: 'party_agent' | 'security' | 'ict_bvas' | 'collation' | 'official' | 'other',
  ward?, pollingUnit?,                         // optional free text, max 120 chars
  completedAt?                                 // onboarding finished
}
learning: {
  xp: Number, dailyGoalXp: 10 | 20 | 30,
  streak: { current, longest, lastActiveDay /* 'YYYY-MM-DD' Africa/Lagos */, freezes (0–2) },
  reminderTime? /* 'HH:mm' */
}
prefs: { sound: true, haptics: true }
security: { failedLogins, lockUntil?, tokenVersion, totpSecretEnc?, totpEnabled, passwordChangedAt }
lastLoginAt
```

### RefreshToken

`userId, tokenHash (sha256), family (uuid), expiresAt, revokedAt?, replacedBy?, userAgent, ip`

### PasswordReset

`userId, codeHash, expiresAt, usedAt?, attempts`

### Geo — seeded, read-only

`State { code, name }` (37) and `Lga { code, stateCode, name }` (774). Seed from a public dataset and
**verify the per-state counts in `docs/data/lga-counts.json` before committing** — the seed script must
fail if any count differs.

### Course

```
title, slug (unique), summary (≤160), description (TipTap JSON), coverImage { url, publicId }
category, targetRoles: [personnelRole], isRequired (for those roles), estimatedMinutes
status: 'draft' | 'published' | 'archived'
createdBy, updatedBy, publishedAt?
moduleIds: [ObjectId]   // ordered
```

### Module

`courseId, title, description?, order, lessonIds: [ObjectId] (ordered), assessmentId`

### Lesson

```
moduleId, title, order, type: 'video' | 'text' | 'document' | 'practice', xp (default by type)
video?:    { youtubeId, title, thumbnailUrl, durationSec, keyPoints: [String] }
text?:     { doc /* TipTap JSON, validated against node allowlist */, readMinutes }
document?: { url, publicId, fileName, bytes, pages? }
practice?: { questions: [Question] }        // ungraded, no pass mark
```

### Assessment (one per module)

```
moduleId, title
questions: [Question]                        // the bank
drawCount?: Number                           // null = use all questions
passMark?: Number                            // null = use Settings.defaultPassMark (70)
maxAttempts?: Number                         // null = unlimited
shuffleQuestions: true, shuffleOptions: true
revealAnswers: 'never' | 'immediately' | 'after_submit' | 'after_pass'     default 'after_pass'
timeLimitMin?: Number                        // null = untimed
```

### Question (embedded subdocument)

```
_id, type, prompt (≤500), imageUrl?, explanation? (≤500), points (default 1), version
type 'single_choice':  options [{ id, text }], correctOptionId
type 'multi_choice':   options [{ id, text }], correctOptionIds [id]        // ≥1 correct
type 'true_false':     correct: Boolean
type 'matching':       pairs [{ id, left, right }]                          // 3–6 pairs
type 'ordering':       items [{ id, text }], correctOrder [id]              // 3–8 items
type 'fill_blank':     template "The ___ must sign the result sheet.", acceptedAnswers [[String]]  // one list per blank
type 'reflection':     (no answer key; never graded; points forced to 0)
```

### Enrollment

`userId, courseId (unique pair), status 'in_progress' | 'completed', currentModuleId, startedAt, completedAt?, bestScores: { [moduleId]: Number }`

### LessonProgress

`userId, lessonId (unique pair), courseId, status 'in_progress' | 'completed', watchedSegments: [[startSec, endSec]], lastPositionSec, startedAt, completedAt?`

### AssessmentAttempt

```
userId, assessmentId, moduleId, courseId, attemptNumber
questions: [{ questionId, version, snapshot /* full question incl. key, server-only */, optionOrder? }]
answers:   [{ questionId, response, correct, pointsAwarded, answeredAt }]
status: 'in_progress' | 'submitted' | 'expired'
score?, passed?, startedAt, expiresAt, submittedAt?
```

### Certificate

`userId, courseId (unique pair), code (unique, 10 chars, Crockford base32), learnerName, courseTitle, score, issuedAt, revokedAt?`

### XpEvent

`userId, amount, reason, refId, day /* 'YYYY-MM-DD' Africa/Lagos */` — unique index on `(userId, reason, refId)` so XP can never be awarded twice for the same thing.

### AuditLog

`actorId, actorRole, action ('course.publish', 'user.deactivate', …), targetType, targetId, meta, ip, at`

### Settings (single document)

```
defaultPassMark: 70
registrationMode: 'open' | 'access_code'     default 'open'
accessCodes: [{ codeHash, label, active, uses }]
nextElectionDate?: Date, nextElectionLabel?: String
supportEmail?, privacyPolicyUrl?, aboutText?
```

## 6. API (base `/api/v1`)

### Public / auth

```
POST /auth/register                 learner signup
POST /auth/login                    { identifier: email|phone, password } → access + refresh
POST /auth/refresh                  rotate refresh token
POST /auth/logout                   revoke current refresh family
POST /auth/forgot-password          always 200, never reveals whether the account exists
POST /auth/reset-password           { identifier, code, newPassword }
POST /auth/admin/login              step 1 → { needsTotp, challengeToken }
POST /auth/admin/totp               step 2 → session (refresh token in httpOnly cookie)
POST /auth/admin/totp/setup         returns otpauth URI + QR (first login only)
GET  /geo/states
GET  /geo/states/:stateCode/lgas
GET  /verify/:code                  public certificate check → { valid, learnerName, courseTitle, issuedAt }
GET  /settings/public               { nextElectionDate, nextElectionLabel, registrationMode, aboutText }
```

### Learner (auth required)

```
GET    /me                          profile, prefs, learning stats
PATCH  /me                          name, prefs, dailyGoalXp, reminderTime
PATCH  /me/profile                  stateCode, lgaCode, personnelRole, ward, pollingUnit
DELETE /me                          request deletion (App Store requirement) — see SECURITY.md
GET    /me/stats                    xp, streak, today's XP vs goal, readiness %, 7-day activity
GET    /me/certificates
GET    /certificates/:id/pdf        owner only, generated on demand

GET    /courses                     published; ?role= &q= ; includes my enrolment/progress summary
GET    /courses/:slug               outline: modules → lessons (titles, types, xp, duration) + lock state
POST   /courses/:id/enroll
GET    /lessons/:id                 full lesson content; 423 LESSON_LOCKED if locked
POST   /lessons/:id/heartbeat       video only: { positionSec, durationSec } every 10 s
POST   /lessons/:id/complete        text / document / practice
POST   /lessons/:id/practice/answer { questionId, response } → { correct, explanation, correctAnswer }

POST   /assessments/:id/attempts    start → attempt with questions (NO answer keys)
POST   /attempts/:id/answers        { questionId, response } → { correct, explanation?, correctAnswer? }
POST   /attempts/:id/submit         → { score, passed, passMark, xp, events[] }
GET    /attempts/:id                resume an in-progress attempt
```

### Admin (content_admin and above)

```
GET/POST           /admin/courses                     content_admin sees own + published
GET/PATCH          /admin/courses/:id                 ownership enforced for content_admin
POST               /admin/courses/:id/publish         runs checklist §8.5
POST               /admin/courses/:id/unpublish       super_admin only
DELETE             /admin/courses/:id                 super_admin only; blocked if anyone enrolled → archive instead
POST/PATCH/DELETE  /admin/courses/:id/modules[/:moduleId]
PUT                /admin/courses/:id/modules/order   { moduleIds }
POST/PATCH/DELETE  /admin/modules/:id/lessons[/:lessonId]
PUT                /admin/modules/:id/lessons/order   { lessonIds }
GET/PUT            /admin/modules/:id/assessment      settings + question bank
POST               /admin/uploads/sign                signed Cloudinary upload params (images, PDFs)
GET                /admin/youtube/lookup?url=         parse ID, fetch oEmbed title + thumbnail
GET                /admin/courses/:id/preview         full learner view, no lock state
```

### Super admin only

```
GET    /admin/users                 ?q &stateCode &lgaCode &personnelRole &status &page &limit(≤100)
GET    /admin/users/export.csv      same filters, streamed
GET    /admin/users/:id             profile + enrolments + per-module progress + attempts + certificates
PATCH  /admin/users/:id/status      activate / deactivate (revokes all sessions)
POST   /admin/users/:id/reset       email a reset code
GET    /admin/reports/overview      KPIs + 30-day series
GET    /admin/reports/courses       per course: enrolled, completed, completion %, avg score, avg attempts
GET    /admin/reports/geography     ?stateCode → per-state or per-LGA completion
GET/POST/DELETE /admin/admins       list, invite (emails a one-time setup link), revoke
GET/PATCH       /admin/settings
GET    /admin/audit-logs            ?actorId &action &from &to &page
```

## 7. Video lessons (YouTube, unlisted)

- Admin pastes any YouTube URL form (`watch?v=`, `youtu.be/`, `shorts/`, `embed/`). Server extracts the
  11-character ID with a strict regex and calls YouTube's public oEmbed endpoint for title and thumbnail.
  No API key is needed.
- The admin lesson editor embeds the video with the YouTube IFrame API, reads `getDuration()` and saves
  `durationSec` automatically. Show a reminder: _"Make sure this video is set to Unlisted on YouTube,
  not Private — private videos will not play in the app."_
- Mobile uses `react-native-youtube-iframe` with `modestbranding`, `playsinline`, `rel=0`. Hide the
  YouTube logo overlay where the player allows. The client's channel must hold only training videos, so
  any end-screen suggestions stay on-topic.
- **Completion:** the app sends a heartbeat every 10 s with the current position. The server merges
  watched segments, ignoring any jump larger than `elapsed wall-clock × 1.5 + 5 s` (so seeking ahead does
  not count). When covered time ≥ 90% of `durationSec`, the lesson completes and XP is awarded.
- Resume from `lastPositionSec` when the learner returns.
- No offline video (YouTube's terms forbid it). Show a friendly offline state on video lessons.

## 8. Business rules (each one needs tests)

### 8.1 Locking

- Lessons inside a module unlock in order: lesson _k+1_ unlocks when lesson _k_ is completed.
- A module's assessment unlocks when **all** its lessons are completed.
- Module _n+1_ unlocks when the learner has **passed** module _n_'s assessment.
- Module 1 lesson 1 is unlocked on enrolment.
- Courses can be taken in any order.
- Locked content returns `423 LESSON_LOCKED` / `ASSESSMENT_LOCKED` from the server regardless of what the
  app shows.

### 8.2 Attempts and grading

- Starting an attempt draws `drawCount` questions at random from the bank (or all), shuffles question and
  option order if enabled, and **snapshots** each question so later admin edits never change a live
  attempt.
- One active attempt per learner per assessment. Starting again resumes it.
- Each question can be answered **once**. A second answer returns `409 ALREADY_ANSWERED`.
- The answer response always includes `correct` (true/false) and `explanation` — that is the learning
  loop. It includes `correctAnswer` only if `revealAnswers === 'immediately'`.
- Marking (all-or-nothing per question in v1):
  - `single_choice`, `true_false`: exact match.
  - `multi_choice`: the selected set equals the correct set exactly.
  - `matching`: every pair matched correctly.
  - `ordering`: exact sequence.
  - `fill_blank`: per blank, trim, collapse internal whitespace, case-insensitive, strip trailing
    punctuation, then compare against that blank's accepted list. All blanks must be right.
  - `reflection`: stored, never graded, excluded from the denominator.
- `score = round(pointsAwarded / pointsPossible × 100)`. Unanswered questions score 0 on submit.
- `passed = score ≥ (assessment.passMark ?? settings.defaultPassMark)`.
- `maxAttempts` null = unlimited. When reached, return `403 ATTEMPTS_EXHAUSTED` and tell the learner to
  contact their administrator; a super admin can grant one more attempt from the user detail page.
- Attempts expire `timeLimitMin` after start, or 2 hours if untimed. Expired attempts are auto-submitted.
- After submit, the result includes correct answers if `revealAnswers` is `after_submit`, or
  `after_pass` and the learner passed.

### 8.3 XP

| Event                             | XP                       |
| --------------------------------- | ------------------------ |
| Video lesson completed            | 10                       |
| Text or document lesson completed | 5                        |
| Practice lesson completed         | 5 + 2 per correct answer |
| Module assessment passed          | 20                       |
| …passed on the first attempt      | +10                      |
| …with a score of 100%             | +10                      |
| Course completed                  | 50                       |

Values live in `shared/xp.js`. XP is written through `XpEvent` with the unique index, so retries and
double-taps can never award twice. Re-passing an already-passed assessment awards nothing.

### 8.4 Streak and daily goal (Africa/Lagos days)

- The streak counts **days on which the learner completed at least one lesson or assessment**. It is
  deliberately separate from the daily XP goal — Duolingo found that tying the two together stopped
  people forming the habit.
- On the first qualifying activity of a day: if `lastActiveDay` was yesterday → `current + 1`; if it was
  today → no change; if exactly one day was missed and `freezes > 0` → spend a freeze and `current + 1`;
  otherwise → `current = 1`. Update `longest`.
- Learners earn **one streak freeze at every 7-day milestone**, holding at most 2. No currency, no store.
- Daily goal = sum of today's XpEvents vs `dailyGoalXp`. Hitting it once per day emits `daily_goal_met`.

### 8.5 Publish checklist (server-enforced)

A course can only be published if: it has a title, summary, cover image and at least one target role;
at least one module; every module has at least one lesson; every module has an assessment; every
assessment has at least `drawCount` (or 1) gradable questions; every gradable question has a valid
answer key; every video lesson has a `youtubeId` and `durationSec`. Return every failure at once as a
list so the admin can fix them in one pass.

### 8.6 Course completion and certificates

- A course completes when every module's assessment is passed. Emit `course_completed`.
- Issue one certificate per learner per course. `score` = mean of the best module scores.
- Code: 10 characters from Crockford base32 (no I, L, O, U), unique.
- The PDF (pdfkit, A4 landscape) shows the PollWise logo, learner name, course title, score, date, code
  and `https://<admin-domain>/verify/<code>`.
- The public verify page shows only: valid or not, learner name, course title, date issued.

### 8.7 Readiness

`readiness% = completed required courses for my personnelRole ÷ required courses for my personnelRole`.
If no course is marked required for the role, show course progress instead and hide the word "readiness".

### 8.8 Events

Every learner action that can trigger celebrations returns an `events` array, in display order:

```
{ type: 'xp', amount, reason }
{ type: 'lesson_completed', lessonId }
{ type: 'streak_extended', current }
{ type: 'streak_milestone', current }          // 3, 7, 14, 30, 50, 100
{ type: 'streak_freeze_earned', freezes }
{ type: 'streak_freeze_used' }
{ type: 'daily_goal_met', xpToday, goal }
{ type: 'module_passed', moduleId, score, firstTry }
{ type: 'module_unlocked', moduleId, title }
{ type: 'course_completed', courseId, certificateId }
```

The mobile app plays these through a single **celebration queue** (see DESIGN.md). Nothing else in the
app decides when to celebrate.

## 9. Settings the super admin controls

Default pass mark · registration mode (open or access code) and the codes · next election date and label
(drives the countdown card) · support email · privacy policy URL · "About PollWise" text.

## 10. Out of scope for v1

Learner web app · offline video · human-marked written answers · ward and polling unit reference data ·
leaderboards · in-app messaging · payments · languages other than English · server-sent push
notifications (reminders are local notifications on the device).
