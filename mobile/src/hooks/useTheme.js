import { useContext } from 'react';
import { ThemeContext } from '../theme/ThemeProvider.js';

/** @returns {typeof import('../theme/theme.js').theme} */
export function useTheme() {
  return useContext(ThemeContext);
}
