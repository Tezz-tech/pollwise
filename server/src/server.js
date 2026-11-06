/**
 * Process entry point. Validates the environment, connects to MongoDB, starts the jobs and listens.
 * Unhandled rejections and uncaught exceptions are logged and the process exits so the host can
 * restart it (SECURITY §9).
 */
import { createApp } from './app.js';
import { loadConfigOrExit } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { startJobs } from './jobs/index.js';
import { createMailer } from './services/mailService.js';
import { createLogger } from './utils/logger.js';

const config = loadConfigOrExit();
const logger = createLogger({ level: config.LOG_LEVEL });

await connectDatabase(config.MONGODB_URI);
logger.info('database connected');

const now = () => new Date();
const mailer = createMailer(config, logger);
const app = createApp({ config, logger, mailer, now });
const stopJobs = startJobs({ config, logger, mailer, now });

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'PollWise API listening');
});

let stopping = false;
async function shutdown(reason, err) {
  if (stopping) return;
  stopping = true;
  if (err) logger.error({ err }, reason);
  else logger.info({ reason }, 'shutting down');
  stopJobs();
  const code = err ? 1 : 0;
  server.close();
  await disconnectDatabase().catch(() => {});
  process.exit(code);
}

process.on('unhandledRejection', (err) => shutdown('unhandledRejection', err));
process.on('uncaughtException', (err) => shutdown('uncaughtException', err));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
