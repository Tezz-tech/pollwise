import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { createAuthRouter } from './auth.routes.js';
import { createAdminRouter, createMeRouter, createPublicRouter } from './account.routes.js';
import { createLearnerRouter, createVerifyRouter } from './learner.routes.js';

/**
 * Every route lives under /api/v1 (CLAUDE.md conventions).
 * @param {object} ctx service context (config, logger, mailer, clock)
 * @param {ReturnType<typeof import('../middleware/rateLimit.js').createRateLimiters>} limiters
 */
export function createApiRouter(ctx, limiters) {
  const apiRouter = Router();
  apiRouter.use(healthRouter);
  apiRouter.use('/auth', createAuthRouter(ctx, limiters));
  apiRouter.use('/me', createMeRouter(ctx, limiters));
  apiRouter.use('/admin', createAdminRouter(ctx, limiters));
  apiRouter.use(createPublicRouter(ctx, limiters));
  apiRouter.use(createLearnerRouter(ctx, limiters));
  apiRouter.use(createVerifyRouter(ctx, limiters));
  return apiRouter;
}
