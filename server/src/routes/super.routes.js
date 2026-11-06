import { Router } from 'express';
import { ROLES } from '@pollwise/shared/constants';
import { createSuperController } from '../controllers/super.controller.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  accessCodeBody,
  accessCodeParams,
  accessCodeStatusBody,
  adminIdParams,
  auditQuery,
  grantBody,
  reportQuery,
  settingsBody,
  userExportQuery,
  userListQuery,
  userParams,
  userStatusBody,
} from '../validation/super.schemas.js';

const SUPER = [ROLES.SUPER_ADMIN];

/**
 * Super admin routes (SPEC §6). Mounted inside the admin router, which has already checked the session
 * and the rate limit. Every route here is super-admin only, so a content admin gets 403 on each one.
 * @param {object} ctx
 */
export function createSuperRoutes(ctx) {
  const c = createSuperController(ctx);
  const router = Router();
  const only = requireRole(...SUPER);

  // Learners
  router.get('/users', only, validate({ query: userListQuery }), c.listUsers);
  // Declared before /users/:id so "export.csv" is never read as an id.
  router.get('/users/export.csv', only, validate({ query: userExportQuery }), c.exportUsers);
  router.get('/users/:id', only, validate({ params: userParams }), c.userDetail);
  router.patch(
    '/users/:id/status',
    only,
    validate({ params: userParams, body: userStatusBody }),
    c.setUserStatus
  );
  router.post('/users/:id/reset', only, validate({ params: userParams }), c.sendReset);
  router.post(
    '/users/:id/attempts',
    only,
    validate({ params: userParams, body: grantBody }),
    c.grantAttempt
  );

  // Reports
  router.get('/reports/overview', only, c.overview);
  router.get('/reports/courses', only, c.courseReport);
  router.get('/reports/geography', only, validate({ query: reportQuery }), c.geographyReport);

  // Admins
  router.get('/admins', only, c.listAdmins);
  router.delete('/admins/:id', only, validate({ params: adminIdParams }), c.revokeAdmin);

  // Settings and access codes
  router.get('/settings', only, c.getSettings);
  router.patch('/settings', only, validate({ body: settingsBody }), c.updateSettings);
  router.post('/settings/access-codes', only, validate({ body: accessCodeBody }), c.addAccessCode);
  router.patch(
    '/settings/access-codes/:codeId',
    only,
    validate({ params: accessCodeParams, body: accessCodeStatusBody }),
    c.setAccessCode
  );

  // Audit log (read only)
  router.get('/audit-logs', only, validate({ query: auditQuery }), c.auditLog);

  return router;
}
