import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  missedPrompts,
  scorePercent,
  xpBreakdown,
} from '../src/lib/assessment.js';

describe('xpBreakdown', () => {
  it('lists only the check rewards, in award order', () => {
    const rows = xpBreakdown([
      { type: 'assessment_pass_ignored' },
      { type: 'xp', reason: 'assessment_pass', amount: 20 },
      { type: 'xp', reason: 'assessment_first_try', amount: 10 },
      { type: 'streak_extended', current: 3 },
      { type: 'xp', reason: 'video_lesson', amount: 10 },
    ]);
    expect(rows).toEqual([
      { label: 'Passed', amount: 20 },
      { label: 'First try', amount: 10 },
    ]);
  });
});

describe('missedPrompts', () => {
  it('returns the prompts of questions answered wrongly', () => {
    const review = [
      { questionId: 'q1', correct: true },
      { questionId: 'q2', correct: false },
    ];
    const questions = [
      { id: 'q1', prompt: 'First?' },
      { id: 'q2', prompt: 'Second?' },
    ];
    expect(missedPrompts(review, questions)).toEqual(['Second?']);
  });

  it('is empty when the server did not reveal answers', () => {
    expect(missedPrompts([], [{ id: 'q1', prompt: 'x' }])).toEqual([]);
  });
});

describe('formatCountdown and scorePercent', () => {
  it('formats minutes and seconds, never negative', () => {
    expect(formatCountdown(299_500)).toBe('5:00');
    expect(formatCountdown(59_000)).toBe('0:59');
    expect(formatCountdown(-4000)).toBe('0:00');
  });

  it('keeps the score between 0 and 100', () => {
    expect(scorePercent(72.4)).toBe(72);
    expect(scorePercent(140)).toBe(100);
    expect(scorePercent(undefined)).toBe(0);
  });
});
