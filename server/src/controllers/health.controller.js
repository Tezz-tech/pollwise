/**
 * Liveness check for the host and for uptime monitors. Deliberately does not touch the database so a
 * slow Atlas connection cannot make the process look dead.
 * @type {import('express').RequestHandler}
 */
export function getHealth(_req, res) {
  res.json({
    data: {
      status: 'ok',
      uptimeSec: Math.round(process.uptime()),
    },
  });
}
