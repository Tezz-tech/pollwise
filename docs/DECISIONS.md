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
