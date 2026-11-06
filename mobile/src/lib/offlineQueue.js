/**
 * Offline queue for learner writes that must not be lost: video heartbeats and completions (DESIGN §6.11).
 *
 * Items are stored one key each, so a single item always fits the small per-value limit of secure storage.
 * Flushing stops at the first network failure and keeps the rest. A server rejection (for example a lesson
 * that is no longer open) drops the item: the server is the source of truth, and retrying cannot help.
 */

export const QUEUE_INDEX_KEY = 'pw.queue.index';
/** Oldest heartbeats go first when the queue is full: a lost heartbeat only costs a few seconds of credit. */
export const MAX_QUEUED = 200;

/**
 * @typedef {object} QueueStorage
 * @property {(key: string) => Promise<string | null>} get
 * @property {(key: string, value: string) => Promise<void>} set
 * @property {(key: string) => Promise<void>} remove
 */

/**
 * @typedef {object} QueuedRequest
 * @property {string} id
 * @property {string} key coalescing key, e.g. "heartbeat:<lessonId>"
 * @property {string} kind 'heartbeat' | 'complete' | 'other'
 * @property {string} path
 * @property {string} method
 * @property {unknown} [body]
 * @property {number} queuedAt
 */

/**
 * @param {{
 *   storage: QueueStorage,
 *   send: (item: QueuedRequest) => Promise<unknown>,
 *   isNetworkError: (err: unknown) => boolean,
 *   now?: () => number,
 * }} deps
 */
export function createOfflineQueue({ storage, send, isNetworkError, now = Date.now }) {
  let counter = 0;

  async function readIndex() {
    const raw = await storage.get(QUEUE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  async function writeIndex(ids) {
    await storage.set(QUEUE_INDEX_KEY, JSON.stringify(ids));
  }

  async function list() {
    const ids = await readIndex();
    const items = [];
    for (const id of ids) {
      const raw = await storage.get(itemKey(id));
      if (raw) items.push(JSON.parse(raw));
    }
    return items;
  }

  /**
   * Add a write. A newer write with the same key replaces the older one, so a learner who watched for
   * ten minutes sends one heartbeat, not sixty.
   * @param {Omit<QueuedRequest, 'id' | 'queuedAt'>} request
   */
  async function enqueue(request) {
    const ids = await readIndex();
    const items = await list();
    const replaced = items.find((item) => item.key === request.key);
    const id = replaced?.id ?? `${now()}-${(counter += 1)}`;
    const entry = { ...request, id, queuedAt: now() };
    await storage.set(itemKey(id), JSON.stringify(entry));
    if (!replaced) ids.push(id);

    // Evict oldest heartbeats first when full; anything else is kept.
    while (ids.length > MAX_QUEUED) {
      const evictId = ids.find((candidate) => {
        const found = items.find((item) => item.id === candidate);
        return found?.kind === 'heartbeat';
      });
      const victim = evictId ?? ids[0];
      ids.splice(ids.indexOf(victim), 1);
      await storage.remove(itemKey(victim));
    }
    await writeIndex(ids);
    return id;
  }

  /**
   * Send queued writes in order.
   * @returns {Promise<{ sent: number, dropped: number, pending: number }>}
   */
  async function flush() {
    let sent = 0;
    let dropped = 0;
    const items = await list();
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      try {
        await send(item);
        sent += 1;
      } catch (err) {
        if (isNetworkError(err)) {
          return { sent, dropped, pending: items.length - sent - dropped };
        }
        dropped += 1; // rejected by the server: nothing to retry
      }
      await removeItem(item.id);
    }
    return { sent, dropped, pending: 0 };
  }

  async function removeItem(id) {
    const ids = (await readIndex()).filter((candidate) => candidate !== id);
    await storage.remove(itemKey(id));
    await writeIndex(ids);
  }

  return { enqueue, flush, list, removeItem };
}

/** @param {string} id */
function itemKey(id) {
  return `pw.queue.${id}`;
}
