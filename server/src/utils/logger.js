/**
 * Structured logging with pino (SECURITY §8, §9).
 *
 * Redaction paths are the ones SECURITY §8 lists. They are a safety net, not a licence: code must
 * still avoid logging secrets, tokens, passwords, reset codes and TOTP codes in the first place.
 * Logs carry user IDs, never names, emails or phone numbers (SECURITY §9).
 */
import pino from 'pino';

export const REDACT_PATHS = Object.freeze([
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.code',
  '*.token',
  '*.refreshToken',
]);

/**
 * @param {{ level?: string, destination?: NodeJS.WritableStream }} [options]
 * @returns {import('pino').Logger}
 */
export function createLogger({ level = 'info', destination } = {}) {
  const options = {
    level,
    base: undefined,
    redact: { paths: [...REDACT_PATHS], censor: '[REDACTED]' },
  };
  return destination ? pino(options, destination) : pino(options);
}
