import { createContext, useMemo } from 'react';
import { theme } from './theme.js';

/** Provides the shared design tokens to every screen and component. */
export const ThemeContext = createContext(theme);

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export default function ThemeProvider({ children }) {
  const value = useMemo(() => theme, []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
