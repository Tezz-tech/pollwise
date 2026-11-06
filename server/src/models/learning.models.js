/**
 * Learner-side records (SPEC §5): lesson progress, assessment attempts, XP events and certificates.
 */
import mongoose from 'mongoose';
import { ATTEMPT_STATUS, LESSON_PROGRESS_STATUS } from '@pollwise/shared/constants';

const { Schema } = mongoose;

const lessonProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    status: {
      type: String,
      enum: Object.values(LESSON_PROGRESS_STATUS),
      default: LESSON_PROGRESS_STATUS.IN_PROGRESS,
    },
    /** Merged spans of real watching, in seconds. */
    watchedSegments: { type: [Schema.Types.Mixed], default: [] },
    /** Last heartbeat seen, used to judge the next one (SPEC §7). */
    lastHeartbeat: {
      position: Number,
      at: Date,
    },
    lastPositionSec: { type: Number, default: 0 },
    /** Set the first time the learner opens the lesson; text and document minimum times count from here. */
    openedAt: { type: Date, required: true },
    completedAt: Date,
    /** Practice lessons: one entry per answered question. */
    practiceAnswers: {
      type: [
        {
          questionId: Schema.Types.ObjectId,
          correct: { type: Boolean, default: null },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);
lessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
lessonProgressSchema.index({ userId: 1, courseId: 1 });

const attemptQuestionSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    version: { type: Number, required: true },
    /** The question as it was when the attempt started. Server-only: never returned to a learner. */
    snapshot: { type: Schema.Types.Mixed, required: true, select: false },
    /** The order options, items or pairs are shown in for this learner (SPEC §8.2). */
    presentation: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const attemptAnswerSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    response: { type: Schema.Types.Mixed, default: null },
    correct: { type: Boolean, default: null },
    pointsAwarded: { type: Number, default: 0 },
    answeredAt: { type: Date, required: true },
  },
  { _id: false }
);

const assessmentAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    questions: { type: [attemptQuestionSchema], default: [] },
    answers: { type: [attemptAnswerSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(ATTEMPT_STATUS),
      default: ATTEMPT_STATUS.IN_PROGRESS,
    },
    /** Snapshot of the pass mark when the attempt started, so a later settings change cannot move it. */
    passMark: { type: Number, required: true },
    score: Number,
    passed: Boolean,
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    submittedAt: Date,
  },
  { timestamps: true }
);
// One active attempt per learner per assessment (SPEC §8.2).
assessmentAttemptSchema.index(
  { userId: 1, assessmentId: 1 },
  { unique: true, partialFilterExpression: { status: 'in_progress' } }
);
assessmentAttemptSchema.index({ userId: 1, assessmentId: 1, status: 1 });

const xpEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    refId: { type: String, required: true },
    day: { type: String, required: true },
  },
  { timestamps: true }
);
// XP can never be awarded twice for the same thing (SPEC §5, §8.3).
xpEventSchema.index({ userId: 1, reason: 1, refId: 1 }, { unique: true });
xpEventSchema.index({ userId: 1, day: 1 });

const certificateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    code: { type: String, required: true, unique: true, minlength: 10, maxlength: 10 },
    learnerName: { type: String, required: true, maxlength: 120 },
    courseTitle: { type: String, required: true, maxlength: 120 },
    score: { type: Number, required: true, min: 0, max: 100 },
    issuedAt: { type: Date, required: true },
    revokedAt: Date,
  },
  { timestamps: true }
);
// One certificate per learner per course (SPEC §5).
certificateSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const LessonProgress =
  mongoose.models.LessonProgress || mongoose.model('LessonProgress', lessonProgressSchema);
export const AssessmentAttempt =
  mongoose.models.AssessmentAttempt || mongoose.model('AssessmentAttempt', assessmentAttemptSchema);
export const XpEvent = mongoose.models.XpEvent || mongoose.model('XpEvent', xpEventSchema);
export const Certificate =
  mongoose.models.Certificate || mongoose.model('Certificate', certificateSchema);
