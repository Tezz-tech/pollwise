import { describe, expect, it } from 'vitest';
import {
  blankCount,
  computeScore,
  correctAnswerFor,
  isPass,
  markAnswer,
  normaliseBlankAnswer,
  parseResponse,
} from '../src/domain/grading.js';
import { assignQuestionIds } from '../src/domain/questionIds.js';

const single = {
  type: 'single_choice',
  prompt: 'Who signs the result sheet?',
  points: 1,
  options: [
    { id: 'a1', text: 'The agent' },
    { id: 'b2', text: 'The presiding officer' },
    { id: 'c3', text: 'The voter' },
  ],
  correctOptionId: 'b2',
};

const multi = {
  type: 'multi_choice',
  prompt: 'Pick all that apply',
  points: 1,
  options: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
    { id: 'c', text: 'C' },
  ],
  correctOptionIds: ['a', 'c'],
};

const tf = { type: 'true_false', prompt: 'Sure?', points: 1, correct: false };

const matching = {
  type: 'matching',
  prompt: 'Match',
  points: 1,
  pairs: [
    { id: 'p1', left: 'Form EC8A', right: 'Polling unit result', rightId: 'r1' },
    { id: 'p2', left: 'BVAS', right: 'Accreditation', rightId: 'r2' },
    { id: 'p3', left: 'Collation', right: 'Ward totals', rightId: 'r3' },
  ],
};

const ordering = {
  type: 'ordering',
  prompt: 'Order the steps',
  points: 1,
  items: [
    { id: 'i1', text: 'Open' },
    { id: 'i2', text: 'Count' },
    { id: 'i3', text: 'Sign' },
  ],
  correctOrder: ['i1', 'i2', 'i3'],
};

const fill = {
  type: 'fill_blank',
  prompt: 'Fill',
  points: 1,
  template: 'The ___ must sign the result sheet, and the ___ counts it.',
  acceptedAnswers: [['presiding officer'], ['agent', 'party agent']],
};

describe('markAnswer: every question type (SPEC §8.2)', () => {
  it('single choice needs the exact option', () => {
    expect(markAnswer(single, { optionId: 'b2' }).correct).toBe(true);
    expect(markAnswer(single, { optionId: 'a1' }).correct).toBe(false);
  });

  it('multi choice needs the exact set: all correct plus one wrong is wrong', () => {
    expect(markAnswer(multi, { optionIds: ['c', 'a'] }).correct).toBe(true);
    expect(markAnswer(multi, { optionIds: ['a'] }).correct).toBe(false);
    expect(markAnswer(multi, { optionIds: ['a', 'b', 'c'] }).correct).toBe(false);
    expect(markAnswer(multi, { optionIds: [] }).correct).toBe(false);
  });

  it('true/false compares the boolean', () => {
    expect(markAnswer(tf, { value: false }).correct).toBe(true);
    expect(markAnswer(tf, { value: true }).correct).toBe(false);
  });

  it('matching needs every pair matched to its own right-hand side', () => {
    const right = { p1: 'r1', p2: 'r2', p3: 'r3' };
    expect(markAnswer(matching, { rightByLeft: right }).correct).toBe(true);
    expect(markAnswer(matching, { rightByLeft: { ...right, p1: 'r2', p2: 'r1' } }).correct).toBe(
      false
    );
    // Two of three right is still wrong.
    expect(markAnswer(matching, { rightByLeft: { p1: 'r1', p2: 'r2' } }).correct).toBe(false);
  });

  it('ordering needs the exact sequence', () => {
    expect(markAnswer(ordering, { order: ['i1', 'i2', 'i3'] }).correct).toBe(true);
    expect(markAnswer(ordering, { order: ['i1', 'i3', 'i2'] }).correct).toBe(false);
    expect(markAnswer(ordering, { order: ['i1', 'i2'] }).correct).toBe(false);
  });

  it('fill blank needs every blank right', () => {
    expect(markAnswer(fill, { blanks: ['Presiding Officer', 'Party Agent'] }).correct).toBe(true);
    expect(markAnswer(fill, { blanks: ['Presiding Officer', 'voter'] }).correct).toBe(false);
    expect(markAnswer(fill, { blanks: ['Presiding Officer'] }).correct).toBe(false);
  });

  it('reflection is never graded and never scores', () => {
    const reflection = { type: 'reflection', prompt: 'Think', points: 0 };
    expect(markAnswer(reflection, { text: 'anything' })).toEqual({
      correct: null,
      pointsAwarded: 0,
      possible: 0,
    });
  });

  it('awards the question points on a correct answer and none otherwise (all-or-nothing)', () => {
    expect(markAnswer({ ...single, points: 3 }, { optionId: 'b2' }).pointsAwarded).toBe(3);
    expect(markAnswer({ ...single, points: 3 }, { optionId: 'a1' }).pointsAwarded).toBe(0);
  });
});

describe('fill_blank normalisation (SPEC §8.2)', () => {
  it.each([
    ['  Presiding   Officer  ', 'presiding officer'],
    ['PRESIDING OFFICER.', 'presiding officer'],
    ['presiding officer!?', 'presiding officer'],
    ['Presiding\tOfficer', 'presiding officer'],
  ])('normalises %j to %j', (input, expected) => {
    expect(normaliseBlankAnswer(input)).toBe(expected);
  });

  it('does not forgive a wrong word', () => {
    expect(normaliseBlankAnswer('presiding officers')).not.toBe('presiding officer');
  });

  it('counts blanks in the template', () => {
    expect(blankCount(fill.template)).toBe(2);
  });
});

describe('score and pass rules (SPEC §8.2)', () => {
  const ten = Array.from({ length: 10 }, () => ({ type: 'single_choice', points: 1 }));

  it('scores round(awarded / possible × 100)', () => {
    const graded = ten.map((q, i) => ({ ...q, pointsAwarded: i < 7 ? 1 : 0 }));
    expect(computeScore(graded)).toBe(70);
  });

  it('a score of exactly the pass mark passes; one point below fails', () => {
    expect(isPass(70, 70)).toBe(true);
    expect(isPass(69, 70)).toBe(false);
  });

  it('weights by points: 69 of 100 fails, 70 of 100 passes', () => {
    const hundred = (awardedPoints) => [
      { type: 'single_choice', points: 69, pointsAwarded: awardedPoints },
      { type: 'single_choice', points: 31, pointsAwarded: 0 },
    ];
    expect(computeScore(hundred(69))).toBe(69);
    expect(isPass(computeScore(hundred(69)), 70)).toBe(false);
    expect(computeScore(hundred(70))).toBe(70);
    expect(isPass(computeScore(hundred(70)), 70)).toBe(true);
  });

  it('leaves reflection questions out of the denominator', () => {
    const graded = [
      { type: 'single_choice', points: 1, pointsAwarded: 1 },
      { type: 'reflection', points: 0, pointsAwarded: 0 },
    ];
    expect(computeScore(graded)).toBe(100);
  });

  it('a per-assessment pass mark is respected by the caller’s comparison', () => {
    expect(isPass(85, 90)).toBe(false);
    expect(isPass(90, 90)).toBe(true);
  });
});

describe('answer parsing and reveal form', () => {
  it('refuses a response with an unknown key', () => {
    expect(parseResponse('single_choice', { optionId: 'a', extra: 1 }).ok).toBe(false);
  });

  it('refuses a response in the wrong shape for the type', () => {
    expect(parseResponse('true_false', { optionId: 'a' }).ok).toBe(false);
    expect(parseResponse('unknown_type', {}).ok).toBe(false);
  });

  it('gives the correct answer in a learner-safe form', () => {
    expect(correctAnswerFor(single)).toBe('The presiding officer');
    expect(correctAnswerFor(multi)).toEqual(['A', 'C']);
    expect(correctAnswerFor(tf)).toBe(false);
    expect(correctAnswerFor(ordering)).toEqual(['Open', 'Count', 'Sign']);
    expect(correctAnswerFor(fill)).toEqual(['presiding officer', 'agent']);
  });
});

describe('assignQuestionIds: item ids are random and references follow them', () => {
  it('replaces the admin’s readable ids and rewrites the answer key to match', () => {
    const input = {
      type: 'single_choice',
      prompt: 'Pick',
      options: [
        { id: 'correct', text: 'Right' },
        { id: 'wrong', text: 'Wrong' },
      ],
      correctOptionId: 'correct',
    };
    const out = assignQuestionIds(input);
    const ids = out.options.map((o) => o.id);
    expect(ids).not.toContain('correct');
    expect(ids).not.toContain('wrong');
    expect(ids[0]).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(out.correctOptionId).toBe(ids[0]);
  });

  it('keeps stored ids that the admin sends back', () => {
    const stored = {
      options: [
        { id: 'K1xYz_09aB', text: 'A' },
        { id: 'Qw3rTy-12Zx', text: 'B' },
      ],
      correctOptionId: 'K1xYz_09aB',
    };
    const input = {
      type: 'single_choice',
      prompt: 'Pick',
      options: [
        { id: 'K1xYz_09aB', text: 'A (edited)' },
        { id: 'Qw3rTy-12Zx', text: 'B' },
      ],
      correctOptionId: 'K1xYz_09aB',
    };
    const out = assignQuestionIds(input, stored);
    expect(out.options.map((o) => o.id)).toEqual(['K1xYz_09aB', 'Qw3rTy-12Zx']);
    expect(out.correctOptionId).toBe('K1xYz_09aB');
  });

  it('gives matching left and right sides different random ids', () => {
    const input = {
      type: 'matching',
      prompt: 'Match',
      pairs: [
        { id: 'p1', left: 'A', right: 'a' },
        { id: 'p2', left: 'B', right: 'b' },
        { id: 'p3', left: 'C', right: 'c' },
      ],
    };
    const out = assignQuestionIds(input);
    for (const pair of out.pairs) {
      expect(pair.rightId).toMatch(/^[A-Za-z0-9_-]{10}$/);
      expect(pair.rightId).not.toBe(pair.id);
    }
    const all = out.pairs.flatMap((p) => [p.id, p.rightId]);
    expect(new Set(all).size).toBe(6);
  });
});
