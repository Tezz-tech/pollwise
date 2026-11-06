/**
 * MongoDB connection (SECURITY §4, §11). Global Mongoose settings are applied before any model is used.
 */
import mongoose from 'mongoose';
import { configureMongoose } from './models/mongooseSetup.js';

/**
 * @param {string} uri
 * @returns {Promise<typeof mongoose>}
 */
/**
 * @param {string} uri
 * @param {{ maxPoolSize?: number }} [options] serverless hosts keep the pool small: each warm instance holds its own
 */
export async function connectDatabase(uri, options = {}) {
  configureMongoose(mongoose);
  await mongoose.connect(uri, {
    autoIndex: true,
    maxPoolSize: options.maxPoolSize ?? 10,
    serverSelectionTimeoutMS: 8000,
  });
  return mongoose;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
