import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Lga, State } from '../src/models/index.js';
import { resetData, START_TIME, startHarness, stopHarness } from './helpers/harness.js';

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

async function learner(email, phone) {
  const res = await h.api
    .post('/api/v1/auth/register')
    .send({ name: 'State Tester', email, phone, password: 'Correct-Horse-42' });
  return res.body.data.accessToken;
}

describe('choosing a state during onboarding', () => {
  it('saves a state on its own, as the app does before the area question', async () => {
    await seedGeo();
    const token = await learner('state1@example.com', '08091111111');
    const res = await h.api.patch('/api/v1/me/profile').set(auth(token)).send({ stateCode: 'LA' });
    expect(res.status).toBe(200);
    expect(res.body.data.profile.stateCode).toBe('LA');
    expect(res.body.data.profile.lgaCode).toBeFalsy();
  });

  it('then accepts an area from that state', async () => {
    await seedGeo();
    const token = await learner('state2@example.com', '08092222222');
    await h.api.patch('/api/v1/me/profile').set(auth(token)).send({ stateCode: 'LA' });
    const res = await h.api
      .patch('/api/v1/me/profile')
      .set(auth(token))
      .send({ lgaCode: 'LA-IKEJA' });
    expect(res.status).toBe(200);
    expect(res.body.data.profile.lgaCode).toBe('LA-IKEJA');
  });

  it('clears the area when the state changes, so the old area never sticks to a new state', async () => {
    await seedGeo();
    const token = await learner('state3@example.com', '08093333333');
    await h.api.patch('/api/v1/me/profile').set(auth(token)).send({ stateCode: 'LA' });
    await h.api.patch('/api/v1/me/profile').set(auth(token)).send({ lgaCode: 'LA-IKEJA' });
    const res = await h.api.patch('/api/v1/me/profile').set(auth(token)).send({ stateCode: 'KN' });
    expect(res.body.data.profile.stateCode).toBe('KN');
    expect(res.body.data.profile.lgaCode).toBeFalsy();
  });

  it('refuses a state that does not exist', async () => {
    await seedGeo();
    const token = await learner('state4@example.com', '08094444444');
    const res = await h.api.patch('/api/v1/me/profile').set(auth(token)).send({ stateCode: 'ZZ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('refuses an area that belongs to a different state', async () => {
    await seedGeo();
    const token = await learner('state5@example.com', '08095555555');
    await h.api.patch('/api/v1/me/profile').set(auth(token)).send({ stateCode: 'KN' });
    const res = await h.api
      .patch('/api/v1/me/profile')
      .set(auth(token))
      .send({ lgaCode: 'LA-IKEJA' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
