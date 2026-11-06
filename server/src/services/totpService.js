/**
 * TOTP for admin accounts (SECURITY §1): otplib, 30-second steps, ±1 window, secrets encrypted at rest
 * with AES-256-GCM, and 10 single-use recovery codes shown once.
 */
import { generateSecret, generateURI, verify } from 'otplib';
import { randomBytes } from 'node:crypto';
import { decryptAtRest, encryptAtRest } from '../utils/crypto.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

export const TOTP_ISSUER = 'PollWise';
export const RECOVERY_CODE_COUNT = 10;

/** Crockford base32 (no I, L, O or U) so codes read clearly when typed. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** @returns {string} base32 secret for the authenticator app */
export function newTotpSecret() {
  return generateSecret();
}

/**
 * @param {Buffer} key
 * @param {string} secret
 */
export function encryptSecret(key, secret) {
  return encryptAtRest(key, secret);
}

/**
 * @param {Buffer} key
 * @param {string} payload
 */
export function decryptSecret(key, payload) {
  return decryptAtRest(key, payload);
}

/**
 * @param {{ secret: string, label: string }} args
 * @returns {string} otpauth:// URI the authenticator app imports (usually via QR)
 */
export function totpUri({ secret, label }) {
  return generateURI({ issuer: TOTP_ISSUER, label, secret });
}

/**
 * Check a six-digit code, allowing one 30-second step either side (clock drift).
 * @param {string} secret base32
 * @param {string} code
 * @param {number} [afterTimeStep] reject codes from this step or earlier (replay protection)
 * @returns {Promise<{ valid: boolean, timeStep?: number }>}
 */
export async function checkTotpCode(secret, code, afterTimeStep) {
  if (!/^\d{6}$/.test(code)) return { valid: false };
  const result = await verify({ token: code, secret, epochTolerance: 30, afterTimeStep });
  return { valid: Boolean(result?.valid), timeStep: result?.timeStep };
}

/** @returns {string} one recovery code in the form XXXX-XXXX */
function randomRecoveryCode() {
  const bytes = randomBytes(8);
  let chars = '';
  for (const byte of bytes) chars += CROCKFORD[byte % CROCKFORD.length];
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

/**
 * Create recovery codes. The plain codes go to the user once; only argon2 hashes are stored.
 * @returns {Promise<{ plain: string[], hashes: string[] }>}
 */
export async function createRecoveryCodes() {
  const plain = Array.from({ length: RECOVERY_CODE_COUNT }, randomRecoveryCode);
  const hashes = [];
  for (const code of plain) hashes.push(await hashPassword(code));
  return { plain, hashes };
}

/**
 * Find and consume a matching recovery code.
 * @param {string[]} hashes
 * @param {string} code
 * @returns {Promise<number>} index of the matched hash, or -1
 */
export async function matchRecoveryCode(hashes, code) {
  for (let i = 0; i < hashes.length; i += 1) {
    if (await verifyPassword(hashes[i], code)) return i;
  }
  return -1;
}

export const RECOVERY_CODE_PATTERN = /^[0-9A-Z]{4}-[0-9A-Z]{4}$/;
