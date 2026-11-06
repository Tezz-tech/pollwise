/**
 * React Query hooks for the learner screens. Each one returns what the server said; nothing here decides progress.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from './client.js';

export const queryKeys = Object.freeze({
  stats: ['me', 'stats'],
  catalogue: (role, q) => ['courses', { role: role ?? 'me', q: q ?? '' }],
  outline: (slug) => ['course', slug],
  settings: ['settings', 'public'],
  lesson: (id) => ['lesson', id],
});

/** XP, streak, today against the goal, readiness, the 7-day activity (SPEC §6 GET /me/stats). */
export function useStats() {
  return useQuery({ queryKey: queryKeys.stats, queryFn: () => api.request('/me/stats') });
}

/**
 * Published courses. `role` omitted means "For you" (the learner's own role); 'all' lifts the filter.
 * @param {{ role?: string, q?: string }} [filters]
 */
export function useCatalogue({ role, q } = {}) {
  return useQuery({
    queryKey: queryKeys.catalogue(role, q),
    queryFn: () => api.request('/courses', { query: { role, q: q || undefined } }),
  });
}

/** @param {string | null} slug */
export function useOutline(slug) {
  return useQuery({
    queryKey: queryKeys.outline(slug),
    queryFn: () => api.request(`/courses/${slug}`),
    enabled: Boolean(slug),
  });
}

/** Election date and label for the countdown card (SPEC §6 GET /settings/public). */
export function usePublicSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api.request('/settings/public', { auth: false }),
    staleTime: 300_000,
  });
}
