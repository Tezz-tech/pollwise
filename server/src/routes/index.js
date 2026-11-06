import { Router } from 'express';
import { healthRouter } from './health.routes.js';

/** Every route lives under /api/v1 (CLAUDE.md conventions). */
export const apiRouter = Router();

apiRouter.use(healthRouter);
