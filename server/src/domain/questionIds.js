/**
 * Item ids inside a question (options, ordering items, matching pairs) are chosen by the server, at
 * random. A learner sees these ids, so predictable ids would leak the answer: an option called
 * "correct", or items named 1-2-3 in their true order. This module keeps the ids the stored question
 * already has, gives every new item a fresh random id, and rewrites answer-key references to match.
 */
import { randomBytes } from 'node:crypto';

/** 10 characters of URL-safe randomness (60 bits). */
export function randomItemId() {
  return randomBytes(8).toString('base64url').slice(0, 10);
}

/**
 * @param {object} input a question as the admin sent it (already zod-validated; ids may be temporary)
 * @param {object} [existing] the stored question with the same _id, when there is one
 * @returns {object} a copy of `input` with server-chosen item ids and remapped references
 */
export function assignQuestionIds(input, existing) {
  const question = structuredClone(input);
  const options = question.options ?? [];
  const items = question.items ?? [];
  const pairs = question.pairs ?? [];

  const storedItemIds = new Set(
    [...(existing?.options ?? []), ...(existing?.items ?? [])].map((i) => i.id)
  );
  const storedLeftIds = new Set((existing?.pairs ?? []).map((p) => p.id));
  const storedRightIds = new Set((existing?.pairs ?? []).map((p) => p.rightId).filter(Boolean));

  // Pass 1: reserve every id that is kept, so a fresh id can never collide with one.
  const taken = new Set();
  for (const item of [...options, ...items]) {
    if (storedItemIds.has(item.id)) taken.add(item.id);
  }
  for (const pair of pairs) {
    if (storedLeftIds.has(pair.id)) taken.add(pair.id);
    if (pair.rightId && storedRightIds.has(pair.rightId)) taken.add(pair.rightId);
  }

  const fresh = () => {
    let id;
    do id = randomItemId();
    while (taken.has(id));
    taken.add(id);
    return id;
  };

  // Pass 2: replace whatever is not kept, remembering the admin's temporary id for remapping.
  const remap = new Map();
  for (const item of [...options, ...items]) {
    if (!storedItemIds.has(item.id)) {
      const clientId = item.id;
      item.id = fresh();
      remap.set(clientId, item.id);
    }
  }
  for (const pair of pairs) {
    if (!storedLeftIds.has(pair.id)) pair.id = fresh();
    if (!pair.rightId || !storedRightIds.has(pair.rightId)) pair.rightId = fresh();
  }

  // Answer-key references use the admin's ids, so rewrite them to the new ones.
  const mapId = (id) => (remap.has(id) ? remap.get(id) : id);
  if (question.correctOptionId !== undefined) {
    question.correctOptionId = mapId(question.correctOptionId);
  }
  if (question.correctOptionIds) question.correctOptionIds = question.correctOptionIds.map(mapId);
  if (question.correctOrder) question.correctOrder = question.correctOrder.map(mapId);
  return question;
}
