/**
 * Vercel entry point for the API. vercel.json routes every request here. Configuration is read from the platform's
 * environment variables, and a missing or weak value is reported by name only.
 */
import { createApp } from '../src/app.js';
import { loadEnv, loadDotEnvFile } from '../src/config/env.js';
import { connectDatabase } from '../src/db.js';
import { createMailer } from '../src/services/mailService.js';
import { createLogger } from '../src/utils/logger.js';
import { createServerlessHandler } from '../src/serverless.js';

let logger = null;

export default createServerlessHandler({
  loadConfig: () => {
    loadDotEnvFile();
    const outcome = loadEnv(process.env);
    if (!outcome.ok) {
      const names = outcome.problems.map((problem) => problem.split(':')[0]);
      throw new Error(`configuration incomplete: ${names.join(', ')}`);
    }
    return outcome.env;
  },
  connect: (uri) => connectDatabase(uri, { maxPoolSize: 5 }),
  buildApp: ({ config }) => {
    logger ??= createLogger({ level: config.LOG_LEVEL });
    const mailer = createMailer(config, logger);
    return createApp({ config, logger, mailer, now: () => new Date() });
  },
  log: (message) => console.error(JSON.stringify({ level: 'error', message })),
});
