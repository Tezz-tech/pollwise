/**
 * Cryptographic helpers (SECURITY §1). Each function has one job so call sites read clearly.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/** SHA-256 hex digest. Used for high-entropy random tokens only, never for human passwords. */
export function sha256Hex(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** URL-safe random token from `bytes` random bytes (32 bytes = 256 bits). */
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

/** Six-digit numeric code for password resets. Uses a CSPRNG and keeps leading zeros. */
export function randomSixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Constant-time string comparison. Lengths are compared first; differing lengths are not equal.
 * @param {string} a
 * @param {string} b
 */
export function safeEqual(a, b) {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * AES-256-GCM encryption for values stored at rest, such as TOTP secrets (SECURITY §1).
 * Output is `iv.tag.ciphertext`, each part base64.
 * @param {Buffer} key 32-byte key
 * @param {string} plaintext
 */
export function encryptAtRest(key, plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64')).join('.');
}

/**
 * Reverse of encryptAtRest. Throws if the value was tampered with or the key is wrong.
 * @param {Buffer} key
 * @param {string} payload
 */
export function decryptAtRest(key, payload) {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
