import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { generate, generateSecret } from 'otplib';
import {
  Assessment,
  AssessmentAttempt,
  AuditLog,
  Course,
  Enrollment,
  Lga,
  Module,
  Settings,
  State,
  User,
} from '../src/models/index.js';
import { encryptSecret } from '../src/services/totpService.js';
import { hashPassword } from '../src/utils/password.js';
import { csvCell, csvLine, userFilter } from '../src/services/adminPeopleService.js';
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

const PASSWORD = 'Admin-Strong-Pass-1';

async function admin(email, role) {
  const secret = generateSecret();
  const user = await User.create({
    name: email.split('@')[0],
    email,
    passwordHash: await hashPassword(PASSWORD),
    role,
    security: {
      totpEnabled: role === 'super_admin',
      totpSecretEnc: encryptSecret(Buffer.from(h.config.TOTP_ENC_KEY, 'base64'), secret),
    },
  });
  let res = await h.api.post('/api/v1/auth/admin/login').send({ email, password: PASSWORD });
  if (res.body.data.needsTotp) {
    const code = await generate({ secret, epoch: h.clock.now.getTime() / 1000 });
    res = await h.api
      .post('/api/v1/auth/admin/totp')
      .send({ challengeToken: res.body.data.challengeToken, code });
  }
  return { id: String(user._id), auth: { Authorization: `Bearer ${res.body.data.accessToken}` } };
}

const superAdmin = () => admin('boss@pollwise.test', 'super_admin');
const writer = () => admin('writer@pollwise.test', 'content_admin');

/** A learner with a profile, created directly for fixtures. */
async function learner(i, over = {}) {
  return User.create({
    name: `Learner ${i}`,
    email: `learner${i}@example.com`,
    phone: `+23480${String(10000000 + i).slice(0, 8)}`,
    passwordHash: await hashPassword(PASSWORD),
    role: 'learner',
    status: 'active',
    profile: { stateCode: 'LA', lgaCode: 'LA-IKEJA', personnelRole: 'collation' },
    learning: { xp: i * 10 },
    ...over,
  });
}

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

/** A course with one module, one text lesson and an assessment with one question. */
async function course(title = 'Polling unit opening', extra = {}) {
  const creator = await User.findOne({ role: 'super_admin' }, { _id: 1 }).lean();
  const c = await Course.create({
    title,
    slug: `${title.toLowerCase().replace(/\W+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
    summary: 'x',
    targetRoles: ['collation'],
    status: 'published',
    createdBy: creator._id,
    moduleIds: [],
    ...extra,
  });
  const mod = await Module.create({ courseId: c._id, title: 'One', order: 0, lessonIds: [] });
  const assessment = await Assessment.create({
    moduleId: mod._id,
    title: 'Check',
    questions: [
      {
        type: 'single_choice',
        prompt: 'Who signs?',
        options: [
          { id: 'a', text: 'Agent' },
          { id: 'b', text: 'Officer' },
        ],
        correctOptionId: 'b',
        points: 1,
        version: 1,
      },
    ],
    maxAttempts: 1,
  });
  await Module.updateOne({ _id: mod._id }, { assessmentId: assessment._id });
  await Course.updateOne({ _id: c._id }, { moduleIds: [mod._id] });
  return { course: c, assessmentId: String(assessment._id), moduleId: String(mod._id) };
}

/* ------------------------------------------------------------------ role gate */

describe('a content admin gets 403 on every super admin route', () => {
  it.each([
    ['GET', '/api/v1/admin/users'],
    ['GET', '/api/v1/admin/users/export.csv'],
    ['GET', '/api/v1/admin/users/64b000000000000000000001'],
    ['PATCH', '/api/v1/admin/users/64b000000000000000000001/status'],
    ['POST', '/api/v1/admin/users/64b000000000000000000001/reset'],
    ['POST', '/api/v1/admin/users/64b000000000000000000001/attempts'],
    ['GET', '/api/v1/admin/reports/overview'],
    ['GET', '/api/v1/admin/reports/courses'],
    ['GET', '/api/v1/admin/reports/geography'],
    ['GET', '/api/v1/admin/admins'],
    ['DELETE', '/api/v1/admin/admins/64b000000000000000000001'],
    ['GET', '/api/v1/admin/settings'],
    ['PATCH', '/api/v1/admin/settings'],
    ['POST', '/api/v1/admin/settings/access-codes'],
    ['PATCH', '/api/v1/admin/settings/access-codes/64b000000000000000000001'],
    ['GET', '/api/v1/admin/audit-logs'],
  ])('%s %s is refused to a content admin', async (method, url) => {
    const w = await writer();
    const req = h.api[method.toLowerCase()](url).set(w.auth);
    const res = await (method === 'GET' || method === 'DELETE' ? req : req.send({}));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

/* ------------------------------------------------------------------ learners */

describe('learner list, filters and detail', () => {
  it('filters combine: area, status and a search term all apply together', async () => {
    const boss = await superAdmin();
    await learner(1, { name: 'Ada Okafor', 'profile.stateCode': 'LA' });
    await learner(2, {
      name: 'Ada Bello',
      profile: { stateCode: 'KN', lgaCode: 'KN-NASSARAWA', personnelRole: 'security' },
    });
    await learner(3, { name: 'Tunde Ada', status: 'deactivated' });
    await learner(4, { name: 'Ada Eze', 'profile.stateCode': 'LA' });

    const res = await h.api
      .get('/api/v1/admin/users')
      .set(boss.auth)
      .query({ q: 'ada', stateCode: 'LA', status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((u) => u.name).sort()).toEqual(['Ada Eze', 'Ada Okafor']);
    expect(res.body.data.total).toBe(2);
  });

  it('paginates and caps the page size at 100', async () => {
    const boss = await superAdmin();
    for (let i = 0; i < 5; i += 1) await learner(i);
    const page2 = await h.api
      .get('/api/v1/admin/users')
      .set(boss.auth)
      .query({ page: 2, limit: 2 });
    expect(page2.body.data.items).toHaveLength(2);
    expect(page2.body.data.total).toBe(5);
    expect(
      (await h.api.get('/api/v1/admin/users').set(boss.auth).query({ limit: 500 })).status
    ).toBe(400);
  });

  it('search text is escaped, so regex characters cannot change the filter', async () => {
    const boss = await superAdmin();
    await learner(1, { name: 'Plain name' });
    const res = await h.api.get('/api/v1/admin/users').set(boss.auth).query({ q: '.*' });
    expect(res.body.data.total).toBe(0);
  });

  it('the user filter never includes operators from the client', () => {
    const filter = userFilter({ status: 'active' });
    expect(JSON.stringify(filter)).not.toMatch(/\$where|\$regex":\s*"\.\*/);
  });

  it('user detail shows progress and every answer, and is audit-logged', async () => {
    const boss = await superAdmin();
    const u = await learner(1);
    const { course: c, assessmentId, moduleId } = await course();
    await Enrollment.create({
      userId: u._id,
      courseId: c._id,
      startedAt: START_TIME,
      passedModuleIds: [],
    });
    await AssessmentAttempt.create({
      userId: u._id,
      assessmentId,
      moduleId,
      courseId: c._id,
      attemptNumber: 1,
      questions: [
        {
          questionId: (await Assessment.findById(assessmentId).lean()).questions[0]._id,
          version: 1,
          snapshot: { type: 'single_choice', prompt: 'Who signs?', points: 1 },
        },
      ],
      answers: [
        {
          questionId: (await Assessment.findById(assessmentId).lean()).questions[0]._id,
          response: { optionId: 'a' },
          correct: false,
          pointsAwarded: 0,
          answeredAt: START_TIME,
        },
      ],
      status: 'submitted',
      score: 0,
      passed: false,
      passMark: 70,
      startedAt: START_TIME,
      expiresAt: START_TIME,
    });

    const res = await h.api.get(`/api/v1/admin/users/${u._id}`).set(boss.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.enrolments[0].courseTitle).toBe('Polling unit opening');
    expect(res.body.data.attempts[0].answers[0]).toMatchObject({
      prompt: 'Who signs?',
      correct: false,
    });
    expect(await AuditLog.countDocuments({ action: 'user.view', targetId: String(u._id) })).toBe(1);
  });

  it('a super admin cannot open an admin account through the learner detail route', async () => {
    const boss = await superAdmin();
    const res = await h.api.get(`/api/v1/admin/users/${boss.id}`).set(boss.auth);
    expect(res.status).toBe(404);
  });
});

/* ------------------------------------------------------------------ CSV export */

describe('CSV export (SECURITY §11)', () => {
  it('streams the filtered learners and records the export in the audit log', async () => {
    const boss = await superAdmin();
    await learner(1, { name: 'Ada, the "first"' });
    await learner(2, { name: 'Other', 'profile.stateCode': 'KN' });
    const res = await h.api
      .get('/api/v1/admin/users/export.csv')
      .set(boss.auth)
      .query({ stateCode: 'LA' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('id,name,email,phone,state,lga,personnel_role,status,xp,joined');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Ada, the ""first"""');
    expect(await AuditLog.countDocuments({ action: 'users.export', actorId: boss.id })).toBe(1);
  });

  it('neutralises spreadsheet formulas in exported text', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+1+1')).toBe(`"'+1+1"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('Plain')).toBe('"Plain"');
  });

  it('exports only the agreed columns, never security fields', () => {
    const line = csvLine({
      _id: '64b000000000000000000001',
      name: 'Ada',
      email: 'ada@example.com',
      passwordHash: 'SECRET-HASH',
      security: { totpSecretEnc: 'SECRET' },
      status: 'active',
      learning: { xp: 3 },
      createdAt: START_TIME,
    });
    expect(line).not.toMatch(/SECRET/);
  });
});

/* ------------------------------------------------------------------ status, reset and grants */

describe('deactivation, reset and extra attempts', () => {
  it('deactivating a learner ends their session at once', async () => {
    const boss = await superAdmin();
    const u = await learner(1);
    const login = await h.api
      .post('/api/v1/auth/login')
      .send({ identifier: 'learner1@example.com', password: PASSWORD });
    const token = login.body.data.accessToken;
    expect((await h.api.get('/api/v1/me').set('Authorization', `Bearer ${token}`)).status).toBe(
      200
    );

    const off = await h.api
      .patch(`/api/v1/admin/users/${u._id}/status`)
      .set(boss.auth)
      .send({ status: 'deactivated' });
    expect(off.status).toBe(200);
    expect((await h.api.get('/api/v1/me').set('Authorization', `Bearer ${token}`)).status).toBe(
      401
    );
    expect(
      await AuditLog.countDocuments({ action: 'user.deactivate', targetId: String(u._id) })
    ).toBe(1);
  });

  it('reactivating restores sign-in', async () => {
    const boss = await superAdmin();
    const u = await learner(1, { status: 'deactivated' });
    await h.api
      .patch(`/api/v1/admin/users/${u._id}/status`)
      .set(boss.auth)
      .send({ status: 'active' });
    const login = await h.api
      .post('/api/v1/auth/login')
      .send({ identifier: 'learner1@example.com', password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('a super admin cannot deactivate their own account', async () => {
    const boss = await superAdmin();
    const res = await h.api
      .patch(`/api/v1/admin/users/${boss.id}/status`)
      .set(boss.auth)
      .send({ status: 'deactivated' });
    expect(res.status).toBe(409);
  });

  it('sends a reset code to the learner and audit-logs it', async () => {
    const boss = await superAdmin();
    const u = await learner(1);
    const res = await h.api.post(`/api/v1/admin/users/${u._id}/reset`).set(boss.auth);
    expect(res.status).toBe(200);
    expect(
      await AuditLog.countDocuments({ action: 'user.password_reset_sent', targetId: String(u._id) })
    ).toBe(1);
  });

  it('a granted attempt lets a learner who used all their attempts start one more', async () => {
    const boss = await superAdmin();
    const { course: c, assessmentId, moduleId } = await course();
    const u = await learner(1);
    await Enrollment.create({
      userId: u._id,
      courseId: c._id,
      startedAt: START_TIME,
      passedModuleIds: [],
    });
    await AssessmentAttempt.create({
      userId: u._id,
      assessmentId,
      moduleId,
      courseId: c._id,
      attemptNumber: 1,
      questions: [],
      answers: [],
      status: 'submitted',
      score: 10,
      passed: false,
      passMark: 70,
      startedAt: START_TIME,
      expiresAt: START_TIME,
    });

    const granted = await h.api
      .post(`/api/v1/admin/users/${u._id}/attempts`)
      .set(boss.auth)
      .send({ assessmentId });
    expect(granted.status).toBe(200);
    expect(granted.body.data.granted).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'attempt.grant' })).toBe(1);
  });
});

/* ------------------------------------------------------------------ admins */

describe('admin accounts', () => {
  it('lists admins, and revoking one ends their sessions', async () => {
    const boss = await superAdmin();
    const w = await writer();
    const list = await h.api.get('/api/v1/admin/admins').set(boss.auth);
    expect(list.body.data.items.map((a) => a.role).sort()).toEqual([
      'content_admin',
      'super_admin',
    ]);

    const revoked = await h.api.delete(`/api/v1/admin/admins/${w.id}`).set(boss.auth);
    expect(revoked.status).toBe(200);
    expect((await h.api.get('/api/v1/admin/session').set(w.auth)).status).toBe(401);
    expect(await AuditLog.countDocuments({ action: 'admin.revoke' })).toBe(1);
  });

  it('the last active super admin cannot be revoked', async () => {
    const boss = await superAdmin();
    const other = await admin('second@pollwise.test', 'super_admin');
    await h.api.delete(`/api/v1/admin/admins/${other.id}`).set(boss.auth);
    // Now the boss is the only super admin left; a second super admin revoking them is blocked.
    const third = await admin('third@pollwise.test', 'super_admin');
    const res = await h.api.delete(`/api/v1/admin/admins/${third.id}`).set(boss.auth);
    expect(res.status).toBe(200);
    const blocked = await h.api.delete(`/api/v1/admin/admins/${boss.id}`).set(boss.auth);
    expect(blocked.status).toBe(409);
  });

  it('an admin cannot revoke themself', async () => {
    const boss = await superAdmin();
    const res = await h.api.delete(`/api/v1/admin/admins/${boss.id}`).set(boss.auth);
    expect(res.status).toBe(409);
  });
});

/* ------------------------------------------------------------------ settings and audit */

describe('settings, access codes and the audit log', () => {
  it('updates settings and audit-logs the changed fields', async () => {
    const boss = await superAdmin();
    const res = await h.api
      .patch('/api/v1/admin/settings')
      .set(boss.auth)
      .send({ defaultPassMark: 75, aboutText: 'About' });
    expect(res.status).toBe(200);
    expect(res.body.data.defaultPassMark).toBe(75);
    const audit = await AuditLog.findOne({ action: 'settings.update' }).lean();
    expect(audit.meta.fields.sort()).toEqual(['aboutText', 'defaultPassMark']);
  });

  it('refuses an unknown settings field (strict)', async () => {
    const boss = await superAdmin();
    const res = await h.api
      .patch('/api/v1/admin/settings')
      .set(boss.auth)
      .send({ registrationMode: 'open', admin: true });
    expect(res.status).toBe(400);
  });

  it('adds an access code, stores only its hash, and can switch it off', async () => {
    const boss = await superAdmin();
    const added = await h.api
      .post('/api/v1/admin/settings/access-codes')
      .set(boss.auth)
      .send({ label: 'Org', code: 'ORG-CODE-2026' });
    expect(added.status).toBe(201);
    expect(JSON.stringify(added.body)).not.toMatch(/ORG-CODE/);

    const stored = await Settings.findOne({}).select('+accessCodes').lean();
    expect(stored.accessCodes[0].codeHash).toMatch(/^\$argon2id\$/);

    const off = await h.api
      .patch(`/api/v1/admin/settings/access-codes/${added.body.data.id}`)
      .set(boss.auth)
      .send({ active: false });
    expect(off.body.data.active).toBe(false);
    const settingsView = await h.api.get('/api/v1/admin/settings').set(boss.auth);
    expect(JSON.stringify(settingsView.body)).not.toMatch(/codeHash|argon2/);
  });

  it('queries the audit log by action and date, and is read-only', async () => {
    const boss = await superAdmin();
    await h.api.patch('/api/v1/admin/settings').set(boss.auth).send({ aboutText: 'x' });
    const res = await h.api
      .get('/api/v1/admin/audit-logs')
      .set(boss.auth)
      .query({ action: 'settings.update' });
    expect(res.body.data.total).toBe(1);
    const future = await h.api
      .get('/api/v1/admin/audit-logs')
      .set(boss.auth)
      .query({ from: '2100-01-01' });
    expect(future.body.data.total).toBe(0);
    expect(
      (await h.api.delete('/api/v1/admin/audit-logs/64b000000000000000000001').set(boss.auth))
        .status
    ).toBe(404);
  });
});

/* ------------------------------------------------------------------ reports */

describe('reports', () => {
  it('overview returns KPIs and a 30-day series in Lagos days', async () => {
    const boss = await superAdmin();
    await learner(1);
    await learner(2);
    const res = await h.api.get('/api/v1/admin/reports/overview').set(boss.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.learners).toBe(2);
    expect(res.body.data.series).toHaveLength(30);
    expect(res.body.data.series[29].day).toBe('2026-11-06');
    expect(res.body.data.series[29].joined).toBeGreaterThanOrEqual(0);
  });

  it('per-course stats count enrolments, completions and average score', async () => {
    const boss = await superAdmin();
    const { course: c, assessmentId, moduleId } = await course('Stats course');
    const u1 = await learner(1);
    const u2 = await learner(2);
    await Enrollment.create({
      userId: u1._id,
      courseId: c._id,
      startedAt: START_TIME,
      status: 'completed',
      passedModuleIds: [],
    });
    await Enrollment.create({
      userId: u2._id,
      courseId: c._id,
      startedAt: START_TIME,
      passedModuleIds: [],
    });
    await AssessmentAttempt.create({
      userId: u1._id,
      assessmentId,
      moduleId,
      courseId: c._id,
      attemptNumber: 1,
      questions: [],
      answers: [],
      status: 'submitted',
      score: 80,
      passed: true,
      passMark: 70,
      startedAt: START_TIME,
      expiresAt: START_TIME,
    });
    const res = await h.api.get('/api/v1/admin/reports/courses').set(boss.auth);
    const row = res.body.data.items.find((r) => r.title === 'Stats course');
    expect(row).toMatchObject({ enrolled: 2, completed: 1, completionPct: 50, averageScore: 80 });
  });

  it('geography drills from states to LGAs', async () => {
    const boss = await superAdmin();
    await seedGeo();
    const u1 = await learner(1);
    const u2 = await learner(2, { 'profile.stateCode': 'KN', 'profile.lgaCode': 'KN-NASSARAWA' });
    const { course: c } = await course('Geo course');
    await Enrollment.create({
      userId: u1._id,
      courseId: c._id,
      startedAt: START_TIME,
      status: 'completed',
      stateCode: 'LA',
      lgaCode: 'LA-IKEJA',
      passedModuleIds: [],
    });
    await Enrollment.create({
      userId: u2._id,
      courseId: c._id,
      startedAt: START_TIME,
      passedModuleIds: [],
      stateCode: 'KN',
      lgaCode: 'KN-NASSARAWA',
    });

    const states = await h.api.get('/api/v1/admin/reports/geography').set(boss.auth);
    expect(states.body.data.level).toBe('state');
    const la = states.body.data.items.find((r) => r.code === 'LA');
    expect(la).toMatchObject({ name: 'Lagos', enrolled: 1, completed: 1, completionPct: 100 });

    const lgas = await h.api
      .get('/api/v1/admin/reports/geography')
      .set(boss.auth)
      .query({ stateCode: 'KN' });
    expect(lgas.body.data.level).toBe('lga');
    expect(lgas.body.data.items.map((r) => r.code)).toEqual(['KN-NASSARAWA']);
  });

  it('rejects a malformed state code in the drill-down', async () => {
    const boss = await superAdmin();
    expect(
      (
        await h.api
          .get('/api/v1/admin/reports/geography')
          .set(boss.auth)
          .query({ stateCode: 'lagos' })
      ).status
    ).toBe(400);
  });
});
