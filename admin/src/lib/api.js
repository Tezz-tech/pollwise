/**
 * API client for the admin site (SECURITY §1). The access token lives only in memory. The refresh token
 * is an httpOnly cookie that the browser sends by itself; refresh and logout also need the CSRF value
 * from the pw_csrf cookie, echoed in the X-CSRF-Token header. The admin site and the API share an origin
 * through the dev proxy (and a reverse proxy in production), so that cookie is readable here.
 */

const BASE = '/api/v1';
const CSRF_COOKIE = 'pw_csrf';

/** @type {string | null} */
let accessToken = null;
/** @type {Set<() => void>} */
const listeners = new Set();

export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {Array<{ path: string, message: string }> | undefined} details
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
  listeners.forEach((fn) => fn());
}

/** Subscribe to token changes (the auth context uses this to re-render). */
export function onTokenChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function csrfToken() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

let refreshing = null;

/**
 * Exchange the refresh cookie for a new access token. Concurrent callers share one request.
 * @returns {Promise<boolean>} true when a new token was obtained
 */
export function silentRefresh() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: '{}',
    })
      .then(async (res) => {
        if (!res.ok) {
          setAccessToken(null);
          return false;
        }
        const body = await res.json();
        setAccessToken(body.data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/**
 * Call the API. Adds the bearer token, retries once after a silent refresh if the token has expired,
 * and turns error envelopes into ApiError.
 * @param {string} path path under /api/v1, starting with /
 * @param {{ method?: string, body?: unknown, query?: Record<string, string | number | undefined>, raw?: boolean, signal?: AbortSignal }} [options]
 */
export async function api(path, options = {}) {
  const { method = 'GET', body, query, raw = false, signal } = options;
  const url = new URL(`${BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value));
  }

  const send = () =>
    fetch(url, {
      method,
      credentials: 'same-origin',
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await send();
  if (res.status === 401 && path !== '/auth/refresh' && (await silentRefresh())) {
    res = await send();
  }
  if (raw) return res;

  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? 'INTERNAL',
      err.message ?? 'Something went wrong. Try again.',
      err.details
    );
  }
  return json.data;
}

/** Errors on a single field, keyed by its path, for inline validation messages. */
export function fieldErrors(err) {
  const map = {};
  for (const d of err?.details ?? []) if (d.path && !map[d.path]) map[d.path] = d.message;
  return map;
}
