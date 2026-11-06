/**
 * Turns a course outline into the rows of the Learn path (DESIGN §3, §6.5): a banner per module, then its lesson
 * nodes, then its check node. Pure, so the state rules are tested in Node.
 *
 * States: completed (done), current (the next lesson to open), available (open but not next), locked, and for the
 * check node: passed, available, locked.
 */

/** Vertical room for one node row, in layout pixels. */
export const ROW_HEIGHT = 112;
export const BANNER_HEIGHT = 92;

/**
 * @typedef {'completed' | 'current' | 'available' | 'locked'} NodeState
 * @typedef {{ kind: 'banner', key: string, moduleId: string, title: string, index: number, total: number, done: number, locked: boolean }} BannerRow
 * @typedef {{ kind: 'node', key: string, id: string, title: string, type: string, durationSec: number | null, xp: number | null, state: NodeState, check: boolean, moduleId: string, height: number }} NodeRow
 * @typedef {BannerRow | NodeRow} PathRow
 */

/**
 * @param {{ modules?: object[] }} outline GET /courses/:slug
 * @returns {{ rows: PathRow[], currentId: string | null, moduleStartIndex: Record<string, number> }}
 */
export function buildPath(outline) {
  const modules = outline?.modules ?? [];
  const rows = [];
  const moduleStartIndex = {};
  // The current lesson is the first open lesson that is not yet completed.
  let currentId = null;
  for (const mod of modules) {
    for (const lesson of mod.lessons ?? []) {
      if (!currentId && !lesson.locked && !lesson.completed) currentId = lesson.id;
    }
  }

  modules.forEach((mod, index) => {
    const lessons = mod.lessons ?? [];
    const doneLessons = lessons.filter((l) => l.completed).length;
    const passed = Boolean(mod.assessment?.passed);
    rows.push({
      kind: 'banner',
      key: `banner-${mod.id}`,
      moduleId: mod.id,
      title: mod.title,
      index: index + 1,
      total: modules.length,
      done: doneLessons + (mod.assessment ? (passed ? 1 : 0) : 0),
      locked: Boolean(mod.locked),
      height: BANNER_HEIGHT,
    });
    moduleStartIndex[mod.id] = rows.length - 1;

    for (const lesson of lessons) {
      rows.push({
        kind: 'node',
        key: `lesson-${lesson.id}`,
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        durationSec: lesson.durationSec ?? null,
        xp: lesson.xp ?? null,
        state: lessonState(lesson, currentId),
        check: false,
        moduleId: mod.id,
        height: ROW_HEIGHT,
      });
    }

    if (mod.assessment) {
      rows.push({
        kind: 'node',
        key: `check-${mod.assessment.id}`,
        id: mod.assessment.id,
        title: mod.assessment.title ?? 'Module check',
        type: 'assessment',
        durationSec: null,
        xp: null,
        state: checkState(mod.assessment),
        check: true,
        passMark: mod.assessment.passMark ?? null,
        moduleId: mod.id,
        height: ROW_HEIGHT,
      });
    }
  });

  return { rows, currentId, moduleStartIndex };
}

/** @param {{ id: string, locked?: boolean, completed?: boolean }} lesson @param {string | null} currentId */
export function lessonState(lesson, currentId) {
  if (lesson.completed) return 'completed';
  if (lesson.locked) return 'locked';
  if (lesson.id === currentId) return 'current';
  return 'available';
}

/** The check node: passed, open, or locked until every lesson in the module is done (SPEC §8.1). */
export function checkState(assessment) {
  if (assessment.passed) return 'completed';
  if (assessment.locked) return 'locked';
  return 'available';
}

/**
 * What a screen reader says about a node (DESIGN §9): "Lesson 3, Opening the polling unit, video, 4 minutes, completed".
 * @param {NodeRow} row
 * @param {number} position 1-based position among lessons
 */
export function nodeLabel(row, position) {
  const parts = [row.check ? 'Module check' : `Lesson ${position}`, row.title];
  if (!row.check) parts.push(typeLabel(row.type));
  if (row.durationSec) parts.push(`${Math.round(row.durationSec / 60)} minutes`);
  parts.push(STATE_WORDS[row.state]);
  return parts.join(', ');
}

const STATE_WORDS = Object.freeze({
  completed: 'completed',
  current: 'next',
  available: 'open',
  locked: 'locked',
});

/** @param {string} type */
export function typeLabel(type) {
  return (
    { video: 'video', text: 'reading', document: 'document', practice: 'practice' }[type] ?? type
  );
}
