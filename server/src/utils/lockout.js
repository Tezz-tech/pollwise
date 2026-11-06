/**
 * Account lockout timing (SECURITY §1): 5 failed logins lock the account for 15 minutes. Each further
 * lockout doubles the wait, capped at 24 hours.
 */
export const LOCKOUT_THRESHOLD = 5;
const BASE_MINUTES = 15;
const CAP_MINUTES = 24 * 60;

/**
 * @param {number} lockoutCount how many times this account has been locked so far (1 for the first)
 * @returns {number} lock duration in milliseconds
 */
export function lockoutDurationMs(lockoutCount) {
  if (!Number.isInteger(lockoutCount) || lockoutCount < 1) {
    throw new RangeError('lockoutCount must be a positive integer');
  }
  const minutes = Math.min(BASE_MINUTES * 2 ** (lockoutCount - 1), CAP_MINUTES);
  return minutes * 60_000;
}
