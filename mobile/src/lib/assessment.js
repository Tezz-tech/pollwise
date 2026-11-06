/**
 * Assessment rules the screens show (SPEC §8.2, §8.3, DESIGN §6.8). Pure, so they are tested in Node. The server
 * still decides every score, pass and XP award; these only label what it sent.
 */

/** Labels for the XP reasons a check can award (server: attemptService progressAfterSubmit). */
const XP_LABELS = Object.freeze({
  assessment_pass: 'Passed',
  assessment_first_try: 'First try',
  assessment_perfect: 'Perfect score',
});

/**
 * The rows of the XP breakdown, in the order the server awarded them.
 * @param {{ type: string, amount?: number, reason?: string }[]} events
 * @returns {{ label: string, amount: number }[]}
 */
export function xpBreakdown(events) {
  return (events ?? [])
    .filter((e) => e.type === 'xp' && XP_LABELS[e.reason])
    .map((e) => ({ label: XP_LABELS[e.reason], amount: e.amount }));
}

/**
 * The questions the learner got wrong, as the prompts they saw. The review only lists them when the server's reveal
 * rule allows it; with no review, nothing is listed.
 * @param {{ questionId: string, correct: boolean }[]} review
 * @param {{ id: string, prompt: string }[]} questions
 * @returns {string[]}
 */
export function missedPrompts(review, questions) {
  const prompts = new Map((questions ?? []).map((q) => [q.id, q.prompt]));
  return (review ?? [])
    .filter((r) => r.correct === false)
    .map((r) => prompts.get(r.questionId))
    .filter(Boolean);
}

/**
 * "4:59" for a countdown, or "0:00" once time is up.
 * @param {number} ms milliseconds left
 */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The score as a whole percentage, for the ring. Anything not a number is 0.
 * @param {number | null | undefined} score
 */
export function scorePercent(score) {
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
}
