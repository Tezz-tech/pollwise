/** Learner-facing names for the enums (SPEC §5). Party-neutral wording only (CLAUDE.md rule 5). */
export const PERSONNEL_ROLE_LABELS = Object.freeze({
  party_agent: 'Party / polling agent',
  security: 'Security personnel',
  ict_bvas: 'ICT / BVAS operator',
  collation: 'Collation officer',
  official: 'Election official',
  other: 'Other',
});

export const LESSON_TYPE_LABELS = Object.freeze({
  video: 'Video',
  text: 'Text',
  document: 'Document',
  practice: 'Practice',
});

export const QUESTION_TYPE_LABELS = Object.freeze({
  single_choice: 'Single choice',
  multi_choice: 'Multiple choice',
  true_false: 'True or false',
  matching: 'Matching',
  ordering: 'Ordering',
  fill_blank: 'Fill in the blank',
  reflection: 'Reflection',
});

export const REVEAL_LABELS = Object.freeze({
  never: 'Never show answers',
  immediately: 'Show each answer straight away',
  after_submit: 'After the learner submits',
  after_pass: 'Only after the learner passes',
});
