/**
 * Lesson and module schemas (SPEC §5 "Module" and "Lesson").
 */
import { z } from 'zod';
import { LESSON_TYPES } from '../constants.js';
import { validateRichText } from './richText.js';
import {
  httpsUrlSchema,
  objectIdSchema,
  shortText,
  wholeNumber,
  youtubeIdSchema,
} from './common.js';
import { questionSchema } from './question.js';

/** TipTap doc validated structurally here; the full allowlist check runs in validateRichText(). */
export const richTextSchema = z.custom((value) => validateRichText(value).valid, {
  message: 'Rich text contains content that is not allowed',
});

export const videoLessonSchema = z.object({
  youtubeId: youtubeIdSchema,
  title: shortText(200),
  thumbnailUrl: httpsUrlSchema,
  durationSec: wholeNumber(60 * 60 * 6)
    .nullable()
    .default(null),
  keyPoints: z.array(shortText(200)).max(10).default([]),
});

export const textLessonSchema = z.object({
  doc: richTextSchema,
  readMinutes: z.number().int().min(1).max(120),
});

export const documentLessonSchema = z.object({
  url: httpsUrlSchema,
  publicId: shortText(200),
  fileName: shortText(200),
  bytes: wholeNumber(20 * 1024 * 1024),
  pages: z.number().int().min(1).max(2000).nullable().default(null),
});

export const practiceLessonSchema = z.object({
  questions: z.array(questionSchema).max(50),
});

/**
 * A lesson. The sub-object matching `type` must be present; the others are dropped by the
 * superRefine check (they must not be present at all, so admin data stays clean).
 */
export const lessonSchema = z
  .object({
    _id: objectIdSchema.optional(),
    moduleId: objectIdSchema.optional(),
    title: shortText(160),
    order: wholeNumber(10000),
    type: z.enum(Object.values(LESSON_TYPES)),
    xp: wholeNumber(100).optional(),
    video: videoLessonSchema.optional(),
    text: textLessonSchema.optional(),
    document: documentLessonSchema.optional(),
    practice: practiceLessonSchema.optional(),
  })
  .superRefine((lesson, ctx) => {
    const required = {
      [LESSON_TYPES.VIDEO]: 'video',
      [LESSON_TYPES.TEXT]: 'text',
      [LESSON_TYPES.DOCUMENT]: 'document',
      [LESSON_TYPES.PRACTICE]: 'practice',
    }[lesson.type];

    if (!lesson[required]) {
      ctx.addIssue({
        code: 'custom',
        path: [required],
        message: `A ${lesson.type} lesson needs its "${required}" details`,
      });
    }
    for (const other of ['video', 'text', 'document', 'practice']) {
      if (other !== required && lesson[other] !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [other],
          message: `A ${lesson.type} lesson cannot have "${other}" details`,
        });
      }
    }
  });

export const moduleSchema = z.object({
  _id: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
  title: shortText(160),
  description: shortText(500).optional(),
  order: wholeNumber(10000),
});
