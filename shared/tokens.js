/**
 * PollWise design tokens — the single source of truth for colour, type, space, shape and motion.
 * Copied to shared/tokens.js in Phase 0. Never hard-code these values in components.
 * Every text/background pairing marked "text" below passes WCAG AA (checked).
 */

export const colors = {
  jade600: '#1A8257', // primary — buttons, links, active states (white text 4.8:1)
  jade700: '#12613F', // lip under jade600, pressed, text on jade100 (6.5:1)
  jade500: '#23A46E', // progress fills, success accents, Tally body — no text on it
  jade400: '#2BB673', // highlights, shine, Tally lid
  jade100: '#E3F3EA', // correct sheet, selected tint

  amber500: '#F2A93B', // XP, streak flame, certificates — ink900 text only (6.9:1)
  amber700: '#C9821C', // amber lip / pressed
  amber100: '#FDF1DC', // XP / streak tint

  coral600: '#C2472F', // "not quite" button (white text 4.96:1)
  coral700: '#B23A28', // text on coral100 (5.2:1), coral lip
  coral100: '#FDECE8', // wrong-answer sheet

  sky600: '#2F6FAE', // info, tips (5.2:1 on white)
  sky100: '#E6F0FA',

  ink900: '#13322A', // headings and body text (13:1 on bg)
  ink600: '#4B5D55', // secondary text (7:1 on white)
  ink400: '#7D8C84', // placeholder / disabled only
  line: '#E2E8E4', // borders, dividers, locked nodes, white-card lip
  bg: '#F6F8F5', // app background
  surface: '#FFFFFF',
  white: '#FFFFFF',

  cheek: '#F4A08F', // Tally's cheeks only
  freeze: '#7CC4F0', // streak-freeze shield only
};

export const lip = {
  // solid bottom border colour for each raised fill — depth without blur
  [colors.jade600]: colors.jade700,
  [colors.amber500]: colors.amber700,
  [colors.coral600]: colors.coral700,
  [colors.surface]: colors.line,
  width: 4,
};

export const font = {
  family: {
    regular: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
    heavy: 'Nunito_800ExtraBold',
    black: 'Nunito_900Black',
  },
  webFamily: "'Nunito', ui-rounded, system-ui, sans-serif",
};

export const type = {
  display: { size: 32, line: 38, weight: '900' },
  h1: { size: 26, line: 32, weight: '800' },
  h2: { size: 21, line: 28, weight: '800' },
  h3: { size: 18, line: 24, weight: '800' },
  body: { size: 16, line: 24, weight: '600' },
  small: { size: 14, line: 20, weight: '600' },
  label: { size: 13, line: 16, weight: '800', uppercase: true, tracking: 0.6 },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const size = {
  touch: 48,
  input: 56,
  button: 52,
  progressBar: 16,
  pathNode: 72,
  pathNodeCurrent: 84,
};

export const motion = {
  springSnappy: { damping: 15, stiffness: 260 },
  springBouncy: { damping: 10, stiffness: 180 },
  springGentle: { damping: 20, stiffness: 140 },
  duration: { fast: 120, base: 220, slow: 380, countUp: 700, shine: 600, confetti: 1600 },
  pressDepth: 4,
  shake: { distance: 6, count: 3, duration: 240 },
  idleBounce: { distance: 2, period: 1800 },
  blink: { minGap: 3000, maxGap: 6000 },
};

export const confettiColors = [
  colors.jade500,
  colors.jade400,
  colors.amber500,
  colors.sky600,
  colors.white,
];

export const chartColors = [
  colors.jade600,
  colors.amber500,
  colors.sky600,
  colors.jade400,
  colors.coral600,
];

export default {
  colors,
  lip,
  font,
  type,
  space,
  radius,
  size,
  motion,
  confettiColors,
  chartColors,
};
