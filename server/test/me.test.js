import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Lga, Settings, State, User } from '../src/models/index.js';
import { anonymiseDueAccounts } from '../src/services/userService.js';
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

async function seedGeo() {
  await State.create([
    { code: 'LA', name: 'Lagos' },
    { code: 'KN', name: 'Kano' },
  ]);
  await Lga.create([
    { code: 'LA-IKEJA', stateCode: 'LA', name: 'Ikeja' },
    { code: 'KN-NASSARAWA', stateCode: 'KN', name: 'Nassarawa' },
  ]);
}

async function registerLearner(email, phone) {
  const res = await h.api.post('/api/v1/auth/register').send({
    name: email.split('@')[0],
    email,
    phone,
    password: 'Correct-Horse-42',
  });
  return {
    token: res.body.data.accessToken,
    refresh: res.body.data.refreshToken,
    id: res.body.data.user.id,
  };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('GET /me', () => {
  it('requires a token', async () => {
    expect((await h.api.get('/api/v1/me')).status).toBe(401);
  });

  it('returns only the caller’s own profile', async () => {
    const a = await registerLearner('a@example.com', '08031111111');
    const b = await registerLearner('b@example.com', '08032222222');
    const resA = await h.api.get('/api/v1/me').set(auth(a.token));
    const resB = await h.api.get('/api/v1/me').set(auth(b.token));
    expect(resA.body.data.id).toBe(a.id);
    expect(resB.body.data.id).toBe(b.id);
    expect(resB.body.data.email).toBe('b@example.com');
  });
});

describe('PATCH /me', () => {
  it('updates name, preferences, daily goal and reminder time', async () => {
    const a = await registerLearner('a@example.com', '08031111111');
    const res = await h.api
      .patch('/api/v1/me')
      .set(auth(a.token))
      .send({
        name: 'Ada O.',
        prefs: { sound: false },
        dailyGoalXp: 20,
        reminderTime: '07:30',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Ada O.');
    expect(res.body.data.prefs.sound).toBe(false);
    expect(res.body.data.learning.dailyGoalXp).toBe(20);
    expect(res.body.data.learning.reminderTime).toBe('07:30');
  });

  it('silently drops role, status, xp and streak, which can never be set by the client', async () => {
    const a = await registerLearner('a@example.com', '08031111111');
    const res = await h.api
      .patch('/api/v1/me')
      .set(auth(a.token))
      .send({
        name: 'Still Ada',
        role: 'super_admin',
        status: 'deactivated',
        learning: { xp: 99999, streak: { current: 50 } },
        security: { tokenVersion: -1 },
      });
    expect(res.status).toBe(200);
    const stored = await User.findById(a.id).lean();
    expect(stored.role).toBe('learner');
    expect(stored.status).toBe('active');
    expect(stored.learning.xp).toBe(0);
    expect(stored.learning.streak.current).toBe(0);
    expect(stored.name).toBe('Still Ada');
  });

  it('rejects a daily goal that is not 10, 20 or 30', async () => {
    const a = await registerLearner('a@example.com', '08031111111');
    const res = await h.api.patch('/api/v1/me').set(auth(a.token)).send({ dailyGoalXp: 15 });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /me/profile', () => {
  beforeEach(seedGeo);

  it('saves a state, an LGA that belongs to it, and a personnel role', async () => {
    const a = await registerLearner('a@example.com', '08031111111');
    const res = await h.api.patch('/api/v1/me/profile').set(auth(a.token)).send({
      stateCode: 'LA',
      lgaCode: 'LA-IKEJA',
      personnelRole: 'collation',
      pollingUnit: 'Unit 12, Primary School',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.profile.stateCode).toBe('LA');
    expect(res.body.data.profile.lgaCode).toBe('LA-IKEJA');
    expect(res.body.data.profile.personnelRole).toBe('collation');
    expect(res.body.data.profile.completedAt).not.toBeNull();
  });

  it('rejects an LGA that is in a different state', async () => {
    const a = await registerLearner('a@example.com', '08031111111');
    const res = await h.api.patch('/api/v1/me/profile').set(auth(a.token)).send({
      stateCode: 'LA',
      lgaCode: 'KN-NASSARAWA',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('lgaCode');
  });

  it('rejects an unknown personnel role', async () => {
    const a = await registerLearner('a@example.com', '08031111111');
    const res = await h.api
      .patch('/api/v1/me/profile')
      .set(auth(a.token))
      .send({ personnelRole: 'party_leader' });
    expect(res.status).toBe(400);
  });
});

describe('geography and public settings', () => {
  beforeEach(seedGeo);

  it('lists states and the LGAs of one state', async () => {
    const states = await h.api.get('/api/v1/geo/states');
    expect(states.body.data.map((s) => s.code)).toEqual(['KN', 'LA']);
    const lgas = await h.api.get('/api/v1/geo/states/LA/lgas');
    expect(lgas.body.data).toEqual([{ code: 'LA-IKEJA', name: 'Ikeja' }]);
  });

  it('returns 404 for an unknown state and 400 for a malformed code', async () => {
    expect((await h.api.get('/api/v1/geo/states/ZZ/lgas')).status).toBe(404);
    expect((await h.api.get('/api/v1/geo/states/lagos/lgas')).status).toBe(400);
  });

  it('serves public settings without access codes', async () => {
    await Settings.create({
      registrationMode: 'access_code',
      accessCodes: [{ codeHash: 'secret-hash', label: 'Org', active: true }],
    });
    const res = await h.api.get('/api/v1/settings/public');
    expect(res.status).toBe(200);
    expect(res.body.data.registrationMode).toBe('access_code');
    expect(JSON.stringify(res.body)).not.toMatch(/secret-hash|accessCodes/);
  });
});

describe('account deletion', () => {
  it('disables the account at once, signs the learner out, and anonymises it after 7 days', async () => {
    const a = await registerLearner('a@example.com', '08031111111');

    const del = await h.api.delete('/api/v1/me').set(auth(a.token));
    expect(del.status).toBe(202);
    expect(del.body.data.status).toBe('pending_deletion');

    expect((await h.api.get('/api/v1/me').set(auth(a.token))).status).toBe(401);
    const login = await h.api
      .post('/api/v1/auth/login')
      .send({ identifier: 'a@example.com', password: 'Correct-Horse-42' });
    expect(login.status).toBe(403);

    advance(h.clock, { days: 6 });
    expect(await anonymiseDueAccounts({ now: () => new Date(h.clock.now) })).toBe(0);

    advance(h.clock, { days: 2 });
    expect(await anonymiseDueAccounts({ now: () => new Date(h.clock.now) })).toBe(1);

    const stored = await User.findById(a.id).lean();
    expect(stored.name).toBe('Deleted user');
    expect(stored.email).toBeUndefined();
    expect(stored.phone).toBeUndefined();
    expect(stored.status).toBe('deactivated');
    expect(stored.anonymisedAt).toBeDefined();
  });
});
