/**
 * Streaks and freezes (SPEC §8.4). Pure: the caller supplies today's Africa/Lagos date and gets back the
 * new state and the events to show. The streak is separate from the daily XP goal by design.
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { earnsStreakFreeze, isStreakMilestone, MAX_STREAK_FREEZES } from '@pollwise/shared/xp';

dayjs.extend(utc);

/**
 * Whole days from `from` to `to` (both 'YYYY-MM-DD'). Date-only arithmetic, so no time zone enters.
 * @param {string} from
 * @param {string} to
 */
export function dayGap(from, to) {
  return dayjs.utc(to).diff(dayjs.utc(from), 'day');
}

/**
 * @param {{ current: number, longest: number, lastActiveDay: string | null | undefined, freezes: number }} streak
 * @param {string} today 'YYYY-MM-DD' in Africa/Lagos
 * @returns {{ streak: typeof streak, events: Array<{ type: string, [k: string]: unknown }> }}
 */
export function applyActivity(streak, today) {
  // Already counted today: nothing changes. This is what makes repeated completions safe.
  if (streak.lastActiveDay === today) return { streak: { ...streak }, events: [] };

  let current;
  let freezes = streak.freezes ?? 0;
  const events = [];
  const gap = streak.lastActiveDay ? dayGap(streak.lastActiveDay, today) : null;

  if (gap === 1) {
    current = streak.current + 1;
  } else if (gap === 2 && freezes > 0) {
    // Exactly one day missed: spend a freeze to keep the streak.
    freezes -= 1;
    current = streak.current + 1;
    events.push({ type: 'streak_freeze_used' });
  } else {
    current = 1;
  }

  const longest = Math.max(streak.longest ?? 0, current);
  events.push({ type: 'streak_extended', current });
  if (isStreakMilestone(current)) events.push({ type: 'streak_milestone', current });

  if (earnsStreakFreeze(current) && freezes < MAX_STREAK_FREEZES) {
    freezes += 1;
    events.push({ type: 'streak_freeze_earned', freezes });
  }

  return {
    streak: { current, longest, lastActiveDay: today, freezes },
    events,
  };
}
