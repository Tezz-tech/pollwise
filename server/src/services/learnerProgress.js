/**
 * Loads what the lock rules need: a course outline in order, and one learner's progress through it.
 * Shared by the outline, lesson, heartbeat and attempt routes so they all judge locks the same way.
 */
import mongoose from 'mongoose';
import { COURSE_STATUS, ERROR_CODES } from '@pollwise/shared/constants';
import { Assessment, Course, Enrollment, Lesson, LessonProgress, Module } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { computeLocks } from '../domain/locks.js';

const oid = (value) => new mongoose.Types.ObjectId(String(value));

/**
 * @param {string} courseId
 * @param {{ publishedOnly?: boolean }} [options]
 * @returns {Promise<{ course: object, modules: object[], lessons: Map<string, object>, assessments: Map<string, object> }>}
 */
export async function loadOutline(courseId, { publishedOnly = true } = {}) {
  const filter = { _id: oid(courseId) };
  if (publishedOnly) filter.status = COURSE_STATUS.PUBLISHED;
  const course = await Course.findOne(filter).lean();
  if (!course) throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That course does not exist.');

  const modules = await Module.find({ courseId: course._id }).lean();
  const byId = new Map(modules.map((m) => [String(m._id), m]));
  const ordered = course.moduleIds.map((id) => byId.get(String(id))).filter(Boolean);

  const lessons = await Lesson.find({
    moduleId: mongoose.trusted({ $in: ordered.map((m) => m._id) }),
  }).lean();
  const assessments = await Assessment.find({
    moduleId: mongoose.trusted({ $in: ordered.map((m) => m._id) }),
  }).lean();
  const lessonById = new Map(lessons.map((l) => [String(l._id), l]));
  const assessmentByModule = new Map(assessments.map((a) => [String(a.moduleId), a]));

  return {
    course,
    modules: ordered.map((m) => ({
      id: String(m._id),
      title: m.title,
      description: m.description ?? null,
      lessonIds: m.lessonIds.map(String),
      lessons: m.lessonIds.map((id) => lessonById.get(String(id))).filter(Boolean),
      assessment: assessmentByModule.get(String(m._id)) ?? null,
      assessmentId: assessmentByModule.get(String(m._id))?._id
        ? String(assessmentByModule.get(String(m._id))._id)
        : null,
    })),
    lessons: lessonById,
    assessments: new Map(assessments.map((a) => [String(a._id), a])),
  };
}

/**
 * @param {string} userId
 * @param {string} courseId
 */
export async function loadProgress(userId, courseId) {
  const [enrollment, lessonRows] = await Promise.all([
    Enrollment.findOne({ userId: oid(userId), courseId: oid(courseId) }).lean(),
    LessonProgress.find(
      { userId: oid(userId), courseId: oid(courseId) },
      { lessonId: 1, status: 1 }
    ).lean(),
  ]);
  return {
    enrollment,
    completedLessonIds: new Set(
      lessonRows.filter((r) => r.status === 'completed').map((r) => String(r.lessonId))
    ),
    passedModuleIds: new Set((enrollment?.passedModuleIds ?? []).map(String)),
  };
}

/**
 * Lock state for one learner on one outline. Without an enrolment, the outline is shown as if the
 * learner had just enrolled, so they can see what lies ahead.
 */
export function locksFor(outline, progress) {
  const shape = {
    modules: outline.modules.map((m) => ({
      id: m.id,
      lessonIds: m.lessonIds,
      assessmentId: m.assessmentId,
    })),
  };
  return computeLocks(shape, progress);
}

/** Throw 403 unless the learner is enrolled (the lock rules assume an enrolment). */
export function requireEnrollment(progress) {
  if (!progress.enrollment) {
    throw new HttpError(
      403,
      ERROR_CODES.NOT_ENROLLED,
      'Enrol in this course to start its lessons.'
    );
  }
}
