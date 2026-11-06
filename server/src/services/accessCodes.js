/**
 * Access codes are organisation-issued shared secrets used when registration mode is `access_code`.
 * They are hashed with argon2 like passwords, because people choose them and they may be weak.
 */
import argon2 from 'argon2';
import { ARGON2_OPTIONS } from '../utils/password.js';

/** @param {string} code */
export function hashAccessCode(code) {
  return argon2.hash(code, ARGON2_OPTIONS);
}

/**
 * @param {string} hash
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function argon2Check(hash, code) {
  try {
    return await argon2.verify(hash, code);
  } catch {
    return false;
  }
}
