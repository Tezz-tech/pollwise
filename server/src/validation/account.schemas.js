/**
 * Request schemas for /me, /geo, /settings and /admin/admins. Learner write bodies strip unknown keys
 * so role, status, xp, streak and security.* can never be set by the client (SECURITY §4).
 */
import { z } from 'zod';
import {
  DAILY_GOAL_OPTIONS,
  INVITABLE_ROLE_VALUES,
  PERSONNEL_ROLE_VALUES,
} from '@pollwise/shared/constants';

const shortText = (max) => z.string().trim().min(1).max(max);
const optionalText = (max) => z.string().trim().max(max).nullable();

export const updateMeBody = z.object({
  name: shortText(120).optional(),
  prefs: z
    .object({
      sound: z.boolean().optional(),
      haptics: z.boolean().optional(),
    })
    .optional(),
  dailyGoalXp: z.union(DAILY_GOAL_OPTIONS.map((value) => z.literal(value))).optional(),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time in 24-hour form, like 07:30.')
    .nullable()
    .optional(),
});

export const updateProfileBody = z.object({
  stateCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  lgaCode: z
    .string()
    .regex(/^[A-Z]{2}-[A-Z0-9-]{1,60}$/)
    .optional(),
  personnelRole: z.enum(PERSONNEL_ROLE_VALUES).optional(),
  ward: optionalText(120).optional(),
  pollingUnit: optionalText(120).optional(),
});

export const stateCodeParams = z.object({
  stateCode: z.string().regex(/^[A-Z]{2}$/, 'Unknown state.'),
});

export const inviteAdminBody = z
  .object({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.')),
    name: shortText(120),
    role: z.enum(INVITABLE_ROLE_VALUES),
  })
  .strict();

/** Own password change. The new one follows the same rules as sign-up (SPEC §3: at least 10 characters). */
export const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(10).max(128),
  })
  .strict();
