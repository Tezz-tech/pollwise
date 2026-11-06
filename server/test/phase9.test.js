import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { Certificate, User } from '../src/models/index.js';
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

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const PASSWORD = 'Correct-Horse-42';

async function registerLearner(email, phone) {
  const res = await h.api.post('/api/v1/auth/register').send({
    name: email.split('@')[0],
    email,
    phone,
    password: PASSWORD,
  });
  return {
    token: res.body.data.accessToken,
    refresh: res.body.data.refreshToken,
    id: res.body.data.user.id,
  };
}

/** A certificate issued to `userId`, as the progress service would have written it. */
async function issueCertificate(userId, code) {
  return Certificate.create({
    userId: new mongoose.Types.ObjectId(userId),
    courseId: new mongoose.Types.ObjectId(),
    code,
    learnerName: 'Ada Test',
    courseTitle: 'Opening the polling unit',
    score: 88,
    issuedAt: new Date(START_TIME),
  });
}

describe('POST /me/password', () => {
  it('needs the current password', async () => {
    const a = await registerLearner('pw1@example.com', '08041111111');
    const res = await h.api
      .post('/api/v1/me/password')
      .set(auth(a.token))
      .send({ currentPassword: 'Wrong-Password-1', newPassword: 'New-Password-2026' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('applies the sign-up password rules to the new password', async () => {
    const a = await registerLearner('pw2@example.com', '08042222222');
    const res = await h.api
      .post('/api/v1/me/password')
      .set(auth(a.token))
      .send({ currentPassword: PASSWORD, newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('ends every session, so the old refresh token and access token stop working', async () => {
    const a = await registerLearner('pw3@example.com', '08043333333');
    const res = await h.api
      .post('/api/v1/me/password')
      .set(auth(a.token))
      .send({ currentPassword: PASSWORD, newPassword: 'New-Password-2026' });
    expect(res.status).toBe(200);

    const refresh = await h.api.post('/api/v1/auth/refresh').send({ refreshToken: a.refresh });
    expect(refresh.status).toBe(401);
    const me = await h.api.get('/api/v1/me').set(auth(a.token));
    expect(me.status).toBe(401);

    const login = await h.api
      .post('/api/v1/auth/login')
      .send({ identifier: 'pw3@example.com', password: 'New-Password-2026' });
    expect(login.status).toBe(200);
  });

  it('requires a signed-in learner', async () => {
    const res = await h.api
      .post('/api/v1/me/password')
      .send({ currentPassword: PASSWORD, newPassword: 'New-Password-2026' });
    expect(res.status).toBe(401);
  });
});

describe('certificate PDF download link', () => {
  it('gives the owner a two-minute link that downloads without a bearer header', async () => {
    const a = await registerLearner('cert1@example.com', '08051111111');
    const cert = await issueCertificate(a.id, 'AAAAAAAAAA');

    const link = await h.api.get(`/api/v1/certificates/${cert.id}/pdf-link`).set(auth(a.token));
    expect(link.status).toBe(200);
    expect(link.body.data.expiresInSec).toBe(120);
    expect(link.body.data.path).toMatch(/^\/certificates\/.+\/pdf\?download=/);

    const pdf = await h.api.get(`/api/v1${link.body.data.path}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('does not give anyone else a link to the certificate', async () => {
    const owner = await registerLearner('cert2@example.com', '08052222222');
    const other = await registerLearner('cert3@example.com', '08053333333');
    const cert = await issueCertificate(owner.id, 'BBBBBBBBBB');
    const res = await h.api.get(`/api/v1/certificates/${cert.id}/pdf-link`).set(auth(other.token));
    expect(res.status).toBe(404);
  });

  it('refuses a link that has expired', async () => {
    const a = await registerLearner('cert4@example.com', '08054444444');
    const cert = await issueCertificate(a.id, 'CCCCCCCCCC');
    const link = await h.api.get(`/api/v1/certificates/${cert.id}/pdf-link`).set(auth(a.token));
    advance(h.clock, { minutes: 3 });
    const pdf = await h.api.get(`/api/v1${link.body.data.path}`);
    expect(pdf.status).toBe(401);
  });

  it('refuses a link issued for a different certificate', async () => {
    const a = await registerLearner('cert5@example.com', '08055555555');
    const first = await issueCertificate(a.id, 'DDDDDDDDDD');
    const second = await issueCertificate(a.id, 'EEEEEEEEEE');
    const link = await h.api.get(`/api/v1/certificates/${first.id}/pdf-link`).set(auth(a.token));
    const token = decodeURIComponent(link.body.data.path.split('download=')[1]);
    const pdf = await h.api.get(
      `/api/v1/certificates/${second.id}/pdf?download=${encodeURIComponent(token)}`
    );
    expect(pdf.status).toBe(401);
  });

  it('does not accept an access token in place of a download link', async () => {
    const a = await registerLearner('cert6@example.com', '08056666666');
    const cert = await issueCertificate(a.id, 'FFFFFFFFFF');
    const pdf = await h.api.get(
      `/api/v1/certificates/${cert.id}/pdf?download=${encodeURIComponent(a.token)}`
    );
    expect(pdf.status).toBe(401);
  });

  it('does not accept a download link as a bearer token', async () => {
    const a = await registerLearner('cert7@example.com', '08057777777');
    const cert = await issueCertificate(a.id, 'GGGGGGGGGG');
    const link = await h.api.get(`/api/v1/certificates/${cert.id}/pdf-link`).set(auth(a.token));
    const token = decodeURIComponent(link.body.data.path.split('download=')[1]);
    const me = await h.api.get('/api/v1/me').set(auth(token));
    expect(me.status).toBe(401);
  });

  it('stops working when the account is deactivated', async () => {
    const a = await registerLearner('cert8@example.com', '08058888888');
    const cert = await issueCertificate(a.id, 'HHHHHHHHHH');
    const link = await h.api.get(`/api/v1/certificates/${cert.id}/pdf-link`).set(auth(a.token));
    await User.updateOne({ _id: a.id }, { $set: { status: 'deactivated' } });
    const pdf = await h.api.get(`/api/v1${link.body.data.path}`);
    expect(pdf.status).toBe(403);
  });
});
