# PollWise brand assets

| File                                                         | Use                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `svg/pollwise-logo.svg`                                      | Main logo, on light backgrounds                                   |
| `svg/pollwise-logo-white.svg`                                | Logo on jade or dark backgrounds (admin sidebar, splash)          |
| `svg/pollwise-icon-rounded.svg`                              | Favicon, admin, marketing — anywhere you show the icon yourself   |
| `svg/pollwise-icon-fullbleed.svg`                            | Source for the app icon (stores apply their own rounded mask)     |
| `svg/pollwise-adaptive-foreground.svg`                       | Android adaptive icon foreground (transparent, safe-zone sized)   |
| `svg/tally-happy.svg`                                        | Tally, default mood                                               |
| `svg/tally-cheer.svg`                                        | Tally, celebrating                                                |
| `png/icon.png`                                               | Expo `icon` (1024 × 1024)                                         |
| `png/adaptive-icon.png`                                      | Expo `android.adaptiveIcon.foregroundImage`, background `#1A8257` |
| `png/splash-icon.png`                                        | Expo splash image, background `#1A8257`                           |
| `png/favicon-64.png`, `png/favicon-512.png`                  | Admin favicon and PWA icon                                        |
| `png/pollwise-logo@2x.png`, `png/pollwise-logo-white@2x.png` | Certificates PDF, email templates                                 |
| `tokens.js`                                                  | Colours, type, spacing, radii, motion                             |
| `brand-sheet.png`                                            | Overview of everything above                                      |

**Tally's layers** (in `tally-*.svg`, top to bottom): sparkles (cheer only), ground shadow, feet, arms,
body (lip + top), lid (lip + top), slot, ballot card with tick (clipped into the slot), cheeks, eyes
(sclera, pupils `#pupilL` / `#pupilR`, highlights), mouth. Rebuild these as `react-native-svg` elements so
each part can animate. Make the _thinking_ (one eyebrow up, mouth flat, eyes looking up-left) and _wave_
(one arm raised and rotating) moods in the same style. Tally is never sad.

**Wordmark:** Nunito Black, converted to outlines so it renders identically everywhere. "Poll" in ink
`#13322A`, "Wise" in jade `#1A8257`. Nunito is licensed under the SIL Open Font License.

**Clear space:** keep at least the height of the ballot card clear around the logo. Minimum logo height
24 px on screen. Don't recolour, stretch, outline or add effects.
