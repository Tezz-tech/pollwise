/**
 * Maps @pollwise/shared/tokens into the shape React Native styles use. Components read from here via
 * useTheme(); they never hard-code a colour, size, radius or font (CLAUDE.md, mobile conventions).
 */
import { colors, font, lip, motion, radius, size, space, type } from '@pollwise/shared/tokens';

export const theme = Object.freeze({
  colors,
  lip,
  space,
  radius,
  size,
  motion,
  type,
  /** Expo Google Fonts family names, matching the keys loaded in app/_layout.js. */
  fonts: Object.freeze({
    regular: font.family.regular,
    bold: font.family.bold,
    heavy: font.family.heavy,
    black: font.family.black,
  }),
});
