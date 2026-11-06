/**
 * Reports for super admins (SPEC §4, §6 reports). Every report is one or two aggregation pipelines over
 * indexed fields, so each returns in well under 500 ms on 50,000 learners (see scripts/measure-reports.js).
 */
import mongoose from 'mongoose';
import { APP_TZ as APP_TIME_ZONE } from '../utils/time.js';
import { AssessmentAttempt, Course, Enrollment, Lga, State, User } from '../models/index.js';
import { ROLES } from '@pollwise/shared/constants';
import { addDays } from '../utils/time.js';

/** Count of documents matching `cond` (a Mongo expression) inside $group. */
const countIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });

/** The last 30 Lagos days, oldest first, as 'YYYY-MM-DD' strings. */
export function lastThirtyDays(now) {
  const days = [];
  for (let i = 29; i >= 0; i -= 1) {
    days.push(new Date(addDays(now, -i)).toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE }));
  }
  return days;
}

/**
 * Overview KPIs and a 30-day series (SPEC §4 dashboard).
 */
export async function overview(ctx) {
  const now = ctx.now();
  const weekAgo = addDays(now, -7);
  const thirtyAgo = addDays(now, -30);
  const days = lastThirtyDays(now);

  const [
    learners,
    activeWeek,
    enrolments,
    completions,
    scoreRows,
    enrolledSeries,
    completedSeries,
    joinedSeries,
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.LEARNER }),
    User.countDocuments({ role: ROLES.LEARNER, lastLoginAt: mongoose.trusted({ $gte: weekAgo }) }),
    Enrollment.countDocuments({}),
    Enrollment.countDocuments({ status: 'completed' }),
    AssessmentAttempt.aggregate([
      { $match: { status: 'submitted' } },
      { $group: { _id: null, average: { $avg: '$score' } } },
    ]),
    Enrollment.aggregate([
      { $match: { startedAt: { $gte: thirtyAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$startedAt', timezone: APP_TIME_ZONE },
          },
          n: { $sum: 1 },
        },
      },
    ]),
    Enrollment.aggregate([
      { $match: { completedAt: { $gte: thirtyAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: APP_TIME_ZONE },
          },
          n: { $sum: 1 },
        },
      },
    ]),
    User.aggregate([
      { $match: { role: ROLES.LEARNER, createdAt: { $gte: thirtyAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: APP_TIME_ZONE },
          },
          n: { $sum: 1 },
        },
      },
    ]),
  ]);

  const toMap = (rows) => new Map(rows.map((r) => [r._id, r.n]));
  const enrolledMap = toMap(enrolledSeries);
  const completedMap = toMap(completedSeries);
  const joinedMap = toMap(joinedSeries);

  return {
    kpis: {
      learners,
      activeThisWeek: activeWeek,
      enrolments,
      completions,
      completionRate: enrolments ? Math.round((completions / enrolments) * 100) : 0,
      averageScore: scoreRows[0] ? Math.round(scoreRows[0].average) : null,
    },
    series: days.map((day) => ({
      day,
      joined: joinedMap.get(day) ?? 0,
      enrolled: enrolledMap.get(day) ?? 0,
      completed: completedMap.get(day) ?? 0,
    })),
  };
}

/**
 * Per course: enrolled, completed, completion %, average score and attempts per learner.
 */
export async function courseReport() {
  const [enrolments, attempts, courses] = await Promise.all([
    Enrollment.aggregate([
      {
        $group: {
          _id: '$courseId',
          enrolled: { $sum: 1 },
          completed: countIf({ $eq: ['$status', 'completed'] }),
        },
      },
    ]),
    AssessmentAttempt.aggregate([
      { $match: { status: 'submitted' } },
      { $group: { _id: '$courseId', attempts: { $sum: 1 }, averageScore: { $avg: '$score' } } },
    ]),
    Course.find({}, { title: 1, status: 1 }).lean(),
  ]);

  const enrolMap = new Map(enrolments.map((r) => [String(r._id), r]));
  const attemptMap = new Map(attempts.map((r) => [String(r._id), r]));
  return {
    items: courses
      .map((c) => {
        const e = enrolMap.get(String(c._id)) ?? { enrolled: 0, completed: 0 };
        const a = attemptMap.get(String(c._id));
        return {
          courseId: String(c._id),
          title: c.title,
          status: c.status,
          enrolled: e.enrolled,
          completed: e.completed,
          completionPct: e.enrolled ? Math.round((e.completed / e.enrolled) * 100) : 0,
          averageScore: a ? Math.round(a.averageScore) : null,
          attemptsPerLearner:
            e.enrolled && a ? Math.round((a.attempts / e.enrolled) * 10) / 10 : null,
        };
      })
      .sort((x, y) => y.enrolled - x.enrolled),
  };
}

/**
 * Geography. Without a state: one row per state. With a state: one row per LGA inside it (drill-down).
 * Completion joins enrolments to the learner's profile, so the numbers follow where people work.
 * @param {string | undefined} stateCode validated two-letter code
 */
export async function geographyReport(stateCode) {
  // Enrolments carry the learner's area (see the Enrollment model), so no join is needed.
  const enrolMatch = stateCode ? { stateCode } : {};
  const groupKey = stateCode ? '$lgaCode' : '$stateCode';
  const userMatch = stateCode ? { 'profile.stateCode': stateCode } : {};

  const [enrolRows, learnerRows, names] = await Promise.all([
    Enrollment.aggregate([
      { $match: enrolMatch },
      {
        $group: {
          _id: groupKey,
          enrolled: { $sum: 1 },
          completed: countIf({ $eq: ['$status', 'completed'] }),
        },
      },
    ]),
    User.aggregate([
      { $match: { role: ROLES.LEARNER, ...userMatch } },
      {
        $group: {
          _id: stateCode ? '$profile.lgaCode' : '$profile.stateCode',
          learners: { $sum: 1 },
        },
      },
    ]),
    stateCode
      ? Lga.find({ stateCode }, { code: 1, name: 1 }).lean()
      : State.find({}, { code: 1, name: 1 }).lean(),
  ]);

  const learnersBy = new Map(learnerRows.map((r) => [r._id, r.learners]));
  const enrolledBy = new Map(enrolRows.map((r) => [r._id, r]));
  const nameBy = new Map(names.map((n) => [n.code, n.name]));
  const keys = new Set([...learnersBy.keys(), ...enrolledBy.keys()].filter(Boolean));

  return {
    level: stateCode ? 'lga' : 'state',
    stateCode: stateCode ?? null,
    items: [...keys]
      .map((code) => {
        const e = enrolledBy.get(code) ?? { enrolled: 0, completed: 0 };
        return {
          code,
          name: nameBy.get(code) ?? code,
          learners: learnersBy.get(code) ?? 0,
          enrolled: e.enrolled,
          completed: e.completed,
          completionPct: e.enrolled ? Math.round((e.completed / e.enrolled) * 100) : 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
