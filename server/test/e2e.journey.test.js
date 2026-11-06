/**
 * End-to-end learner journey (Phase 10). Runs the whole path a learner takes, through the HTTP API, against a seeded
 * course and the in-memory database: sign-up, onboarding, enrolment, reading, practice, a module check, unlocking the
 * next module, the course check, the certificate, its download and its public check. A second learner fails a check,
 * retries and passes. Every step asserts what the app relies on.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { Assessment, Course, Lesson, Lga, Module, State } from '../src/models/index.js';
import { advance, resetData, START_TIME, startHarness, stopHarness } from './helpers/harness.js';

let h;
const ids = {};

beforeAll(async () => {
  h = await startHarness();
  await seedCourse();
});
afterAll(async () => {
  await resetData();
  await stopHarness();
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const id = () => new mongoose.Types.ObjectId();

/** A small TipTap document for the reading lesson. */
const doc = (heading, body) => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: heading }] },
    { type: 'paragraph', content: [{ type: 'text', text: body }] },
  ],
});

async function seedCourse() {
  await State.create({ code: 'LA', name: 'Lagos' });
  await Lga.create({ code: 'LA-IKEJA', stateCode: 'LA', name: 'Ikeja' });
  const course = id();
  const m1 = id();
  const m2 = id();
  const l1 = id();
  const l2 = id();
  const l3 = id();
  const a1 = id();
  const a2 = id();
  Object.assign(ids, { course, m1, m2, l1, l2, l3, a1, a2 });

  await Course.create({
    _id: course,
    title: 'Journey course',
    slug: 'journey-course',
    summary: 'End to end.',
    targetRoles: ['party_agent'],
    isRequired: true,
    status: 'published',
    publishedAt: new Date(START_TIME),
    createdBy: id(),
    moduleIds: [m1, m2],
  });
  await Module.create([
    {
      _id: m1,
      courseId: course,
      title: 'Module one',
      order: 0,
      lessonIds: [l1, l2],
      assessmentId: a1,
    },
    { _id: m2, courseId: course, title: 'Module two', order: 1, lessonIds: [l3], assessmentId: a2 },
  ]);
  await Lesson.create([
    {
      _id: l1,
      moduleId: m1,
      title: 'Arriving',
      order: 0,
      type: 'text',
      xp: 5,
      text: { doc: doc('Arrive early', 'Check the seals before the doors open.'), readMinutes: 1 },
    },
    {
      _id: l2,
      moduleId: m1,
      title: 'Ballot basics',
      order: 1,
      type: 'practice',
      xp: 2,
      practice: {
        questions: [
          {
            type: 'single_choice',
            prompt: 'Which ballot do you check first?',
            options: [
              { id: 'a', text: 'The white one' },
              { id: 'b', text: 'The blue one' },
            ],
            correctOptionId: 'b',
          },
        ],
      },
    },
    {
      _id: l3,
      moduleId: m2,
      title: 'Counting',
      order: 0,
      type: 'text',
      xp: 5,
      text: { doc: doc('Count twice', 'Two counts save an argument.'), readMinutes: 1 },
    },
  ]);
  await Assessment.create([
    {
      _id: a1,
      moduleId: m1,
      title: 'Check one',
      passMark: 50,
      maxAttempts: 2,
      revealAnswers: 'after_pass',
      questions: [
        {
          type: 'single_choice',
          prompt: 'Pick the first step.',
          options: [
            { id: 'a', text: 'Seals' },
            { id: 'b', text: 'Count' },
          ],
          correctOptionId: 'a',
        },
        { type: 'true_false', prompt: 'Seals are checked before the vote starts.', correct: true },
      ],
    },
    {
      _id: a2,
      moduleId: m2,
      title: 'Check two',
      passMark: 50,
      maxAttempts: 3,
      revealAnswers: 'after_pass',
      questions: [{ type: 'true_false', prompt: 'You count once and move on.', correct: false }],
    },
  ]);
}

/** Sign up, complete the About you answers, and return the session. */
async function newLearner(email, phone) {
  const reg = await h.api
    .post('/api/v1/auth/register')
    .send({ name: email.split('@')[0], email, phone, password: 'Correct-Horse-42' });
  expect(reg.status).toBe(201);
  const token = reg.body.data.accessToken;
  const profile = await h.api
    .patch('/api/v1/me/profile')
    .set(auth(token))
    .send({ stateCode: 'LA', lgaCode: 'LA-IKEJA', personnelRole: 'party_agent' });
  expect(profile.status).toBe(200);
  return { token, id: reg.body.data.user.id };
}

describe('learner journey: sign-up to certificate', () => {
  it('walks the whole path and ends with a downloadable, publicly checkable certificate', async () => {
    const learner = await newLearner('journey1@example.com', '08081111111');
    const me = auth(learner.token);

    // The catalogue offers the course for the learner's role, and the outline starts with only module one open.
    const catalogue = await h.api.get('/api/v1/courses').set(me);
    expect(catalogue.body.data.items.map((c) => c.slug)).toContain('journey-course');
    expect((await h.api.post(`/api/v1/courses/${ids.course}/enroll`).set(me)).status).toBe(200);
    let outline = (await h.api.get('/api/v1/courses/journey-course').set(me)).body.data;
    expect(outline.modules[0].locked).toBe(false);
    expect(outline.modules[1].locked).toBe(true);

    // Reading: the server enforces the minimum reading time, so the clock is moved on.
    const read = await h.api.get(`/api/v1/lessons/${ids.l1}`).set(me);
    expect(read.status).toBe(200);
    expect(read.body.data.lesson.text.doc).toBeDefined();
    advance(h.clock, { minutes: 1 });
    const done = await h.api.post(`/api/v1/lessons/${ids.l1}/complete`).set(me);
    expect(done.body.data.completed).toBe(true);
    expect(done.body.data.events.map((e) => e.type)).toContain('xp');

    // Practice: the learner's copy of the question carries no answer key, and a correct answer is marked.
    const practice = await h.api.get(`/api/v1/lessons/${ids.l2}`).set(me);
    const question = practice.body.data.lesson.questions[0];
    expect(JSON.stringify(question)).not.toMatch(/correctOptionId|"correct"/);
    const answer = await h.api
      .post(`/api/v1/lessons/${ids.l2}/practice/answer`)
      .set(me)
      .send({ questionId: question.id, response: { optionId: 'b' } });
    expect(answer.body.data.correct).toBe(true);
    expect(
      (await h.api.post(`/api/v1/lessons/${ids.l2}/complete`).set(me)).body.data.completed
    ).toBe(true);

    // The module check: both answers right, a pass, and module two opens.
    const attempt = (await h.api.post(`/api/v1/assessments/${ids.a1}/attempts`).set(me)).body.data
      .attempt;
    expect(attempt.questions).toHaveLength(2);
    for (const q of attempt.questions) {
      const response = q.type === 'single_choice' ? { optionId: 'a' } : { value: true };
      const r = await h.api
        .post(`/api/v1/attempts/${attempt.id}/answers`)
        .set(me)
        .send({ questionId: q.id, response });
      expect(r.body.data.correct).toBe(true);
    }
    const passed = await h.api.post(`/api/v1/attempts/${attempt.id}/submit`).set(me);
    expect(passed.body.data.result.passed).toBe(true);
    const types = passed.body.data.events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['module_passed', 'module_unlocked']));
    const reasons = passed.body.data.events.filter((e) => e.type === 'xp').map((e) => e.reason);
    expect(reasons).toEqual(expect.arrayContaining(['assessment_pass', 'assessment_first_try']));

    outline = (await h.api.get('/api/v1/courses/journey-course').set(me)).body.data;
    expect(outline.modules[1].locked).toBe(false);

    // Another learner cannot open this attempt, or see its result.
    const other = await newLearner('journey2@example.com', '08082222222');
    expect((await h.api.get(`/api/v1/attempts/${attempt.id}`).set(auth(other.token))).status).toBe(
      404
    );

    // Module two: read, then the course check. Passing the last module completes the course.
    advance(h.clock, { minutes: 1 });
    await h.api.get(`/api/v1/lessons/${ids.l3}`).set(me);
    advance(h.clock, { minutes: 1 });
    expect(
      (await h.api.post(`/api/v1/lessons/${ids.l3}/complete`).set(me)).body.data.completed
    ).toBe(true);
    const second = (await h.api.post(`/api/v1/assessments/${ids.a2}/attempts`).set(me)).body.data
      .attempt;
    await h.api
      .post(`/api/v1/attempts/${second.id}/answers`)
      .set(me)
      .send({ questionId: second.questions[0].id, response: { value: false } });
    const finished = await h.api.post(`/api/v1/attempts/${second.id}/submit`).set(me);
    expect(finished.body.data.result.passed).toBe(true);
    const completed = finished.body.data.events.find((e) => e.type === 'course_completed');
    expect(completed).toBeDefined();

    // The certificate: listed, downloadable through a short link, and checkable on the public page.
    const certs = (await h.api.get('/api/v1/me/certificates').set(me)).body.data.items;
    expect(certs).toHaveLength(1);
    expect(certs[0].id).toBe(completed.certificateId);
    const link = await h.api.get(`/api/v1/certificates/${certs[0].id}/pdf-link`).set(me);
    expect(link.body.data.expiresInSec).toBe(120);
    const pdf = await h.api.get(`/api/v1${link.body.data.path}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    const check = await h.api.get(`/api/v1/verify/${certs[0].code}`);
    expect(check.body.data.valid).toBe(true);
    expect(check.body.data.learnerName).toBeDefined();
  });

  it('lets a learner fail a check, see the result without answers, and retry to a pass', async () => {
    const learner = await newLearner('journey3@example.com', '08083333333');
    const me = auth(learner.token);
    await h.api.post(`/api/v1/courses/${ids.course}/enroll`).set(me);
    await h.api.get(`/api/v1/lessons/${ids.l1}`).set(me);
    advance(h.clock, { minutes: 1 });
    await h.api.post(`/api/v1/lessons/${ids.l1}/complete`).set(me);
    const practice = await h.api.get(`/api/v1/lessons/${ids.l2}`).set(me);
    await h.api
      .post(`/api/v1/lessons/${ids.l2}/practice/answer`)
      .set(me)
      .send({ questionId: practice.body.data.lesson.questions[0].id, response: { optionId: 'b' } });
    await h.api.post(`/api/v1/lessons/${ids.l2}/complete`).set(me);

    // First try: both answers wrong.
    const first = (await h.api.post(`/api/v1/assessments/${ids.a1}/attempts`).set(me)).body.data
      .attempt;
    for (const q of first.questions) {
      const response = q.type === 'single_choice' ? { optionId: 'b' } : { value: false };
      await h.api
        .post(`/api/v1/attempts/${first.id}/answers`)
        .set(me)
        .send({ questionId: q.id, response });
    }
    const failed = await h.api.post(`/api/v1/attempts/${first.id}/submit`).set(me);
    expect(failed.body.data.result.passed).toBe(false);
    // Answers are only revealed after a pass (the reveal rule), so a failed review is empty.
    expect(failed.body.data.result.review).toEqual([]);
    expect(failed.body.data.events.map((e) => e.type)).not.toContain('module_passed');

    // Retry: the server opens a new attempt, numbered two, and the pass is recorded with no first-try bonus.
    const retry = (await h.api.post(`/api/v1/assessments/${ids.a1}/attempts`).set(me)).body.data
      .attempt;
    expect(retry.id).not.toBe(first.id);
    expect(retry.attemptNumber).toBe(2);
    // Questions come back shuffled, so each answer is chosen by its type, not its position.
    for (const q of retry.questions) {
      const response = q.type === 'single_choice' ? { optionId: 'a' } : { value: true };
      await h.api
        .post(`/api/v1/attempts/${retry.id}/answers`)
        .set(me)
        .send({ questionId: q.id, response });
    }
    const passed = await h.api.post(`/api/v1/attempts/${retry.id}/submit`).set(me);
    expect(passed.body.data.result.passed).toBe(true);
    const reasons = passed.body.data.events.filter((e) => e.type === 'xp').map((e) => e.reason);
    expect(reasons).toContain('assessment_pass');
    expect(reasons).not.toContain('assessment_first_try');
  });
});
