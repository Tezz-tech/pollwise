/**
 * Vercel entry point for the API. vercel.json routes every request here.
 *
 * Only the handler is imported up front. The application and its modules load inside the handler's start-up, so a
 * failure there is caught, written to the function logs with its stack, and answered with a 503. Configuration is read
 * from the platform's environment variables; a missing or weak value is reported by name only.
 */
import { createServerlessHandler } from '../src/serverless.js';

export default createServerlessHandler({
  loadConfig: async () => {
    const { loadEnv, loadDotEnvFile } = await import('../src/config/env.js');
    loadDotEnvFile();
    const outcome = loadEnv(process.env);
    if (!outcome.ok) {
      const names = outcome.problems.map((problem) => problem.split(':')[0]);
      throw new Error(`configuration incomplete: ${names.join(', ')}`);
    }
    return outcome.env;
  },
  connect: async (uri) => {
    const { connectDatabase } = await import('../src/db.js');
    return connectDatabase(uri, { maxPoolSize: 5 });
  },
  buildApp: async ({ config }) => {
    const [{ createApp }, { createMailer }, { createLogger }] = await Promise.all([
      import('../src/app.js'),
      import('../src/services/mailService.js'),
      import('../src/utils/logger.js'),
    ]);
    const logger = createLogger({ level: config.LOG_LEVEL });
    const mailer = createMailer(config, logger);
    return createApp({ config, logger, mailer, now: () => new Date() });
  },
  log: (message) => console.error(JSON.stringify({ level: 'error', message })),
});
