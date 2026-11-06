/**
 * XP rules (SPEC §8.3) and streak constants (SPEC §8.4).
 *
 * The server is the only place XP is awarded (CLAUDE.md rule 2). These helpers exist so the server
 * and the admin preview use one set of numbers. The app never calls them to decide anything.
 */

/** Flat values from the SPEC §8.3 table. */
export const XP = Object.freeze({
  VIDEO_LESSON_COMPLETED: 10,
  TEXT_LESSON_COMPLETED: 5,
  DOCUMENT_LESSON_COMPLETED: 5,
  PRACTICE_LESSON_COMPLETED: 5,
  PRACTICE_CORRECT_ANSWER: 2,
  ASSESSMENT_PASSED: 20,
  ASSESSMENT_FIRST_TRY_BONUS: 10,
  ASSESSMENT_PERFECT_BONUS: 10,
  COURSE_COMPLETED: 50,
});

/**
 * XP for completing a non-practice lesson. Practice lessons use practiceXp() instead.
 * @param {'video' | 'text' | 'document'} lessonType
 * @returns {number}
 */
export function lessonCompletionXp(lessonType) {
  switch (lessonType) {
    case 'video':
      return XP.VIDEO_LESSON_COMPLETED;
    case 'text':
      return XP.TEXT_LESSON_COMPLETED;
    case 'document':
      return XP.DOCUMENT_LESSON_COMPLETED;
    default:
      throw new RangeError(`lessonCompletionXp: no fixed XP for lesson type "${lessonType}"`);
  }
}

/**
 * Practice lesson XP: 5 on completion plus 2 per correct answer.
 * @param {number} correctCount
 * @returns {number}
 */
export function practiceXp(correctCount) {
  if (!Number.isInteger(correctCount) || correctCount < 0) {
    throw new RangeError('practiceXp: correctCount must be a non-negative integer');
  }
  return XP.PRACTICE_LESSON_COMPLETED + XP.PRACTICE_CORRECT_ANSWER * correctCount;
}

/**
 * XP for passing a module assessment. Re-passing an already-passed assessment awards nothing; that
 * check belongs to the server, not here.
 * @param {{ firstTry: boolean, perfect: boolean }} result
 * @returns {number}
 */
export function assessmentPassXp({ firstTry, perfect }) {
  let amount = XP.ASSESSMENT_PASSED;
  if (firstTry) amount += XP.ASSESSMENT_FIRST_TRY_BONUS;
  if (perfect) amount += XP.ASSESSMENT_PERFECT_BONUS;
  return amount;
}

/** Streak length milestones that trigger a celebration (SPEC §8.8). */
export const STREAK_MILESTONES = Object.freeze([3, 7, 14, 30, 50, 100]);

/** A streak freeze is earned at every multiple of this many days (SPEC §8.4). */
export const STREAK_FREEZE_INTERVAL_DAYS = 7;

/** A learner can hold at most this many streak freezes (SPEC §8.4). */
export const MAX_STREAK_FREEZES = 2;

/**
 * @param {number} streakDays
 * @returns {boolean}
 */
export function isStreakMilestone(streakDays) {
  return STREAK_MILESTONES.includes(streakDays);
}

/**
 * @param {number} streakDays
 * @returns {boolean} true when reaching this streak length earns a freeze.
 */
export function earnsStreakFreeze(streakDays) {
  return streakDays > 0 && streakDays % STREAK_FREEZE_INTERVAL_DAYS === 0;
}
