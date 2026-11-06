import { rankCourses } from './recommend.js';

/** How many outlines to read before giving up: each one is a request on a possibly slow connection. */
export const MAX_CANDIDATES = 8;

/**
 * The first lesson a learner can open in an outline: not locked, not completed (SPEC §8.1).
 * @param {{ modules?: { lessons?: { id: string, locked?: boolean, completed?: boolean }[] }[] }} outline
 */
export function firstOpenLesson(outline) {
  for (const mod of outline?.modules ?? []) {
    for (const lesson of mod.lessons ?? []) {
      if (!lesson.locked && !lesson.completed) return lesson;
    }
  }
  return null;
}

/**
 * Enrol in the recommended course and return the lesson to open first (SPEC §3 step 5). Courses are tried in
 * recommended order. Each outline is read before any enrolment, so a course with nothing to open is never enrolled in.
 * @param {{ request: (path: string, options?: object) => Promise<any> }} api
 * @param {string | null | undefined} role
 * @returns {Promise<string | null>} lesson id, or null when no course has an open lesson
 */
export async function openRecommendedLesson(api, role) {
  const catalogue = await api.request('/courses');
  const candidates = rankCourses(catalogue.items ?? [], catalogue.role ?? role).slice(
    0,
    MAX_CANDIDATES
  );
  for (const course of candidates) {
    const outline = await api.request(`/courses/${course.slug}`);
    const lesson = firstOpenLesson(outline);
    if (!lesson) continue;
    await api.request(`/courses/${course.id}/enroll`, { method: 'POST' });
    return lesson.id;
  }
  return null;
}
