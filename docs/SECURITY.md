# PollWise — Security Requirements

The platform holds personal data about election personnel across Nigeria — names, phone numbers, emails
and where they will be deployed. Treat it accordingly. Every phase ends with the checklist in §12.

## 1. Authentication

**Passwords**

- Hash with **argon2id** (`memoryCost` 19456 KiB, `timeCost` 2, `parallelism` 1 — the OWASP baseline).
- Minimum 10 characters. Reject the 10,000 most common passwords (ship a list in `server/data/`).
- No maximum below 128 characters. No composition rules beyond length.

**Tokens**

- **Access token:** JWT, HS256, 15-minute expiry, claims `{ sub, role, tv }` where `tv` is the user's
  `tokenVersion`. Secret ≥ 32 random bytes from env.
- **Refresh token:** 32 random bytes, sent to the client once, stored **only as a SHA-256 hash**.
  30 days for learners, 12 hours for admins. **Rotate on every use.** Each token belongs to a `family`;
  if a revoked token is ever presented again, revoke the whole family (token theft detected) and log it.
- Bumping `tokenVersion` (password change, deactivation, "log out everywhere") invalidates all access
  tokens immediately.

**Where tokens live**

- Mobile: both tokens in `expo-secure-store`. Never `AsyncStorage`. Access token also held in memory.
- Admin web: access token **in memory only**. Refresh token in an `httpOnly`, `Secure`,
  `SameSite=Strict` cookie scoped to `/api/v1/auth`. Refresh and logout require a CSRF header
  (double-submit token) as well as the cookie.

**Brute force**

- Per account: after 5 failed logins, lock for 15 minutes; doubles on each further lockout up to 24 h.
  The response is the same generic `INVALID_CREDENTIALS` whether the account exists or not.
- Per IP: see §5.

**Admin two-factor**

- `super_admin` must use TOTP (`otplib`, 30 s step, ±1 window). `content_admin` may enable it; a super
  admin setting can make it mandatory.
- TOTP secrets are encrypted at rest with AES-256-GCM using `TOTP_ENC_KEY` from env.
- Admin login is two steps: password → short-lived (5 min) single-use challenge token → TOTP code.
- 10 single-use recovery codes generated at TOTP setup, shown once, stored hashed.

**Password reset**

- 6-digit code, stored hashed, 15-minute expiry, single use, max 5 attempts per code.
- `forgot-password` always returns the same success message and takes the same time.
- A successful reset bumps `tokenVersion` and revokes all refresh tokens.

**Admin invitations**

- Super admin invites by email. The link carries a single-use token (stored hashed, 48 h expiry) that
  lets the invitee set a password and enrol TOTP. No admin passwords are ever chosen by someone else.

## 2. Authorisation

- Middleware `requireAuth`, then `requireRole('content_admin' | 'super_admin')`.
- **Object-level checks in the service layer**, not just the route: a content admin can only modify
  courses where `createdBy` is them; a learner can only read their own attempts, progress and
  certificates. Tests must cover "user A tries to read user B's thing" for every learner resource.
- Locked lessons and assessments are refused by the server (`423`), whatever the app shows.
- Deactivated users are refused on every authenticated request (check status on token use, cached
  briefly).

## 3. Assessment integrity

- Learner payloads for questions are produced by `serializeQuestionForLearner()`, which **whitelists**
  fields. It is the only path from a question document to a learner response.
- **Required test:** walk every learner-facing route's response JSON recursively and fail if it contains
  any of `correct`, `correctOptionId`, `correctOptionIds`, `acceptedAnswers`, `correctOrder`, or a
  `pairs` array with both sides aligned, unless the reveal rules in SPEC §8.2 permit it for that
  response.
- For `matching` questions, send the left and right columns **separately and independently shuffled**.
- Grading uses the attempt's snapshot, never the live question.
- Answers are accepted once per question; scores are computed only on the server.
- Video completion uses server-merged watched segments with the jump rule in SPEC §7 — the client cannot
  simply post "completed".
- Text lessons: `complete` is refused if called less than `max(10 s, readMinutes × 20 s)` after the lesson
  was opened. Document lessons: refused if called less than 10 s after opening.

## 4. Input validation and injection

- **Every** route validates `body`, `query` and `params` with a zod schema. Use `.strict()` on bodies for
  admin routes (reject unknown keys) and `.strip()` on learner routes.
- Validate ObjectIds with a regex before they reach Mongoose; respond `400 INVALID_ID`.
- Mongoose: `mongoose.set('strictQuery', true)` and `mongoose.set('sanitizeFilter', true)` globally. Never
  pass `req.body` / `req.query` objects straight into a query; build filters from validated scalars.
- Never build a regex from user input without escaping it (search uses an escaped, length-limited
  string).
- Mass assignment: update services copy only explicitly allowed fields. `role`, `status`, `xp`,
  `streak`, `security.*` are never writable from a request body except by the dedicated super-admin
  endpoints.
- **Rich text:** stored as TipTap JSON, validated against a node and mark allowlist, max depth and max
  size. Rendered natively on mobile (no WebView, no HTML), and by TipTap in the admin. No raw HTML is
  ever stored or rendered.
- Pagination `limit` capped at 100. Sort fields from an allowlist.
- JSON body limit 200 kB; upload limits below.

## 5. Rate limits (`express-rate-limit`)

| Route group                                                 | Limit                                |
| ----------------------------------------------------------- | ------------------------------------ |
| `POST /auth/login`, `/auth/admin/login`, `/auth/admin/totp` | 10 / 15 min / IP                     |
| `POST /auth/register`                                       | 5 / hour / IP                        |
| `POST /auth/forgot-password`, `/auth/reset-password`        | 5 / hour / IP and 3 / hour / account |
| `POST /lessons/:id/heartbeat`                               | 20 / min / user                      |
| `POST /attempts/:id/answers`                                | 60 / min / user                      |
| `GET /verify/:code`                                         | 30 / min / IP                        |
| Everything else authenticated                               | 300 / 15 min / user                  |
| Everything else public                                      | 100 / 15 min / IP                    |

Set `app.set('trust proxy', 1)` when deployed behind the host's proxy so limits use the real client IP.
Return `429 RATE_LIMITED` with `Retry-After`. Single-instance memory store is acceptable for launch; note in
DECISIONS.md that a shared store is needed before running more than one server instance.

## 6. Transport and headers

- HTTPS only in production. Redirect HTTP. HSTS max-age 1 year.
- `helmet()` with a strict CSP on the admin site: `default-src 'self'`; `img-src 'self'
res.cloudinary.com i.ytimg.com data:`; `frame-src https://www.youtube-nocookie.com
https://www.youtube.com`; `script-src 'self' https://www.youtube.com`; `connect-src` the API origin.
- CORS: explicit allowlist from env (`ADMIN_ORIGIN`). Credentials only for the admin origin. The mobile
  app does not need CORS.
- Remove `x-powered-by`. Use `compression`.
- Use `youtube-nocookie.com` embeds in the admin.

## 7. File uploads

- Only through the server-signed Cloudinary flow (`/admin/uploads/sign`) — admins only, each signature
  scoped to one folder, one resource type, 5-minute expiry.
- Allowed: JPEG, PNG, WebP images ≤ 5 MB; PDF ≤ 20 MB. **No SVG uploads** (script risk).
- After upload, the server confirms the asset via the Cloudinary API (type, size, format) before saving
  the reference.
- Deliver images with Cloudinary transformations `f_auto,q_auto,w_<size>` to keep mobile data use low.

## 8. Secrets and configuration

- `server/src/config/env.js` parses `process.env` with zod at boot. Missing or weak values (JWT secrets
  < 32 bytes, `TOTP_ENC_KEY` not 32 bytes base64, `NODE_ENV` invalid) → log the problem and exit.
- `.env` git-ignored in every package; `.env.example` committed with every variable and a comment.
- Never log secrets, tokens, passwords, reset codes or TOTP codes. `pino` redaction paths:
  `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.newPassword`, `*.code`,
  `*.token`, `*.refreshToken`.
- The mobile app contains no secrets — only the public API URL.

## 9. Error handling and logging

- One central error handler. Known errors map to `{ error: { code, message } }`. Unknown errors return
  `500 INTERNAL` with a request ID and **no stack trace or internal message** in production.
- Every request gets an `x-request-id`. Logs carry it.
- Logs hold user IDs, not names, emails or phone numbers.
- Unhandled rejections and uncaught exceptions are logged and the process exits cleanly (the host
  restarts it).

## 10. Audit log

Write an `AuditLog` entry for: admin login success and failure, TOTP enrolment, admin invite and
revoke, course create / publish / unpublish / archive / delete, assessment settings change, user
deactivate / reactivate, password reset sent by an admin, extra attempt granted, settings change, CSV
export. Super admins can read the log; nobody can edit or delete it through the API.

## 11. Data protection (Nigeria Data Protection Act 2023)

- Collect only what the product needs (SPEC §5). Ward and polling unit are optional.
- First-launch privacy notice with a link to the client's privacy policy (`Settings.privacyPolicyUrl`).
- **In-app account deletion** (also required by Apple's App Store rules for any app with sign-up):
  `DELETE /me` sets `pending_deletion`, revokes sessions, and a daily job anonymises the account after 7
  days (name → "Deleted user", email/phone removed, progress kept only as anonymous aggregates).
  Certificates are revoked.
- CSV exports are super-admin-only, audit-logged, and include only the columns needed.
- Database: MongoDB Atlas with encryption at rest, network access restricted to the API host, a
  dedicated least-privilege database user, automated backups enabled.

## 12. Phase checklist — run at the end of every phase

- [ ] `npm audit --omit=dev` shows no high or critical issues (or each is documented in DECISIONS.md)
- [ ] Every new route has a zod schema and a role check
- [ ] Every new learner resource has an "other user cannot access" test
- [ ] The answer-leak test passes
- [ ] No secrets, tokens or personal data appear in logs (grep the test output)
- [ ] New env variables are in `.env.example` and in the zod env schema
- [ ] Error responses expose no stack traces or internal messages
- [ ] New admin actions write audit entries
