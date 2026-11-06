import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanDataset, cleanName, slugCode, verifyCounts } from '../scripts/seed-geo.js';

const here = dirname(fileURLToPath(import.meta.url));
const expected = JSON.parse(
  await readFile(join(here, '..', '..', 'docs', 'data', 'lga-counts.json'), 'utf8')
);
const geo = JSON.parse(await readFile(join(here, '..', 'data', 'geo.json'), 'utf8'));

describe('committed geo data (server/data/geo.json)', () => {
  it('matches every per-state count in docs/data/lga-counts.json', () => {
    expect(verifyCounts(geo, expected)).toEqual([]);
  });

  it('has 37 states and 774 LGAs with unique codes', () => {
    expect(geo.states).toHaveLength(37);
    expect(geo.lgas).toHaveLength(774);
    expect(new Set(geo.lgas.map((l) => l.code)).size).toBe(774);
  });

  it('only references states that exist', () => {
    const codes = new Set(geo.states.map((s) => s.code));
    for (const lga of geo.lgas) expect(codes.has(lga.stateCode)).toBe(true);
  });

  it('records its licence and source', () => {
    expect(geo.source.licence).toBe('MIT');
    expect(geo.source.url).toMatch(/^https:\/\//);
  });
});

describe('verifyCounts', () => {
  const sample = {
    states: [{ code: 'AB', name: 'Abia' }],
    lgas: [
      { code: 'AB-A', stateCode: 'AB', name: 'A' },
      { code: 'AB-B', stateCode: 'AB', name: 'B' },
    ],
  };

  it('reports a mismatch when a state has a different count', () => {
    const problems = verifyCounts(sample, { total: 3, states: { Abia: 3 } });
    expect(problems.join('\n')).toMatch(/Abia: expected 3 LGAs, found 2/);
  });

  it('reports a state that is expected but missing from the data', () => {
    const problems = verifyCounts(sample, { total: 4, states: { Abia: 2, Ghost: 2 } });
    expect(problems.join('\n')).toMatch(/Ghost: expected 2 LGAs, found 0/);
  });

  it('reports a state present in the data but absent from the expected list', () => {
    const problems = verifyCounts(sample, { total: 2, states: {} });
    expect(problems.join('\n')).toMatch(/Abia: not in the expected list/);
  });
});

describe('cleanDataset', () => {
  it('trims and collapses whitespace and builds stable codes', () => {
    expect(cleanName('  Aba   North ')).toBe('Aba North');
    expect(slugCode('Ọṣọ Ìpẹ́')).toBe('OSO-IPE');
    const { lgas } = cleanDataset([{ state_code: 'lg', state_name: 'Lagos', name: ' Ikeja ' }]);
    expect(lgas[0]).toEqual({ code: 'LG-IKEJA', stateCode: 'LG', name: 'Ikeja' });
  });

  it('throws on a duplicate LGA code rather than silently dropping one', () => {
    expect(() =>
      cleanDataset([
        { state_code: 'LG', state_name: 'Lagos', name: 'Ikeja' },
        { state_code: 'LG', state_name: 'Lagos', name: 'ikeja' },
      ])
    ).toThrow(/Duplicate LGA code/);
  });

  it('throws when one state code maps to two names', () => {
    expect(() =>
      cleanDataset([
        { state_code: 'XX', state_name: 'One', name: 'A' },
        { state_code: 'XX', state_name: 'Two', name: 'B' },
      ])
    ).toThrow(/maps to two names/);
  });
});
