/**
 * Express application factory. Takes its config and logger as arguments so tests can build the app
 * without touching process.env or the real console (CLAUDE.md: routes → controllers → services →
 * models).
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { requestId } from './middleware/requestId.js';
import { createErrorHandler, notFound } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

/**
 * @param {{
 *   config: { ADMIN_ORIGIN: string[], TRUST_PROXY_HOPS: number },
 *   logger: import('pino').Logger,
 * }} deps
 * @returns {import('express').Express}
 */
export function createApp({ config, logger }) {
  const app = express();

  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => req.id }));
  app.use(helmet());
  app.use(
    cors({
      origin: config.ADMIN_ORIGIN.length > 0 ? config.ADMIN_ORIGIN : false,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '200kb' }));

  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(createErrorHandler(logger));

  return app;
}
