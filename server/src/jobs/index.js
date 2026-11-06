/**
 * Background jobs. Started by src/server.js only, never by createApp(), so tests stay deterministic.
 */
import { anonymiseDueAccounts } from '../services/userService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Run the deletion job once a day. The timer is unref'd so it never keeps the process alive.
 * @param {{ now: () => Date, logger: import('pino').Logger, config: object, mailer: object }} ctx
 * @returns {() => void} stop function
 */
export function startJobs(ctx) {
  const run = async () => {
    try {
      const count = await anonymiseDueAccounts(ctx);
      if (count > 0) ctx.logger.info({ count }, 'anonymised accounts after deletion grace period');
    } catch (err) {
      ctx.logger.error({ err }, 'account anonymisation job failed');
    }
  };
  run();
  const timer = setInterval(run, DAY_MS);
  timer.unref();
  return () => clearInterval(timer);
}
