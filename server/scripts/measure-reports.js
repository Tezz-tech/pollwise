#!/usr/bin/env node
/**
 * Times every super admin report against the current database and prints the result against the
 * 500 ms target (SPEC §4). Run after scripts/seed-load.js. It also lists the indexes in use, so the
 * index review in docs/DECISIONS.md can be checked against a real database.
 *
 *   node scripts/measure-reports.js
 */
import mongoose from 'mongoose';
import { loadDotEnvFile } from '../src/config/env.js';
import { configureMongoose } from '../src/models/mongooseSetup.js';
import { User, Enrollment, AssessmentAttempt } from '../src/models/index.js';
import * as reports from '../src/services/reportService.js';
import * as people from '../src/services/adminPeopleService.js';

const TARGET_MS = 500;
const RUNS = 5;

async function timeIt(label, fn) {
  const samples = [];
  let last;
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = performance.now();
    last = await fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const worst = samples[samples.length - 1];
  const verdict = worst < TARGET_MS ? 'PASS' : 'OVER';
  console.log(
    `${label.padEnd(38)} median ${median.toFixed(0).padStart(5)} ms   worst ${worst.toFixed(0).padStart(5)} ms   ${verdict}`
  );
  return { label, median, worst, last };
}

async function main() {
  loadDotEnvFile();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set.');
  configureMongoose(mongoose);
  await mongoose.connect(uri);

  const learners = await User.countDocuments({ role: 'learner' });
  console.log(
    `Database: ${learners.toLocaleString()} learners, ${(await Enrollment.estimatedDocumentCount()).toLocaleString()} enrolments, ${(await AssessmentAttempt.estimatedDocumentCount()).toLocaleString()} attempts.\n`
  );

  const ctx = { now: () => new Date(), logger: { info() {}, warn() {}, error() {} } };
  const results = [];
  results.push(await timeIt('overview (KPIs + 30-day series)', () => reports.overview(ctx)));
  results.push(await timeIt('courses report', () => reports.courseReport()));
  results.push(await timeIt('geography by state', () => reports.geographyReport(undefined)));
  results.push(await timeIt('geography drill-down (LA)', () => reports.geographyReport('LA')));
  results.push(
    await timeIt('learner list, filtered and paged', () =>
      people.listUsers({ stateCode: 'LA', status: 'active', q: 'learner1' }, { page: 1, limit: 25 })
    )
  );

  const over = results.filter((r) => r.worst >= TARGET_MS);
  console.log(
    over.length
      ? `\n${over.length} report(s) over ${TARGET_MS} ms.`
      : `\nAll reports under ${TARGET_MS} ms in the worst of ${RUNS} runs.`
  );

  console.log('\nIndexes in use:');
  for (const model of [User, Enrollment, AssessmentAttempt]) {
    const indexes = await model.collection.indexes();
    console.log(
      `  ${model.collection.name}: ${indexes.map((i) => Object.keys(i.key).join('+')).join(', ')}`
    );
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
