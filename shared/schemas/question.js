/**
 * Question schemas, one per type (SPEC §5 "Question"). These include the answer key, so they are for
 * admin input and storage only. Learner responses must go through the server's
 * serializeQuestionForLearner(), which whitelists fields (SECURITY §3).
 */
import { z } from 'zod';
import { QUESTION_TYPES } from '../constants.js';
import { httpsUrlSchema, itemIdSchema, objectIdSchema, shortText } from './common.js';

/** Fields every question type shares. */
const baseQuestion = {
  _id: objectIdSchema.optional(),
  prompt: shortText(500),
  imageUrl: httpsUrlSchema.optional(),
  explanation: shortText(500).optional(),
  points: z.number().int().min(0).max(10).default(1),
  version: z.number().int().min(1).default(1),
};

/** Reject duplicate ids inside one list (options, pairs, items). */
const uniqueIds = (items) => new Set(items.map((item) => item.id)).size === items.length;

const optionSchema = z.object({ id: itemIdSchema, text: shortText(200) });

export const singleChoiceSchema = z
  .object({
    ...baseQuestion,
    type: z.literal(QUESTION_TYPES.SINGLE_CHOICE),
    options: z.array(optionSchema).min(2).max(6),
    correctOptionId: itemIdSchema,
  })
  .superRefine((q, ctx) => {
    if (!uniqueIds(q.options)) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Option ids must be unique' });
    }
    if (!q.options.some((o) => o.id === q.correctOptionId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctOptionId'],
        message: 'The correct option must be one of the options',
      });
    }
  });

export const multiChoiceSchema = z
  .object({
    ...baseQuestion,
    type: z.literal(QUESTION_TYPES.MULTI_CHOICE),
    options: z.array(optionSchema).min(2).max(8),
    correctOptionIds: z.array(itemIdSchema).min(1),
  })
  .superRefine((q, ctx) => {
    if (!uniqueIds(q.options)) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Option ids must be unique' });
    }
    const ids = new Set(q.options.map((o) => o.id));
    const unique = new Set(q.correctOptionIds);
    if (
      unique.size !== q.correctOptionIds.length ||
      !q.correctOptionIds.every((id) => ids.has(id))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctOptionIds'],
        message: 'Correct options must be unique and come from the options list',
      });
    }
  });

export const trueFalseSchema = z.object({
  ...baseQuestion,
  type: z.literal(QUESTION_TYPES.TRUE_FALSE),
  correct: z.boolean(),
});

export const matchingSchema = z
  .object({
    ...baseQuestion,
    type: z.literal(QUESTION_TYPES.MATCHING),
    // `id` identifies the left-hand item; `rightId` identifies the right-hand item. They are different
    // random ids so a learner's payload never shows which left item belongs with which right item.
    pairs: z
      .array(
        z.object({
          id: itemIdSchema,
          left: shortText(120),
          right: shortText(120),
          rightId: itemIdSchema.optional(),
        })
      )
      .min(3)
      .max(6),
  })
  .superRefine((q, ctx) => {
    if (!uniqueIds(q.pairs)) {
      ctx.addIssue({ code: 'custom', path: ['pairs'], message: 'Pair ids must be unique' });
    }
  });

export const orderingSchema = z
  .object({
    ...baseQuestion,
    type: z.literal(QUESTION_TYPES.ORDERING),
    items: z.array(optionSchema).min(3).max(8),
    correctOrder: z.array(itemIdSchema).min(3).max(8),
  })
  .superRefine((q, ctx) => {
    if (!uniqueIds(q.items)) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Item ids must be unique' });
    }
    const ids = new Set(q.items.map((i) => i.id));
    const order = new Set(q.correctOrder);
    const sameSet =
      order.size === ids.size &&
      q.correctOrder.length === q.items.length &&
      q.correctOrder.every((id) => ids.has(id));
    if (!sameSet) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctOrder'],
        message: 'The correct order must list every item exactly once',
      });
    }
  });

/** Blanks are written as ___ in the template. */
export const BLANK_MARKER = '___';

export const fillBlankSchema = z
  .object({
    ...baseQuestion,
    type: z.literal(QUESTION_TYPES.FILL_BLANK),
    template: shortText(500),
    acceptedAnswers: z
      .array(z.array(shortText(100)).min(1).max(10))
      .min(1)
      .max(10),
  })
  .superRefine((q, ctx) => {
    const blanks = q.template.split(BLANK_MARKER).length - 1;
    if (blanks < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['template'],
        message: `The template needs at least one ${BLANK_MARKER} blank`,
      });
    } else if (q.acceptedAnswers.length !== blanks) {
      ctx.addIssue({
        code: 'custom',
        path: ['acceptedAnswers'],
        message: `There must be one list of accepted answers for each of the ${blanks} blank(s)`,
      });
    }
  });

/** Reflection questions are never graded, so they carry no key and are always worth 0 points. */
export const reflectionSchema = z.object({
  _id: objectIdSchema.optional(),
  type: z.literal(QUESTION_TYPES.REFLECTION),
  prompt: shortText(500),
  imageUrl: httpsUrlSchema.optional(),
  explanation: shortText(500).optional(),
  // Whatever is sent is ignored; reflection is always worth 0.
  points: z.unknown().transform(() => 0),
  version: z.number().int().min(1).default(1),
});

/** Discriminated union over every question type. */
export const questionSchema = z.discriminatedUnion('type', [
  singleChoiceSchema,
  multiChoiceSchema,
  trueFalseSchema,
  matchingSchema,
  orderingSchema,
  fillBlankSchema,
  reflectionSchema,
]);
