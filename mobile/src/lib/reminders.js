/**
 * Planning for local reminder notifications (DESIGN §8, SPEC §3). Pure: the native scheduling lives in
 * notifications.js, which takes the plan made here.
 *
 * Rules: at most one reminder a day, at the learner's chosen time, none on a day they have already learned,
 * and the copy rotates. Reminders are scheduled as dated one-offs for the next week and refreshed every time
 * the app opens, so they never fire a stale message after the learner has learned that day.
 */
import { COPY, interpolate, pickCopy } from '@pollwise/shared/copy';

export const REMINDER_DAYS = 7;

/**
 * The next moment a `HH:MM` time occurs at or after `from`.
 * @param {string} hhmm e.g. "07:30"
 * @param {Date} from
 * @returns {Date}
 */
export function nextOccurrence(hhmm, from) {
  const [hour, minute] = hhmm.split(':').map(Number);
  const date = new Date(from);
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= from.getTime()) date.setDate(date.getDate() + 1);
  return date;
}

/**
 * The message for one day's reminder.
 * @param {{ dayIndex: number, daysToElection: number | null }} input
 */
export function reminderMessage({ dayIndex, daysToElection }) {
  // Every third reminder names the election, and only when a date is set and still ahead.
  if (daysToElection !== null && daysToElection > 0 && dayIndex % 3 === 2) {
    return interpolate(pickCopy(COPY.reminders, 2), { n: daysToElection });
  }
  return pickCopy(COPY.reminders, dayIndex % 2);
}

/**
 * Dated reminders for the coming week.
 * @param {{
 *   hhmm: string | null,
 *   now: Date,
 *   learnedToday: boolean,
 *   daysToElection?: number | null,
 *   days?: number,
 * }} input
 * @returns {{ id: string, date: Date, body: string }[]}
 */
export function planReminders({
  hhmm,
  now,
  learnedToday,
  daysToElection = null,
  days = REMINDER_DAYS,
}) {
  if (!hhmm) return [];
  const plan = [];
  let first = nextOccurrence(hhmm, now);
  // Learned today already: the first reminder is tomorrow, not later today.
  if (learnedToday && isSameDay(first, now)) {
    first = new Date(first);
    first.setDate(first.getDate() + 1);
  }
  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const date = new Date(first);
    date.setDate(first.getDate() + dayIndex);
    plan.push({
      id: `pollwise-reminder-${dayIndex}`,
      date,
      body: reminderMessage({ dayIndex, daysToElection }),
    });
  }
  return plan;
}

/**
 * Whole days from `now` to an ISO date, or null when there is no date or it has passed.
 * @param {string | null | undefined} iso
 * @param {Date} now
 */
export function daysUntil(iso, now) {
  if (!iso) return null;
  const target = new Date(iso);
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const days = Math.round((startOfTarget - startOfNow) / 86400000);
  return days > 0 ? days : null;
}

/** @param {Date} a @param {Date} b */
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
