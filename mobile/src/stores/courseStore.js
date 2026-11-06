import { create } from 'zustand';

/**
 * The course the Learn path shows. Chosen from the switcher or from a course's page. Not persisted: after a restart
 * the path falls back to the first enrolled course, which is what a learner with one course expects anyway.
 */
export const useCourseSelection = create((set) => ({
  /** @type {string | null} */
  slug: null,
  select(slug) {
    set({ slug });
  },
}));
