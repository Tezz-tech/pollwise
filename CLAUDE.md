# PollWise — project memory for Claude Code

You are building **PollWise**, a mobile learning app that trains Nigerian election personnel (polling unit
agents, security, ICT/BVAS operators, collation officers, election officials) to do their job well on
election day. Think Coursera's structure with Duolingo's feel: short lessons, instant feedback, warm
celebrations, a friendly mascot, and steady progress you can see.

Built by **Tezzer Technologies** for a client. Read this file at the start of every session.

## The documents — read the relevant ones before each task

| File               | What it holds                                                                         |
| ------------------ | ------------------------------------------------------------------------------------- |
| `docs/SPEC.md`     | Product rules, roles, data model, API, unlock/grading/XP/streak logic                 |
| `docs/DESIGN.md`   | Design system, Duolingo-style interaction patterns, every screen, motion, sound, copy |
| `docs/SECURITY.md` | Security requirements and the checklist every phase must pass                         |
| `docs/PHASES.md`   | The build order. Work one phase at a time.                                            |
| `brand/`           | Logo, mascot (Tally), app icons, `tokens.js` design tokens                            |

If any document conflicts with this file, this file wins. If two documents conflict with each other,
stop and ask rather than guessing.

## Stack — fixed, do not substitute

- **JavaScript only. No TypeScript** anywhere, in any package. Use JSDoc comments on exported functions
  and on data shapes instead. Use ES modules (`"type": "module"`) on the server.
- **Mobile:** React Native with **Expo** (managed workflow, latest stable SDK), **Expo Router**,
  `react-native-reanimated`, `react-native-gesture-handler`, `react-native-svg`, `expo-haptics`,
  `expo-audio`, `expo-secure-store`, `expo-notifications` (local reminders only),
  `@tanstack/react-query`, `zustand`, `react-native-youtube-iframe` + `react-native-webview`,
  `@gorhom/bottom-sheet`, `expo-image`, `@expo-google-fonts/nunito`.
- **Admin web:** React with **Vite**, `react-router`, `@tanstack/react-query`, Tailwind CSS, `motion`
  (Framer Motion's current package — import from `motion/react`), `@dnd-kit`, TipTap, Recharts,
  `react-hook-form` + `zod`, `sonner`, `lucide-react`.
- **Server:** Node.js (current LTS), **Express 5**, **MongoDB with Mongoose**, `zod`, `helmet`, `cors`,
  `express-rate-limit`, `argon2`, `jsonwebtoken`, `cookie-parser`, `pino` + `pino-http`, `otplib`,
  `multer` + `file-type`, `cloudinary`, `pdfkit`, `nanoid`, `dayjs` (with utc + timezone plugins),
  `nodemailer`. Tests: `vitest` + `supertest` + `mongodb-memory-server`.
- Use the **latest stable** release of each package at scaffold time. Never install beta, canary or RC
  versions. Record exact versions in `package.json`.
- Do **not** add `express-mongo-sanitize` — it is incompatible with Express 5's read-only `req.query`.
  Use Mongoose `sanitizeFilter` plus `zod` validation instead (see `docs/SECURITY.md`).

Before adding any dependency not listed here, explain why in one sentence and wait for approval.

## Repository layout

```
pollwise/
├── CLAUDE.md
├── docs/              SPEC, DESIGN, SECURITY, PHASES
├── brand/             logo, mascot, icons, tokens.js
├── shared/            @pollwise/shared — constants, enums, zod schemas, XP rules, design tokens
├── server/            Express API
├── admin/             Vite React admin dashboard (the website)
└── mobile/            Expo React Native learner app
```

npm workspaces at the root. `shared` is plain ESM JavaScript with no build step and is imported by all
three apps. Expo's Metro bundler supports workspaces; if resolution fails, fix `metro.config.js` rather
than duplicating code.

## Non-negotiable rules

1. **Never send correct answers to the learner app before they answer.** Learner-facing question
   payloads are built by a dedicated serializer that whitelists fields. There is a test that fails if
   any learner endpoint returns `correct`, `correctOptionIds`, `acceptedAnswers`, `pairs` solutions or
   `correctOrder`. Grading happens only on the server.
2. **The server is the only source of truth** for progress, unlocks, scores, XP, streaks and
   certificates. The app displays what the server says. Never compute a pass/fail on the device.
3. **Every request body, query and param is validated with zod** at the route boundary. Unknown fields
   are stripped. A user can never set their own `role`, `xp`, `streak` or `status`.
4. **Roles:** `learner`, `content_admin`, `super_admin`. Check the role _and_ ownership on every admin
   route. Admins sign in with their password. Two-step (TOTP) sign-in is not used; this was an owner decision (see docs/DECISIONS.md).
5. **Politically neutral.** No party names, colours used as party symbols, candidates or partisan
   imagery anywhere in UI copy, sample data or illustrations. Do not claim or imply affiliation with
   INEC. Do not use the INEC logo.
6. **Built for low-end Android on patchy data.** Animations run on the UI thread with Reanimated.
   Prefer solid "lip" borders over blurred shadows. Keep images small. Handle offline gracefully.
7. **Respect reduced motion.** Every animation has a reduced-motion path. Sounds and haptics each have
   an on/off setting.
8. **Secrets live in `.env` files that are git-ignored.** Ship `.env.example` with every variable and a
   comment. The server validates its environment with zod at boot and refuses to start if anything is
   missing or weak.
9. **No guilt or shame mechanics.** No sad or melting mascot, no "you're letting everyone down"
   notifications, no hearts/lives that block a learner from mandatory training.

## How to work

- Work **one phase at a time** from `docs/PHASES.md`. At the end of a phase: run the tests, run the
  linter, list what was built, list anything deferred, and stop. Do not start the next phase until told.
- Plan before large changes. Show the plan, then build.
- Small, focused commits with clear messages.
- When something in the spec is ambiguous, pick the option that is simpler and safer, write it down in
  `docs/DECISIONS.md` with one line of reasoning, and continue.
- Write tests for every rule in `docs/SPEC.md` § "Business rules". Business rules without tests are not
  done.
- Comments explain _why_, not _what_.

## Conventions

- Prettier (2 spaces, single quotes, semicolons, 100 col) and ESLint on all packages.
- Server: `routes → controllers → services → models`. Controllers stay thin; logic lives in services.
- API base path `/api/v1`. JSON responses: `{ data }` on success, `{ error: { code, message, details? } }`
  on failure. Error codes are SCREAMING_SNAKE (`LESSON_LOCKED`, `INVALID_CREDENTIALS`).
- Dates are stored in UTC. Day boundaries for streaks and daily goals use **Africa/Lagos**.
- Phone numbers are normalised to E.164 (`+234…`) before storage.
- Mobile: one component per file, `PascalCase.js`; hooks `useThing.js`; screens live in `app/` (Expo
  Router). All colours, spacing, radii, type and motion values come from `@pollwise/shared/tokens` —
  never hard-code a hex value in a component.
