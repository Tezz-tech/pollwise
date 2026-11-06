/**
 * Users, admins and per-learner support actions for super admins (SPEC §4, §6 super admin routes, §10,
 * §11). Every write is audit-logged, and every read that exposes a learner's answers is too.
 */
import mongoose from 'mongoose';
import { ERROR_CODES, ROLES, USER_STATUS } from '@pollwise/shared/constants';
import {
  Assessment,
  AssessmentAttempt,
  Certificate,
  Course,
  Enrollment,
  LessonProgress,
  Module,
  User,
} from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { recordAudit } from './auditService.js';
import { revokeAllForUser } from './tokenService.js';
import { sendResetCode } from './authService.js';

const ADMIN_ROLES = [ROLES.CONTENT_ADMIN, ROLES.SUPER_ADMIN];
const oid = (value) => new mongoose.Types.ObjectId(String(value));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------ learners */

/**
 * Filters combine with AND. Every value is a validated scalar; the search text is escaped.
 * @param {{ q?: string, stateCode?: string, lgaCode?: string, personnelRole?: string, status?: string }} f
 */
export function userFilter(f) {
  const conditions = [{ role: ROLES.LEARNER }];
  if (f.stateCode) conditions.push({ 'profile.stateCode': f.stateCode });
  if (f.lgaCode) conditions.push({ 'profile.lgaCode': f.lgaCode });
  if (f.personnelRole) conditions.push({ 'profile.personnelRole': f.personnelRole });
  if (f.status) conditions.push({ status: f.status });
  if (f.q) {
    const pattern = new RegExp(escapeRegex(f.q), 'i');
    conditions.push({ $or: [{ name: pattern }, { email: pattern }, { phone: pattern }] });
  }
  return { $and: conditions };
}

const userRow = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email ?? null,
  phone: u.phone ?? null,
  status: u.status,
  stateCode: u.profile?.stateCode ?? null,
  lgaCode: u.profile?.lgaCode ?? null,
  personnelRole: u.profile?.personnelRole ?? null,
  xp: u.learning?.xp ?? 0,
  joinedAt: u.createdAt,
  lastLoginAt: u.lastLoginAt ?? null,
});

const USER_PROJECTION = {
  name: 1,
  email: 1,
  phone: 1,
  status: 1,
  profile: 1,
  learning: 1,
  createdAt: 1,
  lastLoginAt: 1,
};

/** @param {{ page: number, limit: number }} page */
export async function listUsers(filters, page) {
  const filter = userFilter(filters);
  const [rows, total] = await Promise.all([
    User.find(filter, USER_PROJECTION)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return { items: rows.map(userRow), page: page.page, limit: page.limit, total };
}

/**
 * CSV export (SPEC §4, SECURITY §11): streamed, super admin only, audit-logged, and only the columns
 * the client needs. Returns a cursor so the controller can write rows as they arrive.
 */
export function exportCursor(filters) {
  return User.find(userFilter(filters), USER_PROJECTION).sort({ createdAt: 1 }).lean().cursor();
}

export const CSV_COLUMNS = Object.freeze([
  'id',
  'name',
  'email',
  'phone',
  'state',
  'lga',
  'personnel_role',
  'status',
  'xp',
  'joined',
]);

/**
 * One CSV line. Fields starting with a spreadsheet formula character are prefixed with an apostrophe,
 * so an exported name cannot run a formula when someone opens the file.
 * @param {string | number | null | undefined} value
 */
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvLine(u) {
  return [
    String(u._id),
    u.name,
    u.email ?? '',
    u.phone ?? '',
    u.profile?.stateCode ?? '',
    u.profile?.lgaCode ?? '',
    u.profile?.personnelRole ?? '',
    u.status,
    u.learning?.xp ?? 0,
    u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '',
  ]
    .map(csvCell)
    .join(',');
}

/**
 * Full learner record for the support view: profile, enrolments with per-module progress, every attempt
 * with its answers (SPEC §4 super admin), and certificates. Audit-logged because it exposes answers.
 */
export async function userDetail(ctx, actor, userId, meta) {
  const user = await User.findById(userId, { ...USER_PROJECTION, role: 1 }).lean();
  if (!user || user.role !== ROLES.LEARNER) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That learner does not exist.');
  }

  const [enrolments, attempts, certificates, lessonRows] = await Promise.all([
    Enrollment.find({ userId: user._id }).lean(),
    AssessmentAttempt.find({ userId: user._id })
      .select('+questions.snapshot')
      .sort({ startedAt: -1 })
      .limit(200)
      .lean(),
    Certificate.find({ userId: user._id }).lean(),
    LessonProgress.find({ userId: user._id, status: 'completed' }, { lessonId: 1 }).lean(),
  ]);
  const completedLessons = new Set(lessonRows.map((r) => String(r.lessonId)));
  const courses = await Course.find(
    { _id: mongoose.trusted({ $in: enrolments.map((e) => e.courseId) }) },
    { title: 1, moduleIds: 1 }
  ).lean();
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  const modules = await Module.find(
    { courseId: mongoose.trusted({ $in: courses.map((c) => c._id) }) },
    { title: 1, courseId: 1, lessonIds: 1, assessmentId: 1 }
  ).lean();

  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'user.view',
    targetType: 'user',
    targetId: user._id,
    ip: meta.ip,
  });

  return {
    ...userRow(user),
    enrolments: enrolments.map((e) => {
      const course = courseById.get(String(e.courseId));
      const passed = new Set((e.passedModuleIds ?? []).map(String));
      return {
        courseId: String(e.courseId),
        courseTitle: course?.title ?? null,
        status: e.status,
        startedAt: e.startedAt,
        completedAt: e.completedAt ?? null,
        modules: modules
          .filter((m) => String(m.courseId) === String(e.courseId))
          .sort(
            (a, b) =>
              (course?.moduleIds ?? []).findIndex((id) => String(id) === String(a._id)) -
              (course?.moduleIds ?? []).findIndex((id) => String(id) === String(b._id))
          )
          .map((m) => ({
            id: String(m._id),
            title: m.title,
            assessmentId: m.assessmentId ? String(m.assessmentId) : null,
            passed: passed.has(String(m._id)),
            lessonsCompleted: m.lessonIds.filter((id) => completedLessons.has(String(id))).length,
            lessonsTotal: m.lessonIds.length,
          })),
        extraAttempts: Object.fromEntries(e.extraAttempts ? Object.entries(e.extraAttempts) : []),
      };
    }),
    attempts: attempts.map((a) => ({
      id: String(a._id),
      assessmentId: String(a.assessmentId),
      attemptNumber: a.attemptNumber,
      status: a.status,
      score: a.score ?? null,
      passed: a.passed ?? null,
      startedAt: a.startedAt,
      answers: a.answers.map((ans) => {
        const q = a.questions.find((x) => String(x.questionId) === String(ans.questionId));
        return {
          questionId: String(ans.questionId),
          prompt: q?.snapshot?.prompt ?? null,
          correct: ans.correct,
          pointsAwarded: ans.pointsAwarded,
          answeredAt: ans.answeredAt,
        };
      }),
    })),
    certificates: certificates.map((c) => ({
      id: String(c._id),
      code: c.code,
      courseTitle: c.courseTitle,
      score: c.score,
      issuedAt: c.issuedAt,
      revoked: Boolean(c.revokedAt),
    })),
  };
}

/** Activate or deactivate. Deactivation ends every session at once (SPEC §6). */
export async function setUserStatus(ctx, actor, userId, status, meta) {
  if (String(userId) === actor.id) {
    throw new HttpError(409, ERROR_CODES.CONFLICT, 'You cannot change your own account status.');
  }
  const user = await User.findById(userId);
  if (!user || user.role !== ROLES.LEARNER) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That learner does not exist.');
  }
  if (user.status === USER_STATUS.PENDING_DELETION) {
    throw new HttpError(
      409,
      ERROR_CODES.CONFLICT,
      'This account is waiting to be deleted and cannot be changed.'
    );
  }
  user.status = status;
  if (status === USER_STATUS.DEACTIVATED) {
    user.security.tokenVersion += 1;
    await revokeAllForUser(ctx, user._id);
  }
  await user.save();
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: status === USER_STATUS.ACTIVE ? 'user.reactivate' : 'user.deactivate',
    targetType: 'user',
    targetId: user._id,
    ip: meta.ip,
  });
  return { id: String(user._id), status: user.status };
}

/** Email a password-reset code to the learner (SPEC §6 POST /admin/users/:id/reset). */
export async function sendUserReset(ctx, actor, userId, meta) {
  const user = await User.findById(userId);
  if (!user || user.role !== ROLES.LEARNER) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That learner does not exist.');
  }
  if (!user.email || user.status !== USER_STATUS.ACTIVE) {
    throw new HttpError(409, ERROR_CODES.CONFLICT, 'This account cannot receive a reset code.');
  }
  await sendResetCode(ctx, user);
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'user.password_reset_sent',
    targetType: 'user',
    targetId: user._id,
    ip: meta.ip,
  });
  return { sent: true };
}

/** One extra attempt on one assessment for one learner (SPEC §8.2). */
export async function grantAttempt(ctx, actor, userId, assessmentId, meta) {
  const assessment = await Assessment.findById(assessmentId, { moduleId: 1 }).lean();
  if (!assessment)
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That assessment does not exist.');
  const mod = await Module.findById(assessment.moduleId, { courseId: 1 }).lean();
  const key = `extraAttempts.${String(assessmentId)}`;
  const result = await Enrollment.updateOne(
    { userId: oid(userId), courseId: mod.courseId },
    { $inc: { [key]: 1 } }
  );
  if (result.matchedCount !== 1) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'This learner is not enrolled in that course.');
  }
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'attempt.grant',
    targetType: 'assessment',
    targetId: assessmentId,
    meta: { learnerId: String(userId) },
    ip: meta.ip,
  });
  const updated = await Enrollment.findOne(
    { userId: oid(userId), courseId: mod.courseId },
    { extraAttempts: 1 }
  ).lean();
  return { granted: updated.extraAttempts?.[String(assessmentId)] ?? 1 };
}

/* ------------------------------------------------------------------ admins */

export async function listAdmins() {
  const rows = await User.find(
    { role: mongoose.trusted({ $in: ADMIN_ROLES }) },
    { name: 1, email: 1, role: 1, status: 1, 'security.totpEnabled': 1, lastLoginAt: 1 }
  )
    .sort({ createdAt: 1 })
    .lean();
  return {
    items: rows.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email ?? null,
      role: u.role,
      status: u.status,
      totpEnabled: Boolean(u.security?.totpEnabled),
      lastLoginAt: u.lastLoginAt ?? null,
    })),
  };
}

/** Revoke an admin: their sessions end now. A super admin cannot revoke themself or the last super admin. */
export async function revokeAdmin(ctx, actor, userId, meta) {
  if (String(userId) === actor.id) {
    throw new HttpError(409, ERROR_CODES.CONFLICT, 'You cannot revoke your own access.');
  }
  const user = await User.findById(userId);
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That admin does not exist.');
  }
  if (user.role === ROLES.SUPER_ADMIN) {
    const remaining = await User.countDocuments({
      role: ROLES.SUPER_ADMIN,
      status: USER_STATUS.ACTIVE,
      _id: mongoose.trusted({ $ne: user._id }),
    });
    if (remaining === 0) {
      throw new HttpError(
        409,
        ERROR_CODES.CONFLICT,
        'At least one super admin must remain active.'
      );
    }
  }
  user.status = USER_STATUS.DEACTIVATED;
  user.security.tokenVersion += 1;
  await user.save();
  await revokeAllForUser(ctx, user._id);
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'admin.revoke',
    targetType: 'user',
    targetId: user._id,
    meta: { role: user.role },
    ip: meta.ip,
  });
  return { id: String(user._id), status: user.status };
}
