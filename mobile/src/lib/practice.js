/**
 * Builds the response body each question type expects (server/src/domain/grading.js responseSchemas), and tells when
 * an answer is ready to send. Pure, so the shapes are tested here and cannot drift from the server silently.
 */

/** @typedef {'single_choice' | 'multi_choice' | 'true_false' | 'matching' | 'ordering' | 'fill_blank' | 'reflection'} QuestionType */

/**
 * @param {QuestionType} type
 * @param {any} state the component's own state for the question
 * @returns {object | null} the response, or null while the learner has not answered
 */
export function responseFor(type, state) {
  switch (type) {
    case 'single_choice':
      return state ? { optionId: state } : null;
    case 'multi_choice':
      return Array.isArray(state) && state.length ? { optionIds: state } : null;
    case 'true_false':
      return typeof state === 'boolean' ? { value: state } : null;
    case 'matching': {
      // state is { [leftId]: rightId }; every left item must be paired before it can be checked.
      if (!state) return null;
      const pairs = Object.entries(state).filter(([, right]) => right);
      return pairs.length ? { rightByLeft: Object.fromEntries(pairs) } : null;
    }
    case 'ordering':
      return Array.isArray(state) && state.length ? { order: state } : null;
    case 'fill_blank': {
      if (!Array.isArray(state)) return null;
      return state.some((value) => value && value.trim())
        ? { blanks: state.map((v) => v ?? '') }
        : null;
    }
    case 'reflection': {
      const text = typeof state === 'string' ? state.trim() : '';
      return text ? { text } : null;
    }
    default:
      return null;
  }
}

/**
 * Pairs for a matching question, in the order the learner made them: each left item and its chosen right item.
 * @param {Record<string, string>} state
 */
export function matchingPairs(state) {
  return Object.entries(state ?? {}).filter(([, right]) => right);
}

/**
 * Split a fill-in-the-blank template on its blanks. "___" marks each blank (server blankCount).
 * @param {string} template
 * @returns {string[]} the text around the blanks: blanks + 1 pieces
 */
export function splitTemplate(template) {
  return String(template ?? '').split('___');
}

/** The next question the learner has not answered, in order. */
export function firstUnanswered(questions, answeredIds) {
  const answered = new Set(answeredIds ?? []);
  return questions.findIndex((q) => !answered.has(q.id));
}

/**
 * The correct answer as words, for the feedback sheet (SPEC §8.2: shown only when the server sent one).
 * `correctAnswer` is the server's value; ids are turned into the text the learner saw.
 * @param {{ type: string, options?: { id: string, text: string }[], items?: { id: string, text: string }[], pairs?: { id: string, left: string, rightId: string, right: string }[], acceptedAnswers?: string[][] }} question
 * @param {any} correctAnswer
 * @returns {string | null}
 */
export function correctAnswerText(question, correctAnswer) {
  if (correctAnswer === null || correctAnswer === undefined) return null;
  switch (question.type) {
    case 'single_choice': {
      const option = question.options?.find((o) => o.id === correctAnswer);
      return option ? option.text : null;
    }
    case 'multi_choice': {
      const texts = (correctAnswer ?? [])
        .map((id) => question.options?.find((o) => o.id === id)?.text)
        .filter(Boolean);
      return texts.length ? texts.join(', ') : null;
    }
    case 'true_false':
      return correctAnswer ? 'True' : 'False';
    case 'matching': {
      const lines = (question.pairs ?? []).map((pair) => `${pair.left} → ${pair.right}`);
      return lines.length ? lines.join('\n') : null;
    }
    case 'ordering': {
      const texts = (correctAnswer ?? [])
        .map((id) => question.items?.find((i) => i.id === id)?.text)
        .filter(Boolean);
      return texts.length ? texts.map((t, i) => `${i + 1}. ${t}`).join('\n') : null;
    }
    case 'fill_blank':
      return Array.isArray(correctAnswer) && correctAnswer.length
        ? correctAnswer.map((list) => list[0]).join(', ')
        : null;
    default:
      return null;
  }
}
