import { ZodError } from 'zod';
import { ERROR_CODES } from '@pollwise/shared/constants';
import { HttpError } from '../utils/httpError.js';

/**
 * Validate body, params and query with zod at the route boundary (CLAUDE.md rule 3). Unknown keys are
 * stripped by default; schemas built with `.strict()` reject them instead (admin routes).
 *
 * The parsed values go to `req.validated`. Express 5 makes req.query read-only, so they are not
 * written back onto the request.
 *
 * @param {{ body?: import('zod').ZodType, params?: import('zod').ZodType, query?: import('zod').ZodType }} schemas
 * @returns {import('express').RequestHandler}
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      req.validated = {
        body: schemas.body ? schemas.body.parse(req.body ?? {}) : undefined,
        params: schemas.params ? schemas.params.parse(req.params) : undefined,
        query: schemas.query ? schemas.query.parse(req.query) : undefined,
      };
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new HttpError(
            400,
            ERROR_CODES.VALIDATION_FAILED,
            'Some fields are missing or not valid.',
            err.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            }))
          )
        );
        return;
      }
      next(err);
    }
  };
}
