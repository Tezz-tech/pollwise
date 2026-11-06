/**
 * The signed-in learner. The refresh token is kept in secure storage; the access token stays in memory only
 * (SECURITY §1). The server is the source of truth: this store holds what the server last said.
 */
import { create } from 'zustand';
import { readJson, secureStorage } from '../lib/storage.js';

export const REFRESH_KEY = 'pw.refresh';
export const USER_KEY = 'pw.user';

/**
 * @typedef {object} SessionUser
 * @property {string} id
 * @property {string} name
 * @property {string} [email]
 * @property {string} [phone]
 * @property {{ stateCode?: string|null, lgaCode?: string|null, personnelRole?: string|null }} profile
 * @property {{ xp?: number, dailyGoalXp?: number, streak?: object, reminderTime?: string|null }} learning
 * @property {{ sound?: boolean, haptics?: boolean }} [prefs]
 */

/**
 * @typedef {'booting' | 'signedOut' | 'signedIn'} SessionStatus
 */

export const useSession = create((set, get) => ({
  /** @type {SessionStatus} */
  status: 'booting',
  /** @type {SessionUser | null} */
  user: null,
  accessToken: null,
  refreshToken: null,

  /**
   * Start a session after sign-in or sign-up.
   * @param {{ user: SessionUser, accessToken: string, refreshToken: string }} session
   */
  startSession({ user, accessToken, refreshToken }) {
    persistRefresh(refreshToken);
    persistUser(user);
    set({ status: 'signedIn', user, accessToken, refreshToken });
  },

  /** @param {{ accessToken: string, refreshToken: string }} tokens */
  setTokens({ accessToken, refreshToken }) {
    persistRefresh(refreshToken);
    set({ accessToken, refreshToken });
  },

  /** @param {Partial<SessionUser>} patch */
  updateUser(patch) {
    const user = { ...get().user, ...patch };
    persistUser(user);
    set({ user });
  },

  /** Forget everything on this device. */
  signOut() {
    persistRefresh(null);
    persistUser(null);
    set({ status: 'signedOut', user: null, accessToken: null, refreshToken: null });
  },

  /** @param {SessionStatus} status */
  setStatus(status) {
    set({ status });
  },
}));

/**
 * The token adapter the API client uses (see src/lib/api.js TokenStore).
 */
export const tokenStore = {
  getAccess: () => useSession.getState().accessToken,
  getRefresh: () => useSession.getState().refreshToken,
  setTokens: (tokens) => useSession.getState().setTokens(tokens),
  clear: () => useSession.getState().signOut(),
};

/** Load the stored refresh token and last-known user. Does not contact the server. */
export async function readStoredSession() {
  const refreshToken = await secureStorage.get(REFRESH_KEY);
  const user = await readJson(secureStorage, USER_KEY, null);
  return { refreshToken, user };
}

/** Fire-and-forget persistence: a failed write must not break the screen. */
function persistRefresh(token) {
  const op = token ? secureStorage.set(REFRESH_KEY, token) : secureStorage.remove(REFRESH_KEY);
  op.catch(() => {});
}

function persistUser(user) {
  const op = user
    ? secureStorage.set(USER_KEY, JSON.stringify(user))
    : secureStorage.remove(USER_KEY);
  op.catch(() => {});
}
