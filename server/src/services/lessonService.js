/**
 * Lesson reading, video heartbeats, text/document/practice completion (SPEC §6, §7, §8.1, SECURITY §3).
 */
import mongoose from 'mongoose';
import { ERROR_CODES, LESSON_TYPES, LESSON_PROGRESS_STATUS } from '@pollwise/shared/constants';
import { XP, lessonCompletionXp, practiceXp } from '@pollwise/shared/xp';
import { Lesson, LessonProgress, Module } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { serializeLessonForLearner } from '../domain/serializers.js';
import { markAnswer, parseResponse, correctAnswerFor } from '../domain/grading.js';
import { responseReferencesValid } from '../domain/responseCheck.js';
import { applyHeartbeat, coveredSeconds, isWatched } from '../domain/video.js';
import { loadOutline, loadProgress, locksFor, requireEnrollment } from './learnerProgress.js';
import { rewardCompletion } from './progressService.js';

const oid = (value) => new mongoose.Types.ObjectId(String(value));

/** Minimum time before a text lesson can be completed: max(10 s, readMinutes × 20 s) (SECURITY §3). */
export function textMinimumSeconds(readMinutes) {
  return Math.max(10, readMinutes * 20);
}
export const DOCUMENT_MINIMUM_SECONDS = 10;

/**
 * Load a lesson the learner is allowed to act on: published course, enrolled, and unlocked.
 * @returns {Promise<{ lesson: object, progress: object, outline: object }>}
 */
async function openableLesson(userId, lessonId) {
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That lesson does not exist.');
  const mod = await Module.findById(lesson.moduleId, { courseId: 1 }).lean();
  if (!mod) throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That lesson does not exist.');

  const outline = await loadOutline(String(mod.courseId));
  const progress = await loadProgress(userId, String(mod.courseId));
  requireEnrollment(progress);
  const locks = locksFor(outline, progress);
  if (!locks.lessonOpen.get(String(lesson._id))) {
    throw new HttpError(
      423,
      ERROR_CODES.LESSON_LOCKED,
      'Finish the lesson before this one to unlock it.'
    );
  }
  return { lesson, progress, outline, courseId: mod.courseId };
}

/**
 * GET /lessons/:id. The first open records when the learner started, which the minimum-time rule uses.
 */
export async function getLesson(ctx, userId, lessonId) {
  const { lesson, courseId } = await openableLesson(userId, lessonId);
  const row = await LessonProgress.findOneAndUpdate(
    { userId: oid(userId), lessonId: lesson._id },
    { $setOnInsert: { courseId, openedAt: ctx.now(), status: LESSON_PROGRESS_STATUS.IN_PROGRESS } },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  const payload = serializeLessonForLearner(lesson);
  return {
    lesson: payload,
    progress: {
      status: row.status,
      lastPositionSec: row.lastPositionSec ?? 0,
      watchedSec: coveredSeconds(row.watchedSegments ?? []),
      answeredQuestionIds: (row.practiceAnswers ?? []).map((a) => String(a.questionId)),
    },
  };
}

/**
 * POST /lessons/:id/heartbeat. The server decides how much real watching a heartbeat represents.
 * The client's own duration is ignored; the stored length is the only one that counts.
 */
export async function heartbeat(ctx, userId, lessonId, body) {
  const { lesson } = await openableLesson(userId, lessonId);
  if (lesson.type !== LESSON_TYPES.VIDEO) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      'Heartbeats are only for video lessons.'
    );
  }
  const row = await LessonProgress.findOne({ userId: oid(userId), lessonId: lesson._id }).lean();
  if (!row) throw new HttpError(409, ERROR_CODES.TOO_SOON, 'Open the lesson before watching it.');
  if (row.status === LESSON_PROGRESS_STATUS.COMPLETED) {
    return { completed: true, watchedSec: coveredSeconds(row.watchedSegments), events: [] };
  }

  const duration = lesson.video.durationSec;
  const at = ctx.now();
  const state = applyHeartbeat(
    { spans: row.watchedSegments ?? [], anchor: row.lastHeartbeat ?? null },
    { position: body.positionSec, at }
  );

  await LessonProgress.updateOne(
    { _id: row._id, status: LESSON_PROGRESS_STATUS.IN_PROGRESS },
    {
      $set: {
        watchedSegments: state.spans,
        lastHeartbeat: state.anchor,
        lastPositionSec: body.positionSec,
      },
    }
  );

  const watchedSec = coveredSeconds(state.spans);
  if (!isWatched(state.spans, duration)) {
    return { completed: false, watchedSec, events: [] };
  }

  // Claim completion atomically: only the request that flips the status earns the XP.
  const claimed = await LessonProgress.updateOne(
    { _id: row._id, status: LESSON_PROGRESS_STATUS.IN_PROGRESS },
    { $set: { status: LESSON_PROGRESS_STATUS.COMPLETED, completedAt: at } }
  );
  if (claimed.matchedCount !== 1) {
    return { completed: true, watchedSec, events: [] };
  }
  const events = await rewardCompletion(ctx, userId, {
    reason: 'lesson_video',
    refId: String(lesson._id),
    amount: XP.VIDEO_LESSON_COMPLETED,
    lessonId: lesson._id,
  });
  return { completed: true, watchedSec, events };
}

/**
 * POST /lessons/:id/complete for text, document and practice lessons.
 */
export async function complete(ctx, userId, lessonId) {
  const { lesson, progress } = await openableLesson(userId, lessonId);
  if (lesson.type === LESSON_TYPES.VIDEO) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      'Video lessons complete by watching them.'
    );
  }
  const row = await LessonProgress.findOne({ userId: oid(userId), lessonId: lesson._id }).lean();
  if (!row) throw new HttpError(409, ERROR_CODES.TOO_SOON, 'Open the lesson before completing it.');
  if (row.status === LESSON_PROGRESS_STATUS.COMPLETED) return { completed: true, events: [] };
  void progress;

  const now = ctx.now();
  const elapsedSec = (now.getTime() - new Date(row.openedAt).getTime()) / 1000;
  let amount;
  let reason;
  if (lesson.type === LESSON_TYPES.TEXT) {
    const minimum = textMinimumSeconds(lesson.text.readMinutes);
    if (elapsedSec < minimum) {
      throw new HttpError(
        409,
        ERROR_CODES.TOO_SOON,
        'Take a little more time with this lesson before continuing.'
      );
    }
    amount = lessonCompletionXp('text');
    reason = 'lesson_text';
  } else if (lesson.type === LESSON_TYPES.DOCUMENT) {
    if (elapsedSec < DOCUMENT_MINIMUM_SECONDS) {
      throw new HttpError(
        409,
        ERROR_CODES.TOO_SOON,
        'Take a little more time with this document before continuing.'
      );
    }
    amount = lessonCompletionXp('document');
    reason = 'lesson_document';
  } else {
    const answered = row.practiceAnswers ?? [];
    if (answered.length < lesson.practice.questions.length) {
      throw new HttpError(
        409,
        ERROR_CODES.NOT_READY,
        'Answer every question in this practice before completing it.'
      );
    }
    const correctCount = answered.filter((a) => a.correct === true).length;
    amount = practiceXp(correctCount);
    reason = 'lesson_practice';
  }

  const claimed = await LessonProgress.updateOne(
    { _id: row._id, status: LESSON_PROGRESS_STATUS.IN_PROGRESS },
    { $set: { status: LESSON_PROGRESS_STATUS.COMPLETED, completedAt: now } }
  );
  if (claimed.matchedCount !== 1) return { completed: true, events: [] };

  const events = await rewardCompletion(ctx, userId, {
    reason,
    refId: String(lesson._id),
    amount,
    lessonId: lesson._id,
  });
  return { completed: true, events };
}

/**
 * POST /lessons/:id/practice/answer. Practice is ungraded for passing, so the answer and the explanation
 * are returned at once (SPEC §6). Each question can be answered once.
 */
export async function answerPractice(ctx, userId, lessonId, body) {
  const { lesson } = await openableLesson(userId, lessonId);
  if (lesson.type !== LESSON_TYPES.PRACTICE) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      'Only practice lessons take answers here.'
    );
  }
  const question = lesson.practice.questions.find((q) => String(q._id) === body.questionId);
  if (!question)
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That question is not in this practice.');

  const parsed = parseResponse(question.type, body.response);
  if (!parsed.ok) throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, parsed.message);
  if (!responseReferencesValid(question, parsed.value)) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      'That answer refers to a choice that is not in this question.'
    );
  }

  const { correct } = markAnswer(question, parsed.value);
  const claimed = await LessonProgress.updateOne(
    {
      userId: oid(userId),
      lessonId: lesson._id,
      status: LESSON_PROGRESS_STATUS.IN_PROGRESS,
      'practiceAnswers.questionId': mongoose.trusted({ $ne: question._id }),
    },
    { $push: { practiceAnswers: { questionId: question._id, correct } } }
  );
  if (claimed.matchedCount !== 1) {
    throw new HttpError(
      409,
      ERROR_CODES.ALREADY_ANSWERED,
      'You have already answered this question.'
    );
  }

  return {
    correct,
    explanation: question.explanation ?? null,
    correctAnswer: correct === null ? null : correctAnswerFor(question),
    events: [],
  };
}
