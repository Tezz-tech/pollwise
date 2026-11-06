/**
 * Authentication for the scheduled job endpoint (SECURITY §2). Vercel Cron calls it with
 * `Authorization: Bearer <CRON_SECRET>`. The comparison is constant-time on fixed-length digests, and an unset secret
 * refuses everyone.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { ERROR_CODES } from '@pollwise/shared/constants';
import { HttpError } from '../utils/httpError.js';

const digest = (value) => createHash('sha256').update(value).digest();

/** @param {{ CRON_SECRET?: string }} config @returns {import('express').RequestHandler} */
export function requireCronSecret(config) {
  return (req, _res, next) => {
    const expected = config.CRON_SECRET;
    const header = req.get('authorization') ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    const ok =
      Boolean(expected) && given.length > 0 && timingSafeEqual(digest(given), digest(expected));
    if (!ok) {
      next(new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Please sign in to continue.'));
      return;
    }
    next();
  };
}
