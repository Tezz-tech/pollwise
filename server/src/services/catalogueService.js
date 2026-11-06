/**
 * Catalogue, course outline and enrolment for learners (SPEC §3, §6, §8.1).
 */
import mongoose from 'mongoose';
import { COURSE_STATUS, ERROR_CODES, PERSONNEL_ROLE_VALUES } from '@pollwise/shared/constants';
import { Course, Enrollment, User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { courseSummary } from './contentService.js';
import { loadOutline, loadProgress, locksFor } from './learnerProgress.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Published courses. `role` defaults to the learner's own role ("For you", SPEC §6); `all` lifts the filter.
 * @param {{ role?: string, q?: string }} query
 */
export async function listCatalogue(ctx, userId, query) {
  const user = await User.findById(userId, { 'profile.personnelRole': 1 }).lean();
  const role = query.role ?? user?.profile?.personnelRole ?? 'all';

  const conditions = [{ status: COURSE_STATUS.PUBLISHED }];
  if (role !== 'all') {
    if (!PERSONNEL_ROLE_VALUES.includes(role)) {
      throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, 'Unknown role filter.');
    }
    conditions.push({ targetRoles: role });
  }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    conditions.push({ $or: [{ title: pattern }, { summary: pattern }] });
  }

  const courses = await Course.find({ $and: conditions })
    .sort({ isRequired: -1, title: 1 })
    .limit(100)
    .lean();

  const enrolments = await Enrollment.find({
    userId: new mongoose.Types.ObjectId(String(userId)),
    courseId: mongoose.trusted({ $in: courses.map((c) => c._id) }),
  }).lean();
  const byCourse = new Map(enrolments.map((e) => [String(e.courseId), e]));

  return {
    role,
    items: courses.map((course) => {
      const enrolment = byCourse.get(String(course._id));
      return {
        ...courseSummary(course),
        enrolment: enrolment
          ? { status: enrolment.status, passedModules: enrolment.passedModuleIds.length }
          : null,
      };
    }),
  };
}

/**
 * Course outline with the learner's lock state (SPEC §6 GET /courses/:slug, §8.1).
 * Returns titles and types only; lesson content is fetched separately, and only when open.
 */
export async function getOutline(ctx, userId, slug) {
  const course = await Course.findOne({ slug, status: COURSE_STATUS.PUBLISHED }, { _id: 1 }).lean();
  if (!course) throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That course does not exist.');

  const outline = await loadOutline(String(course._id));
  const progress = await loadProgress(userId, String(course._id));
  const locks = locksFor(outline, progress);

  return {
    course: courseSummary(outline.course),
    enrolled: Boolean(progress.enrollment),
    modules: outline.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      locked: !locks.moduleOpen.get(m.id),
      lessons: m.lessons.map((l) => ({
        id: String(l._id),
        title: l.title,
        type: l.type,
        xp: l.xp,
        durationSec: l.type === 'video' ? (l.video?.durationSec ?? null) : null,
        locked: !locks.lessonOpen.get(String(l._id)),
        completed: progress.completedLessonIds.has(String(l._id)),
      })),
      assessment: m.assessment
        ? {
            id: String(m.assessment._id),
            title: m.assessment.title,
            passMark: m.assessment.passMark ?? null,
            locked: !locks.assessmentOpen.get(String(m.assessment._id)),
            passed: progress.passedModuleIds.has(m.id),
          }
        : null,
    })),
  };
}

/**
 * Enrol in a published course. Idempotent: enrolling twice returns the same enrolment. Opens module 1,
 * lesson 1 (SPEC §8.1) by pointing the enrolment at the first module.
 */
export async function enrol(ctx, userId, courseId) {
  const outline = await loadOutline(courseId);
  const existing = await Enrollment.findOne({ userId, courseId: outline.course._id }).lean();
  if (existing) return { enrollment: enrolmentView(existing), events: [] };

  const learner = await User.findById(userId, {
    'profile.stateCode': 1,
    'profile.lgaCode': 1,
  }).lean();
  try {
    const created = await Enrollment.create({
      userId,
      courseId: outline.course._id,
      startedAt: ctx.now(),
      currentModuleId: outline.modules[0]?.id,
      stateCode: learner?.profile?.stateCode,
      lgaCode: learner?.profile?.lgaCode,
    });
    return { enrollment: enrolmentView(created.toObject()), events: [] };
  } catch (err) {
    if (err?.code !== 11000) throw err;
    const again = await Enrollment.findOne({ userId, courseId: outline.course._id }).lean();
    return { enrollment: enrolmentView(again), events: [] };
  }
}

function enrolmentView(enrollment) {
  return {
    id: String(enrollment._id),
    courseId: String(enrollment.courseId),
    status: enrollment.status,
    currentModuleId: enrollment.currentModuleId ? String(enrollment.currentModuleId) : null,
    startedAt: enrollment.startedAt,
  };
}
