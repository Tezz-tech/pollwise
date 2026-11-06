/**
 * Geography lookups (SPEC §6 /geo). Read-only; the data is loaded by scripts/seed-geo.js.
 */
import { Lga, State } from '../models/index.js';
import { ERROR_CODES } from '@pollwise/shared/constants';
import { HttpError } from '../utils/httpError.js';

export async function listStates() {
  const states = await State.find({}, { _id: 0, code: 1, name: 1 }).sort({ name: 1 }).lean();
  return states;
}

/**
 * @param {string} stateCode
 * @throws {HttpError} NOT_FOUND when the state does not exist
 */
export async function listLgas(stateCode) {
  const exists = await State.exists({ code: stateCode });
  if (!exists) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That state does not exist.');
  }
  return Lga.find({ stateCode }, { _id: 0, code: 1, name: 1 }).sort({ name: 1 }).lean();
}

/**
 * True when the LGA exists and belongs to the state. Used to reject a profile where the LGA is from
 * a different state (SPEC §8: profile validation).
 * @param {string} stateCode
 * @param {string} lgaCode
 */
export async function lgaBelongsToState(stateCode, lgaCode) {
  const [state, lga] = await Promise.all([
    State.exists({ code: stateCode }),
    Lga.findOne({ code: lgaCode }, { stateCode: 1 }).lean(),
  ]);
  return Boolean(state && lga && lga.stateCode === stateCode);
}
