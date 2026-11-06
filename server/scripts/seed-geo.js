#!/usr/bin/env node
/**
 * Geography seed (SPEC §5 "Geo", DECISIONS 2026-11-06).
 *
 *   node scripts/seed-geo.js            verify server/data/geo.json against docs/data/lga-counts.json
 *   node scripts/seed-geo.js --refresh  fetch the public dataset, clean it, write geo.json, then verify
 *
 * Source: xosasx/nigerian-local-government-areas (MIT licence), file lgas.json.
 * https://github.com/xosasx/nigerian-local-government-areas
 *
 * The cleaned result is committed as server/data/geo.json, so seeding never needs the network.
 * Any count mismatch exits non-zero. Counts are the contract; a silent drift would make the
 * onboarding dropdowns wrong for a whole state.
 *
 * Writing the cleaned data into MongoDB is part of Phase 1, when the State and Lga models exist.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const GEO_PATH = join(here, '..', 'data', 'geo.json');
const COUNTS_PATH = join(here, '..', '..', 'docs', 'data', 'lga-counts.json');
const SOURCE_URL =
  'https://raw.githubusercontent.com/xosasx/nigerian-local-government-areas/master/lgas.json';
const SOURCE_NAME = 'xosasx/nigerian-local-government-areas (lgas.json)';
const SOURCE_LICENCE = 'MIT';

/** @typedef {{ code: string, name: string }} State */
/** @typedef {{ code: string, stateCode: string, name: string }} Lga */

/**
 * Collapse whitespace and trim. Names are shown to people choosing where they work, so they must
 * read cleanly.
 * @param {string} value
 */
export function cleanName(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

/**
 * Turn a name into a stable, readable code fragment: "Aba North" → "ABA-NORTH".
 * @param {string} value
 */
export function slugCode(value) {
  return cleanName(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert the raw dataset rows into { states, lgas }. Throws on anything unexpected so a bad upstream
 * change cannot slip through quietly.
 * @param {Array<Record<string, unknown>>} rows
 * @returns {{ states: State[], lgas: Lga[] }}
 */
export function cleanDataset(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Geo dataset is empty or not an array');
  }

  /** @type {Map<string, State>} */
  const states = new Map();
  /** @type {Lga[]} */
  const lgas = [];
  const lgaCodes = new Set();

  for (const row of rows) {
    const stateName = cleanName(row.state_name);
    const stateCode = cleanName(row.state_code).toUpperCase();
    const lgaName = cleanName(row.name);
    if (!stateName || !stateCode || !lgaName) {
      throw new Error(`Geo dataset row is missing a name or code: ${JSON.stringify(row)}`);
    }

    const existing = states.get(stateCode);
    if (existing && existing.name !== stateName) {
      throw new Error(`State code ${stateCode} maps to two names: ${existing.name} / ${stateName}`);
    }
    states.set(stateCode, { code: stateCode, name: stateName });

    const code = `${stateCode}-${slugCode(lgaName)}`;
    if (lgaCodes.has(code)) throw new Error(`Duplicate LGA code ${code}`);
    lgaCodes.add(code);
    lgas.push({ code, stateCode, name: lgaName });
  }

  const sortedStates = [...states.values()].sort((a, b) => a.name.localeCompare(b.name));
  lgas.sort((a, b) => a.stateCode.localeCompare(b.stateCode) || a.name.localeCompare(b.name));
  return { states: sortedStates, lgas };
}

/**
 * Compare per-state LGA counts with the contract in docs/data/lga-counts.json.
 * @param {{ states: State[], lgas: Lga[] }} geo
 * @param {{ total: number, states: Record<string, number> }} expected
 * @returns {string[]} list of problems; empty when everything matches
 */
export function verifyCounts(geo, expected) {
  const problems = [];
  const nameByCode = new Map(geo.states.map((s) => [s.code, s.name]));
  const actual = new Map();
  for (const lga of geo.lgas) {
    const stateName = nameByCode.get(lga.stateCode);
    actual.set(stateName, (actual.get(stateName) ?? 0) + 1);
  }

  for (const [stateName, count] of Object.entries(expected.states)) {
    const got = actual.get(stateName) ?? 0;
    if (got !== count) problems.push(`${stateName}: expected ${count} LGAs, found ${got}`);
  }
  for (const [stateName, got] of actual) {
    if (!(stateName in expected.states))
      problems.push(`${stateName}: not in the expected list (${got} LGAs)`);
  }

  const total = geo.lgas.length;
  if (total !== expected.total) problems.push(`Total: expected ${expected.total}, found ${total}`);
  if (geo.states.length !== Object.keys(expected.states).length) {
    problems.push(
      `States: expected ${Object.keys(expected.states).length}, found ${geo.states.length}`
    );
  }
  return problems;
}

async function fetchRawDataset() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Fetching ${SOURCE_URL} failed with HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const refresh = process.argv.includes('--refresh');
  const expected = JSON.parse(await readFile(COUNTS_PATH, 'utf8'));

  let geoFile;
  if (refresh) {
    const rows = await fetchRawDataset();
    const { states, lgas } = cleanDataset(rows);
    geoFile = {
      source: { name: SOURCE_NAME, url: SOURCE_URL, licence: SOURCE_LICENCE },
      retrievedAt: new Date().toISOString().slice(0, 10),
      states,
      lgas,
    };
    await writeFile(GEO_PATH, `${JSON.stringify(geoFile, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${GEO_PATH} from the public dataset.`);
  } else {
    geoFile = JSON.parse(await readFile(GEO_PATH, 'utf8'));
  }

  const problems = verifyCounts(geoFile, expected);
  if (problems.length > 0) {
    console.error('Geo count check FAILED. Nothing was accepted:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(
    `Geo count check passed: ${geoFile.states.length} states, ${geoFile.lgas.length} LGAs ` +
      `(expected ${expected.total}).`
  );
}

// Only run when executed directly, so the tests can import the helpers.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
