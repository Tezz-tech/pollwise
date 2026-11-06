import { Router } from 'express';
import cookieParser from 'cookie-parser';
import { createAuthController } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import {
  acceptInviteBody,
  adminLoginBody,
  challengeBody,
  forgotPasswordBody,
  loginBody,
  logoutBody,
  refreshBody,
  registerBody,
  resetPasswordBody,
  totpBody,
} from '../validation/auth.schemas.js';

/**
 * /api/v1/auth. Rate limits follow SECURITY §5.
 * @param {object} ctx
 * @param {ReturnType<typeof import('../middleware/rateLimit.js').createRateLimiters>} limiters
 */
export function createAuthRouter(ctx, limiters) {
  const c = createAuthController(ctx);
  const router = Router();
  router.use(cookieParser());

  router.post('/register', limiters.register, validate({ body: registerBody }), c.register);
  router.post('/login', limiters.login, validate({ body: loginBody }), c.login);
  router.post('/refresh', limiters.publicIp, validate({ body: refreshBody }), c.refresh);
  router.post('/logout', limiters.publicIp, validate({ body: logoutBody }), c.logout);

  router.post(
    '/forgot-password',
    limiters.resetIp,
    limiters.resetAccount,
    validate({ body: forgotPasswordBody }),
    c.forgotPassword
  );
  router.post(
    '/reset-password',
    limiters.resetIp,
    limiters.resetAccount,
    validate({ body: resetPasswordBody }),
    c.resetPassword
  );

  router.post('/admin/login', limiters.login, validate({ body: adminLoginBody }), c.adminLogin);
  router.post(
    '/admin/totp/setup',
    limiters.login,
    validate({ body: challengeBody }),
    c.adminTotpSetup
  );
  router.post('/admin/totp', limiters.login, validate({ body: totpBody }), c.adminTotp);
  router.post(
    '/admin/accept-invite',
    limiters.resetIp,
    validate({ body: acceptInviteBody }),
    c.acceptInvite
  );

  return router;
}
