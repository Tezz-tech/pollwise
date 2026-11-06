import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { generate, generateSecret } from 'otplib';
import { AuditLog, Enrollment, Upload, User } from '../src/models/index.js';
import { encryptSecret } from '../src/services/totpService.js';
import { hashPassword } from '../src/utils/password.js';
import {
  advance,
  cleanAsset,
  fakeCloudinary,
  resetData,
  START_TIME,
  startHarness,
  stopHarness,
} from './helpers/harness.js';

const PASSWORD = 'Admin-Strong-Pass-1';
const ID = 'dQw4w9WgXcQ';
let h;

beforeAll(async () => {
  h = await startHarness();
  h.net.impl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ title: 'Opening the unit' }),
  });
});
afterEach(async () => {
  await resetData();
  h.clock.now = new Date(START_TIME);
  h.cloud.client = undefined;
  h.net.impl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ title: 'Opening the unit' }),
  });
});
afterAll(stopHarness);

/** An admin with a password and no TOTP, signed in through the real admin route. */
async function signedIn(email, role) {
  // Super admins always need TOTP, so their test accounts have it enabled and sign in in two steps.
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
  expect(res.status).toBe(200);
  return {
    token: res.body.data.accessToken,
    id: String(user._id),
    auth: { Authorization: `Bearer ${res.body.data.accessToken}` },
  };
}

const writer = () => signedIn('writer@pollwise.test', 'content_admin');
const otherWriter = () => signedIn('other@pollwise.test', 'content_admin');
const boss = () => signedIn('boss@pollwise.test', 'super_admin');

const courseBody = (overrides = {}) => ({
  title: 'Polling unit opening',
  summary: 'What to do before the first voter arrives.',
  targetRoles: ['party_agent', 'official'],
  category: 'Election day',
  ...overrides,
});

const singleQuestion = (overrides = {}) => ({
  type: 'single_choice',
  prompt: 'Who signs the result sheet?',
  options: [
    { id: 'a', text: 'The agent' },
    { id: 'b', text: 'The presiding officer' },
  ],
  correctOptionId: 'b',
  explanation: 'The presiding officer signs.',
  ...overrides,
});

const videoLesson = (title = 'Opening the unit') => ({
  title,
  type: 'video',
  video: { youtubeId: ID, title, durationSec: 240, keyPoints: ['Arrive early'] },
});

/** Upload a cover image through the real sign and confirm routes, then attach it to the course. */
async function attachCover(who, courseId) {
  h.cloud.client = fakeCloudinary({});
  const sign = await h.api
    .post('/api/v1/admin/uploads/sign')
    .set(who.auth)
    .send({ courseId, kind: 'image' });
  expect(sign.status).toBe(200);
  const { publicId } = sign.body.data;
  const confirmed = await confirmWith(who, publicId, cleanAsset(publicId));
  expect(confirmed.status).toBe(200);
  return { url: confirmed.body.data.url, publicId };
}

/** Confirm an upload while the fake Cloudinary reports `asset` for it. */
async function confirmWith(who, publicId, asset) {
  return withCloudinary(fakeCloudinary({ [publicId]: asset }), () =>
    h.api.post('/api/v1/admin/uploads/confirm').set(who.auth).send({ publicId })
  );
}

/** Run `run` with `fake` answering as Cloudinary, then restore the unconfigured state. */
async function withCloudinary(fake, run) {
  h.cloud.client = fake;
  try {
    return await run();
  } finally {
    h.cloud.client = undefined;
  }
}

async function createCourse(who, overrides) {
  const res = await h.api.post('/api/v1/admin/courses').set(who.auth).send(courseBody(overrides));
  expect(res.status).toBe(201);
  return res.body.data;
}

async function addModuleWithLesson(who, courseId, title = 'Module one') {
  const mod = await h.api
    .post(`/api/v1/admin/courses/${courseId}/modules`)
    .set(who.auth)
    .send({ title });
  expect(mod.status).toBe(201);
  const lesson = await h.api
    .post(`/api/v1/admin/modules/${mod.body.data.id}/lessons`)
    .set(who.auth)
    .send(videoLesson());
  expect(lesson.status).toBe(201);
  return {
    moduleId: mod.body.data.id,
    assessmentId: mod.body.data.assessmentId,
    lessonId: lesson.body.data.id,
  };
}

describe('ownership: a content admin changes only their own courses', () => {
  it('another content admin cannot edit, publish or see a draft', async () => {
    const a = await writer();
    const b = await otherWriter();
    const course = await createCourse(a);

    const edit = await h.api
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set(b.auth)
      .send({ summary: 'Changed' });
    expect(edit.status).toBe(403);

    const draft = await h.api.get(`/api/v1/admin/courses/${course.id}`).set(b.auth);
    expect(draft.status).toBe(404);

    const publish = await h.api.post(`/api/v1/admin/courses/${course.id}/publish`).set(b.auth);
    expect(publish.status).toBe(403);
  });

  it('a content admin cannot add a module to another admin’s course', async () => {
    const a = await writer();
    const b = await otherWriter();
    const course = await createCourse(a);
    const res = await h.api
      .post(`/api/v1/admin/courses/${course.id}/modules`)
      .set(b.auth)
      .send({ title: 'Sneaky' });
    expect(res.status).toBe(403);
  });

  it('content admins can read published courses by others, but not change them', async () => {
    const a = await writer();
    const b = await otherWriter();
    const course = await createCourse(a);
    await attachCoverAndPublishReady(a, course.id);

    const read = await h.api.get(`/api/v1/admin/courses/${course.id}`).set(b.auth);
    expect(read.status).toBe(200);

    const edit = await h.api
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set(b.auth)
      .send({ summary: 'Changed' });
    expect(edit.status).toBe(403);
  });

  it('only super admins can unpublish, archive or delete', async () => {
    const a = await writer();
    const course = await createCourse(a);
    expect(
      (await h.api.post(`/api/v1/admin/courses/${course.id}/unpublish`).set(a.auth)).status
    ).toBe(403);
    expect(
      (await h.api.post(`/api/v1/admin/courses/${course.id}/archive`).set(a.auth)).status
    ).toBe(403);
    expect((await h.api.delete(`/api/v1/admin/courses/${course.id}`).set(a.auth)).status).toBe(403);
  });

  it('a super admin can change any course', async () => {
    const a = await writer();
    const s = await boss();
    const course = await createCourse(a);
    const res = await h.api
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set(s.auth)
      .send({ summary: 'Edited by the boss' });
    expect(res.status).toBe(200);
  });

  it('a learner token cannot reach any admin content route', async () => {
    const reg = await h.api.post('/api/v1/auth/register').send({
      name: 'Learner',
      email: 'learner@example.com',
      phone: '08031234567',
      password: 'Correct-Horse-42',
    });
    const res = await h.api
      .post('/api/v1/admin/courses')
      .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
      .send(courseBody());
    expect(res.status).toBe(403);
  });
});

/** Make a course fully publishable: cover, one module, one lesson, one question. */
async function attachCoverAndPublishReady(who, courseId) {
  const { moduleId, assessmentId } = await addModuleWithLesson(who, courseId);
  void assessmentId;
  const cover = await attachCover(who, courseId);
  await h.api.patch(`/api/v1/admin/courses/${courseId}`).set(who.auth).send({ coverImage: cover });
  await h.api
    .put(`/api/v1/admin/modules/${moduleId}/assessment`)
    .set(who.auth)
    .send({
      questions: [singleQuestion()],
    });
  const published = await h.api.post(`/api/v1/admin/courses/${courseId}/publish`).set(who.auth);
  expect(published.status).toBe(200);
  return moduleId;
}

describe('publish checklist (SPEC §8.5)', () => {
  it('returns every problem at once, then succeeds once they are fixed', async () => {
    const a = await writer();
    const course = await createCourse(a);

    const empty = await h.api.post(`/api/v1/admin/courses/${course.id}/publish`).set(a.auth);
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe('PUBLISH_CHECKLIST_FAILED');
    const paths = empty.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['coverImage', 'modules']));

    const { moduleId } = await addModuleWithLesson(a, course.id);
    const partial = await h.api.post(`/api/v1/admin/courses/${course.id}/publish`).set(a.auth);
    expect(partial.status).toBe(422);
    const messages = partial.body.error.details.map((d) => d.message).join(' | ');
    expect(messages).toMatch(/cover image/i);
    expect(messages).toMatch(/gradable question/i);
    expect(partial.body.error.details.length).toBeGreaterThanOrEqual(2);

    const cover = await attachCover(a, course.id);
    await h.api.patch(`/api/v1/admin/courses/${course.id}`).set(a.auth).send({ coverImage: cover });
    await h.api
      .put(`/api/v1/admin/modules/${moduleId}/assessment`)
      .set(a.auth)
      .send({ questions: [singleQuestion()] });
    // The video length is saved by the editor (SPEC §7); this is the same effect.
    const lessonId = (await h.api.get(`/api/v1/admin/courses/${course.id}`).set(a.auth)).body.data
      .modules[0].lessons[0].id;
    await h.api
      .patch(`/api/v1/admin/modules/${moduleId}/lessons/${lessonId}`)
      .set(a.auth)
      .send(videoLesson());

    const ok = await h.api.post(`/api/v1/admin/courses/${course.id}/publish`).set(a.auth);
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('published');
  });

  it('unpublish (super admin) returns the course to draft', async () => {
    const a = await writer();
    const s = await boss();
    const course = await createCourse(a);
    await attachCoverAndPublishReady(a, course.id);
    const res = await h.api.post(`/api/v1/admin/courses/${course.id}/unpublish`).set(s.auth);
    expect(res.body.data.status).toBe('draft');
  });

  it('every action writes an audit entry', async () => {
    const a = await writer();
    const course = await createCourse(a);
    await h.api
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set(a.auth)
      .send({ summary: 'Updated summary' });
    const actions = (await AuditLog.find({ targetId: course.id }).lean()).map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining(['course.create', 'course.update']));
  });
});

describe('answer keys: each question type rejects an invalid key', () => {
  const bad = [
    [
      'single choice with a key that is not an option',
      {
        type: 'single_choice',
        prompt: 'x',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionId: 'zz',
      },
    ],
    [
      'multi choice with a key that is not an option',
      {
        type: 'multi_choice',
        prompt: 'x',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['a', 'zz'],
      },
    ],
    [
      'multi choice with a duplicate key',
      {
        type: 'multi_choice',
        prompt: 'x',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['a', 'a'],
      },
    ],
    ['true/false with a text answer', { type: 'true_false', prompt: 'x', correct: 'yes' }],
    [
      'matching with two pairs',
      {
        type: 'matching',
        prompt: 'x',
        pairs: [
          { id: 'p1', left: 'a', right: 'b' },
          { id: 'p2', left: 'c', right: 'd' },
        ],
      },
    ],
    [
      'ordering with a missing item in the key',
      {
        type: 'ordering',
        prompt: 'x',
        items: [
          { id: 'i1', text: 'a' },
          { id: 'i2', text: 'b' },
          { id: 'i3', text: 'c' },
        ],
        correctOrder: ['i1', 'i2'],
      },
    ],
    [
      'fill blank with the wrong number of answer lists',
      {
        type: 'fill_blank',
        prompt: 'x',
        template: 'The ___ and the ___',
        acceptedAnswers: [['one']],
      },
    ],
    [
      'fill blank with no blank in the template',
      { type: 'fill_blank', prompt: 'x', template: 'No gap here', acceptedAnswers: [['one']] },
    ],
  ];

  it.each(bad)('refuses %s', async (_label, question) => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId } = await addModuleWithLesson(a, course.id);
    const res = await h.api
      .put(`/api/v1/admin/modules/${moduleId}/assessment`)
      .set(a.auth)
      .send({ questions: [question] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('accepts a reflection question with no answer key, and it is worth nothing', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId } = await addModuleWithLesson(a, course.id);
    const res = await h.api
      .put(`/api/v1/admin/modules/${moduleId}/assessment`)
      .set(a.auth)
      .send({
        questions: [{ type: 'reflection', prompt: 'What will you do first?', points: 5 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.questions[0].points).toBe(0);
  });
});

describe('question versioning', () => {
  it('bumps the version only when the content changes', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId } = await addModuleWithLesson(a, course.id);
    const first = await h.api
      .put(`/api/v1/admin/modules/${moduleId}/assessment`)
      .set(a.auth)
      .send({ questions: [singleQuestion()] });
    const q = first.body.data.questions[0];
    expect(q.version).toBe(1);

    const same = await h.api
      .put(`/api/v1/admin/modules/${moduleId}/assessment`)
      .set(a.auth)
      .send({
        questions: [{ ...singleQuestion(), _id: q.id }],
      });
    expect(same.body.data.questions[0].version).toBe(1);

    const changed = await h.api
      .put(`/api/v1/admin/modules/${moduleId}/assessment`)
      .set(a.auth)
      .send({
        questions: [{ ...singleQuestion({ prompt: 'Who signs now?' }), _id: q.id }],
      });
    expect(changed.body.data.questions[0].version).toBe(2);
    expect(changed.body.data.questions[0].id).toBe(q.id);
  });

  it('stores item ids the server chose, not the admin’s readable ones', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId } = await addModuleWithLesson(a, course.id);
    const res = await h.api
      .put(`/api/v1/admin/modules/${moduleId}/assessment`)
      .set(a.auth)
      .send({ questions: [singleQuestion()] });
    const ids = res.body.data.questions[0].options.map((o) => o.id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('b');
    expect(res.body.data.questions[0].correctOptionId).toBe(ids[1]);
  });
});

describe('course structure: reorder keeps the order consistent', () => {
  it('refuses a reorder that drops or adds an item, and accepts a true permutation', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const m1 = await h.api
      .post(`/api/v1/admin/courses/${course.id}/modules`)
      .set(a.auth)
      .send({ title: 'One' });
    const m2 = await h.api
      .post(`/api/v1/admin/courses/${course.id}/modules`)
      .set(a.auth)
      .send({ title: 'Two' });
    const m3 = await h.api
      .post(`/api/v1/admin/courses/${course.id}/modules`)
      .set(a.auth)
      .send({ title: 'Three' });
    const [x, y, z] = [m1.body.data.id, m2.body.data.id, m3.body.data.id];

    const dropped = await h.api
      .put(`/api/v1/admin/courses/${course.id}/modules/order`)
      .set(a.auth)
      .send({ moduleIds: [x, y] });
    expect(dropped.status).toBe(400);

    const duplicated = await h.api
      .put(`/api/v1/admin/courses/${course.id}/modules/order`)
      .set(a.auth)
      .send({ moduleIds: [x, x, y] });
    expect(duplicated.status).toBe(400);

    const moved = await h.api
      .put(`/api/v1/admin/courses/${course.id}/modules/order`)
      .set(a.auth)
      .send({ moduleIds: [z, x, y] });
    expect(moved.status).toBe(200);
    const tree = await h.api.get(`/api/v1/admin/courses/${course.id}`).set(a.auth);
    expect(tree.body.data.modules.map((m) => m.id)).toEqual([z, x, y]);
    expect(tree.body.data.modules.map((m) => m.order)).toEqual([0, 1, 2]);
  });

  it('reorders lessons inside a module and deleting one renumbers the rest', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId, lessonId } = await addModuleWithLesson(a, course.id);
    const second = await h.api
      .post(`/api/v1/admin/modules/${moduleId}/lessons`)
      .set(a.auth)
      .send(videoLesson('Second'));
    const third = await h.api
      .post(`/api/v1/admin/modules/${moduleId}/lessons`)
      .set(a.auth)
      .send(videoLesson('Third'));
    const [s, t] = [second.body.data.id, third.body.data.id];

    const reordered = await h.api
      .put(`/api/v1/admin/modules/${moduleId}/lessons/order`)
      .set(a.auth)
      .send({ lessonIds: [t, lessonId, s] });
    expect(reordered.status).toBe(200);

    await h.api.delete(`/api/v1/admin/modules/${moduleId}/lessons/${lessonId}`).set(a.auth);
    const tree = await h.api.get(`/api/v1/admin/courses/${course.id}`).set(a.auth);
    expect(tree.body.data.modules[0].lessons.map((l) => l.id)).toEqual([t, s]);
    expect(tree.body.data.modules[0].lessons.map((l) => l.order)).toEqual([0, 1]);
  });

  it('a new module gets an empty assessment so the checklist can see it', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const mod = await h.api
      .post(`/api/v1/admin/courses/${course.id}/modules`)
      .set(a.auth)
      .send({ title: 'Solo' });
    expect(mod.body.data.assessmentId).toMatch(/^[a-f0-9]{24}$/);
  });
});

describe('uploads: signed, scoped, confirmed (SECURITY §7)', () => {
  it('answers 503 when Cloudinary is not configured', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const res = await h.api
      .post('/api/v1/admin/uploads/sign')
      .set(a.auth)
      .send({ courseId: course.id, kind: 'image' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UPLOADS_DISABLED');
  });

  it('signs for one folder and one kind, with a five-minute window', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const fake = fakeCloudinary({});
    await withCloudinary(fake, async () => {
      const res = await h.api
        .post('/api/v1/admin/uploads/sign')
        .set(a.auth)
        .send({ courseId: course.id, kind: 'pdf' });
      expect(res.status).toBe(200);
      expect(res.body.data.publicId.startsWith(`pollwise/courses/${course.id}/documents/`)).toBe(
        true
      );
      expect(res.body.data.allowedFormats).toEqual(['pdf']);
      expect(res.body.data.maxBytes).toBe(20 * 1024 * 1024);
      expect(new Date(res.body.data.expiresAt) - h.clock.now).toBe(5 * 60 * 1000);
    });
  });

  it('refuses SVG and any kind other than image or pdf', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const svg = await h.api
      .post('/api/v1/admin/uploads/sign')
      .set(a.auth)
      .send({ courseId: course.id, kind: 'svg' });
    expect(svg.status).toBe(400);
  });

  it('rejects an SVG that reaches confirmation, and removes it', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const fake = fakeCloudinary({});
    let publicId;
    await withCloudinary(fake, async () => {
      const sign = await h.api
        .post('/api/v1/admin/uploads/sign')
        .set(a.auth)
        .send({ courseId: course.id, kind: 'image' });
      publicId = sign.body.data.publicId;
    });
    const res = await confirmWith(a, publicId, cleanAsset(publicId, { format: 'svg' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UPLOAD_REJECTED');
    expect(res.body.error.message).toMatch(/JPEG, PNG or WebP/);
  });

  it('rejects an oversized image', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const sign = await withCloudinary(fakeCloudinary({}), () =>
      h.api
        .post('/api/v1/admin/uploads/sign')
        .set(a.auth)
        .send({ courseId: course.id, kind: 'image' })
    );
    const res = await confirmWith(
      a,
      sign.body.data.publicId,
      cleanAsset(sign.body.data.publicId, { bytes: 6 * 1024 * 1024 })
    );
    expect(res.status).toBe(422);
  });

  it('rejects a file that landed outside the signed folder', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const sign = await withCloudinary(fakeCloudinary({}), () =>
      h.api
        .post('/api/v1/admin/uploads/sign')
        .set(a.auth)
        .send({ courseId: course.id, kind: 'image' })
    );
    const elsewhere = `pollwise/other/${sign.body.data.publicId}`;
    const asset = { ...cleanAsset(sign.body.data.publicId), public_id: elsewhere };
    const res = await confirmWith(a, sign.body.data.publicId, asset);
    expect(res.status).toBe(422);
  });

  it('confirms a clean upload once, and records the real URL', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const sign = await withCloudinary(fakeCloudinary({}), () =>
      h.api
        .post('/api/v1/admin/uploads/sign')
        .set(a.auth)
        .send({ courseId: course.id, kind: 'image' })
    );
    const publicId = sign.body.data.publicId;
    const first = await confirmWith(a, publicId, cleanAsset(publicId));
    expect(first.status).toBe(200);
    expect(first.body.data.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    const again = await confirmWith(a, publicId, cleanAsset(publicId));
    expect(again.status).toBe(409);
  });

  it('refuses to confirm after the five-minute window closes', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const sign = await withCloudinary(fakeCloudinary({}), () =>
      h.api
        .post('/api/v1/admin/uploads/sign')
        .set(a.auth)
        .send({ courseId: course.id, kind: 'image' })
    );
    advance(h.clock, { minutes: 6 });
    const publicId = sign.body.data.publicId;
    const res = await confirmWith(a, publicId, cleanAsset(publicId));
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/window has closed/);
  });

  it('another admin cannot confirm someone else’s upload', async () => {
    const a = await writer();
    const b = await otherWriter();
    const course = await createCourse(a);
    const sign = await withCloudinary(fakeCloudinary({}), () =>
      h.api
        .post('/api/v1/admin/uploads/sign')
        .set(a.auth)
        .send({ courseId: course.id, kind: 'image' })
    );
    const res = await confirmWith(b, sign.body.data.publicId, cleanAsset(sign.body.data.publicId));
    expect(res.status).toBe(404);
  });

  it('a cover image must be a confirmed upload of this course', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const res = await h.api
      .patch(`/api/v1/admin/courses/${course.id}`)
      .set(a.auth)
      .send({
        coverImage: {
          url: 'https://res.cloudinary.com/pollwise-test/image/upload/fake.jpg',
          publicId: 'pollwise/fake',
        },
      });
    expect(res.status).toBe(400);
  });

  it('a lesson cannot point at a PDF that was never confirmed', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId } = await addModuleWithLesson(a, course.id);
    const res = await h.api
      .post(`/api/v1/admin/modules/${moduleId}/lessons`)
      .set(a.auth)
      .send({
        title: 'Read the guide',
        type: 'document',
        document: {
          url: 'https://res.cloudinary.com/pollwise-test/image/upload/guide.pdf',
          publicId: 'pollwise/courses/x/documents/never-uploaded',
          fileName: 'guide.pdf',
          bytes: 1000,
        },
      });
    expect(res.status).toBe(400);
  });

  it('a document lesson takes size and pages from the confirmed upload, not the request', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId } = await addModuleWithLesson(a, course.id);
    const sign = await withCloudinary(fakeCloudinary({}), () =>
      h.api
        .post('/api/v1/admin/uploads/sign')
        .set(a.auth)
        .send({ courseId: course.id, kind: 'pdf' })
    );
    const publicId = sign.body.data.publicId;
    const confirmed = await confirmWith(
      a,
      publicId,
      cleanAsset(publicId, { format: 'pdf', bytes: 300_000, pages: 6 })
    );
    expect(confirmed.status).toBe(200);

    const res = await h.api
      .post(`/api/v1/admin/modules/${moduleId}/lessons`)
      .set(a.auth)
      .send({
        title: 'Read the guide',
        type: 'document',
        document: { url: confirmed.body.data.url, publicId, fileName: 'guide.pdf', bytes: 1 },
      });
    expect(res.status).toBe(201);
    const stored = await h.api.get(`/api/v1/admin/courses/${course.id}`).set(a.auth);
    const lesson = stored.body.data.modules[0].lessons.find((l) => l.title === 'Read the guide');
    expect(lesson).toBeDefined();
    const row = await Upload.findOne({ publicId }).lean();
    expect(row.bytes).toBe(300_000);
  });
});

describe('YouTube lookup and video lessons', () => {
  it('returns title and thumbnail for a valid link', async () => {
    const a = await writer();
    const res = await h.api
      .get('/api/v1/admin/youtube/lookup')
      .set(a.auth)
      .query({ url: `https://youtu.be/${ID}` });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Opening the unit');
    expect(res.body.data.thumbnailUrl).toMatch(/^https:\/\/i\.ytimg\.com\//);
  });

  it('refuses a link that is not YouTube', async () => {
    const a = await writer();
    const res = await h.api
      .get('/api/v1/admin/youtube/lookup')
      .set(a.auth)
      .query({ url: 'https://evil.example/watch?v=dQw4w9WgXcQ' });
    expect(res.status).toBe(400);
  });

  it('answers 502 when the oEmbed call fails, without a stack trace', async () => {
    const a = await writer();
    h.net.impl = async () => {
      throw new Error('socket hang up');
    };
    const res = await h.api
      .get('/api/v1/admin/youtube/lookup')
      .set(a.auth)
      .query({ url: `https://youtu.be/${ID}` });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toMatch(/socket hang up|at .*\.js/);
  });

  it('a video lesson takes its thumbnail from the server, not the request', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId, lessonId } = await addModuleWithLesson(a, course.id);
    const tree = await h.api.get(`/api/v1/admin/courses/${course.id}`).set(a.auth);
    expect(tree.body.data.modules[0].lessons[0].id).toBe(lessonId);
    const res = await h.api
      .patch(`/api/v1/admin/modules/${moduleId}/lessons/${lessonId}`)
      .set(a.auth)
      .send({
        title: 'Opening',
        video: {
          youtubeId: ID,
          title: 'Opening',
          durationSec: 60,
          keyPoints: [],
          thumbnailUrl: 'https://evil.example/x.gif',
        },
      });
    expect(res.status).toBe(400);
  });
});

describe('rich text allowlist (SECURITY §4)', () => {
  it('refuses a text lesson containing a raw HTML node', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId } = await addModuleWithLesson(a, course.id);
    const res = await h.api
      .post(`/api/v1/admin/modules/${moduleId}/lessons`)
      .set(a.auth)
      .send({
        title: 'Text',
        type: 'text',
        text: {
          doc: {
            type: 'doc',
            content: [{ type: 'html', attrs: { value: '<script>alert(1)</script>' } }],
          },
          readMinutes: 2,
        },
      });
    expect(res.status).toBe(400);
  });

  it('accepts an allowed text lesson', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId } = await addModuleWithLesson(a, course.id);
    const res = await h.api
      .post(`/api/v1/admin/modules/${moduleId}/lessons`)
      .set(a.auth)
      .send({
        title: 'Text',
        type: 'text',
        text: {
          doc: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Arrive early.' }] }],
          },
          readMinutes: 2,
        },
      });
    expect(res.status).toBe(201);
  });
});

describe('delete and archive (SPEC §6)', () => {
  it('deleting a course with enrolments is refused; archiving works', async () => {
    const a = await writer();
    const s = await boss();
    const course = await createCourse(a);
    const learner = await User.create({
      name: 'L',
      email: 'l@example.com',
      passwordHash: await hashPassword(PASSWORD),
    });
    await Enrollment.create({ userId: learner._id, courseId: course.id, startedAt: new Date() });

    const del = await h.api.delete(`/api/v1/admin/courses/${course.id}`).set(s.auth);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('COURSE_HAS_ENROLMENTS');

    const archived = await h.api.post(`/api/v1/admin/courses/${course.id}/archive`).set(s.auth);
    expect(archived.body.data.status).toBe('archived');
  });

  it('deleting an unenrolled course removes it and its modules', async () => {
    const a = await writer();
    const s = await boss();
    const course = await createCourse(a);
    await addModuleWithLesson(a, course.id);
    const del = await h.api.delete(`/api/v1/admin/courses/${course.id}`).set(s.auth);
    expect(del.status).toBe(204);
    expect((await h.api.get(`/api/v1/admin/courses/${course.id}`).set(s.auth)).status).toBe(404);
  });
});

describe('preview (SPEC §6)', () => {
  it('shows the learner view and never the answer key', async () => {
    const a = await writer();
    const course = await createCourse(a);
    const { moduleId } = await addModuleWithLesson(a, course.id);
    await h.api
      .put(`/api/v1/admin/modules/${moduleId}/assessment`)
      .set(a.auth)
      .send({ questions: [singleQuestion()] });

    const res = await h.api.get(`/api/v1/admin/courses/${course.id}/preview`).set(a.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.modules[0].lessons[0].type).toBe('video');
    const body = JSON.stringify(res.body.data);
    expect(body).not.toMatch(
      /correctOptionId|correctOptionIds|acceptedAnswers|correctOrder|"correct"|explanation/
    );
  });
});

describe('module and lesson ownership in one place', () => {
  it('another admin cannot add a lesson to a module they do not own', async () => {
    const a = await writer();
    const b = await otherWriter();
    const course = await createCourse(a);
    const { moduleId } = await addModuleWithLesson(a, course.id);
    const res = await h.api
      .post(`/api/v1/admin/modules/${moduleId}/lessons`)
      .set(b.auth)
      .send(videoLesson('Mine now'));
    expect(res.status).toBe(403);
  });
});
