import { describe, expect, it } from 'vitest';
import { computeLocks, courseIsComplete } from '../src/domain/locks.js';
import { applyActivity, dayGap } from '../src/domain/streak.js';
import { applyHeartbeat, coveredSeconds, isWatched } from '../src/domain/video.js';
import { lagosDay } from '../src/utils/time.js';

const course = {
  modules: [
    { id: 'm1', lessonIds: ['l1', 'l2'], assessmentId: 'a1' },
    { id: 'm2', lessonIds: ['l3'], assessmentId: 'a2' },
  ],
};
const none = { completedLessonIds: new Set(), passedModuleIds: new Set() };

describe('locks (SPEC §8.1)', () => {
  it('opens module 1 lesson 1 on enrolment, and only that lesson', () => {
    const locks = computeLocks(course, none);
    expect(locks.lessonOpen.get('l1')).toBe(true);
    expect(locks.lessonOpen.get('l2')).toBe(false);
    expect(locks.moduleOpen.get('m1')).toBe(true);
    expect(locks.moduleOpen.get('m2')).toBe(false);
  });

  it('lesson 2 opens only when lesson 1 is complete', () => {
    const locks = computeLocks(course, { ...none, completedLessonIds: new Set(['l1']) });
    expect(locks.lessonOpen.get('l2')).toBe(true);
  });

  it('an assessment opens only when every lesson in its module is complete', () => {
    const partial = computeLocks(course, { ...none, completedLessonIds: new Set(['l1']) });
    expect(partial.assessmentOpen.get('a1')).toBe(false);
    const all = computeLocks(course, { ...none, completedLessonIds: new Set(['l1', 'l2']) });
    expect(all.assessmentOpen.get('a1')).toBe(true);
  });

  it('module 2 opens only when module 1’s assessment is passed', () => {
    const lessonsDone = { completedLessonIds: new Set(['l1', 'l2']), passedModuleIds: new Set() };
    expect(computeLocks(course, lessonsDone).moduleOpen.get('m2')).toBe(false);
    const passed = { ...lessonsDone, passedModuleIds: new Set(['m1']) };
    const locks = computeLocks(course, passed);
    expect(locks.moduleOpen.get('m2')).toBe(true);
    expect(locks.lessonOpen.get('l3')).toBe(true);
  });

  it('a later module’s lessons stay locked even when finished elsewhere', () => {
    const locks = computeLocks(course, { ...none, completedLessonIds: new Set(['l3']) });
    expect(locks.lessonOpen.get('l3')).toBe(false);
  });

  it('a course is complete only when every module is passed', () => {
    expect(courseIsComplete(course, { ...none, passedModuleIds: new Set(['m1']) })).toBe(false);
    expect(courseIsComplete(course, { ...none, passedModuleIds: new Set(['m1', 'm2']) })).toBe(
      true
    );
  });
});

describe('video watch tracking (SPEC §7)', () => {
  const t0 = new Date('2026-11-06T10:00:00Z');
  const at = (sec) => new Date(t0.getTime() + sec * 1000);

  it('continuous watching adds up and completes at 90%', () => {
    let state = { spans: [], anchor: null };
    for (let step = 0; step <= 9; step += 1) {
      state = applyHeartbeat(state, { position: step * 10, at: at(step * 10) });
    }
    expect(coveredSeconds(state.spans)).toBe(90);
    expect(isWatched(state.spans, 100)).toBe(true);
  });

  it('seeking to the end does not count, so the video does not complete', () => {
    let state = applyHeartbeat({ spans: [], anchor: null }, { position: 0, at: at(0) });
    state = applyHeartbeat(state, { position: 100, at: at(10) });
    expect(state.spans).toEqual([]);
    expect(isWatched(state.spans, 100)).toBe(false);
  });

  it('a jump is judged against elapsed wall-clock time', () => {
    const anchored = applyHeartbeat({ spans: [], anchor: null }, { position: 0, at: at(0) });
    // 10 s of real time allows up to 10 × 1.5 + 5 = 20 s of jump.
    const within = applyHeartbeat(anchored, { position: 20, at: at(10) });
    expect(within.counted).toBe(true);
    const beyond = applyHeartbeat(anchored, { position: 21, at: at(10) });
    expect(beyond.counted).toBe(false);
  });

  it('rewinding does not count', () => {
    const anchored = applyHeartbeat({ spans: [], anchor: null }, { position: 50, at: at(0) });
    const back = applyHeartbeat(anchored, { position: 40, at: at(10) });
    expect(back.counted).toBe(false);
  });

  it('overlapping spans are merged, so replaying a section is not double counted', () => {
    let state = { spans: [], anchor: null };
    state = applyHeartbeat(state, { position: 0, at: at(0) });
    state = applyHeartbeat(state, { position: 10, at: at(10) });
    state = applyHeartbeat(state, { position: 5, at: at(20) });
    state = applyHeartbeat(state, { position: 15, at: at(30) });
    expect(coveredSeconds(state.spans)).toBe(15);
  });
});

describe('streaks in Africa/Lagos days (SPEC §8.4)', () => {
  const streak = (over = {}) => ({
    current: 0,
    longest: 0,
    lastActiveDay: null,
    freezes: 0,
    ...over,
  });

  it('counts the same day once', () => {
    const out = applyActivity(
      streak({ current: 3, longest: 3, lastActiveDay: '2026-11-06' }),
      '2026-11-06'
    );
    expect(out.streak.current).toBe(3);
    expect(out.events).toEqual([]);
  });

  it('extends the streak the next day', () => {
    const out = applyActivity(
      streak({ current: 3, longest: 3, lastActiveDay: '2026-11-05' }),
      '2026-11-06'
    );
    expect(out.streak.current).toBe(4);
    expect(out.events).toEqual([{ type: 'streak_extended', current: 4 }]);
  });

  it('one missed day with a freeze spends the freeze and keeps the streak', () => {
    const out = applyActivity(
      streak({ current: 5, longest: 5, lastActiveDay: '2026-11-04', freezes: 1 }),
      '2026-11-06'
    );
    expect(out.streak).toMatchObject({ current: 6, freezes: 0 });
    expect(out.events.map((e) => e.type)).toEqual(['streak_freeze_used', 'streak_extended']);
  });

  it('one missed day without a freeze resets to 1', () => {
    const out = applyActivity(
      streak({ current: 5, longest: 5, lastActiveDay: '2026-11-04', freezes: 0 }),
      '2026-11-06'
    );
    expect(out.streak).toMatchObject({ current: 1, longest: 5 });
  });

  it('two missed days resets even with a freeze in hand', () => {
    const out = applyActivity(
      streak({ current: 5, longest: 5, lastActiveDay: '2026-11-03', freezes: 2 }),
      '2026-11-06'
    );
    expect(out.streak).toMatchObject({ current: 1, freezes: 2 });
  });

  it('earns a freeze at 7 days and holds at most 2', () => {
    const seven = applyActivity(
      streak({ current: 6, longest: 6, lastActiveDay: '2026-11-05' }),
      '2026-11-06'
    );
    expect(seven.streak.freezes).toBe(1);
    expect(seven.events.some((e) => e.type === 'streak_freeze_earned')).toBe(true);

    const fourteen = applyActivity(
      streak({ current: 13, longest: 13, lastActiveDay: '2026-11-05', freezes: 1 }),
      '2026-11-06'
    );
    expect(fourteen.streak.freezes).toBe(2);
    const twentyOne = applyActivity(
      streak({ current: 20, longest: 20, lastActiveDay: '2026-11-05', freezes: 2 }),
      '2026-11-06'
    );
    expect(twentyOne.streak.freezes).toBe(2);
    expect(twentyOne.events.some((e) => e.type === 'streak_freeze_earned')).toBe(false);
  });

  it('reports streak milestones', () => {
    const out = applyActivity(
      streak({ current: 2, longest: 2, lastActiveDay: '2026-11-05' }),
      '2026-11-06'
    );
    expect(out.events.map((e) => e.type)).toContain('streak_milestone');
  });

  it('the day boundary is midnight in Lagos, not UTC', () => {
    // 23:59 in Lagos (UTC+1) and 00:01 the next Lagos day are consecutive days, though only two minutes apart.
    expect(lagosDay(new Date('2026-11-06T22:59:00Z'))).toBe('2026-11-06');
    expect(lagosDay(new Date('2026-11-06T23:01:00Z'))).toBe('2026-11-07');
    expect(dayGap('2026-11-06', '2026-11-07')).toBe(1);
  });
});
