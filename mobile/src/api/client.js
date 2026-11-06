/**
 * The app's one API client and offline queue. Screens import these; nothing else builds a fetch.
 *
 * Every successful request also clears the offline flag and sends any queued writes, so progress saved while the
 * phone was offline reaches the server as soon as a request gets through.
 */
import { API_BASE_URL } from '../lib/config.js';
import { createApiClient } from '../lib/api.js';
import { createOfflineQueue } from '../lib/offlineQueue.js';
import { secureStorage } from '../lib/storage.js';
import { tokenStore } from '../stores/sessionStore.js';
import { useConnection } from '../stores/connectionStore.js';

const base = createApiClient({ baseUrl: API_BASE_URL, tokens: tokenStore });

/**
 * Writes that must survive a dropped connection. A queued item is replayed through the same client, so the
 * refresh and retry rules apply to it too.
 */
export const offlineQueue = createOfflineQueue({
  storage: secureStorage,
  send: (item) => base.request(item.path, { method: item.method, body: item.body }),
  isNetworkError: (err) => Boolean(err?.isNetwork),
});

let flushing = false;

/** Send queued writes, one flush at a time. Errors are not raised: the queue keeps what it could not send. */
export async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    await offlineQueue.flush();
  } catch {
    // Storage trouble leaves the queue as it was; the next successful request tries again.
  } finally {
    flushing = false;
    offlineQueue
      .list()
      .then((items) => useConnection.getState().setQueued(items.length))
      .catch(() => {});
  }
}

export const api = {
  /**
   * @param {string} path
   * @param {object} [options] see src/lib/api.js
   */
  async request(path, options) {
    const connection = useConnection.getState();
    try {
      const data = await base.request(path, options);
      if (connection.offline) connection.setOffline(false);
      flushQueue();
      return data;
    } catch (err) {
      if (err?.isNetwork) useConnection.getState().setOffline(true);
      throw err;
    }
  },
  refreshAccess: base.refreshAccess,
};
