/**
 * Fetch wrapper for the learner API (SPEC §6). It adds the access token, refreshes it once when the server
 * says it has expired, and retries the original request once. Failures come back as ApiError carrying the
 * server's stable code, so screens can show friendly copy (errors.js) instead of raw messages.
 *
 * The client takes its token store and fetch as arguments, so it can be tested without React Native.
 */
import { friendlyMessage } from './errors.js';

/** Code used for "no response at all" (offline, DNS, timeout). Not a server code. */
export const NETWORK_CODE = 'NETWORK';

export class ApiError extends Error {
  /**
   * @param {number} status HTTP status, or 0 for a network failure
   * @param {string} code server error code, or NETWORK
   * @param {string} message friendly message
   * @param {unknown} [details]
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetwork() {
    return this.code === NETWORK_CODE;
  }
}

/**
 * @typedef {object} TokenStore
 * @property {() => string | null} getAccess
 * @property {() => string | null} getRefresh
 * @property {(tokens: { accessToken: string, refreshToken: string }) => void} setTokens
 * @property {() => void} clear
 */

/**
 * @param {{ baseUrl: string, tokens: TokenStore, fetchImpl?: typeof fetch }} options
 */
export function createApiClient({ baseUrl, tokens, fetchImpl = globalThis.fetch }) {
  /** One refresh at a time: parallel 401s share the same refresh. */
  let refreshing = null;

  async function send(path, { method = 'GET', body, query, accessToken, raw = false }) {
    const url = buildUrl(baseUrl, path, query);
    const headers = { Accept: raw ? '*/*' : 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let res;
    try {
      res = await fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, NETWORK_CODE, friendlyMessage(NETWORK_CODE));
    }

    const json = parseJson(await res.text());

    if (!res.ok) {
      const error = json?.error;
      const code = error?.code ?? 'INTERNAL';
      throw new ApiError(
        res.status,
        code,
        friendlyMessage(code, friendlyMessage('INTERNAL')),
        error?.details
      );
    }
    return json?.data ?? null;
  }

  function refreshAccess() {
    if (!refreshing) {
      refreshing = (async () => {
        const refreshToken = tokens.getRefresh();
        if (!refreshToken) throw new ApiError(401, 'UNAUTHORIZED', friendlyMessage('UNAUTHORIZED'));
        const data = await send('/auth/refresh', { method: 'POST', body: { refreshToken } });
        tokens.setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return data.accessToken;
      })().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  /**
   * Call the API.
   * @param {string} path e.g. '/courses'
   * @param {{ method?: string, body?: unknown, query?: Record<string, unknown>, auth?: boolean, raw?: boolean }} [options]
   * @returns {Promise<any>} the `data` member of a successful response
   */
  async function request(path, options = {}) {
    const { auth = true } = options;
    const accessToken = auth ? tokens.getAccess() : null;
    try {
      return await send(path, { ...options, accessToken });
    } catch (err) {
      if (!auth || !(err instanceof ApiError) || err.status !== 401) throw err;
      let fresh;
      try {
        fresh = await refreshAccess();
      } catch (refreshErr) {
        if (refreshErr instanceof ApiError && refreshErr.isNetwork) throw refreshErr;
        // The refresh token is spent or revoked: the learner has to sign in again.
        tokens.clear();
        throw new ApiError(401, 'UNAUTHORIZED', friendlyMessage('UNAUTHORIZED'));
      }
      return send(path, { ...options, accessToken: fresh });
    }
  }

  return { request, refreshAccess };
}

/** A body that is not JSON (a proxy's HTML error page, say) reads as no body, never as a crash. */
function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * @param {string} baseUrl
 * @param {string} path
 * @param {Record<string, unknown>} [query]
 */
export function buildUrl(baseUrl, path, query) {
  const params = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  return `${baseUrl}${path}${qs}`;
}
