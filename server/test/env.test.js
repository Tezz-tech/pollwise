import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const strongSecret = randomBytes(48).toString('base64url');
const totpKey = randomBytes(32).toString('base64');

const good = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/pollwise',
  JWT_ACCESS_SECRET: strongSecret,
  TOTP_ENC_KEY: totpKey,
  ADMIN_ORIGIN: 'http://localhost:5173, https://admin.example.org',
};

describe('loadEnv', () => {
  it('accepts a complete, strong configuration and applies defaults', () => {
    const outcome = loadEnv(good);
    expect(outcome.ok).toBe(true);
    expect(outcome.env.PORT).toBe(4000);
    expect(outcome.env.LOG_LEVEL).toBe('info');
    expect(outcome.env.TRUST_PROXY_HOPS).toBe(0);
    expect(outcome.env.ADMIN_ORIGIN).toEqual([
      'http://localhost:5173',
      'https://admin.example.org',
    ]);
  });

  it('refuses to start when a required variable is missing, naming the variable only', () => {
    const { MONGODB_URI: _omit, ...rest } = good;
    const outcome = loadEnv(rest);
    expect(outcome.ok).toBe(false);
    expect(outcome.problems.join('\n')).toMatch(/MONGODB_URI/);
  });

  it('refuses a JWT secret shorter than 32 bytes', () => {
    const outcome = loadEnv({ ...good, JWT_ACCESS_SECRET: 'x'.repeat(31) });
    expect(outcome.ok).toBe(false);
    expect(outcome.problems.join('\n')).toMatch(/JWT_ACCESS_SECRET must be at least 32 bytes/);
  });

  it('refuses the placeholder text copied from .env.example', () => {
    const outcome = loadEnv({
      ...good,
      JWT_ACCESS_SECRET: 'replace-with-64-random-characters-from-the-generator-above',
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.problems.join('\n')).toMatch(/placeholder/);
  });

  it('refuses a TOTP key that is not 32 bytes of base64', () => {
    const outcome = loadEnv({ ...good, TOTP_ENC_KEY: randomBytes(16).toString('base64') });
    expect(outcome.ok).toBe(false);
    expect(outcome.problems.join('\n')).toMatch(/TOTP_ENC_KEY/);
  });

  it('refuses an unknown NODE_ENV', () => {
    const outcome = loadEnv({ ...good, NODE_ENV: 'staging' });
    expect(outcome.ok).toBe(false);
    expect(outcome.problems.join('\n')).toMatch(/NODE_ENV/);
  });

  it('never echoes a secret value back in its problem list', () => {
    const leaked = 'short-but-secret-value';
    const outcome = loadEnv({ ...good, JWT_ACCESS_SECRET: leaked });
    expect(outcome.ok).toBe(false);
    expect(outcome.problems.join('\n')).not.toContain(leaked);
  });
});
