/**
 * Client-side mirrors of the lesson rules, used only to show the learner a timer and a disabled button. The server
 * enforces every one of these again (SPEC §8.1, SECURITY §3), and its answer is the one that counts.
 */

/** Minimum time before a text lesson can be completed: max(10 s, readMinutes × 20 s) (SECURITY §3). */
export function textMinimumSeconds(readMinutes) {
  return Math.max(10, (readMinutes ?? 1) * 20);
}

/** Seconds of watching a video needed before it can be completed: 90% (SPEC §8.1). */
export const VIDEO_COMPLETE_FRACTION = 0.9;

/** Sum the `xp` events from a server response, for the lesson-complete count-up. */
export function xpFrom(events) {
  return (events ?? []).reduce(
    (total, event) => (event.type === 'xp' ? total + event.amount : total),
    0
  );
}
