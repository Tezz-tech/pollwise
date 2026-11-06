/**
 * Practical election-day tips for the Home tip card (DESIGN §5). Neutral and procedural: nothing about parties,
 * candidates or outcomes. The admin site will edit this bank later; until then it ships with the app.
 */
export const TIPS = Object.freeze([
  'Read the polling unit list before the day. You will know where you are going and who to ask for.',
  'Keep your accreditation and a pen with you. Check that both are in your bag the night before.',
  'Write down times as they happen. A clear log is the easiest thing to rely on afterwards.',
  'If something is not clear, ask your supervisor before you act. Asking is part of the job.',
  'Drink water and take short breaks. Long days go better with them.',
  'Count slowly and check twice. A second count costs a minute and saves an argument later.',
]);

/**
 * The tip for a given day. The same tip all day, a different one tomorrow.
 * @param {Date} now
 */
export function tipForDay(now) {
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return TIPS[dayOfYear % TIPS.length];
}
