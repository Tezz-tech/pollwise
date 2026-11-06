import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/utils/logger.js';
import { createServerlessHandler } from '../src/serverless.js';
import {
  captureMailer,
  resetData,
  startHarness,
  stopHarness,
  testConfig,
  START_TIME,
} from './helpers/harness.js';

let h;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await resetData();
  await stopHarness();
});

const SECRET = randomBytes(24).toString('base64url');

/** The API with a cron secret configured (the harness app has none). */
function appWithCron(secret) {
  return createApp({
    config: testConfig({ CRON_SECRET: secret }),
    logger: createLogger({ level: 'silent' }),
    mailer: captureMailer(),
    now: () => new Date(START_TIME),
  });
}

describe('scheduled job endpoint', () => {
  it('runs the deletion job for the scheduler, with the shared secret', async () => {
    const app = appWithCron(SECRET);
    const res = await request(app)
      .get('/api/v1/internal/cron/anonymise')
      .set('Authorization', `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ anonymised: 0 });
  });

  it('refuses a missing, wrong or malformed secret', async () => {
    const app = appWithCron(SECRET);
    expect((await request(app).get('/api/v1/internal/cron/anonymise')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/v1/internal/cron/anonymise')
          .set('Authorization', 'Bearer wrong-value-entirely-here-1234')
      ).status
    ).toBe(401);
    expect(
      (await request(app).get('/api/v1/internal/cron/anonymise').set('Authorization', SECRET))
        .status
    ).toBe(401);
  });

  it('refuses everyone when no secret is configured', async () => {
    const app = appWithCron(undefined);
    const res = await request(app)
      .get('/api/v1/internal/cron/anonymise')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });
});

describe('CRON_SECRET configuration', () => {
  const base = {
    NODE_ENV: 'development',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/x',
    JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
    TOTP_ENC_KEY: randomBytes(32).toString('base64'),
    ADMIN_ORIGIN: 'http://localhost:5173',
  };
  it('is optional', () => {
    expect(loadEnv(base).ok).toBe(true);
  });
  it('must be at least 32 characters when set', () => {
    const outcome = loadEnv({ ...base, CRON_SECRET: 'short' });
    expect(outcome.ok).toBe(false);
    expect(outcome.problems.join(' ')).toMatch(/CRON_SECRET/);
  });
});

describe('serverless handler', () => {
  function serve(handler) {
    return request(http.createServer(handler));
  }

  it('connects to the database once per instance and reuses the app', async () => {
    let connects = 0;
    const handler = createServerlessHandler({
      loadConfig: () => testConfig(),
      connect: async () => {
        connects += 1;
      },
      buildApp: () => h.app,
    });
    const server = serve(handler);
    expect((await server.get('/api/v1/health')).status).toBe(200);
    expect((await server.get('/api/v1/health')).status).toBe(200);
    expect(connects).toBe(1);
  });

  it('answers 503 with a generic message when configuration is incomplete, and recovers later', async () => {
    let fail = true;
    const logged = [];
    const handler = createServerlessHandler({
      loadConfig: () => {
        if (fail) throw new Error('configuration incomplete: MONGODB_URI');
        return testConfig();
      },
      connect: async () => {},
      buildApp: () => h.app,
      log: (message) => logged.push(message),
    });
    const server = serve(handler);
    const down = await server.get('/api/v1/health');
    expect(down.status).toBe(503);
    expect(down.headers['retry-after']).toBe('5');
    expect(JSON.stringify(down.body)).not.toMatch(/stack|mongodb:\/\/|MONGODB_URI/);
    expect(down.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(logged[0]).toMatch(/configuration incomplete/);

    fail = false;
    expect((await server.get('/api/v1/health')).status).toBe(200);
  });

  it('retries the database connection after a failed start', async () => {
    let attempts = 0;
    const handler = createServerlessHandler({
      loadConfig: () => testConfig(),
      connect: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('server selection timed out');
      },
      buildApp: () => h.app,
    });
    const server = serve(handler);
    expect((await server.get('/api/v1/health')).status).toBe(503);
    expect((await server.get('/api/v1/health')).status).toBe(200);
    expect(attempts).toBe(2);
  });
});
