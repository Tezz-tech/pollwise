# Deploying PollWise

Three pieces go live: the API (a Node server with MongoDB), the admin website (a static site), and the learner app (built with EAS and sent to the app stores). Nothing in this document runs a build or uploads anything; those steps are yours to run when you are ready.

## 1. MongoDB Atlas

- **Cluster:** one M10 or larger for launch. Pick a region close to Nigeria if one is offered (for example an African or European region with the lowest latency for your users).
- **Network access:** add only the IP address (or the outbound range) of your Node host. Do not leave `0.0.0.0/0` in place after testing.
- **Database user:** create a user for the app with the `readWrite` role on the `pollwise` database only. Do not give it `atlasAdmin` or `dbAdmin`. Keep a separate admin user for you, used only for maintenance.
- **Connection string:** `MONGODB_URI=mongodb+srv://…/pollwise`. Store it in the host's secret settings, never in the repository.
- **Backups:** enable continuous cloud backups (or at least daily snapshots with 7 days of retention). Restore one snapshot to a test cluster once before launch, so you know the restore works.
- **Indexes:** the server creates indexes on boot. Check the Atlas "Performance Advisor" after the first week of real use.

## 2. The API (Node server)

- **Host:** any Node host that gives you HTTPS and environment secrets (for example Render, Railway, Fly.io, or a small VPS behind a reverse proxy). The server needs Node LTS.
- **Build and start:** install with `npm ci` at the repository root. Start with `npm run start -w server`. The server listens on `PORT`.
- **HTTPS:** terminate TLS at the host or proxy. Refresh and certificate cookies are `Secure`, so the API must be served over HTTPS in production.
- **Proxy hops:** if the host sits behind one reverse proxy, set `TRUST_PROXY_HOPS=1`, so rate limits see the real client address (SECURITY §5). Leaving it at 0 behind a proxy makes every user share one limit.
- **Health check:** `GET /api/v1/health` returns `{ "data": { "status": "ok" } }`.
- **Logs:** the server logs structured JSON with request ids. Passwords, tokens and reset codes are redacted, and download links are logged without their query string. Ship the logs to your host's log view; do not enable debug logging in production.

## 3. The admin website (static site)

- **Build:** `npm run build -w @pollwise/admin` writes `admin/dist`. Host that folder as a static site over HTTPS.
- **Same origin:** the admin site must reach the API under the **same domain**, with `/api` routed to the API server (for example `https://admin.example.org` for the site and `https://admin.example.org/api/v1` for the API, via the host's rewrite rules). The sign-in cookie is `SameSite=Strict`, so a separate API domain would stop sign-in from working.
- **Single-page routing:** configure the host to serve `index.html` for unknown paths, so `/courses/…` and `/verify/…` load.
- **Public verify page:** `https://admin.example.org/verify/:code` is public and needs no sign-in. Certificates point there.

## 4. Environment variables

Set these on the API host. `server/.env.example` lists every variable with a comment; the server checks all of them at boot and refuses to start if one is missing or weak.

| Variable | Required in production | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | Set to `production`. |
| `PORT` | no | Defaults to 4000. |
| `LOG_LEVEL` | no | `info` in production. |
| `MONGODB_URI` | yes | The least-privilege Atlas user (section 1). |
| `JWT_ACCESS_SECRET` | yes | At least 32 random bytes. Generate with the command in the example file. |
| `TOTP_ENC_KEY` | yes | Exactly 32 bytes, base64. Generate with the command in the example file. Losing it means every super admin must set up two-step sign-in again. |
| `ADMIN_ORIGIN` | yes | The admin site's origin, for example `https://admin.example.org`. |
| `ADMIN_PUBLIC_URL` | yes | The same address. Invitation and certificate check links point here. |
| `TRUST_PROXY_HOPS` | yes | `1` behind one proxy. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | yes | Required in production for password-reset codes and admin invitations. A transactional provider works; the client suggested Brevo. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | before publishing real content | Without them the upload endpoints answer 503; the rest of the API still runs. Rotate the secret if it was ever shared outside the host's settings. |

The learner app needs two values at build time (in `mobile/eas.json`, not on the server):

- `EXPO_PUBLIC_API_URL`: the API address, ending in `/api/v1`.
- `EXPO_PUBLIC_VERIFY_BASE_URL`: the admin site's address, used for the link in shared certificates.

## 5. First-run steps (once, after the first deploy)

1. **Geography:** `npm run seed:geo:load -w server` checks the committed dataset of states and local government areas (`server/data/geo.json`, no network needed) and writes it to the database. Do not run `seed:load` in production: that creates 50,000 fake learners for testing.
2. **First super admin:** run `npm run create-super-admin -w server` on the host, with the production environment loaded. It asks for an email and a password, and prints a TOTP secret once. Add the account to an authenticator app straight away, then sign in to the admin site with the password and the six-digit code. The command refuses an email that already exists, and it has no default account.
3. **Settings:** sign in as the super admin and set the pass mark, the registration mode, the election date and label, the support email, the privacy policy link, and the about text. The app reads these without signing in.
4. **Content:** create the courses, publish them through the checklist, and check each one in the learner preview before publishing.

## 6. Learner app (EAS)

The app is built with EAS (Expo Application Services) from `mobile/eas.json`. The profiles are:

- `development`: a development client for testing on a phone with the native modules (YouTube player, bottom sheets). Expo Go does not include every native module the app uses, so test on a development build before a release.
- `preview`: an installable Android APK for internal testers.
- `production`: an Android App Bundle for Google Play, and an iOS build for the App Store.

Before the first build:

1. Replace the `REPLACE-WITH-…` values in `mobile/eas.json` with the real HTTPS addresses.
2. Create the EAS project once (`cd mobile && npx eas-cli@latest init`). It adds a project id to `app.json`. Commit that change.
3. Sign in to EAS (`npx eas-cli@latest login`) with the account that will own the store listings.

The commands (run them yourself; they upload to EAS, and submitting uploads to a store):

```bash
# Internal test build for Android (an APK you can install directly)
cd mobile && npx eas-cli@latest build --profile preview --platform android

# Release builds
cd mobile && npx eas-cli@latest build --profile production --platform android   # AAB for Google Play
cd mobile && npx eas-cli@latest build --profile production --platform ios       # needs an Apple Developer account

# Submit a finished build to the stores (after you have created the store listings)
cd mobile && npx eas-cli@latest submit --profile production --platform android
cd mobile && npx eas-cli@latest submit --profile production --platform ios
```

Store listings need: the privacy policy URL (section 5), a short description that says the app is for training and makes no claim about INEC, and screenshots from a real device. Google Play requires a data-safety form; the app collects an account (name, email, phone, state, area, role) and progress data, and sends no data to advertising services.

## 7. Before you go live

Work through `docs/ROUTE_REVIEW.md` and the launch checklist in the Phase 10 summary. Re-run `npm test -w server` and `npm run lint` in each package after any change.
