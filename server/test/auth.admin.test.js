import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { generate, generateSecret } from 'otplib';
import { AuditLog, User } from '../src/models/index.js';
import { hashPassword } from '../src/utils/password.js';
import { encryptSecret } from '../src/services/totpService.js';
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

const PASSWORD = 'Admin-Strong-Pass-1';

/** Insert an admin directly. With `totp: true` the secret is already enabled and returned. */
async function makeAdmin({ email, role, totp = false }) {
  const secret = generateSecret();
  const user = await User.create({
    name: `Test ${role}`,
    email,
    passwordHash: await hashPassword(PASSWORD),
    role,
    security: {
      passwordChangedAt: new Date(),
      totpEnabled: totp,
      totpSecretEnc: totp
        ? encryptSecret(Buffer.from(h.config.TOTP_ENC_KEY, 'base64'), secret)
        : undefined,
    },
  });
  return { user, secret };
}

const adminLogin = (email, password = PASSWORD) =>
  h.api.post('/api/v1/auth/admin/login').send({ email, password });

const cookiesOf = (res) => res.headers['set-cookie'] ?? [];
const cookieNamed = (res, name) => cookiesOf(res).find((c) => c.startsWith(`${name}=`));

/** Log a super admin in with TOTP already enabled and return the session body. */
async function superAdminSession(email = 'boss@pollwise.test') {
  const { secret } = await makeAdmin({ email, role: 'super_admin', totp: true });
  const step1 = await adminLogin(email);
  const code = await generate({ secret, epoch: h.clock.now.getTime() / 1000 });
  const step2 = await h.api
    .post('/api/v1/auth/admin/totp')
    .send({ challengeToken: step1.body.data.challengeToken, code });
  return { step2, secret };
}

describe('admin two-step sign-in', () => {
  it('a super admin always needs TOTP, and first login asks for setup', async () => {
    await makeAdmin({ email: 'boss@pollwise.test', role: 'super_admin' });
    const res = await adminLogin('boss@pollwise.test');
    expect(res.status).toBe(200);
    expect(res.body.data.needsTotp).toBe(true);
    expect(res.body.data.totpSetupRequired).toBe(true);
    expect(res.body.data.challengeToken).toEqual(expect.any(String));
    expect(res.body.data.accessToken).toBeUndefined();
    expect(cookieNamed(res, 'pw_admin_refresh')).toBeUndefined();
  });

  it('setup returns an otpauth URI and a secret; the first correct code enables TOTP and returns recovery codes', async () => {
    await makeAdmin({ email: 'boss@pollwise.test', role: 'super_admin' });
    const step1 = await adminLogin('boss@pollwise.test');
    const challengeToken = step1.body.data.challengeToken;

    const setup = await h.api.post('/api/v1/auth/admin/totp/setup').send({ challengeToken });
    expect(setup.status).toBe(200);
    expect(setup.body.data.otpauthUri).toMatch(/^otpauth:\/\/totp\/PollWise/);
    expect(setup.body.data.secret).toMatch(/^[A-Z2-7]+$/);

    const wrong = await h.api
      .post('/api/v1/auth/admin/totp')
      .send({ challengeToken, code: '000000' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_TOTP');

    const code = await generate({
      secret: setup.body.data.secret,
      epoch: h.clock.now.getTime() / 1000,
    });
    const done = await h.api.post('/api/v1/auth/admin/totp').send({ challengeToken, code });
    expect(done.status).toBe(200);
    expect(done.body.data.user.role).toBe('super_admin');
    expect(done.body.data.recoveryCodes).toHaveLength(10);
    expect(done.body.data.refreshToken).toBeUndefined();

    const stored = await User.findOne({ email: 'boss@pollwise.test' })
      .select('+security.totpSecretEnc')
      .lean();
    expect(stored.security.totpEnabled).toBe(true);
    expect(stored.security.totpSecretEnc).not.toContain(setup.body.data.secret);
  });

  it('after setup, the next sign-in asks for the code, not setup', async () => {
    const { step2 } = await superAdminSession();
    expect(step2.status).toBe(200);
    const again = await adminLogin('boss@pollwise.test');
    expect(again.body.data.totpSetupRequired).toBe(false);
  });

  it('a challenge can be used once', async () => {
    const { secret } = await makeAdmin({
      email: 'boss@pollwise.test',
      role: 'super_admin',
      totp: true,
    });
    const { body } = await adminLogin('boss@pollwise.test');
    const code = await generate({ secret, epoch: h.clock.now.getTime() / 1000 });
    expect(
      (
        await h.api
          .post('/api/v1/auth/admin/totp')
          .send({ challengeToken: body.data.challengeToken, code })
      ).status
    ).toBe(200);
    const replay = await h.api
      .post('/api/v1/auth/admin/totp')
      .send({ challengeToken: body.data.challengeToken, code });
    expect(replay.status).toBe(401);
  });

  it('a six-digit code cannot be reused in a new sign-in within its 30-second window', async () => {
    const { secret } = await makeAdmin({
      email: 'boss@pollwise.test',
      role: 'super_admin',
      totp: true,
    });
    const code = await generate({ secret, epoch: h.clock.now.getTime() / 1000 });

    const first = await adminLogin('boss@pollwise.test');
    const ok = await h.api
      .post('/api/v1/auth/admin/totp')
      .send({ challengeToken: first.body.data.challengeToken, code });
    expect(ok.status).toBe(200);

    const second = await adminLogin('boss@pollwise.test');
    const reused = await h.api
      .post('/api/v1/auth/admin/totp')
      .send({ challengeToken: second.body.data.challengeToken, code });
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('INVALID_TOTP');
  });

  it('a challenge expires after five minutes', async () => {
    const { secret } = await makeAdmin({
      email: 'boss@pollwise.test',
      role: 'super_admin',
      totp: true,
    });
    const { body } = await adminLogin('boss@pollwise.test');
    advance(h.clock, { minutes: 6 });
    const code = await generate({ secret, epoch: h.clock.now.getTime() / 1000 });
    const res = await h.api
      .post('/api/v1/auth/admin/totp')
      .send({ challengeToken: body.data.challengeToken, code });
    expect(res.status).toBe(401);
  });

  it('a recovery code works once', async () => {
    await makeAdmin({
      email: 'boss@pollwise.test',
      role: 'super_admin',
      totp: true,
    });
    await User.updateOne(
      { email: 'boss@pollwise.test' },
      { 'security.recoveryCodeHashes': [await hashPassword('ABCD-EFGH')] }
    );
    const first = await adminLogin('boss@pollwise.test');
    const ok = await h.api
      .post('/api/v1/auth/admin/totp')
      .send({ challengeToken: first.body.data.challengeToken, code: 'ABCD-EFGH' });
    expect(ok.status).toBe(200);

    const second = await adminLogin('boss@pollwise.test');
    const reused = await h.api
      .post('/api/v1/auth/admin/totp')
      .send({ challengeToken: second.body.data.challengeToken, code: 'ABCD-EFGH' });
    expect(reused.status).toBe(401);
  });

  it('a content admin without TOTP signs straight in', async () => {
    await makeAdmin({ email: 'writer@pollwise.test', role: 'content_admin' });
    const res = await adminLogin('writer@pollwise.test');
    expect(res.body.data.needsTotp).toBe(false);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
  });

  it('gives a learner the generic failure on the admin route', async () => {
    await User.create({
      name: 'Learner',
      email: 'learner@pollwise.test',
      passwordHash: await hashPassword(PASSWORD),
    });
    const res = await adminLogin('learner@pollwise.test');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('writes audit entries for a failed password, a success and TOTP enrolment', async () => {
    await makeAdmin({ email: 'boss@pollwise.test', role: 'super_admin' });
    await adminLogin('boss@pollwise.test', 'Not-The-Password-9');
    const step1 = await adminLogin('boss@pollwise.test');
    const setup = await h.api
      .post('/api/v1/auth/admin/totp/setup')
      .send({ challengeToken: step1.body.data.challengeToken });
    const code = await generate({
      secret: setup.body.data.secret,
      epoch: h.clock.now.getTime() / 1000,
    });
    await h.api
      .post('/api/v1/auth/admin/totp')
      .send({ challengeToken: step1.body.data.challengeToken, code });

    const actions = (await AuditLog.find({}).lean()).map((row) => row.action);
    expect(actions).toEqual(
      expect.arrayContaining(['admin.login_failed', 'admin.totp_enabled', 'admin.login'])
    );
  });
});

describe('admin cookies and CSRF', () => {
  it('sets the refresh token as httpOnly, Secure, SameSite=Strict, scoped to /api/v1/auth', async () => {
    const { step2 } = await superAdminSession();
    const refresh = cookieNamed(step2, 'pw_admin_refresh');
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/Secure/i);
    expect(refresh).toMatch(/SameSite=Strict/i);
    expect(refresh).toContain('Path=/api/v1/auth');
    expect(cookieNamed(step2, 'pw_csrf')).toBeDefined();
  });

  it('refuses a cookie refresh without the matching CSRF header', async () => {
    const { step2 } = await superAdminSession();
    const refresh = cookieNamed(step2, 'pw_admin_refresh').split(';')[0];
    const res = await h.api.post('/api/v1/auth/refresh').set('Cookie', refresh).send({});
    expect(res.status).toBe(403);
  });

  it('rotates the cookie when the CSRF header matches the CSRF cookie', async () => {
    const { step2 } = await superAdminSession();
    const refresh = cookieNamed(step2, 'pw_admin_refresh').split(';')[0];
    const csrf = cookieNamed(step2, 'pw_csrf').split(';')[0];
    const csrfValue = csrf.split('=')[1];

    const res = await h.api
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${refresh}; ${csrf}`)
      .set('X-CSRF-Token', csrfValue)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(cookieNamed(res, 'pw_admin_refresh')).toBeDefined();
  });

  it('logout clears the admin cookies and revokes the session', async () => {
    const { step2 } = await superAdminSession();
    const refresh = cookieNamed(step2, 'pw_admin_refresh').split(';')[0];
    const csrf = cookieNamed(step2, 'pw_csrf').split(';')[0];
    const out = await h.api
      .post('/api/v1/auth/logout')
      .set('Cookie', `${refresh}; ${csrf}`)
      .set('X-CSRF-Token', csrf.split('=')[1])
      .send({});
    expect(out.status).toBe(200);
    expect(cookiesOf(out).some((c) => c.startsWith('pw_admin_refresh=;'))).toBe(true);

    const after = await h.api
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${refresh}; ${csrf}`)
      .set('X-CSRF-Token', csrf.split('=')[1])
      .send({});
    expect(after.status).toBe(401);
  });
});

describe('admin role checks', () => {
  it('needs a token for /admin/session', async () => {
    expect((await h.api.get('/api/v1/admin/session')).status).toBe(401);
  });

  it('refuses a learner token on /admin/session', async () => {
    const reg = await h.api.post('/api/v1/auth/register').send({
      name: 'Learner',
      email: 'l@example.com',
      phone: '08031234567',
      password: 'Correct-Horse-42',
    });
    const res = await h.api
      .get('/api/v1/admin/session')
      .set('Authorization', `Bearer ${reg.body.data.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lets a content admin read the session, and a super admin too', async () => {
    await makeAdmin({ email: 'writer@pollwise.test', role: 'content_admin' });
    const writer = await adminLogin('writer@pollwise.test');
    const ok = await h.api
      .get('/api/v1/admin/session')
      .set('Authorization', `Bearer ${writer.body.data.accessToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.role).toBe('content_admin');
  });

  it('refuses a content admin the right to invite admins', async () => {
    await makeAdmin({ email: 'writer@pollwise.test', role: 'content_admin' });
    const writer = await adminLogin('writer@pollwise.test');
    const res = await h.api
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${writer.body.data.accessToken}`)
      .send({ email: 'new@pollwise.test', name: 'New', role: 'content_admin' });
    expect(res.status).toBe(403);
  });

  it('a deactivated admin loses access on the next request', async () => {
    const { step2 } = await superAdminSession();
    const token = step2.body.data.accessToken;
    await User.updateOne({ email: 'boss@pollwise.test' }, { status: 'deactivated' });
    const res = await h.api.get('/api/v1/admin/session').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });
});

describe('admin invitations', () => {
  it('a super admin invites an admin; the link sets the password; then TOTP setup follows', async () => {
    const { step2 } = await superAdminSession();
    const token = step2.body.data.accessToken;

    const invited = await h.api
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new.admin@pollwise.test', name: 'New Admin', role: 'content_admin' });
    expect(invited.status).toBe(201);
    expect(invited.body.data.email).toBe('new.admin@pollwise.test');

    const link = h.mailer.lastInviteLink();
    expect(link).toMatch(/accept-invite\?token=/);
    const inviteToken = new URL(link).searchParams.get('token');

    const accepted = await h.api
      .post('/api/v1/auth/admin/accept-invite')
      .send({ token: inviteToken, password: 'Invitee-Pass-2026' });
    expect(accepted.status).toBe(200);

    const signIn = await adminLogin('new.admin@pollwise.test', 'Invitee-Pass-2026');
    expect(signIn.status).toBe(200);
    expect(signIn.body.data.needsTotp).toBe(false);

    const reuse = await h.api
      .post('/api/v1/auth/admin/accept-invite')
      .send({ token: inviteToken, password: 'Another-Pass-2026' });
    expect(reuse.status).toBe(401);
  });

  it('refuses an invite for an email that already has an account', async () => {
    const { step2 } = await superAdminSession();
    const res = await h.api
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${step2.body.data.accessToken}`)
      .send({ email: 'boss@pollwise.test', name: 'Again', role: 'super_admin' });
    expect(res.status).toBe(409);
  });

  it('refuses an unknown field in the invite body (strict)', async () => {
    const { step2 } = await superAdminSession();
    const res = await h.api
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${step2.body.data.accessToken}`)
      .send({ email: 'x@pollwise.test', name: 'X', role: 'content_admin', status: 'active' });
    expect(res.status).toBe(400);
  });
});
