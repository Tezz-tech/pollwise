/**
 * Assessment schema (SPEC §5 "Assessment"): one per module, holds the question bank and its settings.
 */
import { z } from 'zod';
import { REVEAL_MODE_VALUES } from '../constants.js';
import { objectIdSchema, shortText } from './common.js';
import { questionSchema } from './question.js';

export const assessmentSchema = z.object({
  _id: objectIdSchema.optional(),
  moduleId: objectIdSchema.optional(),
  title: shortText(160),
  questions: z.array(questionSchema).max(200).default([]),
  /** null = use every question in the bank. */
  drawCount: z.number().int().min(1).max(200).nullable().default(null),
  /** null = use Settings.defaultPassMark (70). */
  passMark: z.number().int().min(1).max(100).nullable().default(null),
  /** null = unlimited attempts. */
  maxAttempts: z.number().int().min(1).max(50).nullable().default(null),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  revealAnswers: z.enum(REVEAL_MODE_VALUES).default('after_pass'),
  /** null = untimed. */
  timeLimitMin: z.number().int().min(1).max(240).nullable().default(null),
});
