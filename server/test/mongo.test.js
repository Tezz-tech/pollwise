import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureMongoose } from '../src/models/mongooseSetup.js';

/**
 * Wiring check for the test stack: a real MongoDB (in memory) that the app can connect to and query.
 * Phase 1 builds the real models and per-route tests on top of this helper.
 */
describe('test database harness', () => {
  let mongod;

  beforeAll(async () => {
    configureMongoose(mongoose);
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: 'pollwise_test' });
  }, 180_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  it('connects and round-trips a document', async () => {
    const Probe = mongoose.model('Probe', new mongoose.Schema({ label: String }));
    const saved = await Probe.create({ label: 'ok' });
    const found = await Probe.findById(saved._id).lean();
    expect(found.label).toBe('ok');
  });

  it('enables sanitizeFilter so an injected $ne operator is refused', async () => {
    // Without sanitizeFilter, {label: {$ne: null}} would match every document. With it, the query is
    // rejected instead of running.
    const Probe = mongoose.model('Probe');
    await expect(Probe.find({ label: { $ne: null } }).lean()).rejects.toThrow(/Cast/);
  });
});
