#!/usr/bin/env node
/**
 * Generates fake learners, courses, enrolments and attempts so the reports can be timed at scale
 * (SPEC §4: each report must answer in under 500 ms on 50,000 users).
 *
 *   node scripts/seed-load.js                 # 50,000 learners into MONGODB_URI
 *   node scripts/seed-load.js --learners 5000 # smaller run
 *
 * Only for development and performance checks. Every learner is fake, and nobody can sign in as them
 * (their password hash is a placeholder that matches nothing). Run seed-geo --load first, so the
 * geography drill-down has names and codes to join against.
 */
import mongoose from 'mongoose';
import { loadDotEnvFile } from '../src/config/env.js';
import { configureMongoose } from '../src/models/mongooseSetup.js';
import {
  Assessment,
  AssessmentAttempt,
  Course,
  Enrollment,
  Lga,
  Module,
  State,
  User,
} from '../src/models/index.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const LEARNERS = flag('--learners', 50_000);
const COURSES = 12;
const BATCH = 5000;
const PLACEHOLDER_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ZmFrZXNhbHRmYWtlc2FsdA$ZmFrZWhhc2hmYWtlaGFzaGZha2VoYXNoZmFrZWhhc2g';

const DAY = 24 * 60 * 60 * 1000;
const rand = (n) => Math.floor(Math.random() * n);
const pick = (list) => list[rand(list.length)];

async function batched(total, makeOne, insert) {
  let made = 0;
  while (made < total) {
    const size = Math.min(BATCH, total - made);
    const docs = Array.from({ length: size }, (_, i) => makeOne(made + i));
    await insert(docs);
    made += size;
    if (made % 20_000 === 0 || made === total)
      console.log(`  ${made.toLocaleString()} / ${total.toLocaleString()}`);
  }
}

async function main() {
  loadDotEnvFile();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set.');
  configureMongoose(mongoose);
  await mongoose.connect(uri);

  const started = Date.now();
  const now = Date.now();
  const states = await State.find({}, { code: 1 }).lean();
  const lgas = await Lga.find({}, { code: 1, stateCode: 1 }).lean();
  if (lgas.length === 0)
    throw new Error('No geography loaded. Run: npm run seed:geo:load -w server');

  // Clear only what an earlier run of this script created: fake learners, their records, load courses.
  console.log(`Clearing previous fake load...`);
  const oldUsers = await User.find({ email: /@load\.pollwise\.test$/ }, { _id: 1 }).lean();
  const oldCourses = await Course.find({ slug: /^load-/ }, { _id: 1 }).lean();
  const oldModules = await Module.find(
    { courseId: mongoose.trusted({ $in: oldCourses.map((c) => c._id) }) },
    { _id: 1 }
  ).lean();
  const userIds = mongoose.trusted({ $in: oldUsers.map((u) => u._id) });
  await Enrollment.deleteMany({ userId: userIds });
  await AssessmentAttempt.deleteMany({ userId: userIds });
  await User.deleteMany({ _id: userIds });
  await Assessment.deleteMany({
    moduleId: mongoose.trusted({ $in: oldModules.map((m) => m._id) }),
  });
  await Module.deleteMany({ _id: mongoose.trusted({ $in: oldModules.map((m) => m._id) }) });
  await Course.deleteMany({ _id: mongoose.trusted({ $in: oldCourses.map((c) => c._id) }) });

  console.log(`Creating ${COURSES} courses...`);
  const admin = await User.findOneAndUpdate(
    { email: 'load-admin@load.pollwise.test' },
    {
      $setOnInsert: {
        name: 'Load admin',
        email: 'load-admin@load.pollwise.test',
        passwordHash: PLACEHOLDER_HASH,
        role: 'content_admin',
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
  const courses = [];
  for (let i = 0; i < COURSES; i += 1) {
    const course = await Course.create({
      title: `Load course ${i + 1}`,
      slug: `load-${i + 1}-${Date.now().toString(36)}`,
      summary: 'Generated for load testing',
      targetRoles: ['party_agent', 'security', 'ict_bvas', 'collation', 'official', 'other'].slice(
        0,
        1 + (i % 6)
      ),
      isRequired: i % 4 === 0,
      status: 'published',
      createdBy: admin._id,
      moduleIds: [],
    });
    const mod = await Module.create({
      courseId: course._id,
      title: 'Module',
      order: 0,
      lessonIds: [],
    });
    const assessment = await Assessment.create({
      moduleId: mod._id,
      title: 'Check',
      questions: [],
    });
    await Module.updateOne({ _id: mod._id }, { assessmentId: assessment._id });
    await Course.updateOne({ _id: course._id }, { moduleIds: [mod._id] });
    courses.push({ id: course._id, moduleId: mod._id, assessmentId: assessment._id });
  }

  console.log(`Creating ${LEARNERS.toLocaleString()} learners...`);
  const learnerIds = [];
  const roles = ['party_agent', 'security', 'ict_bvas', 'collation', 'official', 'other'];
  await batched(
    LEARNERS,
    (i) => {
      const area = pick(lgas);
      const _id = new mongoose.Types.ObjectId();
      learnerIds.push({ _id, area });
      return {
        _id,
        name: `Learner ${i + 1}`,
        email: `learner${i + 1}@load.pollwise.test`,
        passwordHash: PLACEHOLDER_HASH,
        role: 'learner',
        status: 'active',
        profile: { stateCode: area.stateCode, lgaCode: area.code, personnelRole: pick(roles) },
        learning: { xp: rand(900) },
        createdAt: new Date(now - rand(60) * DAY),
        lastLoginAt: rand(10) < 7 ? new Date(now - rand(30) * DAY) : undefined,
      };
    },
    (docs) => User.collection.insertMany(docs, { ordered: false })
  );

  console.log('Creating enrolments and attempts...');
  const enrolments = [];
  const attempts = [];
  for (const learner of learnerIds) {
    const count = 1 + rand(2);
    const chosen = new Set();
    for (let k = 0; k < count; k += 1) {
      const course = pick(courses);
      if (chosen.has(String(course.id))) continue;
      chosen.add(String(course.id));
      const completed = rand(10) < 4;
      const startedAt = new Date(now - rand(40) * DAY);
      enrolments.push({
        userId: learner._id,
        stateCode: learner.area.stateCode,
        lgaCode: learner.area.code,
        courseId: course.id,
        status: completed ? 'completed' : 'in_progress',
        startedAt,
        completedAt: completed ? new Date(startedAt.getTime() + DAY) : undefined,
        passedModuleIds: completed ? [course.moduleId] : [],
        bestScores: completed ? { [String(course.moduleId)]: 70 + rand(31) } : {},
      });
      const tries = 1 + rand(3);
      for (let t = 1; t <= tries; t += 1) {
        const score = 40 + rand(61);
        attempts.push({
          userId: learner._id,
          assessmentId: course.assessmentId,
          moduleId: course.moduleId,
          courseId: course.id,
          attemptNumber: t,
          questions: [],
          answers: [],
          status: 'submitted',
          score,
          passed: score >= 70,
          passMark: 70,
          startedAt,
          expiresAt: startedAt,
          submittedAt: startedAt,
        });
      }
    }
  }
  await batched(
    enrolments.length,
    (i) => enrolments[i],
    (docs) => Enrollment.collection.insertMany(docs, { ordered: false })
  );
  await batched(
    attempts.length,
    (i) => attempts[i],
    (docs) => AssessmentAttempt.collection.insertMany(docs, { ordered: false })
  );

  console.log(
    `Done in ${((Date.now() - started) / 1000).toFixed(1)} s: ${learnerIds.length.toLocaleString()} learners, ` +
      `${enrolments.length.toLocaleString()} enrolments, ${attempts.length.toLocaleString()} attempts ` +
      `(${states.length} states).`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
