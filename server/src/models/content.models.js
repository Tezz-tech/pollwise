/**
 * Course, Module, Lesson, Assessment and Enrollment (SPEC §5). Lesson and assessment content is stored
 * as validated JSON; rich text is TipTap JSON checked against the allowlist before it is saved.
 */
import mongoose from 'mongoose';
import {
  COURSE_STATUS,
  LESSON_TYPE_VALUES,
  PERSONNEL_ROLE_VALUES,
  REVEAL_MODE_VALUES,
} from '@pollwise/shared/constants';
import { questionSchema } from './questionSchema.js';

const { Schema } = mongoose;

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, maxlength: 140 },
    summary: { type: String, default: '', maxlength: 160 },
    description: { type: Schema.Types.Mixed },
    coverImage: {
      url: String,
      publicId: String,
    },
    category: { type: String, default: '', maxlength: 60 },
    targetRoles: { type: [{ type: String, enum: PERSONNEL_ROLE_VALUES }], default: [] },
    isRequired: { type: Boolean, default: false },
    estimatedMinutes: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: Object.values(COURSE_STATUS), default: COURSE_STATUS.DRAFT },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    publishedAt: Date,
    moduleIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);
// Learner catalogue: published courses filtered by target role.
courseSchema.index({ status: 1, targetRoles: 1 });

const moduleSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, maxlength: 500 },
    order: { type: Number, required: true, min: 0 },
    lessonIds: { type: [Schema.Types.ObjectId], default: [] },
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment' },
  },
  { timestamps: true }
);
// Order is kept in the parent's id list (moduleIds / lessonIds), so the order field is not unique: a
// reorder would otherwise collide with itself part-way through.
moduleSchema.index({ courseId: 1, order: 1 });

const lessonSchema = new Schema(
  {
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    order: { type: Number, required: true, min: 0 },
    type: { type: String, enum: LESSON_TYPE_VALUES, required: true },
    xp: { type: Number, default: 0, min: 0, max: 100 },
    video: {
      youtubeId: String,
      title: String,
      thumbnailUrl: String,
      durationSec: { type: Number, min: 1 },
      keyPoints: { type: [String], default: [] },
    },
    text: {
      doc: Schema.Types.Mixed,
      readMinutes: { type: Number, min: 1 },
    },
    document: {
      url: String,
      publicId: String,
      fileName: String,
      bytes: Number,
      pages: Number,
    },
    practice: {
      questions: { type: [questionSchema], default: [] },
    },
  },
  { timestamps: true }
);
lessonSchema.index({ moduleId: 1, order: 1 });

const assessmentSchema = new Schema(
  {
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    questions: { type: [questionSchema], default: [] },
    drawCount: { type: Number, default: null, min: 1, max: 200 },
    passMark: { type: Number, default: null, min: 1, max: 100 },
    maxAttempts: { type: Number, default: null, min: 1, max: 50 },
    shuffleQuestions: { type: Boolean, default: true },
    shuffleOptions: { type: Boolean, default: true },
    revealAnswers: { type: String, enum: REVEAL_MODE_VALUES, default: 'after_pass' },
    timeLimitMin: { type: Number, default: null, min: 1, max: 240 },
  },
  { timestamps: true }
);

const enrollmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
    currentModuleId: { type: Schema.Types.ObjectId, ref: 'Module' },
    startedAt: { type: Date, required: true },
    completedAt: Date,
    /** Best score per module, keyed by module id. */
    bestScores: { type: Map, of: Number, default: {} },
    /** Modules whose assessment has been passed. Kept as a list so unlock checks are simple. */
    passedModuleIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);
// One enrolment per learner per course (SPEC §5).
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ courseId: 1 });

export const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);
export const Module = mongoose.models.Module || mongoose.model('Module', moduleSchema);
export const Lesson = mongoose.models.Lesson || mongoose.model('Lesson', lessonSchema);
export const Assessment =
  mongoose.models.Assessment || mongoose.model('Assessment', assessmentSchema);
export const Enrollment =
  mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);
