/**
 * requireAuth and requireRole (SECURITY §2). Authentication happens on every request, not only at
 * login: the token must match the user's current tokenVersion and the account must still be active.
 */
import { ERROR_CODES, ROLE_VALUES, USER_STATUS } from '@pollwise/shared/constants';
import { User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { verifyAccessToken } from '../services/tokenService.js';

/**
 * @returns {import('express').RequestHandler}
 */
export function requireAuth(ctx) {
  return async (req, _res, next) => {
    try {
      const header = req.get('authorization') ?? '';
      const match = /^Bearer (.+)$/.exec(header);
      if (!match) throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Please sign in to continue.');

      const payload = verifyAccessToken(ctx, match[1]);
      const user = await User.findById(payload.sub, {
        role: 1,
        status: 1,
        'security.tokenVersion': 1,
      }).lean();
      if (!user || user.security.tokenVersion !== payload.tv) {
        throw new HttpError(
          401,
          ERROR_CODES.UNAUTHORIZED,
          'Your session has ended. Sign in again.'
        );
      }
      if (user.status !== USER_STATUS.ACTIVE) {
        throw new HttpError(403, ERROR_CODES.ACCOUNT_DEACTIVATED, 'This account is not active.');
      }

      req.user = { id: String(user._id), role: user.role };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * @param {...string} roles every role allowed through. Roles are not inherited: a route for content
 *   admins must list super_admin too if super admins should pass.
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...roles) {
  for (const role of roles) {
    if (!ROLE_VALUES.includes(role)) throw new TypeError(`requireRole: unknown role "${role}"`);
  }
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new HttpError(403, ERROR_CODES.FORBIDDEN, 'You do not have access to this area.'));
      return;
    }
    next();
  };
}
