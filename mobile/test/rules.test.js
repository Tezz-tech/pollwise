import { describe, expect, it } from 'vitest';
import { friendlyMessage, DEFAULT_MESSAGE } from '../src/lib/errors.js';
import { normaliseNigerianPhone, passwordStrength, looksLikeEmail } from '../src/lib/validation.js';
import { daysUntil, nextOccurrence, planReminders, reminderMessage } from '../src/lib/reminders.js';
import { pickRecommendedCourse } from '../src/lib/recommend.js';
import { COPY } from '@pollwise/shared/copy';

describe('friendlyMessage', () => {
  it('uses the mapped sentence for a known code', () => {
    expect(friendlyMessage('LESSON_LOCKED')).toMatch(/Finish the lesson/);
  });

  it('falls back for an unknown or missing code', () => {
    expect(friendlyMessage('SOMETHING_NEW')).toBe(DEFAULT_MESSAGE);
    expect(friendlyMessage(undefined, 'Custom.')).toBe('Custom.');
  });

  it('never returns a sentence that names a party, candidate or outcome', () => {
    const all = [
      'NETWORK',
      'INVALID_CREDENTIALS',
      'LESSON_LOCKED',
      'ATTEMPTS_EXHAUSTED',
      'INTERNAL',
    ].map((code) => friendlyMessage(code));
    for (const text of all) expect(text).not.toMatch(/party|candidate|winner|lost|fail/i);
  });
});

describe('normaliseNigerianPhone', () => {
  it.each([
    ['08030000001', '+2348030000001'],
    ['8030000001', '+2348030000001'],
    ['2348030000001', '+2348030000001'],
    ['+234 803 000 0001', '+2348030000001'],
    ['0703-000-0001', '+2347030000001'],
  ])('normalises %s', (input, expected) => {
    expect(normaliseNigerianPhone(input)).toBe(expected);
  });

  it.each(['0123456789', '080300', 'abcdefghij', '+44 20 7946 0000', ''])('rejects %s', (input) => {
    expect(normaliseNigerianPhone(input)).toBeNull();
  });
});

describe('passwordStrength', () => {
  it('needs at least 10 characters (SPEC §3)', () => {
    expect(passwordStrength('Short1!')).toEqual({ score: 0, label: 'Too short' });
  });

  it('rises with variety', () => {
    expect(passwordStrength('alllowercase').score).toBe(1);
    expect(passwordStrength('MixedCaseOnly').score).toBe(2);
    expect(passwordStrength('MixedCase123').score).toBe(3);
    expect(passwordStrength('MixedCase123!').score).toBe(4);
  });
});

describe('looksLikeEmail', () => {
  it('accepts a basic address and rejects a bare word', () => {
    expect(looksLikeEmail('ada@example.ng')).toBe(true);
    expect(looksLikeEmail('ada')).toBe(false);
  });
});

describe('reminders', () => {
  const now = new Date(2026, 10, 6, 9, 0, 0); // 6 Nov 2026, 09:00 local

  it('picks the next occurrence, tomorrow if the time has passed', () => {
    expect(nextOccurrence('18:00', now).getDate()).toBe(6);
    expect(nextOccurrence('07:30', now).getDate()).toBe(7);
  });

  it('starts tomorrow when the learner has already learned today', () => {
    const plan = planReminders({ hhmm: '18:00', now, learnedToday: true, days: 3 });
    expect(plan.map((p) => p.date.getDate())).toEqual([7, 8, 9]);
  });

  it('includes today when the learner has not learned yet and the time is ahead', () => {
    const plan = planReminders({ hhmm: '18:00', now, learnedToday: false, days: 2 });
    expect(plan[0].date.getDate()).toBe(6);
  });

  it('plans nothing when reminders are off', () => {
    expect(planReminders({ hhmm: null, now, learnedToday: false })).toEqual([]);
  });

  it('uses the election line only when a date is set and still ahead', () => {
    expect(reminderMessage({ dayIndex: 2, daysToElection: 40 })).toContain('40 days');
    expect(reminderMessage({ dayIndex: 2, daysToElection: null })).not.toMatch(/days to election/);
    expect(reminderMessage({ dayIndex: 0, daysToElection: 40 })).toBe(COPY.reminders[0]);
  });

  it('counts whole days to an election date', () => {
    expect(daysUntil('2026-12-06T00:00:00', now)).toBe(30);
    expect(daysUntil('2026-11-01T00:00:00', now)).toBeNull();
    expect(daysUntil(null, now)).toBeNull();
  });
});

describe('pickRecommendedCourse', () => {
  const courses = [
    { id: 'a', isRequired: false, targetRoles: ['security'], enrolment: null },
    { id: 'b', isRequired: true, targetRoles: ['party_agent'], enrolment: null },
    { id: 'c', isRequired: true, targetRoles: ['party_agent'], enrolment: { status: 'completed' } },
  ];

  it('prefers a required course for the role, skipping completed ones', () => {
    expect(pickRecommendedCourse(courses, 'party_agent').id).toBe('b');
  });

  it('falls back to any course for the role, then the first open course', () => {
    expect(pickRecommendedCourse(courses, 'security').id).toBe('a');
    expect(pickRecommendedCourse(courses, 'other').id).toBe('a');
  });

  it('returns null when everything is completed', () => {
    expect(pickRecommendedCourse([{ enrolment: { status: 'completed' } }], 'x')).toBeNull();
  });
});

import { isWelcomeBack } from '../src/lib/welcomeBack.js';

describe('isWelcomeBack', () => {
  const now = new Date('2026-11-10T09:00:00Z');
  it('is true after three or more days away', () => {
    expect(isWelcomeBack('2026-11-07T09:00:00Z', now)).toBe(true);
  });
  it('is false for a short gap, a first run, or a bad value', () => {
    expect(isWelcomeBack('2026-11-09T09:00:00Z', now)).toBe(false);
    expect(isWelcomeBack(null, now)).toBe(false);
    expect(isWelcomeBack('not a date', now)).toBe(false);
  });
});
