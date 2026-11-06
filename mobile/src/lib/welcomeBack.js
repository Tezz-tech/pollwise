/**
 * The welcome-back sheet (DESIGN §5): shown once per session when a learner returns after three or more days. The
 * server does not keep the previous login, so the app keeps its own last-opened time, in secure storage.
 */
export const WELCOME_BACK_KEY = 'pw.lastOpened';
export const WELCOME_BACK_DAYS = 3;

/**
 * @param {string | null | undefined} lastOpenedIso when the app was last opened, or null on a first run
 * @param {Date} now
 */
export function isWelcomeBack(lastOpenedIso, now) {
  if (!lastOpenedIso) return false;
  const last = new Date(lastOpenedIso).getTime();
  if (Number.isNaN(last)) return false;
  return now.getTime() - last >= WELCOME_BACK_DAYS * 86400000;
}
