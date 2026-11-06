/**
 * Video watch tracking (SPEC §7, SECURITY §3). The app reports its playback position every 10 seconds.
 * The server decides how much real watching that represents, so the client cannot simply claim it.
 *
 * Rule: a jump from the last reported position counts only if it is no larger than
 * elapsed wall-clock seconds × 1.5 + 5. Seeking forward does not count. Rewinding does not count.
 */

export const JUMP_FACTOR = 1.5;
export const JUMP_SLACK_SEC = 5;
export const COMPLETION_FRACTION = 0.9;

/**
 * Add a [from, to] span and merge it into the existing spans.
 * @param {Array<[number, number]>} spans
 * @param {[number, number]} span
 * @returns {Array<[number, number]>} sorted, non-overlapping
 */
export function addSpan(spans, span) {
  const all = [...spans, span].sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of all) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/** Total seconds covered by the spans. */
export function coveredSeconds(spans) {
  return spans.reduce((sum, [start, end]) => sum + (end - start), 0);
}

/**
 * Apply one heartbeat.
 * @param {{ spans: Array<[number, number]>, anchor: { position: number, at: Date } | null }} state
 * @param {{ position: number, at: Date }} beat
 * @returns {{ spans: Array<[number, number]>, anchor: { position: number, at: Date }, counted: boolean }}
 */
export function applyHeartbeat(state, beat) {
  let spans = state.spans;
  let counted = false;

  if (state.anchor) {
    const delta = beat.position - state.anchor.position;
    const elapsed = (beat.at.getTime() - state.anchor.at.getTime()) / 1000;
    if (delta > 0 && delta <= elapsed * JUMP_FACTOR + JUMP_SLACK_SEC) {
      spans = addSpan(spans, [state.anchor.position, beat.position]);
      counted = true;
    }
  }

  return { spans, anchor: { position: beat.position, at: beat.at }, counted };
}

/**
 * Whether the covered time is enough to complete the video (SPEC §7: at least 90% of its length).
 * @param {Array<[number, number]>} spans
 * @param {number} durationSec the length the server stored, never the client's claim
 */
export function isWatched(spans, durationSec) {
  if (!(durationSec > 0)) return false;
  return coveredSeconds(spans) >= durationSec * COMPLETION_FRACTION;
}
