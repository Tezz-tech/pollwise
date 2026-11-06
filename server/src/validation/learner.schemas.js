/**
 * Request schemas for the learner API (SPEC §6, SECURITY §4). Learner bodies strip unknown keys, so a
 * client can never send its own score, pass flag, XP or completion status.
 */
import { z } from 'zod';
import { PERSONNEL_ROLE_VALUES } from '@pollwise/shared/constants';
import { objectIdSchema } from '@pollwise/shared/schemas';

export const catalogueQuery = z.object({
  role: z.enum([...PERSONNEL_ROLE_VALUES, 'all']).optional(),
  q: z.string().trim().max(80).optional(),
});

export const slugParams = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Unknown course.')
    .max(140),
});

export const idParams = z.object({ id: objectIdSchema });

export const lessonParams = z.object({ id: objectIdSchema });

/** The app reports where playback is. The server ignores any duration the client sends. */
export const heartbeatBody = z.object({
  positionSec: z
    .number()
    .min(0)
    .max(6 * 60 * 60),
  durationSec: z
    .number()
    .min(0)
    .max(6 * 60 * 60)
    .optional(),
});

export const practiceAnswerBody = z.object({
  questionId: objectIdSchema,
  response: z.any(),
});

export const attemptAnswerBody = z.object({
  questionId: objectIdSchema,
  response: z.any(),
});

export const attemptParams = z.object({ id: objectIdSchema });

export const certificateCodeParams = z.object({
  code: z.string().min(10).max(10),
});
