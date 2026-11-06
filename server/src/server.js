/**
 * Process entry point. Validates the environment first, then starts listening.
 * Unhandled rejections and uncaught exceptions are logged and the process exits so the host can
 * restart it (SECURITY §9).
 */
import { createApp } from './app.js';
import { loadConfigOrExit } from './config/env.js';
import { createLogger } from './utils/logger.js';

const config = loadConfigOrExit();
const logger = createLogger({ level: config.LOG_LEVEL });
const app = createApp({ config, logger });

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'PollWise API listening');
});

function shutdown(reason, err) {
  if (err) logger.error({ err }, reason);
  else logger.info({ reason }, 'shutting down');
  const code = err ? 1 : 0;
  server.close(() => process.exit(code));
  setTimeout(() => process.exit(code), 5000).unref();
}

process.on('unhandledRejection', (err) => shutdown('unhandledRejection', err));
process.on('uncaughtException', (err) => shutdown('uncaughtException', err));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
