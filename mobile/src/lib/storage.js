/**
 * Secure storage for tokens, preferences and the offline queue (CLAUDE.md: secrets in expo-secure-store,
 * never AsyncStorage). Values are strings; JSON helpers below.
 */
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  /** @param {string} key */
  get: (key) => SecureStore.getItemAsync(key),
  /** @param {string} key @param {string} value */
  set: (key, value) => SecureStore.setItemAsync(key, value),
  /** @param {string} key */
  remove: (key) => SecureStore.deleteItemAsync(key),
};

/**
 * @template T
 * @param {{ get: (key: string) => Promise<string | null> }} storage
 * @param {string} key
 * @param {T} fallback
 * @returns {Promise<T>}
 */
export async function readJson(storage, key, fallback) {
  try {
    const raw = await storage.get(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    // A corrupt value must not stop the app from opening; the caller uses its default.
    return fallback;
  }
}
