/**
 * Express application factory. Everything the app needs (config, logger, mailer, clock, rate limits)
 * comes in as an argument, so tests can build the app with fakes and never read process.env.
 * Layering: routes → controllers → services → models (CLAUDE.md conventions).
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { requestId } from './middleware/requestId.js';
import { createErrorHandler, notFound } from './middleware/errorHandler.js';
import { createRateLimiters } from './middleware/rateLimit.js';
import { createMailer } from './services/mailService.js';
import { createApiRouter } from './routes/index.js';

/**
 * @param {{
 *   config: { ADMIN_ORIGIN: string[], TRUST_PROXY_HOPS: number, TOTP_ENC_KEY: string,
 *             JWT_ACCESS_SECRET: string, ADMIN_PUBLIC_URL: string, SMTP_HOST?: string,
 *             SMTP_PORT: number, SMTP_USER?: string, SMTP_PASS?: string, MAIL_FROM?: string },
 *   logger: import('pino').Logger,
 *   mailer?: { send: (message: { to: string, subject: string, text: string }) => Promise<void> },
 *   now?: () => Date,
 *   rateLimits?: Partial<import('./middleware/rateLimit.js').DEFAULT_RATE_LIMITS>,
 * }} deps
 * @returns {import('express').Express}
 */
export function createApp({ config, logger, mailer, now = () => new Date(), rateLimits = {} }) {
  const ctx = {
    config,
    logger,
    now,
    mailer: mailer ?? createMailer(config, logger),
    totpKey: Buffer.from(config.TOTP_ENC_KEY, 'base64'),
  };
  const limiters = createRateLimiters(rateLimits);

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

  app.use('/api/v1', createApiRouter(ctx, limiters));

  app.use(notFound);
  app.use(createErrorHandler(logger));

  return app;
}
