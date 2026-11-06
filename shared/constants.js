/**
 * Enums and fixed values shared by server, admin and mobile.
 *
 * Values are the stored strings (SPEC §5). Labels are for display only. Keep these frozen: a typo
 * here becomes a bad row in the database.
 */

/** @typedef {'learner' | 'content_admin' | 'super_admin'} Role */
export const ROLES = Object.freeze({
  LEARNER: 'learner',
  CONTENT_ADMIN: 'content_admin',
  SUPER_ADMIN: 'super_admin',
});
export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

/**
 * Who a learner is on election day. Party-neutral on purpose: no party or candidate names anywhere
 * (CLAUDE.md rule 5). The label list follows SPEC §3 step 4.3.
 */
export const PERSONNEL_ROLES = Object.freeze({
  party_agent: 'Party / polling agent',
  security: 'Security personnel',
  ict_bvas: 'ICT / BVAS operator',
  collation: 'Collation officer',
  official: 'Election official',
  other: 'Other',
});
export const PERSONNEL_ROLE_VALUES = Object.freeze(Object.keys(PERSONNEL_ROLES));

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  DEACTIVATED: 'deactivated',
  PENDING_DELETION: 'pending_deletion',
});

export const COURSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const LESSON_TYPES = Object.freeze({
  VIDEO: 'video',
  TEXT: 'text',
  DOCUMENT: 'document',
  PRACTICE: 'practice',
});
export const LESSON_TYPE_VALUES = Object.freeze(Object.values(LESSON_TYPES));

export const QUESTION_TYPES = Object.freeze({
  SINGLE_CHOICE: 'single_choice',
  MULTI_CHOICE: 'multi_choice',
  TRUE_FALSE: 'true_false',
  MATCHING: 'matching',
  ORDERING: 'ordering',
  FILL_BLANK: 'fill_blank',
  REFLECTION: 'reflection',
});
export const QUESTION_TYPE_VALUES = Object.freeze(Object.values(QUESTION_TYPES));

/** Reflection questions are stored but never graded (SPEC §8.2). */
export const UNGRADED_QUESTION_TYPES = Object.freeze([QUESTION_TYPES.REFLECTION]);

export const REVEAL_MODES = Object.freeze({
  NEVER: 'never',
  IMMEDIATELY: 'immediately',
  AFTER_SUBMIT: 'after_submit',
  AFTER_PASS: 'after_pass',
});
export const REVEAL_MODE_VALUES = Object.freeze(Object.values(REVEAL_MODES));

export const ENROLLMENT_STATUS = Object.freeze({
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

export const LESSON_PROGRESS_STATUS = Object.freeze({
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

export const ATTEMPT_STATUS = Object.freeze({
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  EXPIRED: 'expired',
});

export const REGISTRATION_MODES = Object.freeze({
  OPEN: 'open',
  ACCESS_CODE: 'access_code',
});

/** Learner daily XP goal options (SPEC §3 step 4.5). */
export const DAILY_GOAL_OPTIONS = Object.freeze([10, 20, 30]);

/** Time zone for every "day" in streaks and daily goals (CLAUDE.md conventions). */
export const APP_TIME_ZONE = 'Africa/Lagos';

/** Default pass mark, overridable in Settings (SPEC §5, decisions log). */
export const DEFAULT_PASS_MARK = 70;

/** Error codes used in `{ error: { code, message } }` responses (SCREAMING_SNAKE, CLAUDE.md). */
export const ERROR_CODES = Object.freeze({
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_ID: 'INVALID_ID',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  PHONE_IN_USE: 'PHONE_IN_USE',
  INVALID_ACCESS_CODE: 'INVALID_ACCESS_CODE',
  INVALID_RESET_CODE: 'INVALID_RESET_CODE',
  TOTP_REQUIRED: 'TOTP_REQUIRED',
  INVALID_TOTP: 'INVALID_TOTP',
  LESSON_LOCKED: 'LESSON_LOCKED',
  ASSESSMENT_LOCKED: 'ASSESSMENT_LOCKED',
  ALREADY_ANSWERED: 'ALREADY_ANSWERED',
  ATTEMPTS_EXHAUSTED: 'ATTEMPTS_EXHAUSTED',
  ATTEMPT_EXPIRED: 'ATTEMPT_EXPIRED',
  PUBLISH_CHECKLIST_FAILED: 'PUBLISH_CHECKLIST_FAILED',
  COURSE_HAS_ENROLMENTS: 'COURSE_HAS_ENROLMENTS',
  UPLOAD_REJECTED: 'UPLOAD_REJECTED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
});
