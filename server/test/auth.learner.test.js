import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Settings, User } from '../src/models/index.js';
import { hashAccessCode } from '../src/services/accessCodes.js';
import { advance, resetData, START_TIME, startHarness, stopHarness } from './helpers/harness.js';

let h;
beforeAll(async () => {
  h = await startHarness();
});
afterEach(async () => {
  await resetData();
  h.clock.now = new Date(START_TIME);
});
afterAll(stopHarness);

const ada = {
  name: 'Ada Okafor',
  email: 'ada@example.com',
  phone: '08031234567',
  password: 'Correct-Horse-42',
};

const register = (body = ada) => h.api.post('/api/v1/auth/register').send(body);
const login = (identifier, password = ada.password) =>
  h.api.post('/api/v1/auth/login').send({ identifier, password });

describe('learner registration', () => {
  it('creates the account and signs the learner in', async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('learner');
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$argon2/);
  });

  it('stores the phone in E.164 form', async () => {
    const res = await register();
    expect(res.body.data.user.phone).toBe('+2348031234567');
  });

  it('refuses a password on the common list', async () => {
    const res = await register({ ...ada, password: '1234567890' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('refuses a password shorter than 10 characters', async () => {
    const res = await register({ ...ada, password: 'Short-1' });
    expect(res.status).toBe(400);
  });

  it('refuses a duplicate email and a duplicate phone', async () => {
    await register();
    const sameEmail = await register({ ...ada, phone: '07012345678' });
    expect(sameEmail.body.error.code).toBe('EMAIL_IN_USE');
    const samePhone = await register({ ...ada, email: 'other@example.com' });
    expect(samePhone.body.error.code).toBe('PHONE_IN_USE');
  });

  it('ignores role, xp and status sent by the client', async () => {
    const res = await register({ ...ada, role: 'super_admin', status: 'deactivated', xp: 9999 });
    expect(res.status).toBe(201);
    const stored = await User.findById(res.body.data.user.id).lean();
    expect(stored.role).toBe('learner');
    expect(stored.status).toBe('active');
    expect(stored.learning.xp).toBe(0);
  });

  it('requires a valid access code when registration is by access code', async () => {
    await Settings.create({
      registrationMode: 'access_code',
      accessCodes: [
        { codeHash: await hashAccessCode('ORG-CODE-2026'), label: 'Test org', active: true },
      ],
    });
    const wrong = await register();
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('INVALID_ACCESS_CODE');

    const right = await register({ ...ada, accessCode: 'ORG-CODE-2026' });
    expect(right.status).toBe(201);
    const settings = await Settings.findOne({}).select('+accessCodes').lean();
    expect(settings.accessCodes[0].uses).toBe(1);
  });
});

describe('learner login', () => {
  beforeEach(async () => {
    await register();
  });

  it('signs in by email, in any letter case', async () => {
    const res = await login('ADA@example.com');
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('ada@example.com');
  });

  it('signs in by phone, in either local or international form', async () => {
    expect((await login('08031234567')).status).toBe(200);
    expect((await login('+234 803 123 4567')).status).toBe(200);
  });

  it('gives the same generic error for a wrong password and an unknown account', async () => {
    const wrong = await login('ada@example.com', 'Wrong-Password-99');
    const unknown = await login('nobody@example.com', 'Wrong-Password-99');
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body).toEqual(wrong.body);
  });

  it('locks the account after five failures, even for the right password, then unlocks after 15 minutes', async () => {
    for (let i = 0; i < 5; i += 1) await login('ada@example.com', 'Wrong-Password-99');

    const locked = await login('ada@example.com');
    expect(locked.status).toBe(401);
    expect(locked.body.error.code).toBe('INVALID_CREDENTIALS');

    advance(h.clock, { minutes: 15 });
    expect((await login('ada@example.com')).status).toBe(200);
  });

  it('doubles the lock on a second lockout (30 minutes)', async () => {
    for (let i = 0; i < 5; i += 1) await login('ada@example.com', 'Wrong-Password-99');
    advance(h.clock, { minutes: 15 });
    for (let i = 0; i < 5; i += 1) await login('ada@example.com', 'Wrong-Password-99');

    advance(h.clock, { minutes: 15 });
    expect((await login('ada@example.com')).status).toBe(401);
    advance(h.clock, { minutes: 15 });
    expect((await login('ada@example.com')).status).toBe(200);
  });

  it('refuses a deactivated or pending-deletion account even with the right password', async () => {
    await User.updateOne({ email: 'ada@example.com' }, { status: 'deactivated' });
    const res = await login('ada@example.com');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('does not let an admin sign in through the learner route', async () => {
    await User.updateOne({ email: 'ada@example.com' }, { role: 'content_admin' });
    const res = await login('ada@example.com');
    expect(res.status).toBe(401);
  });
});

describe('refresh rotation and logout', () => {
  it('rotates the refresh token and rejects the old one', async () => {
    const { body } = await register();
    const first = body.data.refreshToken;

    const rotated = await h.api.post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.refreshToken).not.toBe(first);

    const replay = await h.api.post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('revokes the whole family when a used refresh token is presented again', async () => {
    const { body } = await register();
    const first = body.data.refreshToken;
    const second = (await h.api.post('/api/v1/auth/refresh').send({ refreshToken: first })).body
      .data.refreshToken;

    // The first token is replayed (theft suspected). The newest token must stop working too.
    await h.api.post('/api/v1/auth/refresh').send({ refreshToken: first });
    const newest = await h.api.post('/api/v1/auth/refresh').send({ refreshToken: second });
    expect(newest.status).toBe(401);
  });

  it('logs out: the refresh token stops working', async () => {
    const { body } = await register();
    const out = await h.api
      .post('/api/v1/auth/logout')
      .send({ refreshToken: body.data.refreshToken });
    expect(out.status).toBe(200);
    const after = await h.api
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.data.refreshToken });
    expect(after.status).toBe(401);
  });

  it('refuses a refresh with no token at all', async () => {
    const res = await h.api.post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(401);
  });
});

describe('password reset', () => {
  beforeEach(async () => {
    await register();
  });

  it('answers the same way for a known and an unknown email, and emails a six-digit code', async () => {
    const known = await h.api
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'ada@example.com' });
    const unknown = await h.api
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'ghost@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(h.mailer.lastResetCode()).toMatch(/^\d{6}$/);
  });

  it('resets the password with the emailed code, then the old password and old tokens stop working', async () => {
    const { body: session } = await login('ada@example.com');
    await h.api.post('/api/v1/auth/forgot-password').send({ identifier: 'ada@example.com' });
    const code = h.mailer.lastResetCode();

    const reset = await h.api.post('/api/v1/auth/reset-password').send({
      identifier: 'ada@example.com',
      code,
      newPassword: 'Brand-New-Pass-7',
    });
    expect(reset.status).toBe(200);

    expect((await login('ada@example.com', ada.password)).status).toBe(401);
    expect((await login('ada@example.com', 'Brand-New-Pass-7')).status).toBe(200);

    const oldAccess = await h.api
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${session.data.accessToken}`);
    expect(oldAccess.status).toBe(401);
    const oldRefresh = await h.api
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.data.refreshToken });
    expect(oldRefresh.status).toBe(401);
  });

  it('refuses a code after it has expired (15 minutes)', async () => {
    await h.api.post('/api/v1/auth/forgot-password').send({ identifier: 'ada@example.com' });
    const code = h.mailer.lastResetCode();
    advance(h.clock, { minutes: 16 });

    const res = await h.api.post('/api/v1/auth/reset-password').send({
      identifier: 'ada@example.com',
      code,
      newPassword: 'Brand-New-Pass-7',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_CODE');
  });

  it('stops accepting a code after five wrong attempts, even the right one', async () => {
    await h.api.post('/api/v1/auth/forgot-password').send({ identifier: 'ada@example.com' });
    const code = h.mailer.lastResetCode();
    for (let i = 0; i < 5; i += 1) {
      await h.api.post('/api/v1/auth/reset-password').send({
        identifier: 'ada@example.com',
        code: code === '000000' ? '111111' : '000000',
        newPassword: 'Brand-New-Pass-7',
      });
    }
    const res = await h.api.post('/api/v1/auth/reset-password').send({
      identifier: 'ada@example.com',
      code,
      newPassword: 'Brand-New-Pass-7',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_CODE');
  });
});
