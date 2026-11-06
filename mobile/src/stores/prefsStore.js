/**
 * Device settings the learner can change (DESIGN §6.10): sound, haptics, daily goal and reminder time. The
 * server keeps the account copy (SPEC §6 PATCH /me); this store makes the choice take effect at once and
 * survive a restart without a network call.
 */
import { create } from 'zustand';
import { readJson, secureStorage } from '../lib/storage.js';

export const PREFS_KEY = 'pw.prefs';

export const DEFAULT_PREFS = Object.freeze({
  sound: true,
  haptics: true,
  dailyGoalXp: 10,
  /** "HH:MM" in the device's time, or null for no reminders. */
  reminderTime: null,
});

export const usePrefs = create((set, get) => ({
  ...DEFAULT_PREFS,
  loaded: false,

  /** Read the saved choices. Call once at launch. */
  async hydrate() {
    const saved = await readJson(secureStorage, PREFS_KEY, {});
    set({ ...DEFAULT_PREFS, ...pick(saved), loaded: true });
  },

  /** @param {Partial<typeof DEFAULT_PREFS>} patch */
  setPrefs(patch) {
    const next = { ...pick(get()), ...pick(patch) };
    set(next);
    secureStorage.set(PREFS_KEY, JSON.stringify(next)).catch(() => {});
  },
}));

/** Keep only the known keys, so a stale or hand-edited value cannot leak into the store. */
function pick(source) {
  const out = {};
  for (const key of Object.keys(DEFAULT_PREFS)) {
    if (source && source[key] !== undefined) out[key] = source[key];
  }
  return out;
}
