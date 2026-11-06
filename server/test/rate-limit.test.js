import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { resetData, startHarness, stopHarness } from './helpers/harness.js';

// Tight limits for these tests only; every other file runs with generous ones.
let h;
beforeAll(async () => {
  h = await startHarness({
    rateLimits: {
      login: { limit: 10, windowMs: 15 * 60_000 },
      resetAccount: { limit: 3, windowMs: 60 * 60_000 },
    },
  });
});
afterEach(async () => {
  await resetData();
});
afterAll(stopHarness);

describe('rate limits (SECURITY §5)', () => {
  it('answers 429 RATE_LIMITED with Retry-After after 10 login attempts in 15 minutes', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await h.api
        .post('/api/v1/auth/login')
        .send({ identifier: 'nobody@example.com', password: 'x' });
      expect(res.status).toBe(401);
    }
    const blocked = await h.api
      .post('/api/v1/auth/login')
      .send({ identifier: 'nobody@example.com', password: 'x' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limits password-reset requests per account to 3 an hour, without affecting other accounts', async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await h.api
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: 'target@example.com' });
      expect(res.status).toBe(200);
    }
    const blocked = await h.api
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'target@example.com' });
    expect(blocked.status).toBe(429);

    const other = await h.api
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'other@example.com' });
    expect(other.status).toBe(200);
  });
});
