/**
 * Route review (SECURITY §2, §12): every route the app serves is listed here by walking the live router, so a new
 * route cannot slip past the checks by being absent from a hand-written list. Two rules are enforced:
 *
 * 1. Every route not on PUBLIC_ROUTES refuses an anonymous caller with 401. Authentication runs before anything else.
 * 2. Every /admin route refuses a learner with 403. Role checks run before validation.
 *
 * docs/ROUTE_REVIEW.md is the written review of the same list, route by route.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { startHarness, stopHarness, resetData } from './helpers/harness.js';

/** Routes that are public by design. Each one is reviewed in docs/ROUTE_REVIEW.md. */
export const PUBLIC_ROUTES = new Set([
  'GET /api/v1/health',
  'POST /api/v1/auth/register',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/forgot-password',
  'POST /api/v1/auth/reset-password',
  'POST /api/v1/auth/admin/login',
  'POST /api/v1/auth/admin/totp/setup',
  'POST /api/v1/auth/admin/totp',
  'POST /api/v1/auth/admin/accept-invite',
  'GET /api/v1/geo/states',
  'GET /api/v1/geo/states/:stateCode/lgas',
  'GET /api/v1/settings/public',
  'GET /api/v1/verify/:code',
]);

/** The api router mounts its children in this order (routes/index.js). Only three of them add a prefix. */
const MOUNTS = ['', '/auth', '/me', '/admin', '', '', ''];

/**
 * Every route in the app, as "METHOD /api/v1/path" with :params left as written.
 * @param {import('express').Express} app
 */
export function listRoutes(app) {
  const routes = [];
  // The API router is the layer whose children include the health route. Matching on structure keeps this working
  // whatever path the router is mounted at.
  const apiLayer = app.router.stack.find((layer) =>
    layer.handle?.stack?.some((child) =>
      child.handle?.stack?.some((r) => r.route?.path === '/health')
    )
  );
  const children = (apiLayer?.handle.stack ?? []).filter(
    (layer) => !layer.route && layer.handle?.stack
  );
  children.forEach((child, index) => {
    const prefix = MOUNTS[index] ?? '';
    collect(child.handle.stack, prefix, routes);
  });
  return routes;
}

/** @param {any[]} stack @param {string} prefix @param {string[]} out */
function collect(stack, prefix, out) {
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        out.push(`${method.toUpperCase()} /api/v1${prefix}${layer.route.path}`);
      }
    } else if (layer.handle?.stack) {
      collect(layer.handle.stack, prefix, out);
    }
  }
}

/** A real-looking value for each parameter, so the path is well formed. */
function fill(path) {
  return path
    .replace(':stateCode', 'LA')
    .replace(/:(\w+)/g, () => new mongoose.Types.ObjectId().toHexString());
}

let h;
let learnerToken;

beforeAll(async () => {
  h = await startHarness();
  await h.api.post('/api/v1/auth/register').send({
    name: 'Route Probe',
    email: 'route-probe@example.com',
    phone: '08070000001',
    password: 'Correct-Horse-42',
  });
  const login = await h.api
    .post('/api/v1/auth/login')
    .send({ identifier: 'route-probe@example.com', password: 'Correct-Horse-42' });
  learnerToken = login.body.data.accessToken;
});
afterAll(async () => {
  await resetData();
  await stopHarness();
});

describe('route review', () => {
  it('finds the routes it expects (the walk did not come back empty or shifted)', () => {
    const routes = listRoutes(h.app);
    // Exact on purpose: adding or removing a route must update docs/ROUTE_REVIEW.md in the same change.
    expect(routes.length).toBe(77);
    expect(routes).toContain('POST /api/v1/auth/login');
    expect(routes).toContain('GET /api/v1/me/stats');
    expect(routes).toContain('POST /api/v1/me/password');
    expect(routes).toContain('GET /api/v1/admin/users');
    expect(routes).toContain('GET /api/v1/certificates/:id/pdf-link');
    expect(routes).toContain('GET /api/v1/internal/cron/anonymise');
  });

  it('refuses an anonymous caller on every route that is not public', async () => {
    const routes = listRoutes(h.app).filter((r) => !PUBLIC_ROUTES.has(r));
    const leaks = [];
    for (const route of routes) {
      const [method, template] = route.split(' ');
      const res = await h.api[method.toLowerCase()](fill(template)).send({});
      if (res.status !== 401) leaks.push(`${route} -> ${res.status}`);
    }
    expect(leaks).toEqual([]);
  });

  it('refuses a learner on every admin route', async () => {
    const admin = listRoutes(h.app).filter(
      (r) => r.startsWith('GET /api/v1/admin') || /\/api\/v1\/admin/.test(r)
    );
    const leaks = [];
    for (const route of admin) {
      const [method, template] = route.split(' ');
      const res = await h.api[method.toLowerCase()](fill(template))
        .set('Authorization', `Bearer ${learnerToken}`)
        .send({});
      if (res.status !== 403) leaks.push(`${route} -> ${res.status}`);
    }
    expect(leaks).toEqual([]);
  });

  it('keeps the public list to the routes it names', () => {
    const routes = new Set(listRoutes(h.app));
    for (const route of PUBLIC_ROUTES) expect(routes.has(route)).toBe(true);
  });
});
