/**
 * Input rules shared by the sign-up and profile screens. Pure functions so they are tested in Node.
 */

export const MIN_PASSWORD_LENGTH = 10;

/**
 * Turn what a learner typed after the fixed +234 prefix into E.164 (CLAUDE.md: phone numbers are stored
 * as +234…). Accepts 0803…, 803…, 234803… and +234803…. Returns null when it is not a Nigerian mobile.
 * @param {string} input
 * @returns {string | null}
 */
export function normaliseNigerianPhone(input) {
  const digits = String(input ?? '').replace(/[\s()-]/g, '');
  let national = null;
  if (/^\+234\d{10}$/.test(digits)) national = digits.slice(4);
  else if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) national = digits;
  if (!national || !/^[789]\d{9}$/.test(national)) return null;
  return `+234${national}`;
}

/**
 * Score a password for the strength bar (SPEC §3: minimum 10 characters).
 * 0 = too short, 1 = weak, 2 = fair, 3 = good, 4 = strong.
 * @param {string} password
 * @returns {{ score: 0 | 1 | 2 | 3 | 4, label: string }}
 */
export function passwordStrength(password) {
  const value = String(password ?? '');
  if (value.length < MIN_PASSWORD_LENGTH) return { score: 0, label: 'Too short' };
  let score = 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  const label = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score];
  return { score: Math.min(score, 4), label };
}

/** A loose email check; the server does the real validation. */
export function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}
