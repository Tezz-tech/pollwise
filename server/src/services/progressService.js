/**
 * XP, streaks, daily goal and certificates (SPEC §8.3, §8.4, §8.6, §8.8). Every function here returns
 * the events the app should celebrate; nothing on the device decides when to celebrate (SPEC §8.8).
 */
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { User, XpEvent, Certificate, Course } from '../models/index.js';
import { lagosDay } from '../utils/time.js';
import { applyActivity } from '../domain/streak.js';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CERTIFICATE_CODE_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/;

/**
 * Award XP once. The unique index on (user, reason, refId) makes a second award a no-op, so retries and
 * double taps cannot pay twice (SPEC §8.3).
 * @returns {Promise<object | null>} the xp event, or null when it was already awarded
 */
export async function awardXp(ctx, userId, { reason, refId, amount }) {
  try {
    await XpEvent.create({
      userId,
      amount,
      reason,
      refId: String(refId),
      day: lagosDay(ctx.now()),
    });
  } catch (err) {
    if (err?.code === 11000) return null;
    throw err;
  }
  await User.updateOne({ _id: userId }, { $inc: { 'learning.xp': amount } });
  return { type: 'xp', amount, reason };
}

/**
 * Count one day of activity (SPEC §8.4). Concurrent completions cannot both extend the streak: the
 * update only applies if the stored last-active day is still the one we read, and we retry otherwise.
 * @returns {Promise<Array<object>>} streak events
 */
export async function recordActivity(ctx, userId) {
  const today = lagosDay(ctx.now());
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const user = await User.findById(userId, { 'learning.streak': 1 }).lean();
    const old = {
      current: user?.learning?.streak?.current ?? 0,
      longest: user?.learning?.streak?.longest ?? 0,
      lastActiveDay: user?.learning?.streak?.lastActiveDay ?? null,
      freezes: user?.learning?.streak?.freezes ?? 0,
    };
    const { streak, events } = applyActivity(old, today);
    if (events.length === 0) return [];

    const result = await User.updateOne(
      { _id: userId, 'learning.streak.lastActiveDay': old.lastActiveDay },
      { $set: { 'learning.streak': streak } }
    );
    if (result.matchedCount === 1) return events;
  }
  return [];
}

/**
 * Daily goal (SPEC §8.4): when today's XP first reaches the learner's goal, emit daily_goal_met once.
 * The marker is an XpEvent with amount 0, so the unique index keeps it to one per day.
 */
export async function dailyGoalEvents(ctx, userId) {
  const day = lagosDay(ctx.now());
  const uid = new mongoose.Types.ObjectId(String(userId));
  const [user, sums] = await Promise.all([
    User.findById(userId, { 'learning.dailyGoalXp': 1 }).lean(),
    XpEvent.aggregate([
      { $match: { userId: uid, day, amount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  const goal = user?.learning?.dailyGoalXp ?? 10;
  const xpToday = sums[0]?.total ?? 0;
  if (xpToday < goal) return [];
  try {
    await XpEvent.create({ userId: uid, amount: 0, reason: 'daily_goal_met', refId: day, day });
  } catch (err) {
    if (err?.code === 11000) return [];
    throw err;
  }
  return [{ type: 'daily_goal_met', xpToday, goal }];
}

/**
 * Everything that happens when something is completed: XP, the completion event, streak and daily goal.
 * @param {{ reason: string, refId: string, amount: number, lessonId?: string }} award
 */
export async function rewardCompletion(ctx, userId, { reason, refId, amount, lessonId }) {
  const events = [];
  const xp = await awardXp(ctx, userId, { reason, refId, amount });
  if (xp) events.push(xp);
  if (lessonId) events.push({ type: 'lesson_completed', lessonId: String(lessonId) });
  events.push(...(await recordActivity(ctx, userId)));
  events.push(...(await dailyGoalEvents(ctx, userId)));
  return events;
}

/* ------------------------------------------------------------------ certificates */

/** A code of ten Crockford base32 characters (SPEC §8.6). Unique by index; retried on the rare clash. */
export function newCertificateCode() {
  const bytes = randomBytes(10);
  let code = '';
  for (const byte of bytes) code += CROCKFORD[byte % CROCKFORD.length];
  return code;
}

/**
 * Issue the course certificate once, when the course completes. `score` is the mean of the best module
 * scores (SPEC §8.6).
 * @returns {Promise<object>} the certificate document
 */
export async function issueCertificate(ctx, { userId, courseId, enrollment }) {
  const existing = await Certificate.findOne({ userId, courseId });
  if (existing) return existing;

  const [user, course] = await Promise.all([
    User.findById(userId, { name: 1 }).lean(),
    Course.findById(courseId, { title: 1 }).lean(),
  ]);
  const scores = [...(enrollment.bestScores?.values?.() ?? [])];
  const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Certificate.create({
        userId,
        courseId,
        code: newCertificateCode(),
        learnerName: user.name,
        courseTitle: course.title,
        score,
        issuedAt: ctx.now(),
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      const again = await Certificate.findOne({ userId, courseId });
      if (again) return again;
    }
  }
  throw new Error('could not issue a unique certificate code');
}
