/**
 * Assessment attempts (SPEC §8.2, §8.3, §8.6): start, resume, answer once, submit, expire, and the
 * progression that follows a submission (pass once, XP once, unlocks, course completion).
 *
 * Grading always uses the snapshot taken when the attempt started, so editing a question later never
 * changes a live attempt. Learners only ever see the serialised form (SECURITY §3).
 */
import mongoose from 'mongoose';
import {
  ATTEMPT_STATUS,
  DEFAULT_PASS_MARK,
  ERROR_CODES,
  REVEAL_MODES,
} from '@pollwise/shared/constants';
import { XP } from '@pollwise/shared/xp';
import { AssessmentAttempt, Assessment, Enrollment, Module } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { serializeQuestionForLearner, presentationFor, shuffled } from '../domain/serializers.js';
import {
  computeScore,
  correctAnswerFor,
  isPass,
  markAnswer,
  parseResponse,
} from '../domain/grading.js';
import { responseReferencesValid } from '../domain/responseCheck.js';
import { loadOutline, loadProgress, locksFor, requireEnrollment } from './learnerProgress.js';
import { awardXp, dailyGoalEvents, recordActivity } from './progressService.js';
import { issueCertificate } from './progressService.js';
import { courseIsComplete } from '../domain/locks.js';
import { getSettings } from './settingsService.js';

const oid = (value) => new mongoose.Types.ObjectId(String(value));
export const DEFAULT_TIME_LIMIT_MIN = 120;

/** Plain copy of a stored question, so the snapshot holds only data and nothing mongoose-specific. */
const plain = (value) => JSON.parse(JSON.stringify(value));

async function ownedAttempt(userId, attemptId) {
  const attempt = await AssessmentAttempt.findOne({ _id: oid(attemptId), userId: oid(userId) })
    .select('+questions.snapshot')
    .lean();
  if (!attempt) throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That attempt does not exist.');
  return attempt;
}

/**
 * Start an attempt, or resume the one already in progress (SPEC §8.2).
 */
export async function startAttempt(ctx, userId, assessmentId) {
  const assessment = await Assessment.findById(assessmentId).lean();
  if (!assessment)
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That assessment does not exist.');
  const mod = await Module.findById(assessment.moduleId, { courseId: 1 }).lean();
  if (!mod) throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That assessment does not exist.');

  const outline = await loadOutline(String(mod.courseId));
  const progress = await loadProgress(userId, String(mod.courseId));
  requireEnrollment(progress);
  const locks = locksFor(outline, progress);
  if (!locks.assessmentOpen.get(String(assessment._id))) {
    throw new HttpError(
      423,
      ERROR_CODES.ASSESSMENT_LOCKED,
      'Finish every lesson in this module to unlock its check.'
    );
  }

  const open = await AssessmentAttempt.findOne({
    userId: oid(userId),
    assessmentId: assessment._id,
    status: ATTEMPT_STATUS.IN_PROGRESS,
  })
    .select('+questions.snapshot')
    .lean();
  if (open) {
    const settled = await settleIfExpired(ctx, open);
    if (settled.status === ATTEMPT_STATUS.IN_PROGRESS)
      return { attempt: attemptView(settled, assessment), events: [] };
  }

  const used = await AssessmentAttempt.countDocuments({
    userId: oid(userId),
    assessmentId: assessment._id,
    status: mongoose.trusted({ $in: [ATTEMPT_STATUS.SUBMITTED, ATTEMPT_STATUS.EXPIRED] }),
  });
  if (assessment.maxAttempts && used >= assessment.maxAttempts) {
    throw new HttpError(
      403,
      ERROR_CODES.ATTEMPTS_EXHAUSTED,
      'You have used all your attempts on this check. Contact your administrator for another.'
    );
  }

  if (!assessment.questions || assessment.questions.length === 0) {
    throw new HttpError(409, ERROR_CODES.NOT_READY, 'This check has no questions yet.');
  }

  const pool = assessment.questions;
  const count = assessment.drawCount ? Math.min(assessment.drawCount, pool.length) : pool.length;
  const chosen = (assessment.shuffleQuestions ? shuffled(pool) : pool).slice(0, count);
  const settings = await getSettings();
  const now = ctx.now();
  const limitMin = assessment.timeLimitMin ?? DEFAULT_TIME_LIMIT_MIN;

  let created;
  try {
    created = await AssessmentAttempt.create({
      userId: oid(userId),
      assessmentId: assessment._id,
      moduleId: assessment.moduleId,
      courseId: mod.courseId,
      attemptNumber: used + 1,
      questions: chosen.map((q) => ({
        questionId: q._id,
        version: q.version ?? 1,
        snapshot: plain(q),
        presentation: presentationFor(q, { shuffleOptions: assessment.shuffleOptions }),
      })),
      passMark: assessment.passMark ?? settings.defaultPassMark ?? DEFAULT_PASS_MARK,
      startedAt: now,
      expiresAt: new Date(now.getTime() + limitMin * 60_000),
    });
  } catch (err) {
    // The partial unique index allows one open attempt; a concurrent start returns that one instead.
    if (err?.code !== 11000) throw err;
    const existing = await AssessmentAttempt.findOne({
      userId: oid(userId),
      assessmentId: assessment._id,
      status: ATTEMPT_STATUS.IN_PROGRESS,
    })
      .select('+questions.snapshot')
      .lean();
    return { attempt: attemptView(existing, assessment), events: [] };
  }

  const fresh = await AssessmentAttempt.findById(created._id).select('+questions.snapshot').lean();
  return { attempt: attemptView(fresh, assessment), events: [] };
}

/** GET /attempts/:id: the learner's own attempt, expired ones settled first. */
export async function getAttempt(ctx, userId, attemptId) {
  let attempt = await ownedAttempt(userId, attemptId);
  attempt = await settleIfExpired(ctx, attempt);
  const assessment = await Assessment.findById(attempt.assessmentId, {
    revealAnswers: 1,
    title: 1,
  }).lean();
  return { attempt: attemptView(attempt, assessment), events: [] };
}

/**
 * POST /attempts/:id/answers. One answer per question, graded on the spot (SPEC §8.2).
 */
export async function answerQuestion(ctx, userId, attemptId, body) {
  let attempt = await ownedAttempt(userId, attemptId);
  attempt = await settleIfExpired(ctx, attempt);
  if (attempt.status === ATTEMPT_STATUS.EXPIRED) {
    throw new HttpError(
      409,
      ERROR_CODES.ATTEMPT_EXPIRED,
      'Time is up for this attempt. Its answers were submitted.'
    );
  }
  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
    throw new HttpError(409, ERROR_CODES.CONFLICT, 'This attempt has already been submitted.');
  }

  const entry = attempt.questions.find((q) => String(q.questionId) === body.questionId);
  if (!entry)
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That question is not part of this attempt.');
  if (attempt.answers.some((a) => String(a.questionId) === body.questionId)) {
    throw new HttpError(
      409,
      ERROR_CODES.ALREADY_ANSWERED,
      'You have already answered this question.'
    );
  }

  const parsed = parseResponse(entry.snapshot.type, body.response);
  if (!parsed.ok) throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, parsed.message);
  if (!responseReferencesValid(entry.snapshot, parsed.value)) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      'That answer refers to a choice that is not in this question.'
    );
  }

  const result = markAnswer(entry.snapshot, parsed.value);
  const now = ctx.now();
  // Atomic: the filter refuses a second answer to the same question even under parallel requests.
  const claimed = await AssessmentAttempt.updateOne(
    {
      _id: oid(attemptId),
      status: ATTEMPT_STATUS.IN_PROGRESS,
      'answers.questionId': mongoose.trusted({ $ne: entry.questionId }),
    },
    {
      $push: {
        answers: {
          questionId: entry.questionId,
          response: parsed.value,
          correct: result.correct,
          pointsAwarded: result.pointsAwarded,
          answeredAt: now,
        },
      },
    }
  );
  if (claimed.matchedCount !== 1) {
    throw new HttpError(
      409,
      ERROR_CODES.ALREADY_ANSWERED,
      'You have already answered this question.'
    );
  }

  const assessment = await Assessment.findById(attempt.assessmentId, { revealAnswers: 1 }).lean();
  const reveal = assessment?.revealAnswers ?? 'after_pass';
  return {
    correct: result.correct,
    explanation: entry.snapshot.explanation ?? null,
    correctAnswer:
      reveal === REVEAL_MODES.IMMEDIATELY ? correctAnswerFor(entry.snapshot) : undefined,
    events: [],
  };
}

/**
 * POST /attempts/:id/submit. Unanswered graded questions count as 0 (SPEC §8.2). Submitting again returns
 * the same result with no new events.
 */
export async function submitAttempt(ctx, userId, attemptId) {
  const attempt = await ownedAttempt(userId, attemptId);
  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
    const assessment = await Assessment.findById(attempt.assessmentId, { revealAnswers: 1 }).lean();
    return { result: resultView(attempt, assessment), events: [] };
  }
  const { attempt: finished, events } = await finish(ctx, attempt, { expired: false });
  const assessment = await Assessment.findById(finished.assessmentId, { revealAnswers: 1 }).lean();
  return { result: resultView(finished, assessment), events };
}

/**
 * Settle an attempt whose time has run out: grade what was answered and record it as expired. The
 * learner's answers are never lost.
 */
async function settleIfExpired(ctx, attempt) {
  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) return attempt;
  if (attempt.expiresAt > ctx.now()) return attempt;
  const { attempt: settled } = await finish(ctx, attempt, { expired: true });
  return settled;
}

/**
 * Grade, record and apply progression. Runs once per attempt: the status claim in the first update is
 * what guarantees a single submission.
 * @returns {Promise<{ attempt: object, events: object[] }>}
 */
async function finish(ctx, attempt, { expired }) {
  const answers = new Map(attempt.answers.map((a) => [String(a.questionId), a]));
  const graded = attempt.questions.map((q) => ({
    type: q.snapshot.type,
    points: q.snapshot.points,
    pointsAwarded: answers.get(String(q.questionId))?.pointsAwarded ?? 0,
  }));
  const score = computeScore(graded);
  const passed = isPass(score, attempt.passMark);
  const now = ctx.now();

  const claimed = await AssessmentAttempt.updateOne(
    { _id: attempt._id, status: ATTEMPT_STATUS.IN_PROGRESS },
    {
      $set: {
        status: expired ? ATTEMPT_STATUS.EXPIRED : ATTEMPT_STATUS.SUBMITTED,
        score,
        passed,
        submittedAt: now,
      },
    }
  );
  const reloaded = await AssessmentAttempt.findById(attempt._id)
    .select('+questions.snapshot')
    .lean();
  if (claimed.matchedCount !== 1) return { attempt: reloaded, events: [] };

  const events = await progressAfterSubmit(ctx, reloaded, { score, passed });
  return { attempt: reloaded, events };
}

/**
 * What a submission changes (SPEC §8.3, §8.4, §8.6, §8.8). Pass XP, module and course completion are
 * claimed atomically, so a retry cannot pay twice.
 */
async function progressAfterSubmit(ctx, attempt, { score, passed }) {
  const userId = attempt.userId;
  const courseId = attempt.courseId;
  const moduleId = String(attempt.moduleId);
  const assessmentId = String(attempt.assessmentId);
  const events = [];

  await Enrollment.updateOne({ userId, courseId }, { $max: { [`bestScores.${moduleId}`]: score } });

  if (passed) {
    const firstTry = attempt.attemptNumber === 1;
    const perfect = score === 100;
    const claim = await Enrollment.updateOne(
      { userId, courseId, passedModuleIds: mongoose.trusted({ $ne: oid(moduleId) }) },
      { $push: { passedModuleIds: oid(moduleId) } }
    );
    if (claim.matchedCount === 1) {
      events.push({ type: 'module_passed', moduleId, score, firstTry });
      const pass = await awardXp(ctx, userId, {
        reason: 'assessment_pass',
        refId: assessmentId,
        amount: XP.ASSESSMENT_PASSED,
      });
      if (pass) events.push(pass);
      if (firstTry) {
        const bonus = await awardXp(ctx, userId, {
          reason: 'assessment_first_try',
          refId: assessmentId,
          amount: XP.ASSESSMENT_FIRST_TRY_BONUS,
        });
        if (bonus) events.push(bonus);
      }
      if (perfect) {
        const bonus = await awardXp(ctx, userId, {
          reason: 'assessment_perfect',
          refId: assessmentId,
          amount: XP.ASSESSMENT_PERFECT_BONUS,
        });
        if (bonus) events.push(bonus);
      }
      events.push(...(await unlockNextModule(ctx, userId, courseId, moduleId)));
      events.push(...(await completeCourseIfDone(ctx, userId, courseId)));
    }
  }

  // Finishing a check counts as activity for the streak, pass or fail (SPEC §8.4).
  events.push(...(await recordActivity(ctx, userId)));
  events.push(...(await dailyGoalEvents(ctx, userId)));
  return events;
}

async function unlockNextModule(ctx, userId, courseId, moduleId) {
  const outline = await loadOutline(String(courseId), { publishedOnly: false });
  const index = outline.modules.findIndex((m) => m.id === moduleId);
  const next = outline.modules[index + 1];
  if (!next) return [];
  await Enrollment.updateOne({ userId, courseId }, { $set: { currentModuleId: oid(next.id) } });
  return [{ type: 'module_unlocked', moduleId: next.id, title: next.title }];
}

async function completeCourseIfDone(ctx, userId, courseId) {
  const outline = await loadOutline(String(courseId), { publishedOnly: false });
  const progress = await loadProgress(String(userId), String(courseId));
  if (!courseIsComplete(outline, progress)) return [];

  const claimed = await Enrollment.updateOne(
    { userId, courseId, status: 'in_progress' },
    { $set: { status: 'completed', completedAt: ctx.now() } }
  );
  if (claimed.matchedCount !== 1) return [];

  const events = [];
  const xp = await awardXp(ctx, userId, {
    reason: 'course_complete',
    refId: String(courseId),
    amount: XP.COURSE_COMPLETED,
  });
  if (xp) events.push(xp);
  const enrollment = await Enrollment.findOne({ userId, courseId });
  const certificate = await issueCertificate(ctx, { userId, courseId, enrollment });
  events.push({
    type: 'course_completed',
    courseId: String(courseId),
    certificateId: String(certificate._id),
  });
  return events;
}

/* ------------------------------------------------------------------ views */

/** The learner's view of an attempt. Questions are serialised; no key, explanation or snapshot leaves here. */
function attemptView(attempt, assessment) {
  const answered = new Set(attempt.answers.map((a) => String(a.questionId)));
  return {
    id: String(attempt._id),
    assessmentId: String(attempt.assessmentId),
    title: assessment?.title ?? null,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    passMark: attempt.passMark,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    questions: attempt.questions.map((q) =>
      serializeQuestionForLearner(q.snapshot, q.presentation)
    ),
    answeredQuestionIds: [...answered],
    ...(attempt.status !== ATTEMPT_STATUS.IN_PROGRESS && {
      score: attempt.score,
      passed: attempt.passed,
    }),
  };
}

/**
 * The result after a submission. Correct answers appear only when the assessment's reveal rule allows
 * (SPEC §8.2): never, immediately, after_submit, or after_pass with a pass.
 */
function resultView(attempt, assessment) {
  const reveal = assessment?.revealAnswers ?? 'after_pass';
  const show =
    reveal === REVEAL_MODES.AFTER_SUBMIT ||
    reveal === REVEAL_MODES.IMMEDIATELY ||
    (reveal === REVEAL_MODES.AFTER_PASS && attempt.passed);
  const answers = new Map(attempt.answers.map((a) => [String(a.questionId), a]));
  return {
    attemptId: String(attempt._id),
    status: attempt.status,
    score: attempt.score,
    passed: attempt.passed,
    passMark: attempt.passMark,
    review: show
      ? attempt.questions.map((q) => ({
          questionId: String(q.questionId),
          correct: answers.has(String(q.questionId))
            ? answers.get(String(q.questionId)).correct
            : false,
          explanation: q.snapshot.explanation ?? null,
          correctAnswer: correctAnswerFor(q.snapshot),
        }))
      : [],
  };
}
