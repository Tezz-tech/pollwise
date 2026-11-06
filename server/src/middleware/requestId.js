import { randomUUID } from 'node:crypto';

const VALID_INCOMING_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Give every request an id and echo it back in `x-request-id` (SECURITY §9). A client-supplied id is
 * accepted only when it is a short, safe token, so it cannot inject log lines.
 * @type {import('express').RequestHandler}
 */
export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && VALID_INCOMING_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
