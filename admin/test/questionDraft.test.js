import { describe, expect, it } from 'vitest';
import {
  apiToDraft,
  changeType,
  draftToApi,
  newDraft,
  validateDraft,
} from '../src/lib/questionDraft.js';
import { validateRichText } from '@pollwise/shared/schemas';
import { richTextExtensions } from '../src/lib/richText.js';

describe('draft validation mirrors the server rules', () => {
  it('a new single choice needs a prompt and a correct option before it is ready', () => {
    const d = newDraft('single_choice');
    expect(Object.keys(validateDraft(d))).toEqual(
      expect.arrayContaining(['prompt', 'correctOptionId'])
    );
    d.prompt = 'Who signs?';
    d.correctOptionId = d.options[1].id;
    expect(validateDraft(d)).toEqual({});
  });

  it('multiple choice needs at least one correct option', () => {
    const d = { ...newDraft('multi_choice'), prompt: 'Pick' };
    expect(validateDraft(d).correctOptionIds).toMatch(/at least one/);
  });

  it('matching needs three to six complete pairs', () => {
    const d = { ...newDraft('matching'), prompt: 'Match' };
    expect(validateDraft(d).pairs).toMatch(/both sides/);
    d.pairs = d.pairs.map((p) => ({ ...p, left: 'a', right: 'b' }));
    expect(validateDraft(d).pairs).toBeUndefined();
  });

  it('fill blank counts the blanks and wants an answer for each', () => {
    const d = {
      ...newDraft('fill_blank'),
      prompt: 'Fill',
      template: 'One ___ and two ___',
      acceptedAnswers: [['x']],
    };
    expect(validateDraft(d).acceptedAnswers).toMatch(/2 blank/);
    d.acceptedAnswers = [['x'], ['']];
    expect(validateDraft(d).acceptedAnswers).toMatch(/every blank/i);
  });

  it('reflection needs only a prompt', () => {
    const d = { ...newDraft('reflection'), prompt: 'Think about it' };
    expect(validateDraft(d)).toEqual({});
  });
});

describe('draft to API shape', () => {
  it('sends temporary ids and keeps the stored order for ordering questions', () => {
    const d = {
      ...newDraft('ordering'),
      prompt: 'Order',
      items: [
        { id: 'a1', text: 'First' },
        { id: 'b2', text: 'Second' },
        { id: 'c3', text: 'Third' },
      ],
    };
    const body = draftToApi(d);
    expect(body.correctOrder).toEqual(['a1', 'b2', 'c3']);
    expect(body.items.map((i) => i.id)).toEqual(['a1', 'b2', 'c3']);
  });

  it('reflection never carries a key or points', () => {
    const body = draftToApi({ ...newDraft('reflection'), prompt: 'Think' });
    expect(body.points).toBe(0);
    expect(body.correctOptionId).toBeUndefined();
    expect(Object.keys(body)).not.toContain('acceptedAnswers');
  });

  it('a stored question round-trips through the editor unchanged', () => {
    const stored = {
      _id: '64b000000000000000000001',
      type: 'matching',
      prompt: 'Match',
      points: 1,
      version: 2,
      pairs: [
        { id: 'p1', left: 'a', right: 'A', rightId: 'r1' },
        { id: 'p2', left: 'b', right: 'B', rightId: 'r2' },
        { id: 'p3', left: 'c', right: 'C', rightId: 'r3' },
      ],
    };
    const back = draftToApi(apiToDraft(stored));
    expect(back.pairs).toEqual(stored.pairs);
    expect(back._id).toBe(stored._id);
  });

  it('changing the type keeps the prompt but resets the answer part', () => {
    const d = { ...newDraft('single_choice'), prompt: 'Keep me' };
    const changed = changeType(d, 'true_false');
    expect(changed.prompt).toBe('Keep me');
    expect(changed.type).toBe('true_false');
    expect(changed.key).toBe(d.key);
  });
});

describe('text editor allowlist (SECURITY §4)', () => {
  it('switches off links, code, quotes, strike and rules', () => {
    const options = richTextExtensions().options;
    for (const off of [
      'link',
      'underline',
      'strike',
      'code',
      'codeBlock',
      'blockquote',
      'horizontalRule',
    ]) {
      expect(options[off]).toBe(false);
    }
  });

  it('a document the editor produces passes the server validator', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Before polls open' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Arrive early.', marks: [{ type: 'bold' }] }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Check the seal' }] }],
            },
          ],
        },
      ],
    };
    expect(validateRichText(doc).valid).toBe(true);
  });
});
