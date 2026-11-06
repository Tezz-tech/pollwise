/**
 * Authentication for the certificate PDF (SECURITY §2). Two ways in:
 *
 * - a normal bearer token, as every other learner route uses; or
 * - a short-lived download link (?download=…), for the browser, which cannot send a bearer header.
 *
 * The link is bound to one certificate and one owner and lasts two minutes (tokenService). The account must still
 * be active when the PDF is served.
 */
import { ERROR_CODES, USER_STATUS } from '@pollwise/shared/constants';
import { User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { verifyCertificateDownload } from '../services/tokenService.js';
import { requireAuth } from './auth.js';

/** @returns {import('express').RequestHandler} */
export function certificateAuth(ctx) {
  const bearer = requireAuth(ctx);
  return async (req, res, next) => {
    if (typeof req.query?.download !== 'string') return bearer(req, res, next);
    try {
      const claims = verifyCertificateDownload(ctx, req.query.download, req.params.id);
      const user = await User.findById(claims.userId, { status: 1 }).lean();
      if (!user) throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Please sign in to continue.');
      if (user.status !== USER_STATUS.ACTIVE) {
        throw new HttpError(403, ERROR_CODES.ACCOUNT_DEACTIVATED, 'This account is not active.');
      }
      req.user = { id: claims.userId, role: 'learner' };
      next();
    } catch (err) {
      next(err);
    }
  };
}
