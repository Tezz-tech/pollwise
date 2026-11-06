import { describe, expect, it } from 'vitest';
import { COPY, interpolate, pickCopy } from '../copy.js';

describe('copy banks (DESIGN §8)', () => {
  it('keeps the approved wording of every bank', () => {
    expect(COPY.correct).toContain('Nice work!');
    expect(COPY.notQuite).toContain('Not quite.');
    expect(COPY.notYet[0]).toBe(
      'Not yet — you need {passMark}%. Have another look at these and try again.'
    );
  });

  it('never uses shaming or party language', () => {
    const everything = JSON.stringify(COPY).toLowerCase();
    for (const banned of ['fail', 'letting everyone', 'wrong answer', 'party', 'candidate']) {
      expect(everything).not.toContain(banned);
    }
  });
});

describe('pickCopy', () => {
  it('rotates through the bank and wraps around', () => {
    expect(pickCopy(['a', 'b'], 0)).toBe('a');
    expect(pickCopy(['a', 'b'], 1)).toBe('b');
    expect(pickCopy(['a', 'b'], 2)).toBe('a');
  });

  it('rejects an empty bank or a bad index', () => {
    expect(() => pickCopy([], 0)).toThrow(RangeError);
    expect(() => pickCopy(['a'], -1)).toThrow(RangeError);
  });
});

describe('interpolate', () => {
  it('fills known placeholders and leaves unknown ones visible', () => {
    expect(interpolate('Need {passMark}%', { passMark: 70 })).toBe('Need 70%');
    expect(interpolate('{n} days, {missing}', { n: 3 })).toBe('3 days, {missing}');
  });
});
