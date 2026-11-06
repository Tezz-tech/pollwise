/**
 * Makes sure an answer only refers to choices that exist on the question. A made-up option id is a bad
 * request, not a wrong answer, so it is refused before marking.
 */
import { QUESTION_TYPES } from '@pollwise/shared/constants';

/**
 * @param {object} question stored or snapshot question
 * @param {object} response already parsed with parseResponse()
 * @returns {boolean}
 */
export function responseReferencesValid(question, response) {
  const optionIds = new Set((question.options ?? []).map((o) => o.id));
  const itemIds = new Set((question.items ?? []).map((i) => i.id));
  const leftIds = new Set((question.pairs ?? []).map((p) => p.id));
  const rightIds = new Set((question.pairs ?? []).map((p) => p.rightId));

  switch (question.type) {
    case QUESTION_TYPES.SINGLE_CHOICE:
      return optionIds.has(response.optionId);
    case QUESTION_TYPES.MULTI_CHOICE:
      return response.optionIds.every((id) => optionIds.has(id));
    case QUESTION_TYPES.ORDERING:
      return response.order.every((id) => itemIds.has(id));
    case QUESTION_TYPES.MATCHING:
      return Object.entries(response.rightByLeft).every(
        ([left, right]) => leftIds.has(left) && rightIds.has(right)
      );
    default:
      return true;
  }
}
