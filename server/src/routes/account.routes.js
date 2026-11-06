import { Router } from 'express';
import { ROLES } from '@pollwise/shared/constants';
import { createAccountController } from '../controllers/account.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createContentRoutes } from './content.routes.js';
import { createSuperRoutes } from './super.routes.js';
import { createLearnerController } from '../controllers/learner.controller.js';
import { validate } from '../middleware/validate.js';
import {
  updateMeBody,
  updateProfileBody,
  inviteAdminBody,
  stateCodeParams,
} from '../validation/account.schemas.js';

/**
 * Authenticated learner and self routes: /api/v1/me.
 */
export function createMeRouter(ctx, limiters) {
  const c = createAccountController(ctx);
  const router = Router();
  router.use(requireAuth(ctx), limiters.authed);

  router.get('/', c.getMe);
  router.patch('/', validate({ body: updateMeBody }), c.updateMe);
  router.patch('/profile', validate({ body: updateProfileBody }), c.updateProfile);
  router.delete('/', c.requestDeletion);
  const learner = createLearnerController(ctx);
  router.get('/stats', learner.myStats);
  router.get('/certificates', learner.myCertificates);
  return router;
}

/**
 * /api/v1/admin. Every route needs a signed-in admin; each one then checks its role.
 */
export function createAdminRouter(ctx, limiters) {
  const c = createAccountController(ctx);
  const router = Router();
  router.use(requireAuth(ctx), limiters.authed);

  router.get('/session', requireRole(ROLES.CONTENT_ADMIN, ROLES.SUPER_ADMIN), c.adminSession);
  router.post(
    '/admins',
    requireRole(ROLES.SUPER_ADMIN),
    validate({ body: inviteAdminBody }),
    c.inviteAdmin
  );
  // Content routes share this router's session check and rate limit, so each request is counted once.
  router.use(createContentRoutes(ctx));
  router.use(createSuperRoutes(ctx));
  return router;
}

/**
 * Public read routes: geo and settings (SPEC §6).
 */
export function createPublicRouter(ctx, limiters) {
  const c = createAccountController(ctx);
  const router = Router();
  router.get('/geo/states', limiters.publicIp, c.listStates);
  router.get(
    '/geo/states/:stateCode/lgas',
    limiters.publicIp,
    validate({ params: stateCodeParams }),
    c.listLgas
  );
  router.get('/settings/public', limiters.publicIp, c.publicSettings);
  return router;
}
