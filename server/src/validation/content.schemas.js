/**
 * Request schemas for the admin content API (SPEC §6 admin routes, SECURITY §4). Admin bodies are
 * strict: an unknown key is an error, so nothing sneaks past into the database.
 */
import { z } from 'zod';
import {
  LESSON_TYPE_VALUES,
  PERSONNEL_ROLE_VALUES,
  REVEAL_MODE_VALUES,
} from '@pollwise/shared/constants';
import {
  documentLessonSchema,
  objectIdSchema,
  practiceLessonSchema,
  questionSchema,
  richTextSchema,
  textLessonSchema,
  videoLessonSchema,
} from '@pollwise/shared/schemas';

const text = (max) => z.string().trim().min(1).max(max);
const optionalText = (max) => z.string().trim().max(max);

/** Cloudinary asset URLs only (SECURITY §7). Anything else is refused. */
export const cloudinaryUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com';
    } catch {
      return false;
    }
  }, 'Images and PDFs must come from the PollWise upload service');

export const idParams = z.object({ id: objectIdSchema });
export const idAndModuleParams = z.object({ id: objectIdSchema, moduleId: objectIdSchema });
export const moduleAndLessonParams = z.object({ id: objectIdSchema, lessonId: objectIdSchema });

export const courseCreateBody = z
  .object({
    title: text(120),
    summary: text(160),
    description: richTextSchema.optional(),
    category: optionalText(60),
    targetRoles: z.array(z.enum(PERSONNEL_ROLE_VALUES)).min(1).max(6),
    isRequired: z.boolean().default(false),
    estimatedMinutes: z.number().int().min(0).max(100000).default(0),
  })
  .strict();

export const courseUpdateBody = courseCreateBody.partial().extend({
  coverImage: z
    .object({ url: cloudinaryUrl, publicId: text(200) })
    .nullable()
    .optional(),
});

export const courseListQuery = z
  .object({
    status: z.enum(['draft', 'published', 'archived']).optional(),
    q: z.string().trim().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const moduleCreateBody = z
  .object({
    title: text(160),
    description: optionalText(500).optional(),
  })
  .strict();

export const moduleUpdateBody = moduleCreateBody.partial();

export const reorderBody = (key) =>
  z.object({ [key]: z.array(objectIdSchema).min(1).max(200) }).strict();

const lessonBase = {
  title: text(160),
  xp: z.number().int().min(0).max(100).optional(),
};

/** Lesson create/update: exactly one detail object, matching `type`. */
export const lessonBody = z
  .object({
    ...lessonBase,
    type: z.enum(LESSON_TYPE_VALUES),
    // The thumbnail is derived by the server from the video ID, never taken from the client.
    video: videoLessonSchema.omit({ thumbnailUrl: true }).strict().optional(),
    text: textLessonSchema.optional(),
    document: documentLessonSchema.extend({ url: cloudinaryUrl }).strict().optional(),
    practice: practiceLessonSchema.optional(),
  })
  .strict()
  .superRefine((lesson, ctx) => {
    const detail = { video: 'video', text: 'text', document: 'document', practice: 'practice' };
    const needed = detail[lesson.type];
    if (!lesson[needed]) {
      ctx.addIssue({
        code: 'custom',
        path: [needed],
        message: `A ${lesson.type} lesson needs its ${needed} details.`,
      });
    }
    for (const other of Object.values(detail)) {
      if (other !== needed && lesson[other] !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [other],
          message: `A ${lesson.type} lesson cannot have ${other} details.`,
        });
      }
    }
  });

export const lessonUpdateBody = z
  .object({
    ...lessonBase,
    title: text(160).optional(),
    video: lessonBody.shape.video,
    text: lessonBody.shape.text,
    document: lessonBody.shape.document,
    practice: lessonBody.shape.practice,
  })
  .strict();

/**
 * Assessment settings and the whole question bank. The bank is replaced as a set: the server works out
 * which questions changed (for versioning) by their _id.
 */
export const assessmentBody = z
  .object({
    title: text(160).optional(),
    drawCount: z.number().int().min(1).max(200).nullable().optional(),
    passMark: z.number().int().min(1).max(100).nullable().optional(),
    maxAttempts: z.number().int().min(1).max(50).nullable().optional(),
    shuffleQuestions: z.boolean().optional(),
    shuffleOptions: z.boolean().optional(),
    revealAnswers: z.enum(REVEAL_MODE_VALUES).optional(),
    timeLimitMin: z.number().int().min(1).max(240).nullable().optional(),
    questions: z.array(questionSchema).max(200),
  })
  .strict();

export const uploadSignBody = z
  .object({
    courseId: objectIdSchema,
    kind: z.enum(['image', 'pdf']),
  })
  .strict();

export const uploadConfirmBody = z
  .object({
    publicId: z
      .string()
      .min(3)
      .max(200)
      .regex(/^[A-Za-z0-9/_-]+$/),
  })
  .strict();

export const youtubeLookupQuery = z
  .object({
    url: z.string().trim().min(1).max(300),
  })
  .strict();
