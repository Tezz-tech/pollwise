/**
 * Geography reference data (SPEC §5 "Geo"). Seeded by scripts/seed-geo.js, read-only at runtime.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const stateSchema = new Schema({
  code: { type: String, required: true, unique: true, maxlength: 4 },
  name: { type: String, required: true, maxlength: 80 },
});

export const lgaSchema = new Schema({
  code: { type: String, required: true, unique: true, maxlength: 64 },
  stateCode: { type: String, required: true, index: true, maxlength: 4 },
  name: { type: String, required: true, maxlength: 80 },
});

export const State = mongoose.models.State || mongoose.model('State', stateSchema);
export const Lga = mongoose.models.Lga || mongoose.model('Lga', lgaSchema);
