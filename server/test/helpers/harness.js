/**
 * Shared test harness: an in-memory MongoDB, a fixed clock, a capturing mailer and a built app.
 * Each test file calls startHarness() in beforeAll and stopHarness() in afterAll.
 */
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { loadEnv } from '../../src/config/env.js';
import { configureMongoose } from '../../src/models/mongooseSetup.js';
import { createLogger } from '../../src/utils/logger.js';

// Start at the real current time: TOTP codes are checked against the real clock, so the fake clock must
// agree with it at the start of each test.
export const START_TIME = new Date();

/** A valid, strong configuration for tests. Secrets are random on every run. */
export function testConfig(overrides = {}) {
  const outcome = loadEnv({
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/pollwise_unit',
    JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
    TOTP_ENC_KEY: randomBytes(32).toString('base64'),
    ADMIN_ORIGIN: 'http://localhost:5173',
    ADMIN_PUBLIC_URL: 'http://localhost:5173',
    ...overrides,
  });
  if (!outcome.ok) throw new Error(`test config invalid: ${outcome.problems.join('; ')}`);
  return outcome.env;
}

/** Records every message instead of sending it. */
export function captureMailer() {
  const sent = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
    /** The six-digit code from the most recent reset email. */
    lastResetCode() {
      const latest = [...sent].reverse().find((m) => m.subject.includes('reset code'));
      const match = latest?.text.match(/code is (\d{6})/);
      return match?.[1];
    },
    /** The invitation link from the most recent invite email. */
    lastInviteLink() {
      const latest = [...sent].reverse().find((m) => m.subject.includes('invited'));
      return latest?.text.match(/(http\S+accept-invite\S+)/)?.[1];
    },
  };
}

let mongod;

/**
 * @param {{ rateLimits?: object }} [options] lower limits only in tests that exercise them
 */
export async function startHarness({ rateLimits = {} } = {}) {
  configureMongoose(mongoose);
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'pollwise_unit' });
  await mongoose.connection.syncIndexes?.();

  const clock = { now: new Date(START_TIME) };
  const mailer = captureMailer();
  const config = testConfig();
  // Generous limits by default so unrelated tests do not trip them.
  const generous = Object.fromEntries(
    ['login', 'register', 'resetIp', 'resetAccount', 'publicIp', 'authed'].map((k) => [
      k,
      { limit: 100000, windowMs: 60_000 },
    ])
  );
  const app = createApp({
    config,
    logger: createLogger({ level: process.env.TEST_LOG_LEVEL ?? 'silent' }),
    mailer,
    now: () => new Date(clock.now),
    rateLimits: { ...generous, ...rateLimits },
  });

  return { app, config, clock, mailer, api: request(app) };
}

export async function stopHarness() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

/** Delete every document from every collection, keeping indexes. Call in afterEach. */
export async function resetData() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

/** Advance the fake clock by minutes or hours. */
export function advance(clock, { minutes = 0, hours = 0, days = 0 } = {}) {
  clock.now = new Date(clock.now.getTime() + (minutes + hours * 60 + days * 1440) * 60_000);
}
