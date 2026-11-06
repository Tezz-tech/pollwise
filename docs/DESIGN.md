# PollWise — Design System and Interaction Spec

The brief: **catchy, alive, never "standard"** — and still a serious tool for adults preparing for
election day. Borrow Duolingo's _mechanics of delight_; don't borrow its guilt.

---

## 1. What we take from Duolingo, and what we don't

Duolingo's numbers show what works: separating the streak from the daily goal raised the share of new
learners with a streak by 19%; a learner on a 7-day streak is far more likely to come back the next day;
even the streak _animation_ alone measurably lifted 7-day retention. It also shows what backfires: guilt
notifications, a sad or melting mascot, and pressure on children drew public criticism.

| Take                            | How PollWise uses it                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bite-sized lessons**          | Text lessons are split into swipeable cards of ~60 words. Videos are short. Every lesson ends with one tap on _Continue_.                      |
| **One question per screen**     | Assessments and practice show a single question, a big _Check_ button, then a feedback sheet.                                                  |
| **Instant feedback**            | Correct → green sheet slides up, chime, light haptic, Tally nods. Wrong → coral sheet, soft thud, explanation shown. Never a red error screen. |
| **The path**                    | Home is a winding vertical path of lesson nodes grouped under module banners. You always see where you are and what's next.                    |
| **Visible progress everywhere** | Progress bar at the top of every lesson, spring-animated with a shine sweep. Progress rings on course cards.                                   |
| **XP + streak + daily goal**    | Header chips. Streak = at least one lesson a day; goal is separate.                                                                            |
| **Streak freezes**              | Earned, never bought. Protects a missed day.                                                                                                   |
| **Celebration moments**         | Confetti, Tally cheering, numbers counting up, unlocks animating on the path.                                                                  |
| **A mascot with personality**   | **Tally**, a friendly ballot box. Appears at key moments, not on every screen.                                                                 |
| **Tactile buttons**             | Chunky buttons with a solid bottom "lip" that press down.                                                                                      |
| **Sound + haptics**             | Short, warm, optional.                                                                                                                         |

| Don't take                      | Why                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Hearts / lives                  | A learner must never be locked out of mandatory training for making mistakes. The 70% gate already does the job. |
| Gems, shop, wagers              | No currency in a professional training tool.                                                                     |
| Guilt notifications, sad mascot | Criticised publicly; wrong tone for adults; reflects badly on the client.                                        |
| Leagues / public ranking        | Out of scope for v1, and ranking states against each other in an election context is unwise.                     |

---

## 2. Brand

**Name:** PollWise. **Mascot:** Tally — a ballot box with a ballot card tucked in the slot like a tuft
of hair. Files in `brand/svg/`: `tally-happy.svg`, `tally-cheer.svg`, logo, icons.

**Personality:** a calm, capable colleague who's done this before. Warm, encouraging, plain-spoken.
Never silly about the subject matter. Celebrates effort, explains mistakes.

### Colour — "classic jade"

A mid-tone jade green: confident without being neon, calm without being dull. It nods to the national
colour without echoing any party. Warm amber carries reward (XP, streak, certificates); a soft coral
carries "not quite" without alarm.

| Token      | Hex       | Use                                                      |
| ---------- | --------- | -------------------------------------------------------- |
| `jade600`  | `#1A8257` | **Primary.** Buttons, links, active tab, selected state  |
| `jade700`  | `#12613F` | Button lip, pressed state, text on jade tint             |
| `jade500`  | `#23A46E` | Progress fills, success accents, Tally's body            |
| `jade400`  | `#2BB673` | Highlights, shine, Tally's lid                           |
| `jade100`  | `#E3F3EA` | Correct-answer sheet, success tint, selected-option tint |
| `amber500` | `#F2A93B` | XP, streak flame, certificates, ballot card              |
| `amber700` | `#C9821C` | Amber lip/pressed                                        |
| `amber100` | `#FDF1DC` | Streak/XP tint                                           |
| `coral600` | `#C2472F` | "Not quite" button fill                                  |
| `coral700` | `#B23A28` | Text on coral tint, lip                                  |
| `coral100` | `#FDECE8` | Wrong-answer sheet                                       |
| `sky600`   | `#2F6FAE` | Information, tips, "Did you know?"                       |
| `sky100`   | `#E6F0FA` | Info tint                                                |
| `ink900`   | `#13322A` | Headings and body text                                   |
| `ink600`   | `#4B5D55` | Secondary text                                           |
| `ink400`   | `#7D8C84` | Placeholders, disabled text                              |
| `line`     | `#E2E8E4` | Borders, dividers, locked path nodes                     |
| `bg`       | `#F6F8F5` | App background                                           |
| `surface`  | `#FFFFFF` | Cards, sheets                                            |

Every text pairing above has been checked: white on `jade600` 4.8:1, `ink900` on `bg` 13:1, `ink600` on
white 7:1, `jade700` on `jade100` 6.5:1, `coral700` on `coral100` 5.2:1, `ink900` on `amber500` 6.9:1. All
pass WCAG AA. Do not put white text on `jade500`, `amber500` or `coral100`.

Never rely on colour alone: correct/incorrect always pairs colour with an icon and a word.

### Type

**Nunito** everywhere (rounded, friendly, excellent at small sizes, free).

| Token     | Size / line | Weight                        | Use                                                                |
| --------- | ----------- | ----------------------------- | ------------------------------------------------------------------ |
| `display` | 32 / 38     | 900                           | Celebration headlines, big numbers                                 |
| `h1`      | 26 / 32     | 800                           | Screen titles                                                      |
| `h2`      | 21 / 28     | 800                           | Section titles, question prompts                                   |
| `h3`      | 18 / 24     | 800                           | Card titles                                                        |
| `body`    | 16 / 24     | 600                           | Body text (600, not 400 — Nunito 400 is too thin on cheap screens) |
| `small`   | 14 / 20     | 600                           | Meta, captions                                                     |
| `label`   | 13 / 16     | 800, uppercase, +0.6 tracking | Button labels, chips, tags                                         |

Support the OS font scale up to 1.3×; layouts must not break.

### Shape and space

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 56.
- Radii: `sm 10` (chips) · `md 14` (buttons, inputs) · `lg 18` (cards) · `xl 24` (sheets) · `pill 999`.
- **Depth comes from solid lips, not blur.** A raised element has a 4 px bottom border in its darker
  shade (`jade700` under `jade600`, `line` under white cards). Cheap to render, crisp on every phone, and
  it's the signature look.
- Minimum touch target 48 × 48.

---

## 3. Motion

Reanimated on the UI thread for everything. Springs, not linear tweens, for anything the user touches.

| Token          | Value                     | Use                                |
| -------------- | ------------------------- | ---------------------------------- |
| `springSnappy` | damping 15, stiffness 260 | Button press/release, chip toggles |
| `springBouncy` | damping 10, stiffness 180 | Tally, unlocks, number pops        |
| `springGentle` | damping 20, stiffness 140 | Sheets, cards entering             |
| `fast`         | 120 ms                    | Colour and opacity changes         |
| `base`         | 220 ms                    | Screen elements entering           |
| `slow`         | 380 ms                    | Big reveals                        |

**Reduced motion** (`useReducedMotion()`): replace movement with ≤150 ms cross-fades; no confetti, no
shake, no looping idle animations; numbers jump straight to their final value. Sounds and haptics still
follow their own settings.

### Signature interactions

1. **Lip button press.** On press-in: translate Y +4, lip shrinks 4 → 0, `springSnappy`, light haptic.
   On release: spring back. Disabled: `line` fill, `ink400` label, no lip, no haptic.
2. **Option tiles.** White card with `line` lip. Selected: border and lip go `jade600`, fill `jade100`,
   tile scales 0.97 → 1 with `springSnappy`.
3. **Check → feedback sheet.** _Check_ is disabled until an answer is given. On _Check_, the sheet
   rises from the bottom with `springGentle` (~280 ms):
   - **Correct:** `jade100` sheet, `jade700` title with a tick icon ("Nice work!" — rotate from the copy
     bank), `success` haptic, correct chime, Tally peeks in from the corner and nods. Button: _Continue_
     (jade).
   - **Not quite:** `coral100` sheet, `coral700` title with a cross icon ("Not quite"), the explanation,
     the correct answer only if the server sent it, `warning` haptic, soft thud, the chosen tile does a
     small horizontal shake (3 × 6 px, 240 ms). Button: _Got it_ (coral600).
4. **Progress bar.** 16 px tall, rounded, `line` track, `jade500` fill with a 2 px lighter strip along
   the top. On advance: fill springs to the new width, then a white shine sweeps left → right across the
   filled part (600 ms, 35% opacity).
5. **Combo.** Three or more correct in a row: a small amber "3 in a row" chip pops above the progress
   bar with `springBouncy`, number increments on each further correct answer, disappears on a miss.
6. **Number count-ups.** XP, scores and streak counts roll up over 700 ms with ease-out, then a single
   scale pop (1 → 1.12 → 1).
7. **Path node states.**
   - _Completed:_ jade disc with a white tick, lip `jade700`.
   - _Current:_ larger jade disc, gentle idle bounce (2 px, 1.8 s loop), and a white tooltip above it
     reading **START** (or **CONTINUE**) that bobs.
   - _Locked:_ `line` disc with a lock icon. Tap → small shake + toast "Finish the lesson before this one
     to unlock".
   - _Assessment:_ a shield-shaped node in amber.
   - Tapping an available node opens a bottom-sheet popover: lesson title, type icon, duration, XP, and a
     **Start** lip button.
8. **Unlock.** After passing a module, when the learner returns to the path the next module's banner
   slides in, its first node pops from grey to jade with `springBouncy`, a short sparkle burst plays, and
   the view auto-scrolls to it.
9. **Confetti.** Reanimated particle burst (60 particles on high-end, 24 on low-end devices), brand
   colours only (`jade500`, `jade400`, `amber500`, `sky600`, `white`), falls ~1.6 s. Used only for
   module pass, course completion, daily goal and streak milestones.
10. **Tally.** Built from the SVG layers as a React component (`<Tally mood="happy|cheer|thinking|wave"
/>`) so parts animate: eyes blink every 3–6 s (random), pupils look toward the action, body
    squash-and-stretch on landing, arms raise for _cheer_. Never sad, never crying.

---

## 4. Sound and haptics

Generate all sounds with `scripts/make-sounds.js` (pure Node, writes short 44.1 kHz WAVs — no licensing
questions). Keep each under 25 KB. Default volume moderate. Respect the iOS silent switch.

| Sound      | Character                                            | When                                   |
| ---------- | ---------------------------------------------------- | -------------------------------------- |
| `correct`  | Two bright notes rising (a major third), 180 ms      | Correct answer                         |
| `wrong`    | One soft, low, short note falling, 200 ms, not harsh | Not quite                              |
| `complete` | Four-note rising arpeggio, 600 ms                    | Lesson complete                        |
| `pass`     | Arpeggio + sustained chord, 1 s                      | Module passed                          |
| `streak`   | Soft rising whoosh, 500 ms                           | Streak extended                        |
| `unlock`   | Light sparkle chime, 400 ms                          | Module unlocked                        |
| `tap`      | Very short click, 30 ms                              | Lip buttons (optional, off by default) |

Haptics: `selection` on option select · `impactLight` on lip press · `notificationSuccess` on correct ·
`notificationWarning` on wrong · `impactHeavy` on module pass and course complete.

---

## 5. Celebrations and pop-ups

The user asked for pop-ups that grab attention. They work only if they're rare and earned.

**One celebration queue.** Server responses carry an `events` array (SPEC §8.8). The app pushes them into
`CelebrationQueue` and shows them **one at a time, in order, after the current screen finishes** — never
on top of a question, never two at once. Each has a primary button; tapping anywhere outside does
nothing.

| Event                     | Pop-up                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lesson_completed` + `xp` | Lesson complete screen: Tally cheer, "+10 XP" counting up, time spent, accuracy if practice. _Continue_.                                                        |
| `streak_extended`         | Full-screen: amber flame grows from small to large, the day number flips from old to new, row of 7 day-dots fills the new dot. "3-day streak!" _Continue_.      |
| `streak_milestone`        | Same as above plus confetti and a one-line message.                                                                                                             |
| `streak_freeze_earned`    | Bottom sheet: an ice-blue shield appears with a shimmer. "You earned a streak freeze. It protects your streak if you miss a day."                               |
| `daily_goal_met`          | Bottom sheet: goal ring completes to 100% with a pop, confetti. "Daily goal reached."                                                                           |
| `module_passed`           | Results screen (see §6.8).                                                                                                                                      |
| `module_unlocked`         | Plays on the path (interaction 8), not as a modal.                                                                                                              |
| `course_completed`        | Full-screen certificate reveal: the certificate card flips in, a diagonal shine passes over it, confetti, Tally cheer. _View certificate_ / _Back to learning_. |

**Other pop-ups (limit: at most one per app session, never during a lesson):**

- **Tip of the day** card on Home (dismissible, `sky100`), from a small bank of practical election-day
  tips the admin can edit later.
- **Election countdown** card on Home when `nextElectionDate` is set: "47 days to election day. You're 60%
  ready." with a readiness ring.
- **Welcome back** sheet if the learner returns after 3+ days: warm, no guilt. "Good to see you. Pick up
  where you left off?" + _Continue lesson_.

---

## 6. Mobile screens

Tab bar (4 tabs, icons + labels, active tab jade with a small spring underline): **Learn · Courses ·
Progress · Profile**.

### 6.1 Splash

`jade600` background, white Tally drops in, squashes on landing, waves. 900 ms max, then routes.

### 6.2 Welcome

Three slides, swipe or _Next_. Large Tally poses, one headline, one line of body each.

1. "Learn what to do at the polling unit." 2. "Short lessons. Quick checks. Real situations."
2. "Finish a course, earn your certificate." Dots indicator. _Get started_ · _I already have an account_.

### 6.3 Sign up / Log in

Clean single column, big inputs (56 px), floating labels, inline validation on blur with a gentle shake
on error, password strength bar that fills and changes colour. Phone input with a fixed "+234" prefix.
Primary lip button pinned above the keyboard.

### 6.4 About you (onboarding questions)

Top progress bar. One question per screen, big tappable cards, Tally in the corner reacting (looks at the
selected card). State and LGA open a full-height searchable sheet with instant filtering. Each answer
auto-advances 300 ms after selection with a slide transition. The final "You're all set" screen is a
celebration with _Start your first lesson_.

### 6.5 Learn (Home)

- **Header** (sticky): streak chip (flame + count, amber), XP chip, daily goal ring (small circular
  progress). Tapping any chip opens a sheet with details and the 7-day calendar.
- **Countdown card** (if set) and **tip card** (if any).
- **Course switcher**: current course title with a chevron; tap to switch between enrolled courses.
- **The path**: module banners (coloured band with module number and title, a small progress fraction)
  followed by lesson nodes winding left-centre-right-centre in a gentle S-curve. Tally sits beside the
  current node. Smooth scroll to the current node on open.

### 6.6 Courses

Search bar, role filter chips ("For you" selected by default = matches the learner's role), course cards
in a single column: cover image (16:9, rounded top), title, summary, "6 modules · 45 min", progress ring
or _Required_ tag. Course detail: hero image, description, module list with lesson counts and lock
state, big _Start course_ / _Continue_ button.

### 6.7 Lesson player

Top bar: close (×) and progress bar. Closing asks "Leave this lesson? Your progress is saved."

- **Video:** 16:9 player at the top with rounded corners. Below: "Key points" — numbered cards that
  reveal one by one as the video passes 25 / 50 / 75%. When completion triggers, a small toast slides
  down "+10 XP" and the bottom button changes from disabled "Watch to continue" to _Continue_ with a
  pop. Offline: friendly card "This video needs internet. Connect and try again."
- **Text:** content split into cards at each heading or ~60 words. Swipe or _Continue_ to advance;
  progress bar fills per card. Callout blocks render as coloured "Did you know?" / "Remember" boxes.
  Images rounded with a soft lip.
- **Document:** title card with page count and file size, _Open document_ button (downloads with
  `expo-file-system`, opens in the system viewer), then _I've read this_ to complete.
- **Practice:** the question flow below, ungraded, with "+2 XP" on each correct answer.

### 6.8 Assessment

- **Intro screen:** shield icon, "Module 2 check", question count, pass mark ("You need 70% to unlock
  the next module"), time limit if any, attempts used. _Start_.
- **Question screen:** progress bar, combo chip, prompt in `h2`, answer area, _Check_ lip button.
  Answer components by type:
  - `single_choice` / `multi_choice`: stacked option tiles; multi shows checkboxes and "Select all that
    apply".
  - `true_false`: two large side-by-side tiles with tick and cross icons.
  - `matching`: two columns of chips; tap left then right to pair; paired chips get the same colour and
    a connecting animation; tap a pair to undo.
  - `ordering`: draggable cards with a grip handle (gesture-handler + reanimated), neighbours slide out
    of the way with `springSnappy`. Up/down buttons too, for accessibility.
  - `fill_blank`: the sentence with inline input pills; keyboard opens on the first blank.
  - `reflection`: multiline input, "This one isn't marked" note.
- **Results screen:**
  - _Pass:_ score ring animates from 0 to the score with a count-up, turns jade, confetti, Tally cheer,
    "You passed!", XP breakdown rows counting up one by one (Passed +20, First try +10, Perfect +10),
    _Continue_ → path plays the unlock.
  - _Not yet:_ ring fills coral-amber and stops, Tally in _thinking_ mood (never sad), "Not yet — you
    need 70%." Lists the topics of the questions missed, with links back to those lessons.
    _Review lessons_ (secondary) · _Try again_ (primary, new shuffled draw).

### 6.9 Progress

Big streak card (flame, current, longest, 7-day dots, freezes held), XP total with a 7-day bar chart,
readiness ring, courses in progress, **Certificates** grid (tap → full certificate view with _Download
PDF_ and _Share_).

### 6.10 Profile

Avatar initials circle, name, role, state and LGA. Settings: daily goal, reminder time, sound, haptics,
edit profile, change password, privacy policy, about, log out, **delete account** (two-step confirm).

### 6.11 Empty, loading, error

- Loading: skeleton shapes with a soft shimmer, never a bare spinner on a full screen.
- Empty: Tally + one line + one action ("No courses yet for your role. Check back soon.").
- Offline: top banner "You're offline. We'll save your progress when you're back." Queue lesson
  completions and heartbeats; retry on reconnect.
- Error: Tally _thinking_, plain message, _Try again_.

---

## 7. Admin dashboard (web)

Same brand, calmer energy — it's a work tool. Delight comes from smoothness, not confetti (one exception
below).

- **Layout:** left sidebar `ink900` with the white logo, nav items with icons, active item has a jade
  left indicator and soft jade tint. Top bar: page title, global search, profile menu. Content area `bg`
  with white cards (lg radius, `line` border, 4 px `line` lip on interactive cards).
- **Motion:** page content fades/slides up 8 px on route change (`motion`, 200 ms); list items stagger
  in (30 ms); drag-and-drop with smooth reflow (`@dnd-kit`); toasts via `sonner`; skeleton loaders.
- **Dashboard:** KPI strip (learners, active this week, enrolments, completions, average score) with
  count-up on load; 30-day activity area chart; completion by course bar chart; completion by state bar
  chart; recent activity feed.
- **Course builder** — the heart of the admin:
  - Three panes: left **outline tree** (modules → lessons → assessment, draggable, with type icons and
    a red dot on anything failing the publish checklist); centre **editor** for the selected item; right
    **live phone preview** rendering exactly as the mobile app will (same tokens).
  - Video lesson editor: paste URL → instant thumbnail, title and duration; "key points" list; the
    unlisted-not-private reminder.
  - Text editor: TipTap with only the allowed nodes (headings, paragraph, bold, italic, bullet/numbered
    list, callout "Did you know?" / "Remember", image). Paste is cleaned to the allowlist.
  - Assessment editor: settings panel (draw count, pass mark — placeholder shows the global default,
    attempts, shuffle, reveal answers, time limit); question bank list; _Add question_ opens a type picker
    with an icon card per type; each type has its own editor with clear "mark correct" controls and
    inline validation.
  - **Publish:** opens the checklist; failures are clickable and jump to the item. When everything
    passes, _Publish_ fires a small, tasteful confetti burst in the panel. (The one exception.)
- **Users:** filter bar (search, state, LGA filtered by state, role, status), data table with sticky
  header, pagination, CSV export. Row → **user detail** drawer or page: profile, enrolments with
  per-module progress bars, attempt history (expand to see each answer, correct or not), certificates,
  actions.
- **Reports:** completion by course, by state, drill into LGAs; score distribution histogram; attempts
  to pass.
- **Public verify page** `/verify/:code`: centred card with the logo, a large tick or cross, and the
  three facts. No sign-in.

---

## 8. Copy

Plain English, second person, short sentences. Warm, adult, encouraging. Never mention parties,
candidates or outcomes. Never shame.

**Correct (rotate):** Nice work! · That's right. · Exactly. · Spot on. · You've got it.
**Not quite (rotate):** Not quite. · Almost — here's why. · Close. Let's look at that.
**Lesson complete:** Lesson done. · Another one down.
**Pass:** You passed! · Module complete. The next one is open.
**Not yet:** Not yet — you need {passMark}%. Have another look at these and try again.
**Streak:** {n}-day streak! · You're building a habit.
**Reminder notifications (local):** "Ready for today's lesson? It takes about 5 minutes." · "Tally saved
your place. Pick up where you left off." · "{n} days to election day — a quick lesson today?" Maximum one
per day, at the learner's chosen time, and none if they've already learned today.

---

## 9. Accessibility

Screen-reader labels on every control (path nodes read "Lesson 3, Opening the polling unit, video, 4
minutes, completed"). Focus order matches visual order. 48 px targets. Font scaling to 1.3×. Colour never
the only signal. Ordering questions usable without drag. Reduced motion honoured. Captions: remind admins
to enable YouTube captions on videos.
