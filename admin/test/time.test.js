import { describe, expect, it } from 'vitest';
import { relativeTime } from '../src/lib/time.js';

describe('relativeTime', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  it('describes recent edits in words', () => {
    expect(relativeTime('2026-11-06T11:00:00Z', now)).toMatch(/hour/);
    expect(relativeTime('2026-11-05T12:00:00Z', now)).toMatch(/day|yesterday/);
    expect(relativeTime('2026-11-06T11:59:50Z', now)).toBe('just now');
  });
});
