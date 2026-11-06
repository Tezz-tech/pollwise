/**
 * The ONLY path from a stored question or lesson to a learner response (SECURITY §3).
 *
 * Every function here builds a new object from an explicit whitelist. Nothing is copied with spread or
 * passed through, so a field added to the model later can never reach a learner by accident. The
 * answer-leak test in server/test walks every learner response to enforce this.
 */
import { randomInt } from 'node:crypto';
import { QUESTION_TYPES } from '@pollwise/shared/constants';
import { blankCount } from './grading.js';

/** Fisher–Yates with a cryptographic source, so the order cannot be predicted from earlier orders. */
export function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Decide the order a learner sees things in. Stored on the attempt so the same order is shown on
 * resume and so grading never depends on display order.
 * @param {object} question stored question
 * @param {{ shuffleOptions: boolean }} settings
 * @returns {{ options?: string[], items?: string[], left?: string[], right?: string[] }}
 */
export function presentationFor(question, { shuffleOptions }) {
  const pick = (ids) => (shuffleOptions ? shuffled(ids) : ids);
  switch (question.type) {
    case QUESTION_TYPES.SINGLE_CHOICE:
    case QUESTION_TYPES.MULTI_CHOICE:
      return { options: pick(question.options.map((o) => o.id)) };
    case QUESTION_TYPES.ORDERING:
      // Items always shuffle: the stored correctOrder is the answer, and the display order must not be it.
      return { items: shuffled(question.items.map((i) => i.id)) };
    case QUESTION_TYPES.MATCHING:
      // Both columns shuffle independently (SECURITY §3).
      return {
        left: shuffled(question.pairs.map((p) => p.id)),
        right: shuffled(question.pairs.map((p) => p.rightId)),
      };
    default:
      return {};
  }
}

/**
 * Learner view of one question. `presentation` supplies the order; without it, stored order is used.
 * @param {object} question stored question (or attempt snapshot)
 * @param {object} [presentation] from presentationFor()
 */
export function serializeQuestionForLearner(question, presentation = {}) {
  const base = {
    id: String(question._id),
    type: question.type,
    prompt: question.prompt,
    imageUrl: question.imageUrl ?? null,
  };

  switch (question.type) {
    case QUESTION_TYPES.SINGLE_CHOICE:
    case QUESTION_TYPES.MULTI_CHOICE:
      return { ...base, options: orderBy(question.options, presentation.options) };
    case QUESTION_TYPES.TRUE_FALSE:
      return base;
    case QUESTION_TYPES.MATCHING:
      return {
        ...base,
        leftItems: orderBy(
          question.pairs.map((p) => ({ id: p.id, text: p.left })),
          presentation.left
        ),
        rightItems: orderBy(
          question.pairs.map((p) => ({ id: p.rightId, text: p.right })),
          presentation.right
        ),
      };
    case QUESTION_TYPES.ORDERING:
      return { ...base, items: orderBy(question.items, presentation.items) };
    case QUESTION_TYPES.FILL_BLANK:
      return { ...base, template: question.template, blankCount: blankCount(question.template) };
    case QUESTION_TYPES.REFLECTION:
      return base;
    default:
      throw new TypeError(`serializeQuestionForLearner: unknown type ${question.type}`);
  }
}

/** Order a list of {id,text} by a list of ids, keeping only the whitelisted fields. */
function orderBy(items, ids) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const order = ids ?? items.map((i) => i.id);
  return order.map((id) => ({ id, text: byId.get(id).text }));
}

/**
 * Learner view of a lesson's content. Video includes the YouTube ID; nothing else internal.
 * @param {object} lesson stored lesson
 */
export function serializeLessonForLearner(lesson) {
  const base = {
    id: String(lesson._id),
    moduleId: String(lesson.moduleId),
    title: lesson.title,
    type: lesson.type,
    xp: lesson.xp,
  };
  switch (lesson.type) {
    case 'video':
      return {
        ...base,
        video: {
          youtubeId: lesson.video.youtubeId,
          title: lesson.video.title,
          thumbnailUrl: lesson.video.thumbnailUrl,
          durationSec: lesson.video.durationSec,
          keyPoints: [...(lesson.video.keyPoints ?? [])],
        },
      };
    case 'text':
      return {
        ...base,
        text: { doc: lesson.text.doc, readMinutes: lesson.text.readMinutes },
      };
    case 'document':
      return {
        ...base,
        document: {
          url: lesson.document.url,
          fileName: lesson.document.fileName,
          bytes: lesson.document.bytes,
          pages: lesson.document.pages ?? null,
        },
      };
    case 'practice':
      return {
        ...base,
        questions: lesson.practice.questions.map((q) =>
          serializeQuestionForLearner(q, presentationFor(q, { shuffleOptions: true }))
        ),
      };
    default:
      throw new TypeError(`serializeLessonForLearner: unknown type ${lesson.type}`);
  }
}
