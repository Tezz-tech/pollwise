/**
 * Which course to open first (SPEC §3, step 5). The order: a required course for the learner's role, then any course
 * for their role, then the rest. Completed courses are left out.
 * @param {{ isRequired?: boolean, targetRoles?: string[], enrolment?: { status?: string } | null }[]} courses
 * @param {string | null | undefined} role
 * @returns {object[]} courses in the order to try them
 */
export function rankCourses(courses, role) {
  const open = courses.filter((course) => course.enrolment?.status !== 'completed');
  const forRole = (course) => Boolean(role) && Boolean(course.targetRoles?.includes(role));
  const rank = (course) => (course.isRequired && forRole(course) ? 0 : forRole(course) ? 1 : 2);
  // Stable sort, so the catalogue's own order breaks ties.
  return [...open].sort((a, b) => rank(a) - rank(b));
}

/**
 * The single best course to open, or null when nothing is open.
 * @param {object[]} courses
 * @param {string | null | undefined} role
 */
export function pickRecommendedCourse(courses, role) {
  return rankCourses(courses, role)[0] ?? null;
}
