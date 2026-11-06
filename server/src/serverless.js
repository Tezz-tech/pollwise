/**
 * Request handler for serverless hosts (Vercel). Each warm instance connects to MongoDB once and reuses the Express
 * app; a cold instance does the work on its first request. Nothing here listens on a port, starts a timer or exits the
 * process, because a serverless function must return. Failures answer with a generic JSON error (SECURITY §8): the
 * configuration variable names may be logged, their values never are.
 */
const STARTING = 'The service is starting. Try again in a moment.';
const UPSTREAM_UNAVAILABLE = 'UPSTREAM_UNAVAILABLE';

/**
 * @param {{
 *   loadConfig: () => object | Promise<object>,
 *   connect: (uri: string) => Promise<unknown>,
 *   buildApp: (deps: { config: object }) => import('express').Express | Promise<import('express').Express>,
 *   log?: (message: string) => void,
 * }} deps
 */
export function createServerlessHandler({ loadConfig, connect, buildApp, log = () => {} }) {
  let ready = null;

  /** One start-up per instance. A failed start is forgotten, so the next request tries again. */
  function start() {
    if (!ready) {
      ready = (async () => {
        const config = await loadConfig();
        await connect(config.MONGODB_URI);
        return buildApp({ config });
      })();
      ready.catch((err) => {
        // The first lines of the stack name the file that failed. They hold no configuration values.
        const where = (err?.stack ?? String(err)).split('\n').slice(0, 4).join(' | ');
        log(`start-up failed: ${where}`);
        ready = null;
      });
    }
    return ready;
  }

  return async function handler(req, res) {
    let app;
    try {
      app = await start();
    } catch {
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('retry-after', '5');
      res.end(JSON.stringify({ error: { code: UPSTREAM_UNAVAILABLE, message: STARTING } }));
      return undefined;
    }
    return app(req, res);
  };
}
