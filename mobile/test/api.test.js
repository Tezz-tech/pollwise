import { describe, expect, it, vi } from 'vitest';
import { ApiError, buildUrl, createApiClient } from '../src/lib/api.js';

/** A fake token store. */
function memoryTokens(initial = {}) {
  const state = { access: null, refresh: null, ...initial };
  return {
    state,
    getAccess: () => state.access,
    getRefresh: () => state.refresh,
    setTokens: ({ accessToken, refreshToken }) => {
      state.access = accessToken;
      state.refresh = refreshToken;
    },
    clear: () => {
      state.access = null;
      state.refresh = null;
    },
  };
}

/** A minimal Response-like object for the fetch stub. */
function reply(status, body) {
  const text = body === undefined ? '' : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

const BASE = 'https://api.test/api/v1';

describe('buildUrl', () => {
  it('drops empty query values and encodes the rest', () => {
    expect(buildUrl(BASE, '/courses', { q: 'polling unit', role: '', page: 2, x: undefined })).toBe(
      `${BASE}/courses?q=polling%20unit&page=2`
    );
  });
});

describe('createApiClient', () => {
  it('returns the data member of a successful response', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { data: { ok: true } }));
    const api = createApiClient({ baseUrl: BASE, tokens: memoryTokens(), fetchImpl });
    await expect(api.request('/me', { auth: false })).resolves.toEqual({ ok: true });
  });

  it('sends the access token as a bearer header', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { data: null }));
    const api = createApiClient({
      baseUrl: BASE,
      tokens: memoryTokens({ access: 'A1', refresh: 'R1' }),
      fetchImpl,
    });
    await api.request('/me');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer A1');
  });

  it('refreshes once after a 401 and retries the original request', async () => {
    const tokens = memoryTokens({ access: 'OLD', refresh: 'R1' });
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push({ url, auth: init.headers.Authorization });
      if (url.endsWith('/auth/refresh')) {
        return reply(200, { data: { accessToken: 'NEW', refreshToken: 'R2' } });
      }
      if (init.headers.Authorization === 'Bearer OLD') {
        return reply(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } });
      }
      return reply(200, { data: { name: 'Ada' } });
    });
    const api = createApiClient({ baseUrl: BASE, tokens, fetchImpl });

    await expect(api.request('/me')).resolves.toEqual({ name: 'Ada' });
    expect(tokens.state).toEqual({ access: 'NEW', refresh: 'R2' });
    expect(calls.map((c) => c.url.replace(BASE, ''))).toEqual(['/me', '/auth/refresh', '/me']);
  });

  it('shares one refresh between parallel requests', async () => {
    const tokens = memoryTokens({ access: 'OLD', refresh: 'R1' });
    let refreshCount = 0;
    const fetchImpl = vi.fn(async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCount += 1;
        return reply(200, { data: { accessToken: 'NEW', refreshToken: 'R2' } });
      }
      return init.headers.Authorization === 'Bearer NEW'
        ? reply(200, { data: 'ok' })
        : reply(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } });
    });
    const api = createApiClient({ baseUrl: BASE, tokens, fetchImpl });
    await Promise.all([api.request('/a'), api.request('/b')]);
    expect(refreshCount).toBe(1);
  });

  it('clears the session when the refresh token is refused', async () => {
    const tokens = memoryTokens({ access: 'OLD', refresh: 'REVOKED' });
    const fetchImpl = vi.fn(async (url) =>
      url.endsWith('/auth/refresh')
        ? reply(401, { error: { code: 'TOKEN_REVOKED', message: 'revoked' } })
        : reply(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } })
    );
    const api = createApiClient({ baseUrl: BASE, tokens, fetchImpl });
    await expect(api.request('/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(tokens.state).toEqual({ access: null, refresh: null });
  });

  it('keeps the session when the refresh fails because the phone is offline', async () => {
    const tokens = memoryTokens({ access: 'OLD', refresh: 'R1' });
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith('/auth/refresh')) throw new TypeError('Network request failed');
      return reply(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } });
    });
    const api = createApiClient({ baseUrl: BASE, tokens, fetchImpl });
    const err = await api.request('/me').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.isNetwork).toBe(true);
    expect(tokens.state.refresh).toBe('R1');
  });

  it('turns a network failure into a friendly NETWORK error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const api = createApiClient({ baseUrl: BASE, tokens: memoryTokens(), fetchImpl });
    const err = await api.request('/courses', { auth: false }).catch((e) => e);
    expect(err.isNetwork).toBe(true);
    expect(err.message).toMatch(/offline/i);
  });

  it('maps a server error to its code and a friendly message, never the raw message', async () => {
    const fetchImpl = vi.fn(async () =>
      reply(423, { error: { code: 'LESSON_LOCKED', message: 'internal wording' } })
    );
    const api = createApiClient({ baseUrl: BASE, tokens: memoryTokens(), fetchImpl });
    const err = await api.request('/lessons/x', { auth: false }).catch((e) => e);
    expect(err.code).toBe('LESSON_LOCKED');
    expect(err.message).toBe('Finish the lesson before this one to unlock it.');
  });

  it('treats a non-JSON failure as an internal error', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 502, text: async () => '<html>' }));
    const api = createApiClient({ baseUrl: BASE, tokens: memoryTokens(), fetchImpl });
    const err = await api.request('/me', { auth: false }).catch((e) => e);
    expect(err.code).toBe('INTERNAL');
    expect(err.status).toBe(502);
  });
});
