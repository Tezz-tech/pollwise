/**
 * Time helpers. Stored times are UTC Date objects. "Day" for streaks and daily goals is an
 * Africa/Lagos calendar day (CLAUDE.md conventions, SPEC §8.4).
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const APP_TZ = 'Africa/Lagos';

/**
 * @param {Date} date
 * @returns {string} 'YYYY-MM-DD' in Africa/Lagos
 */
export function lagosDay(date) {
  return dayjs(date).tz(APP_TZ).format('YYYY-MM-DD');
}

/** @param {Date} date @param {number} minutes */
export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

/** @param {Date} date @param {number} hours */
export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3_600_000);
}

/** @param {Date} date @param {number} days */
export function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

export { dayjs };
