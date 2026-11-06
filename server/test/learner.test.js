import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  Assessment,
  AssessmentAttempt,
  Certificate,
  Course,
  Enrollment,
  Lesson,
  LessonProgress,
  Module,
  User,
  XpEvent,
} from '../src/models/index.js';
import { awardXp } from '../src/services/progressService.js';
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

const YT = 'dQw4w9WgXcQ';
const PASSWORD = 'Correct-Horse-42';
let counter = 0;

/* ------------------------------------------------------------------ fixtures */

/** Question factories. Ids are plain strings here; in production the server chooses them at random. */
const Q = {
  single: (points = 1, correct = 'b') => ({
    type: 'single_choice',
    prompt: 'Who signs the result sheet?',
    options: [
      { id: 'a', text: 'The agent' },
      { id: 'b', text: 'The presiding officer' },
    ],
    correctOptionId: correct,
    points,
    version: 1,
    explanation: 'The presiding officer signs.',
  }),
  multi: () => ({
    type: 'multi_choice',
    prompt: 'Pick all',
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' },
    ],
    correctOptionIds: ['a', 'c'],
    points: 1,
    version: 1,
  }),
  tf: (correct = true) => ({ type: 'true_false', prompt: 'True?', correct, points: 1, version: 1 }),
  matching: () => ({
    type: 'matching',
    prompt: 'Match',
    pairs: [
      { id: 'p1', left: 'EC8A', right: 'Unit result', rightId: 'r1' },
      { id: 'p2', left: 'BVAS', right: 'Accreditation', rightId: 'r2' },
      { id: 'p3', left: 'Collation', right: 'Ward totals', rightId: 'r3' },
    ],
    points: 1,
    version: 1,
  }),
  ordering: () => ({
    type: 'ordering',
    prompt: 'Order',
    items: [
      { id: 'i1', text: 'Open' },
      { id: 'i2', text: 'Count' },
      { id: 'i3', text: 'Sign' },
    ],
    correctOrder: ['i1', 'i2', 'i3'],
    points: 1,
    version: 1,
  }),
  fill: () => ({
    type: 'fill_blank',
    prompt: 'Fill',
    template: 'The ___ must sign the sheet.',
    acceptedAnswers: [['presiding officer']],
    points: 1,
    version: 1,
  }),
};

/**
 * Build a published course directly in the database.
 * modules: [{ lessons: ['text'|'video'|'practice'|'document'], questions: [...], assessment: {...} }]
 */
async function makeCourse({
  modules: specs = [{ lessons: ['text'], questions: [Q.single()] }],
  targetRoles = ['party_agent'],
  isRequired = false,
  status = 'published',
  textMinutes = 1,
  videoSeconds = 100,
} = {}) {
  counter += 1;
  const course = await Course.create({
    title: `Course ${counter}`,
    slug: `course-${counter}-${Math.random().toString(36).slice(2, 6)}`,
    summary: 'Summary',
    category: 'Election day',
    targetRoles,
    isRequired,
    status,
    publishedAt: status === 'published' ? START_TIME : undefined,
    createdBy: await adminId(),
    moduleIds: [],
  });
  const out = { courseId: String(course._id), slug: course.slug, modules: [] };
  for (const [mi, spec] of specs.entries()) {
    const mod = await Module.create({
      courseId: course._id,
      title: `Module ${mi + 1}`,
      order: mi,
      lessonIds: [],
    });
    const lessonIds = [];
    const lessonList = [];
    for (const [li, type] of spec.lessons.entries()) {
      const base = {
        moduleId: mod._id,
        title: `${type} ${mi + 1}.${li + 1}`,
        order: li,
        type,
        xp: 5,
      };
      const lesson =
        type === 'video'
          ? await Lesson.create({
              ...base,
              xp: 10,
              video: {
                youtubeId: YT,
                title: 'Video',
                thumbnailUrl: `https://i.ytimg.com/vi/${YT}/hq.jpg`,
                durationSec: videoSeconds,
                keyPoints: [],
              },
            })
          : type === 'practice'
            ? await Lesson.create({
                ...base,
                practice: { questions: spec.practice ?? [Q.single()] },
              })
            : type === 'document'
              ? await Lesson.create({
                  ...base,
                  document: {
                    url: 'https://res.cloudinary.com/x/y.pdf',
                    publicId: 'pollwise/doc',
                    fileName: 'guide.pdf',
                    bytes: 1000,
                    pages: 2,
                  },
                })
              : await Lesson.create({
                  ...base,
                  text: {
                    doc: {
                      type: 'doc',
                      content: [
                        { type: 'paragraph', content: [{ type: 'text', text: 'Read this.' }] },
                      ],
                    },
                    readMinutes: textMinutes,
                  },
                });
      lessonIds.push(lesson._id);
      lessonList.push({ id: String(lesson._id), type });
    }
    const assessment = await Assessment.create({
      moduleId: mod._id,
      title: `Check ${mi + 1}`,
      questions: spec.questions ?? [Q.single()],
      passMark: spec.passMark ?? null,
      drawCount: spec.drawCount ?? null,
      maxAttempts: spec.maxAttempts ?? null,
      timeLimitMin: spec.timeLimitMin ?? null,
      shuffleQuestions: spec.shuffleQuestions ?? false,
      shuffleOptions: spec.shuffleOptions ?? false,
      revealAnswers: spec.revealAnswers ?? 'after_pass',
    });
    await Module.updateOne({ _id: mod._id }, { lessonIds, assessmentId: assessment._id });
    await Course.updateOne({ _id: course._id }, { $push: { moduleIds: mod._id } });
    out.modules.push({
      id: String(mod._id),
      lessons: lessonList,
      assessmentId: String(assessment._id),
    });
  }
  return out;
}

let adminCache;
async function adminId() {
  if (!adminCache) {
    const admin = await User.create({
      name: 'Admin',
      email: `admin${Date.now()}@pollwise.test`,
      passwordHash: 'x',
      role: 'content_admin',
    });
    adminCache = admin._id;
  }
  return adminCache;
}

/** A learner registered through the real route, with a role so the catalogue default applies. */
async function learner(email = `l${++counter}@example.com`, role = 'party_agent') {
  const res = await h.api.post('/api/v1/auth/register').send({
    name: 'Learner',
    email,
    phone: `0803${String(counter).padStart(7, '0')}`,
    password: PASSWORD,
  });
  const id = res.body.data.user.id;
  await User.updateOne({ _id: id }, { 'profile.personnelRole': role });
  const auth = { Authorization: `Bearer ${res.body.data.accessToken}` };
  return { id, auth };
}

const get = (who, url) => h.api.get(url).set(who.auth);
const post = (who, url, body = {}) => h.api.post(url).set(who.auth).send(body);

async function enrol(who, course) {
  const res = await post(who, `/api/v1/courses/${course.courseId}/enroll`);
  expect(res.status).toBe(200);
  return res.body.data.enrollment;
}

/** Open a lesson and wait out the minimum reading time, then complete it. */
async function finishLesson(who, lessonId, seconds = 25) {
  await get(who, `/api/v1/lessons/${lessonId}`);
  advance(h.clock, { minutes: 0 });
  h.clock.now = new Date(h.clock.now.getTime() + seconds * 1000);
  return post(who, `/api/v1/lessons/${lessonId}/complete`);
}

/** Pass a single-module course: finish every lesson, then answer the check correctly. */
async function passModule(who, course, moduleIndex, answers) {
  const mod = course.modules[moduleIndex];
  for (const lesson of mod.lessons) {
    if (lesson.type === 'text') expect((await finishLesson(who, lesson.id)).status).toBe(200);
  }
  const start = await post(who, `/api/v1/assessments/${mod.assessmentId}/attempts`);
  expect(start.status).toBe(201);
  const attemptId = start.body.data.attempt.id;
  for (const [i, q] of start.body.data.attempt.questions.entries()) {
    const response = answers(q, i);
    const res = await post(who, `/api/v1/attempts/${attemptId}/answers`, {
      questionId: q.id,
      response,
    });
    expect(res.status).toBe(200);
  }
  return post(who, `/api/v1/attempts/${attemptId}/submit`);
}

/* ------------------------------------------------------------------ catalogue and outline */

describe('catalogue and outline', () => {
  it('shows a learner the courses for their role by default, and everything with role=all', async () => {
    const who = await learner();
    await makeCourse({ targetRoles: ['party_agent'] });
    await makeCourse({ targetRoles: ['security'] });
    const forYou = await get(who, '/api/v1/courses');
    expect(forYou.body.data.items).toHaveLength(1);
    const everything = await get(who, '/api/v1/courses?role=all');
    expect(everything.body.data.items).toHaveLength(2);
  });

  it('never lists drafts', async () => {
    const who = await learner();
    await makeCourse({ status: 'draft' });
    const res = await get(who, '/api/v1/courses?role=all');
    expect(res.body.data.items).toHaveLength(0);
  });

  it('shows locks on the outline: only the first lesson is open before enrolling', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [
        { lessons: ['text', 'text'], questions: [Q.single()] },
        { lessons: ['text'], questions: [Q.single()] },
      ],
    });
    const res = await get(who, `/api/v1/courses/${course.slug}`);
    expect(res.status).toBe(200);
    const [m1, m2] = res.body.data.modules;
    expect(m1.lessons.map((l) => l.locked)).toEqual([false, true]);
    expect(m1.assessment.locked).toBe(true);
    expect(m2.locked).toBe(true);
  });

  it('enrolment is idempotent and needs a published course', async () => {
    const who = await learner();
    const course = await makeCourse();
    const first = await enrol(who, course);
    const again = await enrol(who, course);
    expect(again.id).toBe(first.id);
    expect(await Enrollment.countDocuments({ courseId: course.courseId })).toBe(1);

    const draft = await makeCourse({ status: 'draft' });
    expect((await post(who, `/api/v1/courses/${draft.courseId}/enroll`)).status).toBe(404);
  });
});

/* ------------------------------------------------------------------ lessons */

describe('lessons: locks, minimum time, completion and XP', () => {
  it('lesson 2 is locked until lesson 1 is done (423)', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text', 'text'], questions: [Q.single()] }],
    });
    await enrol(who, course);
    const res = await get(who, `/api/v1/lessons/${course.modules[0].lessons[1].id}`);
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('LESSON_LOCKED');
  });

  it('refuses a lesson to someone who is not enrolled', async () => {
    const who = await learner();
    const course = await makeCourse();
    const res = await get(who, `/api/v1/lessons/${course.modules[0].lessons[0].id}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ENROLLED');
  });

  it('a text lesson cannot be completed before its minimum time, and completes after it', async () => {
    const who = await learner();
    const course = await makeCourse({ modules: [{ lessons: ['text'], questions: [Q.single()] }] });
    await enrol(who, course);
    const lessonId = course.modules[0].lessons[0].id;
    await get(who, `/api/v1/lessons/${lessonId}`);
    const early = await post(who, `/api/v1/lessons/${lessonId}/complete`);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('TOO_SOON');

    h.clock.now = new Date(h.clock.now.getTime() + 25_000);
    const done = await post(who, `/api/v1/lessons/${lessonId}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.data.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'xp', amount: 5, reason: 'lesson_text' }),
        expect.objectContaining({ type: 'lesson_completed', lessonId }),
      ])
    );
  });

  it('completing twice awards XP once', async () => {
    const who = await learner();
    const course = await makeCourse({ modules: [{ lessons: ['text'], questions: [Q.single()] }] });
    await enrol(who, course);
    const lessonId = course.modules[0].lessons[0].id;
    await finishLesson(who, lessonId);
    const again = await post(who, `/api/v1/lessons/${lessonId}/complete`);
    expect(again.body.data.events).toEqual([]);
    expect(await XpEvent.countDocuments({ reason: 'lesson_text' })).toBe(1);
  });

  it('XP is never awarded twice under concurrent duplicate requests', async () => {
    const who = await learner();
    const course = await makeCourse({ modules: [{ lessons: ['text'], questions: [Q.single()] }] });
    await enrol(who, course);
    const lessonId = course.modules[0].lessons[0].id;
    await get(who, `/api/v1/lessons/${lessonId}`);
    h.clock.now = new Date(h.clock.now.getTime() + 25_000);
    await Promise.all([1, 2, 3, 4].map(() => post(who, `/api/v1/lessons/${lessonId}/complete`)));
    expect(await XpEvent.countDocuments({ reason: 'lesson_text', refId: lessonId })).toBe(1);
    const user = await User.findById(who.id).lean();
    expect(user.learning.xp).toBe(5);
  });

  it('the same XP award cannot be recorded twice directly either', async () => {
    const who = await learner();
    const ctx = { now: () => h.clock.now };
    const first = await awardXp(ctx, who.id, { reason: 'probe', refId: 'once', amount: 7 });
    const second = await awardXp(ctx, who.id, { reason: 'probe', refId: 'once', amount: 7 });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('a video completes by watching: continuous play to 90% counts, a seek to the end does not', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['video'], questions: [Q.single()] }],
      videoSeconds: 100,
    });
    await enrol(who, course);
    const lessonId = course.modules[0].lessons[0].id;
    await get(who, `/api/v1/lessons/${lessonId}`);

    // Seek straight to the end: nothing counts.
    await post(who, `/api/v1/lessons/${lessonId}/heartbeat`, { positionSec: 0 });
    h.clock.now = new Date(h.clock.now.getTime() + 10_000);
    const seek = await post(who, `/api/v1/lessons/${lessonId}/heartbeat`, { positionSec: 100 });
    expect(seek.body.data.completed).toBe(false);
    h.clock.now = new Date(h.clock.now.getTime() + 10_000);
    const seekAgain = await post(who, `/api/v1/lessons/${lessonId}/heartbeat`, {
      positionSec: 100,
    });
    expect(seekAgain.body.data.completed).toBe(false);

    // Now watch honestly: 10 s of playing per 10 s of real time.
    let position = 100;
    let last;
    for (let i = 0; i < 12; i += 1) {
      h.clock.now = new Date(h.clock.now.getTime() + 10_000);
      position += 10;
      last = await post(who, `/api/v1/lessons/${lessonId}/heartbeat`, { positionSec: position });
      if (last.body.data.completed) break;
    }
    expect(last.body.data.completed).toBe(true);
    expect(last.body.data.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'xp', amount: 10 })])
    );
  });

  it('a video cannot be completed with /complete', async () => {
    const who = await learner();
    const course = await makeCourse({ modules: [{ lessons: ['video'], questions: [Q.single()] }] });
    await enrol(who, course);
    const lessonId = course.modules[0].lessons[0].id;
    await get(who, `/api/v1/lessons/${lessonId}`);
    expect((await post(who, `/api/v1/lessons/${lessonId}/complete`)).status).toBe(400);
  });

  it('a document opens and completes after the minimum time', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['document'], questions: [Q.single()] }],
    });
    await enrol(who, course);
    const lessonId = course.modules[0].lessons[0].id;
    await get(who, `/api/v1/lessons/${lessonId}`);
    expect((await post(who, `/api/v1/lessons/${lessonId}/complete`)).body.error?.code).toBe(
      'TOO_SOON'
    );
    h.clock.now = new Date(h.clock.now.getTime() + 11_000);
    const done = await post(who, `/api/v1/lessons/${lessonId}/complete`);
    expect(done.body.data.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'lesson_document', amount: 5 })])
    );
  });

  it('practice: each question is answered once, and completion waits for all of them', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['practice'], questions: [Q.single()] }],
    });
    // Replace the practice questions with two known ones.
    const practiceLesson = course.modules[0].lessons[0];
    const questions = [Q.single(1, 'b'), Q.tf(true)];
    await Lesson.updateOne({ _id: practiceLesson.id }, { 'practice.questions': questions });
    await enrol(who, course);
    await get(who, `/api/v1/lessons/${practiceLesson.id}`);
    const lesson = await get(who, `/api/v1/lessons/${practiceLesson.id}`);
    const [q1, q2] = lesson.body.data.lesson.questions;

    const early = await post(who, `/api/v1/lessons/${practiceLesson.id}/complete`);
    expect(early.body.error.code).toBe('NOT_READY');

    const first = await post(who, `/api/v1/lessons/${practiceLesson.id}/practice/answer`, {
      questionId: q1.id,
      response: { optionId: 'b' },
    });
    expect(first.body.data.correct).toBe(true);
    expect(first.body.data.explanation).toBe('The presiding officer signs.');
    expect(first.body.data.correctAnswer).toBe('The presiding officer');

    const twice = await post(who, `/api/v1/lessons/${practiceLesson.id}/practice/answer`, {
      questionId: q1.id,
      response: { optionId: 'a' },
    });
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe('ALREADY_ANSWERED');

    await post(who, `/api/v1/lessons/${practiceLesson.id}/practice/answer`, {
      questionId: q2.id,
      response: { value: false },
    });
    const done = await post(who, `/api/v1/lessons/${practiceLesson.id}/complete`);
    expect(done.body.data.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'lesson_practice', amount: 5 + 2 * 1 }),
      ])
    );
  });

  it('XP for a video is 10 and a daily goal is announced once', async () => {
    const who = await learner();
    await User.updateOne({ _id: who.id }, { 'learning.dailyGoalXp': 10 });
    const course = await makeCourse({ modules: [{ lessons: ['video'], questions: [Q.single()] }] });
    await enrol(who, course);
    const lessonId = course.modules[0].lessons[0].id;
    await get(who, `/api/v1/lessons/${lessonId}`);
    let position = 0;
    let last;
    for (let i = 0; i < 12; i += 1) {
      h.clock.now = new Date(h.clock.now.getTime() + 10_000);
      position += 10;
      last = await post(who, `/api/v1/lessons/${lessonId}/heartbeat`, { positionSec: position });
      if (last.body.data.completed) break;
    }
    expect(last.body.data.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['xp', 'lesson_completed', 'daily_goal_met'])
    );
    // A second announcement the same day is not sent.
    expect(await XpEvent.countDocuments({ reason: 'daily_goal_met' })).toBe(1);
  });
});

/* ------------------------------------------------------------------ assessments */

describe('assessments: locks, attempts, grading', () => {
  it('the check is locked until every lesson in the module is complete (423)', async () => {
    const who = await learner();
    const course = await makeCourse({ modules: [{ lessons: ['text'], questions: [Q.single()] }] });
    await enrol(who, course);
    const res = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ASSESSMENT_LOCKED');
  });

  it('module 2 stays locked until module 1 is passed', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [
        { lessons: ['text'], questions: [Q.single(1, 'b')] },
        { lessons: ['text'], questions: [Q.single(1, 'b')] },
      ],
    });
    await enrol(who, course);
    await finishLesson(who, course.modules[1].lessons[0].id);
    expect((await get(who, `/api/v1/lessons/${course.modules[1].lessons[0].id}`)).status).toBe(423);
  });

  it('starts an attempt without answer keys, and resumes the same one', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [
        {
          lessons: ['text'],
          questions: [Q.single(), Q.multi(), Q.tf(), Q.matching(), Q.ordering(), Q.fill()],
        },
      ],
    });
    await enrol(who, course);
    await finishLesson(who, course.modules[0].lessons[0].id);

    const first = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    expect(first.status).toBe(201);
    const second = await post(
      who,
      `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`
    );
    expect(second.body.data.attempt.id).toBe(first.body.data.attempt.id);
    expect(first.body.data.attempt.questions).toHaveLength(6);
  });

  it('answering a question twice is refused with 409', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')] }],
    });
    await enrol(who, course);
    await finishLesson(who, course.modules[0].lessons[0].id);
    const start = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    const attemptId = start.body.data.attempt.id;
    const qid = start.body.data.attempt.questions[0].id;
    expect(
      (
        await post(who, `/api/v1/attempts/${attemptId}/answers`, {
          questionId: qid,
          response: { optionId: 'b' },
        })
      ).status
    ).toBe(200);
    const again = await post(who, `/api/v1/attempts/${attemptId}/answers`, {
      questionId: qid,
      response: { optionId: 'a' },
    });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_ANSWERED');
  });

  it('grades every question type, and an answer for a made-up choice is a bad request', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [
        {
          lessons: ['text'],
          questions: [
            Q.single(1, 'b'),
            Q.multi(),
            Q.tf(true),
            Q.matching(),
            Q.ordering(),
            Q.fill(),
          ],
        },
      ],
    });
    await enrol(who, course);
    await finishLesson(who, course.modules[0].lessons[0].id);
    const start = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    const id = start.body.data.attempt.id;
    const qs = start.body.data.attempt.questions;
    const ask = (q, response) =>
      post(who, `/api/v1/attempts/${id}/answers`, { questionId: q.id, response });

    const bad = await ask(qs[0], { optionId: 'zzz' });
    expect(bad.status).toBe(400);

    const answers = [
      { optionId: 'b' },
      { optionIds: ['a', 'c'] },
      { value: true },
      { rightByLeft: { p1: 'r1', p2: 'r2', p3: 'r3' } },
      { order: ['i1', 'i2', 'i3'] },
      { blanks: ['  Presiding   Officer. '] },
    ];
    const results = [];
    for (const [i, q] of qs.entries()) {
      const r = await ask(q, answers[i]);
      results.push(r.body.data.correct);
    }
    expect(results).toEqual([true, true, true, true, true, true]);
  });

  it('a wrong multi-choice set is wrong, and so is a partial matching', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.multi(), Q.matching()] }],
    });
    await enrol(who, course);
    await finishLesson(who, course.modules[0].lessons[0].id);
    const start = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    const id = start.body.data.attempt.id;
    const [multi, matching] = start.body.data.attempt.questions;
    const r1 = await post(who, `/api/v1/attempts/${id}/answers`, {
      questionId: multi.id,
      response: { optionIds: ['a'] },
    });
    const r2 = await post(who, `/api/v1/attempts/${id}/answers`, {
      questionId: matching.id,
      response: { rightByLeft: { p1: 'r1', p2: 'r2' } },
    });
    expect(r1.body.data.correct).toBe(false);
    expect(r2.body.data.correct).toBe(false);
  });

  it('a score of exactly 70% passes and 69% fails (SPEC §8.2)', async () => {
    const who = await learner();
    // Ten questions worth 10 points each (the per-question maximum). Seven correct is exactly 70%.
    const course = await makeCourse({
      modules: [
        { lessons: ['text'], questions: Array.from({ length: 10 }, () => Q.single(10, 'b')) },
      ],
    });
    await enrol(who, course);
    const pass = await passModule(who, course, 0, (q, i) => ({ optionId: i < 7 ? 'b' : 'a' }));
    expect(pass.body.data.result.score).toBe(70);
    expect(pass.body.data.result.passed).toBe(true);
  });

  it('69% fails the check', async () => {
    const who = await learner();
    // Points 10,10,10,10,10,10,9 (= 69) then 10,10,10,1 (= 31). The first seven together are 69 points.
    const points = [10, 10, 10, 10, 10, 10, 9, 10, 10, 10, 1];
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: points.map((p) => Q.single(p, 'b')) }],
    });
    await enrol(who, course);
    const fail = await passModule(who, course, 0, (q, i) => ({ optionId: i < 7 ? 'b' : 'a' }));
    expect(fail.body.data.result.score).toBe(69);
    expect(fail.body.data.result.passed).toBe(false);
  });

  it('an assessment pass mark overrides the default: 60% passes a 50% mark but fails the default', async () => {
    const make = async (passMark) =>
      makeCourse({
        modules: [
          {
            lessons: ['text'],
            questions: Array.from({ length: 10 }, () => Q.single(1, 'b')),
            passMark,
          },
        ],
      });
    const low = await make(50);
    const high = await make(null);
    const who1 = await learner();
    const who2 = await learner();
    await enrol(who1, low);
    await enrol(who2, high);
    const answer = (q, i) => ({ optionId: i < 6 ? 'b' : 'a' });
    const passLow = await passModuleWithIndex(who1, low, answer);
    const failHigh = await passModuleWithIndex(who2, high, answer);
    expect(passLow.body.data.result).toMatchObject({ score: 60, passed: true, passMark: 50 });
    expect(failHigh.body.data.result).toMatchObject({ score: 60, passed: false, passMark: 70 });
  });

  it('editing a question during an attempt does not change how that attempt is graded', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')] }],
    });
    await enrol(who, course);
    await finishLesson(who, course.modules[0].lessons[0].id);
    const start = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    const id = start.body.data.attempt.id;
    const qid = start.body.data.attempt.questions[0].id;

    // The admin changes the key after the learner started.
    await Assessment.updateOne(
      { _id: course.modules[0].assessmentId },
      { 'questions.0.correctOptionId': 'a', 'questions.0.version': 2 }
    );

    await post(who, `/api/v1/attempts/${id}/answers`, {
      questionId: qid,
      response: { optionId: 'b' },
    });
    const submitted = await post(who, `/api/v1/attempts/${id}/submit`);
    expect(submitted.body.data.result.score).toBe(100);
  });

  it('an unanswered question scores 0 on submit', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b'), Q.single(1, 'b')] }],
    });
    await enrol(who, course);
    await finishLesson(who, course.modules[0].lessons[0].id);
    const start = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    const id = start.body.data.attempt.id;
    await post(who, `/api/v1/attempts/${id}/answers`, {
      questionId: start.body.data.attempt.questions[0].id,
      response: { optionId: 'b' },
    });
    const submitted = await post(who, `/api/v1/attempts/${id}/submit`);
    expect(submitted.body.data.result.score).toBe(50);
  });

  it('submitting twice returns the same result and no new events', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')] }],
    });
    await enrol(who, course);
    const pass = await passModule(who, course, 0, () => ({ optionId: 'b' }));
    expect(pass.body.data.events.length).toBeGreaterThan(0);
    const again = await post(who, `/api/v1/attempts/${pass.body.data.result.attemptId}/submit`);
    expect(again.body.data.events).toEqual([]);
    expect(again.body.data.result.score).toBe(100);
  });

  it('refuses more attempts once maxAttempts is used up (403)', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')], maxAttempts: 1 }],
    });
    await enrol(who, course);
    await passModule(who, course, 0, () => ({ optionId: 'a' }));
    const third = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    expect(third.status).toBe(403);
    expect(third.body.error.code).toBe('ATTEMPTS_EXHAUSTED');
  });

  it('an attempt that runs out of time is submitted automatically', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')], timeLimitMin: 1 }],
    });
    await enrol(who, course);
    await finishLesson(who, course.modules[0].lessons[0].id);
    const start = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    const id = start.body.data.attempt.id;
    h.clock.now = new Date(h.clock.now.getTime() + 2 * 60_000);
    const late = await post(who, `/api/v1/attempts/${id}/answers`, {
      questionId: start.body.data.attempt.questions[0].id,
      response: { optionId: 'b' },
    });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('ATTEMPT_EXPIRED');
    const after = await get(who, `/api/v1/attempts/${id}`);
    expect(after.body.data.attempt.status).toBe('expired');
  });

  it('the first pass awards the pass, first-try and perfect XP, and unlocks the next module', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [
        { lessons: ['text'], questions: [Q.single(1, 'b')] },
        { lessons: ['text'], questions: [Q.single(1, 'b')] },
      ],
    });
    await enrol(who, course);
    const pass = await passModule(who, course, 0, () => ({ optionId: 'b' }));
    const types = pass.body.data.events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['module_passed', 'module_unlocked', 'xp']));
    const xp = pass.body.data.events.filter((e) => e.type === 'xp').map((e) => e.reason);
    expect(xp).toEqual(
      expect.arrayContaining(['assessment_pass', 'assessment_first_try', 'assessment_perfect'])
    );
    const unlocked = pass.body.data.events.find((e) => e.type === 'module_unlocked');
    expect(unlocked.moduleId).toBe(course.modules[1].id);
    expect(pass.body.data.events.some((e) => e.type === 'course_completed')).toBe(false);
  });

  it('re-passing an assessment awards no XP', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')] }],
    });
    await enrol(who, course);
    await passModule(who, course, 0, () => ({ optionId: 'b' }));
    const before = await XpEvent.countDocuments({ userId: who.id, reason: 'assessment_pass' });
    const again = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    expect(again.status).toBe(201);
    const second = await post(who, `/api/v1/attempts/${again.body.data.attempt.id}/answers`, {
      questionId: again.body.data.attempt.questions[0].id,
      response: { optionId: 'b' },
    });
    expect(second.status).toBe(200);
    const done = await post(who, `/api/v1/attempts/${again.body.data.attempt.id}/submit`);
    expect(done.body.data.events.filter((e) => e.type === 'xp')).toEqual([]);
    expect(await XpEvent.countDocuments({ userId: who.id, reason: 'assessment_pass' })).toBe(
      before
    );
  });
});

async function passModuleWithIndex(who, course, answer) {
  const mod = course.modules[0];
  for (const lesson of mod.lessons) await finishLesson(who, lesson.id);
  const start = await post(who, `/api/v1/assessments/${mod.assessmentId}/attempts`);
  const id = start.body.data.attempt.id;
  for (const [i, q] of start.body.data.attempt.questions.entries()) {
    await post(who, `/api/v1/attempts/${id}/answers`, { questionId: q.id, response: answer(q, i) });
  }
  return post(who, `/api/v1/attempts/${id}/submit`);
}

/* ------------------------------------------------------------------ course completion, certificates */

describe('course completion, certificates and verification', () => {
  it('finishing the last module completes the course, issues a certificate, and it downloads and verifies', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')] }],
    });
    await enrol(who, course);
    const pass = await passModule(who, course, 0, () => ({ optionId: 'b' }));
    const done = pass.body.data.events.find((e) => e.type === 'course_completed');
    expect(done).toBeDefined();
    expect(await Certificate.countDocuments({ userId: who.id })).toBe(1);

    const list = await get(who, '/api/v1/me/certificates');
    const cert = list.body.data.items[0];
    expect(cert.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);

    const pdf = await h.api
      .get(`/api/v1/certificates/${cert.id}/pdf`)
      .set(who.auth)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');

    const verified = await h.api.get(`/api/v1/verify/${cert.code}`);
    expect(verified.body.data.valid).toBe(true);
    expect(Object.keys(verified.body.data).sort()).toEqual([
      'courseTitle',
      'issuedAt',
      'learnerName',
      'valid',
    ]);
  });

  it('an unknown or malformed code verifies as not valid', async () => {
    expect((await h.api.get('/api/v1/verify/ABCDEFGHJK')).body.data.valid).toBe(false);
    expect((await h.api.get('/api/v1/verify/ILLEGAL000')).body.data.valid).toBe(false);
  });
});

/* ------------------------------------------------------------------ privacy between learners */

describe('learner A cannot reach learner B’s data', () => {
  it('attempts, certificates and progress are private', async () => {
    const a = await learner();
    const b = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')] }],
    });
    await enrol(a, course);
    const pass = await passModule(a, course, 0, () => ({ optionId: 'b' }));
    const attemptId = pass.body.data.result.attemptId;
    const cert = (await get(a, '/api/v1/me/certificates')).body.data.items[0];

    expect((await get(b, `/api/v1/attempts/${attemptId}`)).status).toBe(404);
    expect((await h.api.get(`/api/v1/certificates/${cert.id}/pdf`).set(b.auth)).status).toBe(404);
    expect((await post(b, `/api/v1/attempts/${attemptId}/submit`)).status).toBe(404);
    expect(
      (
        await post(b, `/api/v1/attempts/${attemptId}/answers`, {
          questionId: '000000000000000000000000',
          response: {},
        })
      ).status
    ).toBe(404);
  });
});

/* ------------------------------------------------------------------ streaks and stats */

describe('streaks and /me/stats', () => {
  it('a lesson on consecutive Lagos days extends the streak', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text', 'text'], questions: [Q.single()] }],
    });
    await enrol(who, course);
    const first = await finishLesson(who, course.modules[0].lessons[0].id);
    expect(first.body.data.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'streak_extended', current: 1 })])
    );
    h.clock.now = new Date(h.clock.now.getTime() + 24 * 60 * 60 * 1000);
    const second = await finishLesson(who, course.modules[0].lessons[1].id);
    expect(second.body.data.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'streak_extended', current: 2 })])
    );
  });

  it('returns XP, streak, today against the goal, and a seven-day activity series', async () => {
    const who = await learner();
    const course = await makeCourse({ modules: [{ lessons: ['text'], questions: [Q.single()] }] });
    await enrol(who, course);
    await finishLesson(who, course.modules[0].lessons[0].id);
    const res = await get(who, '/api/v1/me/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.xp).toBe(5);
    expect(res.body.data.today).toEqual({ xp: 5, goal: 10 });
    expect(res.body.data.activity7d).toHaveLength(7);
    expect(res.body.data.readiness).toBeNull();
  });

  it('readiness counts completed required courses for the learner’s role', async () => {
    const who = await learner('ready@example.com', 'collation');
    const required = await makeCourse({ isRequired: true, targetRoles: ['collation'] });
    await makeCourse({ isRequired: true, targetRoles: ['collation'] });
    await enrol(who, required);
    await passModule(who, required, 0, () => ({ optionId: 'b' }));
    const res = await get(who, '/api/v1/me/stats');
    expect(res.body.data.readiness).toMatchObject({ completed: 1, required: 2, percent: 50 });
  });
});

/* ------------------------------------------------------------------ the answer-leak test (SECURITY §3) */

const LEAK_KEYS_ALWAYS = [
  'correctOptionId',
  'correctOptionIds',
  'acceptedAnswers',
  'correctOrder',
  'snapshot',
  'presentation',
  'pairs',
];

/** Explanations are shown only after an answer, so they may appear on answer responses and nowhere else. */
function explanationsIn(value, path = '$', out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => explanationsIn(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key === 'explanation' && v) out.push(`${path}.${key}`);
      explanationsIn(v, `${path}.${key}`, out);
    }
  }
  return out;
}

/** Every key path in a JSON value that is a forbidden answer-key field. `correct` is handled separately. */
function leaksIn(value, path = '$', out = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => leaksIn(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (LEAK_KEYS_ALWAYS.includes(key)) out.push(`${path}.${key}`);
      leaksIn(v, `${path}.${key}`, out);
    }
  }
  return out;
}

/** Keys named `correct` anywhere in a value. Allowed only on answer responses and revealed reviews. */
function correctKeysIn(value, path = '$', out = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => correctKeysIn(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key === 'correct' || key === 'correctAnswer') out.push(`${path}.${key}`);
      correctKeysIn(v, `${path}.${key}`, out);
    }
  }
  return out;
}

describe('answer-leak test: no learner route returns an answer key', () => {
  it('walks every learner response and finds no key, before or after answering', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [
        {
          lessons: ['text', 'practice'],
          questions: [
            Q.single(1, 'b'),
            Q.multi(),
            Q.tf(true),
            Q.matching(),
            Q.ordering(),
            Q.fill(),
          ],
          revealAnswers: 'never',
          shuffleOptions: true,
        },
      ],
    });
    // Practice questions with keys, to walk the practice route too.
    await Lesson.updateOne(
      { _id: course.modules[0].lessons[1].id },
      { 'practice.questions': [Q.single(1, 'b'), Q.matching()] }
    );
    await enrol(who, course);

    const responses = [];
    const record = (label, res, allowCorrect = false) =>
      responses.push({ label, body: res.body, allowCorrect });

    record('catalogue', await get(who, '/api/v1/courses?role=all'));
    record('outline', await get(who, `/api/v1/courses/${course.slug}`));
    record('lesson text', await get(who, `/api/v1/lessons/${course.modules[0].lessons[0].id}`));
    await finishLesson(who, course.modules[0].lessons[0].id);
    const practice = await get(who, `/api/v1/lessons/${course.modules[0].lessons[1].id}`);
    record('lesson practice', practice);
    const [pq1, pq2] = practice.body.data.lesson.questions;
    record(
      'practice answer',
      await post(who, `/api/v1/lessons/${course.modules[0].lessons[1].id}/practice/answer`, {
        questionId: pq1.id,
        response: { optionId: 'a' },
      }),
      true
    );
    record(
      'practice answer 2',
      await post(who, `/api/v1/lessons/${course.modules[0].lessons[1].id}/practice/answer`, {
        questionId: pq2.id,
        response: { rightByLeft: {} },
      }),
      true
    );
    record(
      'practice complete',
      await post(who, `/api/v1/lessons/${course.modules[0].lessons[1].id}/complete`),
      false
    );

    const start = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    record('attempt start', start);
    const attemptId = start.body.data.attempt.id;
    record('attempt get', await get(who, `/api/v1/attempts/${attemptId}`));
    for (const q of start.body.data.attempt.questions) {
      record(
        'answer',
        await post(who, `/api/v1/attempts/${attemptId}/answers`, {
          questionId: q.id,
          response: { optionId: 'a' },
        }),
        true
      );
    }
    record('submit (reveal never)', await post(who, `/api/v1/attempts/${attemptId}/submit`), false);

    for (const { label, body, allowCorrect } of responses) {
      expect(leaksIn(body), `${label} leaked`).toEqual([]);
      if (!allowCorrect) {
        expect(correctKeysIn(body), `${label} leaked a correct flag`).toEqual([]);
        expect(explanationsIn(body), `${label} showed an explanation early`).toEqual([]);
      }
    }
  });

  it('a matching question shows left and right columns separately, never as aligned pairs', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.matching()] }],
    });
    await enrol(who, course);
    await finishLesson(who, course.modules[0].lessons[0].id);
    const start = await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    const q = start.body.data.attempt.questions[0];
    expect(q.leftItems).toHaveLength(3);
    expect(q.rightItems).toHaveLength(3);
    expect(q.pairs).toBeUndefined();
    expect(Object.keys(q.leftItems[0]).sort()).toEqual(['id', 'text']);
  });

  it('the review after a pass reveals answers only when the reveal rule allows it', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')], revealAnswers: 'after_pass' }],
    });
    await enrol(who, course);
    const pass = await passModule(who, course, 0, () => ({ optionId: 'b' }));
    expect(pass.body.data.result.review).toHaveLength(1);
    expect(pass.body.data.result.review[0].correctAnswer).toBe('The presiding officer');
  });
});

describe('preview and the database contract', () => {
  it('stores the attempt snapshot server-side only (select: false)', async () => {
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')] }],
    });
    await enrol(who, course);
    await finishLesson(who, course.modules[0].lessons[0].id);
    await post(who, `/api/v1/assessments/${course.modules[0].assessmentId}/attempts`);
    const row = await AssessmentAttempt.findOne({ userId: who.id }).lean();
    expect(row.questions[0].snapshot).toBeUndefined();
    const withSnapshot = await AssessmentAttempt.findOne({ userId: who.id })
      .select('+questions.snapshot')
      .lean();
    expect(withSnapshot.questions[0].snapshot.correctOptionId).toBe('b');
  });

  it('a lesson progress row is created when a lesson is first opened', async () => {
    const who = await learner();
    const course = await makeCourse({ modules: [{ lessons: ['text'], questions: [Q.single()] }] });
    await enrol(who, course);
    await get(who, `/api/v1/lessons/${course.modules[0].lessons[0].id}`);
    const progress = await LessonProgress.findOne({ userId: who.id }).lean();
    expect(progress.openedAt).toBeDefined();
    expect(progress.status).toBe('in_progress');
  });
});

describe('deletion and certificates (SECURITY §11)', () => {
  it('anonymising an account revokes its certificates, so they no longer verify', async () => {
    const { anonymiseDueAccounts } = await import('../src/services/userService.js');
    const who = await learner();
    const course = await makeCourse({
      modules: [{ lessons: ['text'], questions: [Q.single(1, 'b')] }],
    });
    await enrol(who, course);
    await passModule(who, course, 0, () => ({ optionId: 'b' }));
    const code = (await Certificate.findOne({ userId: who.id }).lean()).code;
    expect((await h.api.get(`/api/v1/verify/${code}`)).body.data.valid).toBe(true);

    await h.api.delete('/api/v1/me').set(who.auth);
    h.clock.now = new Date(h.clock.now.getTime() + 8 * 24 * 60 * 60 * 1000);
    await anonymiseDueAccounts({
      now: () => new Date(h.clock.now),
      logger: { info() {}, error() {}, warn() {} },
    });

    expect((await h.api.get(`/api/v1/verify/${code}`)).body.data.valid).toBe(false);
  });
});
