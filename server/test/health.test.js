import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/utils/logger.js';

const config = { ADMIN_ORIGIN: ['http://localhost:5173'], TRUST_PROXY_HOPS: 0 };
const app = createApp({ config, logger: createLogger({ level: 'silent' }) });

describe('GET /api/v1/health', () => {
  it('returns the standard success envelope', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.uptimeSec).toBe('number');
  });

  it('sends security headers and hides the framework', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('gives every response a request id, and reuses a safe incoming one', async () => {
    const generated = await request(app).get('/api/v1/health');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const reused = await request(app).get('/api/v1/health').set('x-request-id', 'trace-abc12345');
    expect(reused.headers['x-request-id']).toBe('trace-abc12345');
  });

  it('ignores an unsafe incoming request id rather than echoing it', async () => {
    const res = await request(app).get('/api/v1/health').set('x-request-id', 'bad id with spaces');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-request-id']).not.toContain('spaces');
  });
});

describe('error responses', () => {
  it('returns the NOT_FOUND envelope with no stack trace', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });

  it('returns VALIDATION_FAILED for malformed JSON without echoing the body', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('content-type', 'application/json')
      .send('{"password": "hunter2",');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });
});
