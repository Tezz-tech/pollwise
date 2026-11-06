/**
 * Course schema (SPEC §5 "Course"). Admin input only; the learner course list is built on the server.
 */
import { z } from 'zod';
import { PERSONNEL_ROLE_VALUES } from '../constants.js';
import { httpsUrlSchema, objectIdSchema, shortText, wholeNumber } from './common.js';
import { richTextSchema } from './lesson.js';

export const coverImageSchema = z.object({
  url: httpsUrlSchema,
  publicId: shortText(200),
});

export const courseSchema = z.object({
  _id: objectIdSchema.optional(),
  title: shortText(120),
  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug may only contain lowercase letters, digits and hyphens'
    )
    .min(3)
    .max(120)
    .optional(),
  summary: shortText(160),
  description: richTextSchema.optional(),
  coverImage: coverImageSchema.nullable().default(null),
  category: shortText(60),
  targetRoles: z.array(z.enum(PERSONNEL_ROLE_VALUES)).min(1).max(6),
  isRequired: z.boolean().default(false),
  estimatedMinutes: wholeNumber(100000).default(0),
});

/**
 * Status is deliberately absent: courses change status only through the publish and unpublish
 * endpoints (SECURITY §4, mass assignment).
 */
