/**
 * The app's one API client and offline queue. Screens import these; nothing else builds a fetch.
 */
import { API_BASE_URL } from '../lib/config.js';
import { createApiClient } from '../lib/api.js';
import { createOfflineQueue } from '../lib/offlineQueue.js';
import { secureStorage } from '../lib/storage.js';
import { tokenStore } from '../stores/sessionStore.js';

export const api = createApiClient({ baseUrl: API_BASE_URL, tokens: tokenStore });

/**
 * Writes that must survive a dropped connection. A queued item is replayed through the same client, so the
 * refresh and retry rules apply to it too.
 */
export const offlineQueue = createOfflineQueue({
  storage: secureStorage,
  send: (item) => api.request(item.path, { method: item.method, body: item.body }),
  isNetworkError: (err) => Boolean(err?.isNetwork),
});
