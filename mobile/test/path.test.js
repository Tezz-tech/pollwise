import { describe, expect, it } from 'vitest';
import { buildPath, checkState, nodeLabel, lessonState } from '../src/lib/path.js';
import { responseFor, splitTemplate, firstUnanswered, matchingPairs } from '../src/lib/practice.js';
import { firstOpenLesson } from '../src/lib/startLesson.js';

const outline = {
  modules: [
    {
      id: 'm1',
      title: 'Opening',
      locked: false,
      lessons: [
        {
          id: 'l1',
          title: 'Arrive',
          type: 'video',
          durationSec: 240,
          xp: 10,
          locked: false,
          completed: true,
        },
        {
          id: 'l2',
          title: 'Set up',
          type: 'text',
          durationSec: null,
          xp: 10,
          locked: false,
          completed: false,
        },
        {
          id: 'l3',
          title: 'Forms',
          type: 'document',
          durationSec: null,
          xp: 10,
          locked: true,
          completed: false,
        },
      ],
      assessment: { id: 'a1', title: 'Check', locked: true, passed: false },
    },
    {
      id: 'm2',
      title: 'Voting',
      locked: true,
      lessons: [{ id: 'l4', title: 'Ballots', type: 'practice', locked: true, completed: false }],
      assessment: null,
    },
  ],
};

describe('buildPath', () => {
  const { rows, currentId, moduleStartIndex } = buildPath(outline);

  it('makes one banner per module, then its nodes and check', () => {
    expect(rows.map((r) => r.kind + ':' + r.key)).toEqual([
      'banner:banner-m1',
      'node:lesson-l1',
      'node:lesson-l2',
      'node:lesson-l3',
      'node:check-a1',
      'banner:banner-m2',
      'node:lesson-l4',
    ]);
    expect(moduleStartIndex.m2).toBe(5);
  });

  it('marks the first open, unfinished lesson as current', () => {
    expect(currentId).toBe('l2');
    expect(rows.find((r) => r.key === 'lesson-l2').state).toBe('current');
  });

  it('marks completed, locked and available nodes', () => {
    expect(rows.find((r) => r.key === 'lesson-l1').state).toBe('completed');
    expect(rows.find((r) => r.key === 'lesson-l3').state).toBe('locked');
    expect(rows.find((r) => r.key === 'lesson-l4').state).toBe('locked');
  });

  it('counts module progress on the banner', () => {
    expect(rows[0]).toMatchObject({ index: 1, total: 2, done: 1 });
  });

  it('gives the check node its own states', () => {
    expect(checkState({ passed: true, locked: false })).toBe('completed');
    expect(checkState({ passed: false, locked: true })).toBe('locked');
    expect(checkState({ passed: false, locked: false })).toBe('available');
  });

  it('builds a screen-reader label with type, length and state', () => {
    const video = rows.find((r) => r.key === 'lesson-l1');
    expect(nodeLabel(video, 1)).toBe('Lesson 1, Arrive, video, 4 minutes, completed');
  });

  it('chooses the current node only among unlocked lessons', () => {
    expect(lessonState({ id: 'x', locked: true, completed: false }, 'x')).toBe('locked');
  });
});

describe('firstOpenLesson', () => {
  it('skips completed and locked lessons', () => {
    expect(firstOpenLesson(outline)?.id).toBe('l2');
  });

  it('returns null when nothing is open', () => {
    expect(firstOpenLesson({ modules: [{ lessons: [{ id: 'z', completed: true }] }] })).toBeNull();
  });
});

describe('responseFor (matches server responseSchemas)', () => {
  it('builds each type body', () => {
    expect(responseFor('single_choice', 'o1')).toEqual({ optionId: 'o1' });
    expect(responseFor('multi_choice', ['a', 'b'])).toEqual({ optionIds: ['a', 'b'] });
    expect(responseFor('true_false', false)).toEqual({ value: false });
    expect(responseFor('matching', { l1: 'r1', l2: 'r2' })).toEqual({
      rightByLeft: { l1: 'r1', l2: 'r2' },
    });
    expect(responseFor('ordering', ['i2', 'i1'])).toEqual({ order: ['i2', 'i1'] });
    expect(responseFor('fill_blank', ['ward', ''])).toEqual({ blanks: ['ward', ''] });
    expect(responseFor('reflection', '  note  ')).toEqual({ text: 'note' });
  });

  it('returns null until the learner has answered', () => {
    expect(responseFor('single_choice', null)).toBeNull();
    expect(responseFor('multi_choice', [])).toBeNull();
    expect(responseFor('true_false', undefined)).toBeNull();
    expect(responseFor('matching', {})).toBeNull();
    expect(responseFor('fill_blank', ['', ' '])).toBeNull();
    expect(responseFor('reflection', '   ')).toBeNull();
  });

  it('drops unpaired items from a matching answer', () => {
    expect(matchingPairs({ l1: 'r1', l2: null })).toEqual([['l1', 'r1']]);
  });
});

describe('templates and resume', () => {
  it('splits a fill-in template on its blanks', () => {
    expect(splitTemplate('The ___ opens at ___ am.')).toEqual(['The ', ' opens at ', ' am.']);
  });

  it('resumes at the first unanswered question', () => {
    const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }];
    expect(firstUnanswered(questions, ['q1'])).toBe(1);
    expect(firstUnanswered(questions, ['q1', 'q2', 'q3'])).toBe(-1);
  });
});

import { correctAnswerText } from '../src/lib/practice.js';

describe('correctAnswerText', () => {
  it('turns server ids into the words the learner saw', () => {
    const q = {
      type: 'single_choice',
      options: [
        { id: 'a', text: 'Form EC8A' },
        { id: 'b', text: 'Form EC8B' },
      ],
    };
    expect(correctAnswerText(q, 'b')).toBe('Form EC8B');
    expect(correctAnswerText(q, null)).toBeNull();
  });

  it('reads true/false and ordering answers', () => {
    expect(correctAnswerText({ type: 'true_false' }, false)).toBe('False');
    const q = {
      type: 'ordering',
      items: [
        { id: 'x', text: 'First' },
        { id: 'y', text: 'Second' },
      ],
    };
    expect(correctAnswerText(q, ['y', 'x'])).toBe('1. Second\n2. First');
  });
});
