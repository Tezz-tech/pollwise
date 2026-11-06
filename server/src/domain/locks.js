/**
 * Lock rules (SPEC §8.1). Pure: given a course outline and a learner's progress, say what is open.
 *
 *  - Module 1 is open on enrolment. Module n+1 opens when module n's assessment is passed.
 *  - Inside a module, lesson k+1 opens when lesson k is complete (lesson 1 opens with its module).
 *  - A module's assessment opens when every lesson in it is complete.
 *  - Courses can be taken in any order, so nothing here looks at other courses.
 */

/**
 * @param {{
 *   modules: Array<{ id: string, lessonIds: string[], assessmentId: string | null }>,
 * }} course outline in order
 * @param {{ completedLessonIds: Set<string>, passedModuleIds: Set<string> }} progress
 * @returns {{
 *   moduleOpen: Map<string, boolean>,
 *   lessonOpen: Map<string, boolean>,
 *   assessmentOpen: Map<string, boolean>,
 * }}
 */
export function computeLocks(course, progress) {
  const moduleOpen = new Map();
  const lessonOpen = new Map();
  const assessmentOpen = new Map();

  let previousPassed = true;
  for (const mod of course.modules) {
    const open = previousPassed;
    moduleOpen.set(mod.id, open);

    let previousLessonDone = true;
    for (const lessonId of mod.lessonIds) {
      lessonOpen.set(lessonId, open && previousLessonDone);
      previousLessonDone = progress.completedLessonIds.has(lessonId);
    }

    const allLessonsDone = mod.lessonIds.every((id) => progress.completedLessonIds.has(id));
    if (mod.assessmentId) assessmentOpen.set(mod.assessmentId, open && allLessonsDone);

    previousPassed = progress.passedModuleIds.has(mod.id);
  }

  return { moduleOpen, lessonOpen, assessmentOpen };
}

/** Whether every module's assessment has been passed. */
export function courseIsComplete(course, progress) {
  return (
    course.modules.length > 0 && course.modules.every((m) => progress.passedModuleIds.has(m.id))
  );
}
