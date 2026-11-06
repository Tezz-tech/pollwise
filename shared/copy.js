/**
 * Copy banks from DESIGN §8. Plain English, second person, warm, never shaming, never mentioning
 * parties, candidates or outcomes.
 *
 * Rotation takes an explicit index so the result is testable and reproducible; callers pick the
 * index (for example, a count of answers given so far).
 */

export const COPY = Object.freeze({
  correct: Object.freeze(['Nice work!', "That's right.", 'Exactly.', 'Spot on.', "You've got it."]),
  notQuite: Object.freeze(['Not quite.', "Almost — here's why.", "Close. Let's look at that."]),
  lessonComplete: Object.freeze(['Lesson done.', 'Another one down.']),
  pass: Object.freeze(['You passed!', 'Module complete. The next one is open.']),
  /** Use with interpolate(…, { passMark }). */
  notYet: Object.freeze([
    'Not yet — you need {passMark}%. Have another look at these and try again.',
  ]),
  /** Use with interpolate(…, { n }). */
  streak: Object.freeze(['{n}-day streak!', "You're building a habit."]),
  /** Local reminder notifications (DESIGN §8). Use with interpolate(…, { n }) where needed. */
  reminders: Object.freeze([
    "Ready for today's lesson? It takes about 5 minutes.",
    'Tally saved your place. Pick up where you left off.',
    '{n} days to election day — a quick lesson today?',
  ]),
});

/**
 * Pick an entry from a bank by index, wrapping around.
 * @param {readonly string[]} bank
 * @param {number} index any non-negative integer
 * @returns {string}
 */
export function pickCopy(bank, index) {
  if (!Array.isArray(bank) || bank.length === 0) {
    throw new RangeError('pickCopy: bank must be a non-empty array');
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError('pickCopy: index must be a non-negative integer');
  }
  return bank[index % bank.length];
}

/**
 * Replace {placeholders} in a copy line. Unknown placeholders are left as they are so a missing
 * value shows up in review instead of silently disappearing.
 * @param {string} template
 * @param {Record<string, string | number>} values
 * @returns {string}
 */
export function interpolate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  );
}
