/**
 * Global Mongoose settings (SECURITY §4). Call once before any model or connection is used.
 *
 * - strictQuery: filters on fields that are not in the schema are dropped, not sent to Mongo.
 * - sanitizeFilter: a filter value that is an object with `$` operators is rejected unless it is
 *   wrapped in $eq, which blocks NoSQL operator injection through query strings and bodies.
 *
 * @param {typeof import('mongoose')} mongoose
 * @returns {typeof import('mongoose')}
 */
export function configureMongoose(mongoose) {
  mongoose.set('strictQuery', true);
  mongoose.set('sanitizeFilter', true);
  return mongoose;
}
