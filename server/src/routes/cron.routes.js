import { Router } from 'express';
import { requireCronSecret } from '../middleware/cronAuth.js';
import { anonymiseDueAccounts } from '../services/userService.js';

/**
 * Scheduled jobs over HTTP. On serverless hosts there is no always-on process to run timers, so the daily account
 * deletion job is a request made by the platform's scheduler (vercel.json "crons"). The same job still runs on a
 * long-lived server through jobs/index.js.
 * @param {object} ctx
 * @param {ReturnType<typeof import('../middleware/rateLimit.js').createRateLimiters>} limiters
 */
export function createCronRouter(ctx, limiters) {
  const router = Router();
  router.get(
    '/internal/cron/anonymise',
    limiters.publicIp,
    requireCronSecret(ctx.config),
    async (_req, res) => {
      const count = await anonymiseDueAccounts(ctx);
      res.json({ data: { anonymised: count } });
    }
  );
  return router;
}
