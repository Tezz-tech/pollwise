import { describe, expect, it } from 'vitest';
import { createOfflineQueue, MAX_QUEUED } from '../src/lib/offlineQueue.js';

/** An in-memory stand-in for secure storage. */
function memoryStorage() {
  const map = new Map();
  return {
    map,
    get: async (key) => (map.has(key) ? map.get(key) : null),
    set: async (key, value) => void map.set(key, value),
    remove: async (key) => void map.delete(key),
  };
}

const networkError = () => Object.assign(new Error('offline'), { isNetwork: true });
const rejected = () =>
  Object.assign(new Error('locked'), { isNetwork: false, code: 'LESSON_LOCKED' });

function makeQueue(send) {
  let clock = 1000;
  return createOfflineQueue({
    storage: memoryStorage(),
    send,
    isNetworkError: (err) => Boolean(err?.isNetwork),
    now: () => (clock += 1),
  });
}

describe('offline queue', () => {
  it('keeps one heartbeat per lesson, the latest one', async () => {
    const queue = makeQueue(async () => {});
    await queue.enqueue({
      key: 'heartbeat:L1',
      kind: 'heartbeat',
      path: '/lessons/L1/heartbeat',
      method: 'POST',
      body: { positionSec: 10 },
    });
    await queue.enqueue({
      key: 'heartbeat:L1',
      kind: 'heartbeat',
      path: '/lessons/L1/heartbeat',
      method: 'POST',
      body: { positionSec: 20 },
    });
    const items = await queue.list();
    expect(items).toHaveLength(1);
    expect(items[0].body).toEqual({ positionSec: 20 });
  });

  it('sends in order and clears what was sent', async () => {
    const sent = [];
    const queue = makeQueue(async (item) => void sent.push(item.path));
    await queue.enqueue({
      key: 'complete:L1',
      kind: 'complete',
      path: '/lessons/L1/complete',
      method: 'POST',
    });
    await queue.enqueue({
      key: 'complete:L2',
      kind: 'complete',
      path: '/lessons/L2/complete',
      method: 'POST',
    });
    const result = await queue.flush();
    expect(sent).toEqual(['/lessons/L1/complete', '/lessons/L2/complete']);
    expect(result).toEqual({ sent: 2, dropped: 0, pending: 0 });
    expect(await queue.list()).toEqual([]);
  });

  it('stops at the first network failure and keeps the rest', async () => {
    let calls = 0;
    const queue = makeQueue(async () => {
      calls += 1;
      if (calls === 2) throw networkError();
    });
    await queue.enqueue({ key: 'a', kind: 'complete', path: '/a', method: 'POST' });
    await queue.enqueue({ key: 'b', kind: 'complete', path: '/b', method: 'POST' });
    await queue.enqueue({ key: 'c', kind: 'complete', path: '/c', method: 'POST' });
    const result = await queue.flush();
    expect(result.sent).toBe(1);
    expect(result.pending).toBe(2);
    expect(calls).toBe(2);
    expect((await queue.list()).map((i) => i.path)).toEqual(['/b', '/c']);
  });

  it('drops an item the server refuses, because retrying cannot help', async () => {
    const queue = makeQueue(async (item) => {
      if (item.path === '/locked') throw rejected();
    });
    await queue.enqueue({ key: 'x', kind: 'complete', path: '/locked', method: 'POST' });
    await queue.enqueue({ key: 'y', kind: 'complete', path: '/ok', method: 'POST' });
    const result = await queue.flush();
    expect(result).toEqual({ sent: 1, dropped: 1, pending: 0 });
    expect(await queue.list()).toEqual([]);
  });

  it('evicts the oldest heartbeat first when full', async () => {
    const queue = makeQueue(async () => {});
    await queue.enqueue({ key: 'complete:keep', kind: 'complete', path: '/keep', method: 'POST' });
    for (let i = 0; i < MAX_QUEUED; i += 1) {
      await queue.enqueue({
        key: `heartbeat:${i}`,
        kind: 'heartbeat',
        path: `/h/${i}`,
        method: 'POST',
      });
    }
    const items = await queue.list();
    expect(items).toHaveLength(MAX_QUEUED);
    expect(items.some((item) => item.path === '/keep')).toBe(true);
    expect(items.some((item) => item.path === '/h/0')).toBe(false);
  });
});
