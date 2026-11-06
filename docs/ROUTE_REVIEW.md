# Route review

Written at the end of Phase 10 (SECURITY §12). Every route the API serves, its access, its roles, its input checks and its rate limit. Paths are under `/api/v1`.

## How this stays true

- `server/test/route-review.test.js` walks the live router. Every route not on the public list must refuse an anonymous caller with 401, and every admin route must refuse a learner with 403. The route count is pinned at 76, so adding a route fails the test until this document is updated.
- `server/test/e2e.journey.test.js` runs the learner journey end to end (sign-up to certificate, and fail-then-pass).
- Audit entries: every admin write was traced from its controller to its service; all 25 write audit entries (unpublish and archive through the shared status change).

## Global controls

- Every request body, query and param is validated with zod at the route boundary; unknown keys are stripped or refused (SECURITY §3).
- Access tokens are 15-minute HS256 tokens checked against the user’s current token version and account status on every request (SECURITY §2).
- Role checks run before validation on admin routes, so a learner gets 403 without the request being parsed.
- Errors never carry a stack trace; unexpected errors return a generic message and the request id (SECURITY §8).
- Request logs record the path without its query string (so certificate download links are not logged).

| Method | Path | Who can call it | Roles | Input checks | Rate limit | Audit (admin writes) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/admin/admins` | Signed-in admin | — | none | authed (router) | — |  |
| POST | `/admin/admins` | Signed-in admin | super_admin | body inviteAdminBody | authed (router) | yes | Super admin only. Emails a one-time setup link. |
| DELETE | `/admin/admins/:id` | Signed-in admin | — | params adminIdParams | authed (router) | yes | Super admin only. The last active super admin cannot be revoked. |
| GET | `/admin/audit-logs` | Signed-in admin | — | query auditQuery | authed (router) | — |  |
| GET | `/admin/courses` | Signed-in admin | content_admin, super_admin | query courseListQuery | authed (router) | — |  |
| POST | `/admin/courses` | Signed-in admin | content_admin, super_admin | body courseCreateBody | authed (router) | yes |  |
| DELETE | `/admin/courses/:id` | Signed-in admin | super_admin | params idParams | authed (router) | yes |  |
| GET | `/admin/courses/:id` | Signed-in admin | content_admin, super_admin | params idParams | authed (router) | — |  |
| PATCH | `/admin/courses/:id` | Signed-in admin | content_admin, super_admin | params idParams, body courseUpdateBody | authed (router) | yes |  |
| POST | `/admin/courses/:id/archive` | Signed-in admin | super_admin | params idParams | authed (router) | yes | Super admin only. Audit entry written by the shared status change. |
| POST | `/admin/courses/:id/modules` | Signed-in admin | content_admin, super_admin | params idParams, body moduleCreateBody | authed (router) | yes |  |
| DELETE | `/admin/courses/:id/modules/:moduleId` | Signed-in admin | content_admin, super_admin | params idAndModuleParams | authed (router) | yes |  |
| PATCH | `/admin/courses/:id/modules/:moduleId` | Signed-in admin | content_admin, super_admin | params idAndModuleParams, body moduleUpdateBody | authed (router) | yes |  |
| PUT | `/admin/courses/:id/modules/order` | Signed-in admin | content_admin, super_admin | params idParams, body reorderBody | authed (router) | yes |  |
| GET | `/admin/courses/:id/preview` | Signed-in admin | content_admin, super_admin | params idParams | authed (router) | — |  |
| POST | `/admin/courses/:id/publish` | Signed-in admin | content_admin, super_admin | params idParams | authed (router) | yes |  |
| POST | `/admin/courses/:id/unpublish` | Signed-in admin | super_admin | params idParams | authed (router) | yes | Super admin only. Audit entry written by the shared status change. |
| GET | `/admin/modules/:id/assessment` | Signed-in admin | content_admin, super_admin | params idParams | authed (router) | — |  |
| PUT | `/admin/modules/:id/assessment` | Signed-in admin | content_admin, super_admin | params idParams, body assessmentBody | authed (router) | yes |  |
| POST | `/admin/modules/:id/lessons` | Signed-in admin | content_admin, super_admin | params idParams, body lessonBody | authed (router) | yes |  |
| DELETE | `/admin/modules/:id/lessons/:lessonId` | Signed-in admin | content_admin, super_admin | params moduleAndLessonParams | authed (router) | yes |  |
| GET | `/admin/modules/:id/lessons/:lessonId` | Signed-in admin | content_admin, super_admin | params moduleAndLessonParams | authed (router) | — |  |
| PATCH | `/admin/modules/:id/lessons/:lessonId` | Signed-in admin | content_admin, super_admin | params moduleAndLessonParams, body lessonUpdateBody | authed (router) | yes |  |
| PUT | `/admin/modules/:id/lessons/order` | Signed-in admin | content_admin, super_admin | params idParams, body reorderBody | authed (router) | yes |  |
| GET | `/admin/reports/courses` | Signed-in admin | — | none | authed (router) | — |  |
| GET | `/admin/reports/geography` | Signed-in admin | — | query reportQuery | authed (router) | — |  |
| GET | `/admin/reports/overview` | Signed-in admin | — | none | authed (router) | — |  |
| GET | `/admin/session` | Signed-in admin | content_admin, super_admin | none | authed (router) | — |  |
| GET | `/admin/settings` | Signed-in admin | — | none | authed (router) | — |  |
| PATCH | `/admin/settings` | Signed-in admin | — | body settingsBody | authed (router) | yes |  |
| POST | `/admin/settings/access-codes` | Signed-in admin | — | body accessCodeBody | authed (router) | yes |  |
| PATCH | `/admin/settings/access-codes/:codeId` | Signed-in admin | — | params accessCodeParams, body accessCodeStatusBody | authed (router) | yes |  |
| POST | `/admin/uploads/confirm` | Signed-in admin | content_admin, super_admin | body uploadConfirmBody | authed (router) | yes | Checks the file with the storage provider before the record is saved. |
| POST | `/admin/uploads/sign` | Signed-in admin | content_admin, super_admin | body uploadSignBody | authed (router) | yes | Signed upload parameters; format, size and folder are checked on confirm (SECURITY §6). |
| GET | `/admin/users` | Signed-in admin | — | query userListQuery | authed (router) | — |  |
| GET | `/admin/users/:id` | Signed-in admin | — | params userParams | authed (router) | — |  |
| POST | `/admin/users/:id/attempts` | Signed-in admin | — | params userParams, body grantBody | authed (router) | yes |  |
| POST | `/admin/users/:id/reset` | Signed-in admin | — | params userParams | authed (router) | yes |  |
| PATCH | `/admin/users/:id/status` | Signed-in admin | — | params userParams, body userStatusBody | authed (router) | yes | Super admin only. Deactivating revokes sessions; self-deactivation is refused. |
| GET | `/admin/users/export.csv` | Signed-in admin | — | query userExportQuery | authed (router) | — | Same filters as the list, streamed; super admin only. |
| GET | `/admin/youtube/lookup` | Signed-in admin | content_admin, super_admin | query youtubeLookupQuery | authed (router) | — | Parses the video ID only; the YouTube API is called server-side. |
| POST | `/auth/admin/accept-invite` | Public | — | body acceptInviteBody | `resetIp` | — | One-time invite token; the account then needs two-step setup. |
| POST | `/auth/admin/login` | Public | — | body adminLoginBody | `login` | — |  |
| POST | `/auth/admin/totp` | Public | — | body totpBody | `login` | — | Needs the challenge token and a six-digit code (or a recovery code). Replay of the same time step is refused. |
| POST | `/auth/admin/totp/setup` | Public | — | body challengeBody | `login` | — | Only before two-step sign-in is switched on; needs the challenge token. |
| POST | `/auth/forgot-password` | Public | — | body forgotPasswordBody | `resetIp` | — |  |
| POST | `/auth/login` | Public | — | body loginBody | `login` | — |  |
| POST | `/auth/logout` | Public | — | body logoutBody | `publicIp` | — | Ends the refresh family. Admins also need the CSRF header (SECURITY §1). |
| POST | `/auth/refresh` | Public | — | body refreshBody | `publicIp` | — | Rotates the refresh token; presenting a used one revokes the family. |
| POST | `/auth/register` | Public | — | body registerBody | `register` | — |  |
| POST | `/auth/reset-password` | Public | — | body resetPasswordBody | `resetIp` | — |  |
| POST | `/assessments/:id/attempts` | Signed-in learner | learner | params idParams | — | — |  |
| GET | `/attempts/:id` | Signed-in learner | learner | params attemptParams | — | — | Owner only; the answer key never leaves the server before the reveal rule allows it. |
| POST | `/attempts/:id/answers` | Signed-in learner | learner | params attemptParams, body attemptAnswerBody | `answers` | — | Owner only; expired attempts are settled first. |
| POST | `/attempts/:id/submit` | Signed-in learner | learner | params attemptParams | — | — | Owner only; a repeat submit returns the same result and no new events. |
| GET | `/certificates/:id/pdf` | Signed-in learner | learner | params idParams, query certificatePdfQuery | `authed` | — | Bearer token, or the two-minute link (?download=). The link is bound to one certificate and its owner; the account must be active. |
| GET | `/certificates/:id/pdf-link` | Signed-in learner | learner | params idParams | — | — | Owner only (404 for anyone else). Returns a two-minute link. |
| GET | `/courses` | Signed-in learner | learner | query catalogueQuery | — | — |  |
| POST | `/courses/:id/enroll` | Signed-in learner | learner | params idParams | — | — |  |
| GET | `/courses/:slug` | Signed-in learner | learner | params slugParams | — | — |  |
| GET | `/lessons/:id` | Signed-in learner | learner | params lessonParams | — | — |  |
| POST | `/lessons/:id/complete` | Signed-in learner | learner | params lessonParams | — | — |  |
| POST | `/lessons/:id/heartbeat` | Signed-in learner | learner | params lessonParams, body heartbeatBody | `heartbeat` | — | Heartbeat limiter. The server decides how much watching counts. |
| POST | `/lessons/:id/practice/answer` | Signed-in learner | learner | params lessonParams, body practiceAnswerBody | — | — | One answer per question (409 if repeated). |
| GET | `/verify/:code` | Public | — | params certificateCodeParams | `verify` | — | Returns valid, learner name, course title and issue date only. Unknown and revoked codes look the same. |
| DELETE | `/me` | Signed-in learner | learner | none | authed (router) | — | Request only: sessions end now, the account is removed after the grace period. |
| GET | `/me` | Signed-in learner | learner | none | authed (router) | — |  |
| PATCH | `/me` | Signed-in learner | learner | body updateMeBody | authed (router) | — |  |
| GET | `/me/certificates` | Signed-in learner | learner | none | authed (router) | — | Only the caller’s own, unrevoked certificates. |
| POST | `/me/password` | Signed-in learner | learner | body changePasswordBody | `login` | — | Needs the current password; ends every session. Login rate limit applies. |
| PATCH | `/me/profile` | Signed-in learner | learner | body updateProfileBody | authed (router) | — |  |
| GET | `/me/stats` | Signed-in learner | learner | none | authed (router) | — |  |
| GET | `/api/v1/health` | Public | — | none | — | — |  |
| GET | `/geo/states` | Public | — | none | `publicIp` | — | Read-only geography from the seeded dataset. |
| GET | `/geo/states/:stateCode/lgas` | Public | — | params stateCodeParams | `publicIp` | — |  |
| GET | `/settings/public` | Public | — | none | `publicIp` | — | Public fields only: election date, label, registration mode, about text, support email, privacy link. |

## Dependency audit (SECURITY §12)

- Server, admin and mobile production dependencies: no high or critical advisories.
- Mobile: moderate advisories in `@expo/cli` (glob and minimatch) come from the Expo command-line tool, which runs on a developer’s machine. It is not part of the app bundle. Accepted and recorded in DECISIONS.md. Re-check at each Expo upgrade.

