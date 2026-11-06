import { describe, expect, it } from 'vitest';
import {
  assessmentSchema,
  fillBlankSchema,
  lessonSchema,
  matchingSchema,
  multiChoiceSchema,
  orderingSchema,
  questionSchema,
  reflectionSchema,
  singleChoiceSchema,
  trueFalseSchema,
} from '../schemas/index.js';

const opt = (id, text) => ({ id, text });

describe('question schemas (SPEC §5 Question)', () => {
  it('accepts a valid single choice with a key that is one of its options', () => {
    const q = {
      type: 'single_choice',
      prompt: 'Which form is signed first?',
      options: [opt('a', 'One'), opt('b', 'Two')],
      correctOptionId: 'b',
    };
    expect(singleChoiceSchema.safeParse(q).success).toBe(true);
  });

  it('rejects a single choice whose key is not among its options', () => {
    const q = {
      type: 'single_choice',
      prompt: 'Pick',
      options: [opt('a', 'One'), opt('b', 'Two')],
      correctOptionId: 'z',
    };
    expect(singleChoiceSchema.safeParse(q).success).toBe(false);
  });

  it('requires every multi-choice key to come from the options and be unique', () => {
    const base = {
      type: 'multi_choice',
      prompt: 'Pick all',
      options: [opt('a', 'A'), opt('b', 'B'), opt('c', 'C')],
    };
    expect(multiChoiceSchema.safeParse({ ...base, correctOptionIds: ['a', 'c'] }).success).toBe(
      true
    );
    expect(multiChoiceSchema.safeParse({ ...base, correctOptionIds: ['a', 'a'] }).success).toBe(
      false
    );
    expect(multiChoiceSchema.safeParse({ ...base, correctOptionIds: ['q'] }).success).toBe(false);
    expect(multiChoiceSchema.safeParse({ ...base, correctOptionIds: [] }).success).toBe(false);
  });

  it('accepts true/false with a boolean key', () => {
    expect(
      trueFalseSchema.safeParse({ type: 'true_false', prompt: 'Sure?', correct: true }).success
    ).toBe(true);
  });

  it('requires 3 to 6 matching pairs', () => {
    const pair = (n) => ({ id: `p${n}`, left: `L${n}`, right: `R${n}` });
    const two = { type: 'matching', prompt: 'Match', pairs: [pair(1), pair(2)] };
    const three = { type: 'matching', prompt: 'Match', pairs: [pair(1), pair(2), pair(3)] };
    expect(matchingSchema.safeParse(two).success).toBe(false);
    expect(matchingSchema.safeParse(three).success).toBe(true);
  });

  it('requires the correct order to list every item exactly once', () => {
    const items = [opt('a', 'A'), opt('b', 'B'), opt('c', 'C')];
    const make = (correctOrder) => ({ type: 'ordering', prompt: 'Order', items, correctOrder });
    expect(orderingSchema.safeParse(make(['a', 'b', 'c'])).success).toBe(true);
    expect(orderingSchema.safeParse(make(['a', 'b'])).success).toBe(false);
    expect(orderingSchema.safeParse(make(['a', 'a', 'b'])).success).toBe(false);
  });

  it('needs one accepted-answer list per blank', () => {
    const template = 'The ___ signs the sheet, and the ___ counts it.';
    const make = (acceptedAnswers) => ({
      type: 'fill_blank',
      prompt: 'Fill',
      template,
      acceptedAnswers,
    });
    expect(
      fillBlankSchema.safeParse(make([['presiding officer'], ['agent', 'party agent']])).success
    ).toBe(true);
    expect(fillBlankSchema.safeParse(make([['presiding officer']])).success).toBe(false);
  });

  it('forces reflection to zero points and carries no answer key', () => {
    const parsed = reflectionSchema.parse({
      type: 'reflection',
      prompt: 'What will you do?',
      points: 5,
    });
    expect(parsed.points).toBe(0);
  });

  it('dispatches on type through the union', () => {
    expect(questionSchema.safeParse({ type: 'essay', prompt: 'x' }).success).toBe(false);
  });
});

describe('lesson and assessment schemas', () => {
  it('requires the detail object that matches the lesson type, and no other', () => {
    const video = {
      type: 'video',
      title: 'Opening the polling unit',
      order: 1,
      video: {
        youtubeId: 'dQw4w9WgXcQ',
        title: 'Opening',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg',
      },
    };
    expect(lessonSchema.safeParse(video).success).toBe(true);
    expect(lessonSchema.safeParse({ ...video, video: undefined }).success).toBe(false);
    expect(
      lessonSchema.safeParse({ ...video, text: { doc: { type: 'doc' }, readMinutes: 2 } }).success
    ).toBe(false);
  });

  it('rejects a YouTube id that is not 11 characters', () => {
    const bad = {
      type: 'video',
      title: 'x',
      order: 1,
      video: { youtubeId: 'short', title: 'x', thumbnailUrl: 'https://i.ytimg.com/a.jpg' },
    };
    expect(lessonSchema.safeParse(bad).success).toBe(false);
  });

  it('applies assessment defaults from SPEC §5', () => {
    const parsed = assessmentSchema.parse({ title: 'Module 1 check' });
    expect(parsed.passMark).toBeNull();
    expect(parsed.revealAnswers).toBe('after_pass');
    expect(parsed.shuffleQuestions).toBe(true);
    expect(parsed.maxAttempts).toBeNull();
  });
});
