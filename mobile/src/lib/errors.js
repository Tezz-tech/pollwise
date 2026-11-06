/**
 * Friendly copy for every error code the learner app can receive (SPEC §6, DESIGN §6.11). The server's
 * message is never shown as-is: it is written for developers, and the code is the stable contract.
 */

/** @type {Readonly<Record<string, string>>} */
const MESSAGES = Object.freeze({
  NETWORK: "You're offline. We'll save your progress when you're back.",
  INVALID_CREDENTIALS: "Those details don't match an account. Check them and try again.",
  ACCOUNT_DEACTIVATED: 'This account is not active. Contact your course provider.',
  EMAIL_IN_USE: 'An account with this email already exists. Try logging in instead.',
  PHONE_IN_USE: 'An account with this phone number already exists. Try logging in instead.',
  INVALID_ACCESS_CODE: 'That access code is not right. Check it with your organisation.',
  INVALID_RESET_CODE: 'That code is not right or has run out. Ask for a new one.',
  VALIDATION_FAILED: 'Check the highlighted fields and try again.',
  UNAUTHORIZED: 'Your session has ended. Please log in again.',
  TOKEN_EXPIRED: 'Your session has ended. Please log in again.',
  TOKEN_REVOKED: 'Your session has ended. Please log in again.',
  FORBIDDEN: 'You do not have access to that.',
  NOT_FOUND: 'We could not find that. It may have moved.',
  LESSON_LOCKED: 'Finish the lesson before this one to unlock it.',
  ASSESSMENT_LOCKED: 'Pass the lessons in this module to unlock the check.',
  NOT_ENROLLED: 'Start this course first to open its lessons.',
  ALREADY_ANSWERED: 'You have already answered this question.',
  ATTEMPTS_EXHAUSTED:
    'You have used all your tries for this check. Your course provider can add more.',
  ATTEMPT_EXPIRED: 'Time is up for this check. Your answers were saved.',
  TOO_SOON: 'Give it a moment before you try again.',
  RATE_LIMITED: "That's a lot of tries in a short time. Wait a minute and try again.",
  UPSTREAM_UNAVAILABLE: 'This is taking longer than usual. Try again in a moment.',
  INTERNAL: 'Something went wrong on our side. Try again in a moment.',
});

export const DEFAULT_MESSAGE = 'Something went wrong. Try again in a moment.';

/**
 * The learner-facing sentence for an error code.
 * @param {string | undefined} code a SCREAMING_SNAKE code from the server, or 'NETWORK'
 * @param {string} [fallback] used when the code is unknown
 * @returns {string}
 */
export function friendlyMessage(code, fallback = DEFAULT_MESSAGE) {
  if (code && Object.prototype.hasOwnProperty.call(MESSAGES, code)) return MESSAGES[code];
  return fallback;
}
