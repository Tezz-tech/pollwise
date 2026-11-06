/**
 * Public entry point for the shared zod schemas. Server and admin validate with these at their
 * boundaries (CLAUDE.md rule 3).
 */
export { objectIdSchema, youtubeIdSchema, httpsUrlSchema } from './common.js';
export {
  RICH_TEXT_NODE_TYPES,
  RICH_TEXT_MARK_TYPES,
  RICH_TEXT_LIMITS,
  validateRichText,
} from './richText.js';
export {
  singleChoiceSchema,
  multiChoiceSchema,
  trueFalseSchema,
  matchingSchema,
  orderingSchema,
  fillBlankSchema,
  reflectionSchema,
  questionSchema,
  BLANK_MARKER,
} from './question.js';
export {
  richTextSchema,
  videoLessonSchema,
  textLessonSchema,
  documentLessonSchema,
  practiceLessonSchema,
  lessonSchema,
  moduleSchema,
} from './lesson.js';
export { assessmentSchema } from './assessment.js';
export { courseSchema, coverImageSchema } from './course.js';
