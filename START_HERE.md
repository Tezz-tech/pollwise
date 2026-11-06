# PollWise — start here

This folder is everything Claude Code needs to build PollWise: the rules, the product spec, the design
system, the security requirements, the build order, and the brand assets.

## 1. Set up

1. Create an empty folder called `pollwise` and put the **contents** of this kit inside it, so
   `CLAUDE.md` sits at the top level.
2. Open the folder in VS Code and start Claude Code in it. Claude Code reads `CLAUDE.md` automatically
   at the start of every session — that file holds the stack, the rules and where everything is.
3. Open `docs/PHASES.md`. It has eleven prompts, Phase 0 to Phase 10.

## 2. For each phase

1. Switch Claude Code to **Plan Mode**.
2. Paste **one** phase prompt.
3. Read the plan. If something looks wrong, say so before approving.
4. Let it build. When it stops, check the "Done when" list yourself — run the app, click through it.
5. Commit. Then paste the next phase.

If it drifts from the design or the rules, tell it: _"Re-read CLAUDE.md and docs/DESIGN.md and check what
you just built against them."_

## 3. Accounts you'll need, and when

| Before   | Account                                     | Cost                                    | In whose name                              |
| -------- | ------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| Phase 1  | MongoDB Atlas                               | Free tier to start                      | Tezzer during build → transfer at handover |
| Phase 1  | SMTP email for password resets (e.g. Brevo) | Free tier: 300 emails/day               | Client                                     |
| Phase 2  | Cloudinary (images and PDFs)                | Free tier                               | Client                                     |
| Phase 7  | Expo account (builds the app)               | Free tier                               | Tezzer during build → transfer at handover |
| Phase 10 | Server hosting                              | First 12 months covered by the contract | Tezzer during build                        |
| Phase 10 | Google Play developer account               | One-off fee                             | **Client** (contract clause 7.3)           |
| Phase 10 | Apple developer account                     | Yearly fee                              | **Client** (contract clause 7.3)           |

**Ask the client to set up the YouTube channel now:** a dedicated channel with _only_ training videos,
every video set to **Unlisted** (not Private — private videos won't play in the app), monetisation off,
captions on.

## 4. Two reminders from the contract

- **Clause 5:** no APK, source code or admin login goes to the client until the full ₦2,000,000 has
  cleared. Demo builds are for review only. Keep the Expo project under your own account until then.
- **Clause 2.4:** anything not in the Schedule is a variation and gets quoted separately. Keep
  `docs/DECISIONS.md` up to date — it's your record of what was agreed.

## 5. What's where

```
CLAUDE.md              rules Claude Code follows every session
docs/SPEC.md           roles, journeys, data model, API, business rules
docs/DESIGN.md         colours, type, motion, Duolingo-style patterns, every screen, copy
docs/SECURITY.md       security requirements + end-of-phase checklist
docs/PHASES.md         the eleven prompts
docs/DECISIONS.md      running log of decisions
docs/data/             LGA counts used to verify the geography seed
brand/                 logo, mascot, app icons, tokens.js, brand-sheet.png
```
