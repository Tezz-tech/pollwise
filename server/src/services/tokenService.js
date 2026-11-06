/**
 * Access and refresh tokens (SECURITY §1).
 *
 * - Access token: HS256 JWT, 15 minutes, claims { sub, role, tv } where tv is tokenVersion. Bumping
 *   tokenVersion invalidates every access token the user holds.
 * - Refresh token: 32 random bytes, returned once, stored only as SHA-256. Rotated on every use and
 *   grouped in a family. Presenting an already-used token revokes the whole family.
 */
import jwt from 'jsonwebtoken';
import { ERROR_CODES, ROLES } from '@pollwise/shared/constants';
import { RefreshToken } from '../models/RefreshToken.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { randomToken, sha256Hex } from '../utils/crypto.js';
import { addDays, addHours } from '../utils/time.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const LEARNER_REFRESH_DAYS = 30;
const ADMIN_REFRESH_HOURS = 12;

const isAdmin = (role) => role === ROLES.CONTENT_ADMIN || role === ROLES.SUPER_ADMIN;

/**
 * @param {{ config: { JWT_ACCESS_SECRET: string } }} ctx
 * @param {{ _id: unknown, role: string, security: { tokenVersion: number } }} user
 */
export function signAccessToken(ctx, user) {
  return jwt.sign(
    { role: user.role, tv: user.security.tokenVersion },
    ctx.config.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      subject: String(user._id),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    }
  );
}

/**
 * Verify an access token. Throws HttpError so every caller gets the same envelope.
 * @returns {{ sub: string, role: string, tv: number }}
 */
export function verifyAccessToken(ctx, token) {
  try {
    const payload = jwt.verify(token, ctx.config.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    return payload;
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      throw new HttpError(
        401,
        ERROR_CODES.TOKEN_EXPIRED,
        'Your session has expired. Sign in again.'
      );
    }
    throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Please sign in to continue.');
  }
}

/** Refresh lifetime depends on the role: 30 days for learners, 12 hours for admins. */
export function refreshLifetime(ctx, role) {
  const now = ctx.now();
  return isAdmin(role) ? addHours(now, ADMIN_REFRESH_HOURS) : addDays(now, LEARNER_REFRESH_DAYS);
}

/**
 * Create a refresh token. Passing `family` continues an existing family (rotation); omitting it
 * starts a new one (login).
 * @returns {Promise<string>} the raw token, which is never stored
 */
export async function issueRefreshToken(ctx, user, { family, ip, userAgent } = {}) {
  const raw = randomToken(32);
  await RefreshToken.create({
    userId: user._id,
    tokenHash: sha256Hex(raw),
    family: family ?? randomToken(16),
    expiresAt: refreshLifetime(ctx, user.role),
    ip,
    userAgent: userAgent?.slice(0, 300),
  });
  return raw;
}

/**
 * Revoke every token in a family. Used on logout and on reuse detection.
 * @param {string} family
 */
export async function revokeFamily(ctx, family) {
  await RefreshToken.updateMany({ family, revokedAt: null }, { $set: { revokedAt: ctx.now() } });
}

/** Revoke every refresh token the user holds (password change, deactivation, deletion). */
export async function revokeAllForUser(ctx, userId) {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: ctx.now() } });
}

/**
 * Exchange a refresh token for a new one. Atomic: the claim (set revokedAt where it is still unset)
 * happens in one database operation, so two concurrent rotations cannot both succeed.
 *
 * @returns {Promise<{ user: import('mongoose').Document, refreshToken: string, family: string }>}
 */
export async function rotateRefreshToken(ctx, raw, { ip, userAgent } = {}) {
  const tokenHash = sha256Hex(raw);
  const now = ctx.now();

  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: now } },
    { returnDocument: 'before' }
  );

  if (!claimed) {
    const seen = await RefreshToken.findOne({ tokenHash });
    if (seen) {
      // A token that was already rotated or revoked is being presented again: assume theft.
      await revokeFamily(ctx, seen.family);
      ctx.logger.warn({ family: seen.family }, 'refresh token reuse detected; family revoked');
      throw new HttpError(401, ERROR_CODES.TOKEN_REVOKED, 'Your session has ended. Sign in again.');
    }
    throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Your session has ended. Sign in again.');
  }

  if (claimed.expiresAt <= now) {
    throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Your session has ended. Sign in again.');
  }

  const user = await User.findById(claimed.userId);
  if (!user || user.status !== 'active') {
    await revokeFamily(ctx, claimed.family);
    throw new HttpError(401, ERROR_CODES.ACCOUNT_DEACTIVATED, 'This account is not active.');
  }

  const next = await issueRefreshToken(ctx, user, {
    family: claimed.family,
    ip,
    userAgent,
  });
  await RefreshToken.updateOne({ tokenHash }, { $set: { replacedBy: sha256Hex(next) } });
  return { user, refreshToken: next, family: claimed.family };
}
