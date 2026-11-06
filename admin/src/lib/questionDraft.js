/**
 * Question drafts for the editors. A draft is the editor's working copy: each option, item and pair has
 * a temporary id that the server replaces with a random one on save (SECURITY §3). Everything here is
 * pure so it can be tested. The rules mirror the shared zod schemas, so mistakes show up beside the field.
 */
import { QUESTION_TYPE_LABELS } from './labels.js';

export const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS);

let counter = 0;
/** A temporary id, unique in this browser session. Stable for the life of one editor. */
export function tempId(prefix = 'n') {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

/** An empty draft of each type, with sensible starting rows. */
export function newDraft(type) {
  switch (type) {
    case 'single_choice':
      return base(type, { options: [opt('Option A'), opt('Option B')], correctOptionId: null });
    case 'multi_choice':
      return base(type, {
        options: [opt('Option A'), opt('Option B'), opt('Option C')],
        correctOptionIds: [],
      });
    case 'true_false':
      return base(type, { correct: true });
    case 'matching':
      return base(type, { pairs: [pair(), pair(), pair()] });
    case 'ordering':
      return base(type, { items: [opt('First step'), opt('Second step'), opt('Third step')] });
    case 'fill_blank':
      return base(type, { template: 'The ___ signs the result sheet.', acceptedAnswers: [['']] });
    case 'reflection':
      return base(type, {});
    default:
      throw new Error(`Unknown question type: ${type}`);
  }
}

function base(type, extra) {
  return {
    key: tempId('q'),
    _id: undefined,
    type,
    prompt: '',
    explanation: '',
    points: 1,
    ...extra,
  };
}
function opt(text) {
  return { id: tempId('o'), text };
}
function pair() {
  return { id: tempId('p'), rightId: tempId('r'), left: '', right: '' };
}

/** Client-side checks. Returns {field: message}; empty object means the draft is ready to save. */
export function validateDraft(d) {
  const e = {};
  if (!d.prompt.trim()) e.prompt = 'Write the question.';
  if (d.prompt.length > 500) e.prompt = 'Keep the question under 500 characters.';
  if (d.explanation && d.explanation.length > 500)
    e.explanation = 'Keep the explanation under 500 characters.';

  const texts = (list) => list.map((x) => x.text.trim());
  switch (d.type) {
    case 'single_choice': {
      if (d.options.length < 2) e.options = 'Add at least two options.';
      else if (texts(d.options).some((t) => !t)) e.options = 'Every option needs text.';
      else if (!d.correctOptionId) e.correctOptionId = 'Mark the correct option.';
      break;
    }
    case 'multi_choice': {
      if (d.options.length < 2) e.options = 'Add at least two options.';
      else if (texts(d.options).some((t) => !t)) e.options = 'Every option needs text.';
      else if (d.correctOptionIds.length < 1)
        e.correctOptionIds = 'Mark at least one correct option.';
      break;
    }
    case 'matching': {
      if (d.pairs.length < 3) e.pairs = 'Add at least three pairs.';
      else if (d.pairs.length > 6) e.pairs = 'Use at most six pairs.';
      else if (d.pairs.some((p) => !p.left.trim() || !p.right.trim()))
        e.pairs = 'Fill in both sides of every pair.';
      break;
    }
    case 'ordering': {
      if (d.items.length < 3) e.items = 'Add at least three steps.';
      else if (d.items.length > 8) e.items = 'Use at most eight steps.';
      else if (texts(d.items).some((t) => !t))
        e.items = 'Every step needs text. List them in the correct order.';
      break;
    }
    case 'fill_blank': {
      const blanks = d.template.split('___').length - 1;
      if (blanks < 1) e.template = 'Put ___ where the blank goes.';
      else if (d.acceptedAnswers.length !== blanks)
        e.acceptedAnswers = `This sentence has ${blanks} blank(s). Give answers for each.`;
      else if (
        d.acceptedAnswers.some((list) => list.map((a) => a.trim()).filter(Boolean).length === 0)
      ) {
        e.acceptedAnswers = 'Every blank needs at least one accepted answer.';
      }
      break;
    }
    default:
      break;
  }
  return e;
}

/** Turn a draft into the API body. Reflection never carries a key or points. */
export function draftToApi(d) {
  const body = { type: d.type, prompt: d.prompt.trim() };
  if (d.explanation?.trim()) body.explanation = d.explanation.trim();
  if (d._id) body._id = d._id;
  switch (d.type) {
    case 'single_choice':
      Object.assign(body, { options: d.options.map(clean), correctOptionId: d.correctOptionId });
      break;
    case 'multi_choice':
      Object.assign(body, { options: d.options.map(clean), correctOptionIds: d.correctOptionIds });
      break;
    case 'true_false':
      Object.assign(body, { correct: Boolean(d.correct) });
      break;
    case 'matching':
      Object.assign(body, {
        pairs: d.pairs.map((p) => ({
          id: p.id,
          rightId: p.rightId,
          left: p.left.trim(),
          right: p.right.trim(),
        })),
      });
      break;
    case 'ordering':
      Object.assign(body, { items: d.items.map(clean), correctOrder: d.items.map((i) => i.id) });
      break;
    case 'fill_blank':
      Object.assign(body, {
        template: d.template.trim(),
        acceptedAnswers: d.acceptedAnswers.map((list) => list.map((a) => a.trim()).filter(Boolean)),
      });
      break;
    case 'reflection':
      Object.assign(body, { points: 0 });
      break;
    default:
      break;
  }
  if (d.type !== 'reflection') body.points = Number(d.points) || 1;
  return body;
}

const clean = (o) => ({ id: o.id, text: o.text.trim() });

/** Turn an API question (with answer keys, for the admin) into a draft the editor can change. */
export function apiToDraft(q) {
  const id = q._id ?? q.id;
  const d = {
    key: id,
    _id: id,
    type: q.type,
    prompt: q.prompt ?? '',
    explanation: q.explanation ?? '',
    points: q.points ?? 1,
    version: q.version,
  };
  switch (q.type) {
    case 'single_choice':
      return {
        ...d,
        options: q.options.map((o) => ({ ...o })),
        correctOptionId: q.correctOptionId,
      };
    case 'multi_choice':
      return {
        ...d,
        options: q.options.map((o) => ({ ...o })),
        correctOptionIds: [...q.correctOptionIds],
      };
    case 'true_false':
      return { ...d, correct: q.correct };
    case 'matching':
      return { ...d, pairs: q.pairs.map((p) => ({ ...p })) };
    case 'ordering':
      return {
        ...d,
        items: q.correctOrder.map((itemId) => ({ ...q.items.find((i) => i.id === itemId) })),
      };
    case 'fill_blank':
      return { ...d, template: q.template, acceptedAnswers: q.acceptedAnswers.map((l) => [...l]) };
    default:
      return d;
  }
}

/** Keep a draft's key stable when the editor changes its type (the type change resets the content). */
export function changeType(draft, type) {
  return {
    ...newDraft(type),
    key: draft.key,
    _id: draft._id,
    prompt: draft.prompt,
    explanation: draft.explanation,
    points: draft.points,
  };
}
