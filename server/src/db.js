/**
 * MongoDB connection (SECURITY §4, §11). Global Mongoose settings are applied before any model is used.
 */
import mongoose from 'mongoose';
import { configureMongoose } from './models/mongooseSetup.js';

/**
 * @param {string} uri
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDatabase(uri) {
  configureMongoose(mongoose);
  await mongoose.connect(uri, { autoIndex: true });
  return mongoose;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
