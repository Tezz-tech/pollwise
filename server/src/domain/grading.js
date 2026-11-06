/**
 * Marking rules (SPEC §8.2). Pure functions with no database access, so every rule can be tested
 * directly. Grading always runs against the attempt's snapshot of the question, never the live bank.
 */
import { z } from 'zod';
import { QUESTION_TYPES, UNGRADED_QUESTION_TYPES } from '@pollwise/shared/constants';

export const MAX_RESPONSE_ITEMS = 10;

/** What a learner may send for each question type. Anything else is refused before marking. */
export const responseSchemas = Object.freeze({
  [QUESTION_TYPES.SINGLE_CHOICE]: z.object({ optionId: z.string().min(1).max(64) }).strict(),
  [QUESTION_TYPES.MULTI_CHOICE]: z
    .object({ optionIds: z.array(z.string().min(1).max(64)).max(MAX_RESPONSE_ITEMS) })
    .strict(),
  [QUESTION_TYPES.TRUE_FALSE]: z.object({ value: z.boolean() }).strict(),
  [QUESTION_TYPES.MATCHING]: z
    .object({
      rightByLeft: z.record(z.string().min(1).max(64), z.string().min(1).max(64)),
    })
    .strict(),
  [QUESTION_TYPES.ORDERING]: z
    .object({ order: z.array(z.string().min(1).max(64)).max(MAX_RESPONSE_ITEMS) })
    .strict(),
  [QUESTION_TYPES.FILL_BLANK]: z
    .object({ blanks: z.array(z.string().max(200)).max(MAX_RESPONSE_ITEMS) })
    .strict(),
  [QUESTION_TYPES.REFLECTION]: z.object({ text: z.string().max(2000) }).strict(),
});

/**
 * @param {string} type
 * @param {unknown} response
 * @returns {{ ok: true, value: object } | { ok: false, message: string }}
 */
export function parseResponse(type, response) {
  const schema = responseSchemas[type];
  if (!schema) return { ok: false, message: 'Unknown question type.' };
  const result = schema.safeParse(response);
  if (!result.success) return { ok: false, message: 'That answer is not in the right form.' };
  return { ok: true, value: result.data };
}

/**
 * Fill-in-the-blank comparison (SPEC §8.2): trim, collapse internal whitespace, case-insensitive,
 * strip trailing punctuation.
 * @param {string} value
 */
export function normaliseBlankAnswer(value) {
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[.,;:!?]+$/, '')
    .trim();
}

const sameSet = (a, b) => {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((x) => right.has(x));
};

/** Number of blanks a fill_blank template contains. */
export function blankCount(template) {
  return template.split('___').length - 1;
}

/**
 * Mark one answer. Returns `correct: null` for reflection (never graded). Points are all-or-nothing.
 * @param {object} question snapshot of the question as stored on the attempt
 * @param {object} response already parsed with parseResponse()
 * @returns {{ correct: boolean | null, pointsAwarded: number, possible: number }}
 */
export function markAnswer(question, response) {
  if (UNGRADED_QUESTION_TYPES.includes(question.type)) {
    return { correct: null, pointsAwarded: 0, possible: 0 };
  }

  let correct;
  switch (question.type) {
    case QUESTION_TYPES.SINGLE_CHOICE:
      correct = response.optionId === question.correctOptionId;
      break;
    case QUESTION_TYPES.MULTI_CHOICE:
      // Exact set: picking every correct option plus one wrong one is wrong.
      correct = sameSet(response.optionIds, question.correctOptionIds);
      break;
    case QUESTION_TYPES.TRUE_FALSE:
      correct = response.value === question.correct;
      break;
    case QUESTION_TYPES.MATCHING:
      // Every pair must be matched to its own right-hand side.
      correct =
        Object.keys(response.rightByLeft).length === question.pairs.length &&
        question.pairs.every((pair) => response.rightByLeft[pair.id] === pair.rightId);
      break;
    case QUESTION_TYPES.ORDERING:
      correct =
        response.order.length === question.correctOrder.length &&
        response.order.every((id, i) => id === question.correctOrder[i]);
      break;
    case QUESTION_TYPES.FILL_BLANK: {
      const accepted = question.acceptedAnswers;
      const blanks = response.blanks;
      correct =
        blanks.length === accepted.length &&
        accepted.every((list, i) =>
          list.map(normaliseBlankAnswer).includes(normaliseBlankAnswer(blanks[i] ?? ''))
        );
      break;
    }
    default:
      correct = false;
  }

  return {
    correct,
    pointsAwarded: correct ? question.points : 0,
    possible: question.points,
  };
}

/**
 * Score as a whole percentage (SPEC §8.2): round(pointsAwarded / pointsPossible × 100). Reflection
 * questions are excluded from the denominator. Unanswered graded questions count as 0.
 * @param {Array<{ type: string, points: number, pointsAwarded?: number }>} graded every question on the attempt
 * @returns {number}
 */
export function computeScore(graded) {
  let possible = 0;
  let awarded = 0;
  for (const item of graded) {
    if (UNGRADED_QUESTION_TYPES.includes(item.type)) continue;
    possible += item.points;
    awarded += item.pointsAwarded ?? 0;
  }
  if (possible === 0) return 0;
  return Math.round((awarded * 100) / possible);
}

/**
 * Whether a score passes. `>=`, so exactly the pass mark passes (SPEC §8.2).
 * @param {number} score
 * @param {number} passMark
 */
export function isPass(score, passMark) {
  return score >= passMark;
}

/**
 * The correct answer in a form a learner may see after the reveal rules allow it.
 * @param {object} question snapshot
 */
export function correctAnswerFor(question) {
  switch (question.type) {
    case QUESTION_TYPES.SINGLE_CHOICE:
      return question.options.find((o) => o.id === question.correctOptionId)?.text ?? null;
    case QUESTION_TYPES.MULTI_CHOICE:
      return question.options
        .filter((o) => question.correctOptionIds.includes(o.id))
        .map((o) => o.text);
    case QUESTION_TYPES.TRUE_FALSE:
      return question.correct;
    case QUESTION_TYPES.MATCHING:
      return question.pairs.map((p) => ({ left: p.left, right: p.right }));
    case QUESTION_TYPES.ORDERING:
      return question.correctOrder.map((id) => question.items.find((i) => i.id === id)?.text ?? '');
    case QUESTION_TYPES.FILL_BLANK:
      return question.acceptedAnswers.map((list) => list[0]);
    default:
      return null;
  }
}
