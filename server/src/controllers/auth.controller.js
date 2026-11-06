/**
 * /auth controllers. Thin: validation has run, services do the work, this file only shapes the HTTP
 * response and decides how the refresh token is delivered.
 *
 * Learners receive their refresh token in the JSON body (the app keeps it in expo-secure-store).
 * Admins receive it in an httpOnly cookie scoped to /api/v1/auth, plus a CSRF cookie that refresh and
 * logout require to be echoed in the X-CSRF-Token header (SECURITY §1, double-submit).
 */
import { ERROR_CODES, ROLES } from '@pollwise/shared/constants';
import * as auth from '../services/authService.js';
import { randomToken, safeEqual } from '../utils/crypto.js';
import { HttpError } from '../utils/httpError.js';

export const ADMIN_REFRESH_COOKIE = 'pw_admin_refresh';
export const CSRF_COOKIE = 'pw_csrf';
export const CSRF_HEADER = 'x-csrf-token';
const COOKIE_PATH = '/api/v1/auth';
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const isAdmin = (role) => role === ROLES.CONTENT_ADMIN || role === ROLES.SUPER_ADMIN;

/** @param {import('express').Request} req */
function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') ?? undefined };
}

/** Set the admin refresh cookie and a fresh CSRF pair. */
function setAdminCookies(res, refreshToken) {
  const base = { secure: true, sameSite: 'strict', path: COOKIE_PATH, maxAge: TWELVE_HOURS_MS };
  res.cookie(ADMIN_REFRESH_COOKIE, refreshToken, { ...base, httpOnly: true });
  // The CSRF cookie is readable by the admin page on every route, so it is scoped to /. A browser only exposes a
  // cookie to document.cookie when the page path matches the cookie path; scoped to /api/v1/auth it was invisible
  // after a reload, which logged the admin out. The value is not a secret: the header must match it (SECURITY §1).
  // Clear the CSRF cookie left by earlier builds at the old path, so only one value is ever sent.
  res.clearCookie(CSRF_COOKIE, {
    secure: true,
    sameSite: 'strict',
    path: COOKIE_PATH,
    httpOnly: false,
  });
  res.cookie(CSRF_COOKIE, randomToken(24), { ...base, path: '/', httpOnly: false });
}

function clearAdminCookies(res) {
  const base = { secure: true, sameSite: 'strict', path: COOKIE_PATH };
  res.clearCookie(ADMIN_REFRESH_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { secure: true, sameSite: 'strict', path: '/', httpOnly: false });
}

/**
 * Cookie-borne refresh requires the CSRF header to match the CSRF cookie (SECURITY §1).
 * @param {import('express').Request} req
 */
function requireCsrf(req) {
  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get(CSRF_HEADER);
  if (!cookie || !header || !safeEqual(cookie, header)) {
    throw new HttpError(
      403,
      ERROR_CODES.FORBIDDEN,
      'This request could not be verified. Sign in again.'
    );
  }
}

/** Shape a session for the response, moving the refresh token into a cookie for admins. */
function deliverSession(res, session) {
  if (isAdmin(session.user.role)) {
    setAdminCookies(res, session.refreshToken);
    const { refreshToken: _omit, ...body } = session;
    return body;
  }
  return session;
}

export function createAuthController(ctx) {
  return {
    async register(req, res) {
      const session = await auth.registerLearner(ctx, req.validated.body, requestMeta(req));
      res.status(201).json({ data: deliverSession(res, session) });
    },

    async login(req, res) {
      const session = await auth.loginLearner(ctx, req.validated.body, requestMeta(req));
      res.json({ data: deliverSession(res, session) });
    },

    async refresh(req, res) {
      const bodyToken = req.validated.body.refreshToken;
      const cookieToken = req.cookies?.[ADMIN_REFRESH_COOKIE];

      let raw = bodyToken;
      if (!raw && cookieToken) {
        requireCsrf(req);
        raw = cookieToken;
      }
      if (!raw) {
        throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Please sign in to continue.');
      }

      const session = await auth.refreshSession(ctx, raw, requestMeta(req));
      res.json({ data: deliverSession(res, session) });
    },

    async logout(req, res) {
      const bodyToken = req.validated.body.refreshToken;
      const cookieToken = req.cookies?.[ADMIN_REFRESH_COOKIE];
      if (!bodyToken && cookieToken) requireCsrf(req);
      const raw = bodyToken ?? cookieToken;
      if (raw) await auth.logout(ctx, raw);
      clearAdminCookies(res);
      res.json({ data: { loggedOut: true } });
    },

    async forgotPassword(req, res) {
      const result = await auth.forgotPassword(ctx, req.validated.body);
      res.json({ data: result });
    },

    async resetPassword(req, res) {
      const result = await auth.resetPassword(ctx, req.validated.body);
      res.json({ data: result });
    },

    async adminLogin(req, res) {
      const result = await auth.adminLogin(ctx, req.validated.body, requestMeta(req));
      if (result.needsTotp) {
        res.json({
          data: {
            needsTotp: true,
            totpSetupRequired: result.totpSetupRequired,
            challengeToken: result.challengeToken,
          },
        });
        return;
      }
      res.json({ data: deliverSession(res, result) });
    },

    async adminTotpSetup(req, res) {
      const result = await auth.adminTotpSetup(ctx, req.validated.body);
      res.json({ data: result });
    },

    async adminTotp(req, res) {
      const session = await auth.adminTotp(ctx, req.validated.body, requestMeta(req));
      res.json({ data: deliverSession(res, session) });
    },

    async acceptInvite(req, res) {
      const result = await auth.acceptInvite(ctx, req.validated.body, requestMeta(req));
      res.json({ data: result });
    },
  };
}
