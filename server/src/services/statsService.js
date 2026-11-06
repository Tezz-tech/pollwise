/**
 * The learner's own numbers (SPEC §6 /me/stats, §8.7). The app displays these; it never computes them.
 */
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { COURSE_STATUS } from '@pollwise/shared/constants';
import { Course, Enrollment, User, XpEvent } from '../models/index.js';
import { lagosDay } from '../utils/time.js';

dayjs.extend(utc);

/**
 * @returns {Promise<object>}
 */
export async function getStats(ctx, userId) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const today = lagosDay(ctx.now());
  const days = Array.from({ length: 7 }, (_, i) =>
    dayjs
      .utc(today)
      .subtract(6 - i, 'day')
      .format('YYYY-MM-DD')
  );

  const user = await User.findById(uid, { learning: 1, 'profile.personnelRole': 1 }).lean();
  const role = user?.profile?.personnelRole ?? null;

  const [xpRows, enrolments, required] = await Promise.all([
    XpEvent.aggregate([
      { $match: { userId: uid, day: mongoose.trusted({ $in: days }), amount: { $gt: 0 } } },
      { $group: { _id: '$day', xp: { $sum: '$amount' } } },
    ]),
    Enrollment.find({ userId: uid }).lean(),
    role
      ? Course.find(
          { status: COURSE_STATUS.PUBLISHED, isRequired: true, targetRoles: role },
          { _id: 1 }
        ).lean()
      : Promise.resolve([]),
  ]);

  const xpByDay = new Map(xpRows.map((r) => [r._id, r.xp]));
  const activity7d = days.map((day) => ({ day, xp: xpByDay.get(day) ?? 0 }));
  const todayXp = xpByDay.get(today) ?? 0;

  const requiredIds = new Set(required.map((c) => String(c._id)));
  const completedRequired = enrolments.filter(
    (e) => e.status === 'completed' && requiredIds.has(String(e.courseId))
  ).length;
  // Readiness only exists when the role has required courses. Otherwise the app shows course progress.
  const readiness = requiredIds.size
    ? {
        percent: Math.round((completedRequired / requiredIds.size) * 100),
        completed: completedRequired,
        required: requiredIds.size,
      }
    : null;

  return {
    xp: user?.learning?.xp ?? 0,
    streak: {
      current: user?.learning?.streak?.current ?? 0,
      longest: user?.learning?.streak?.longest ?? 0,
      freezes: user?.learning?.streak?.freezes ?? 0,
    },
    today: { xp: todayXp, goal: user?.learning?.dailyGoalXp ?? 10 },
    readiness,
    activity7d,
    enrolments: enrolments.map((e) => ({
      courseId: String(e.courseId),
      status: e.status,
      passedModules: e.passedModuleIds.length,
    })),
  };
}
