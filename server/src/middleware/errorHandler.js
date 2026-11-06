import { ZodError } from 'zod';
import { ERROR_CODES } from '@pollwise/shared/constants';
import { HttpError } from '../utils/httpError.js';

/**
 * Map a zod issue to a client-safe entry. The offending value is deliberately left out so that
 * passwords and tokens never come back in an error body.
 * @param {{ path: PropertyKey[], message: string }} issue
 */
function describeIssue(issue) {
  return { path: issue.path.join('.'), message: issue.message };
}

/**
 * The one place errors become responses (SECURITY §9). Unknown errors return INTERNAL with the
 * request id and no stack trace or internal message.
 * @param {import('pino').Logger} logger
 * @returns {import('express').ErrorRequestHandler}
 */
export function createErrorHandler(logger) {
  // Express only treats a middleware as an error handler when it declares all four parameters.
  return (err, req, res, _next) => {
    if (res.headersSent) return;

    if (err instanceof HttpError) {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined && { details: err.details }),
        },
      });
    }

    if (err instanceof ZodError) {
      return res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Some fields are missing or not valid.',
          details: err.issues.map(describeIssue),
        },
      });
    }

    // Body-parser errors carry their own type strings (malformed JSON, oversized body).
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'The request body is not valid JSON.',
        },
      });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({
        error: { code: ERROR_CODES.PAYLOAD_TOO_LARGE, message: 'The request body is too large.' },
      });
    }

    logger.error({ err, reqId: req.id, method: req.method, path: req.path }, 'unhandled error');
    return res.status(500).json({
      error: {
        code: ERROR_CODES.INTERNAL,
        message: `Something went wrong on our side. Quote request ${req.id} if you contact support.`,
      },
    });
  };
}

/** @type {import('express').RequestHandler} */
export function notFound(req, _res, next) {
  next(new HttpError(404, ERROR_CODES.NOT_FOUND, 'That page or resource does not exist.'));
}
