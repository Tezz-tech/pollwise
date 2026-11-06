/**
 * Rate limits (SECURITY §5). Limits come in as an argument so tests can lower them; production uses
 * DEFAULT_RATE_LIMITS. Each limiter is created per app instance, so counters never leak between apps.
 */
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { ERROR_CODES } from '@pollwise/shared/constants';
import { sha256Hex } from '../utils/crypto.js';

const MINUTE = 60_000;

export const DEFAULT_RATE_LIMITS = Object.freeze({
  /** POST /auth/login, /auth/admin/login, /auth/admin/totp, /auth/admin/totp/setup */
  login: { limit: 10, windowMs: 15 * MINUTE },
  /** POST /auth/register */
  register: { limit: 5, windowMs: 60 * MINUTE },
  /** POST /auth/forgot-password and /auth/reset-password, per IP */
  resetIp: { limit: 5, windowMs: 60 * MINUTE },
  /** Same two routes, per account identifier */
  resetAccount: { limit: 3, windowMs: 60 * MINUTE },
  /** Unauthenticated read routes (geo, settings) and refresh/logout, per IP */
  publicIp: { limit: 100, windowMs: 15 * MINUTE },
  /** Every authenticated route, per user */
  authed: { limit: 300, windowMs: 15 * MINUTE },
});

/** Answer 429 in the standard envelope with a Retry-After header (SECURITY §5). */
function tooMany(req, res, _next, options) {
  const resetAt = req.rateLimit?.resetTime?.getTime() ?? Date.now() + options.windowMs;
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  res.set('Retry-After', String(retryAfter));
  res.status(429).json({
    error: {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many attempts. Wait a little while and try again.',
    },
  });
}

/**
 * @param {typeof DEFAULT_RATE_LIMITS} [overrides]
 */
export function createRateLimiters(overrides = {}) {
  const limits = { ...DEFAULT_RATE_LIMITS, ...overrides };
  const make = ({ limit, windowMs }, keyGenerator) =>
    rateLimit({
      limit,
      windowMs,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      keyGenerator,
      handler: tooMany,
    });

  const byIp = (req) => ipKeyGenerator(req.ip ?? '');
  const byUser = (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? '');
  const byAccount = (req) => {
    const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier : '';
    return `acct:${sha256Hex(identifier.trim().toLowerCase())}`;
  };

  return {
    login: make(limits.login, byIp),
    register: make(limits.register, byIp),
    resetIp: make(limits.resetIp, byIp),
    resetAccount: make(limits.resetAccount, byAccount),
    publicIp: make(limits.publicIp, byIp),
    authed: make(limits.authed, byUser),
  };
}
