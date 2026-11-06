/**
 * Nigerian phone numbers are stored as E.164 (`+234…`) so one person cannot register twice with two
 * spellings (CLAUDE.md conventions).
 */

/**
 * Accepts `0803 123 4567`, `+234 803 123 4567`, `234803…` or `803…` and returns `+2348031234567`.
 * Returns null when the input is not a Nigerian mobile number.
 * @param {unknown} input
 * @returns {string | null}
 */
export function normaliseNigerianPhone(input) {
  if (typeof input !== 'string') return null;
  const compact = input.replace(/[\s()-]/g, '');

  let national;
  if (compact.startsWith('+234')) national = compact.slice(4);
  else if (compact.startsWith('234') && compact.length === 13) national = compact.slice(3);
  else if (compact.startsWith('0') && compact.length === 11) national = compact.slice(1);
  else if (compact.length === 10) national = compact;
  else return null;

  // Nigerian mobile numbers are 10 digits after the country code, starting with 7, 8 or 9.
  if (!/^[789]\d{9}$/.test(national)) return null;
  return `+234${national}`;
}
