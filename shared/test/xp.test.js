import { describe, expect, it } from 'vitest';
import {
  XP,
  assessmentPassXp,
  earnsStreakFreeze,
  isStreakMilestone,
  lessonCompletionXp,
  practiceXp,
} from '../xp.js';

// SPEC §8.3 table, checked line by line.
describe('XP table (SPEC §8.3)', () => {
  it('awards the flat lesson values', () => {
    expect(lessonCompletionXp('video')).toBe(10);
    expect(lessonCompletionXp('text')).toBe(5);
    expect(lessonCompletionXp('document')).toBe(5);
  });

  it('refuses to guess XP for practice or unknown lesson types', () => {
    expect(() => lessonCompletionXp('practice')).toThrow(RangeError);
    expect(() => lessonCompletionXp('quiz')).toThrow(RangeError);
  });

  it('awards practice as 5 plus 2 per correct answer', () => {
    expect(practiceXp(0)).toBe(5);
    expect(practiceXp(3)).toBe(11);
  });

  it('rejects impossible practice counts', () => {
    expect(() => practiceXp(-1)).toThrow(RangeError);
    expect(() => practiceXp(1.5)).toThrow(RangeError);
  });

  it('awards a pass of 20, plus 10 for a first try and 10 for a perfect score', () => {
    expect(assessmentPassXp({ firstTry: false, perfect: false })).toBe(20);
    expect(assessmentPassXp({ firstTry: true, perfect: false })).toBe(30);
    expect(assessmentPassXp({ firstTry: false, perfect: true })).toBe(30);
    expect(assessmentPassXp({ firstTry: true, perfect: true })).toBe(40);
  });

  it('exposes the course completion value', () => {
    expect(XP.COURSE_COMPLETED).toBe(50);
  });
});

describe('streak milestones and freezes (SPEC §8.4, §8.8)', () => {
  it('celebrates only the listed milestones', () => {
    for (const day of [3, 7, 14, 30, 50, 100]) expect(isStreakMilestone(day)).toBe(true);
    for (const day of [1, 2, 4, 21]) expect(isStreakMilestone(day)).toBe(false);
  });

  it('earns a freeze at every 7-day multiple and never at zero', () => {
    expect(earnsStreakFreeze(0)).toBe(false);
    expect(earnsStreakFreeze(6)).toBe(false);
    expect(earnsStreakFreeze(7)).toBe(true);
    expect(earnsStreakFreeze(14)).toBe(true);
    expect(earnsStreakFreeze(15)).toBe(false);
  });
});
