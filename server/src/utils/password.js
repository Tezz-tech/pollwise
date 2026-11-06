/**
 * Password hashing and policy (SECURITY §1).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';

/** OWASP baseline for argon2id (SECURITY §1). */
export const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

let commonPasswords;
/** The 10,000 most common passwords, loaded once. SECURITY §1 requires rejecting them. */
function loadCommonPasswords() {
  if (!commonPasswords) {
    const path = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      'data',
      'common-passwords.txt'
    );
    commonPasswords = new Set(
      readFileSync(path, 'utf8')
        .split('\n')
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean)
    );
  }
  return commonPasswords;
}

/**
 * @param {string} password
 * @returns {Promise<string>} argon2id encoded hash
 */
export function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * @param {string} hash
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // A malformed stored hash must count as a failed login, never a crash.
    return false;
  }
}

/**
 * Length rules and the common-password list. No composition rules beyond length (SECURITY §1).
 * @param {string} password
 * @returns {string | null} the reason it is refused, or null when it is acceptable
 */
export function passwordProblem(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Use no more than ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (loadCommonPasswords().has(password.toLowerCase())) {
    return 'That password is too common. Choose a less predictable one.';
  }
  return null;
}
