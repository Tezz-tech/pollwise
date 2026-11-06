/**
 * Request schemas for the super admin area (SPEC §6 super admin routes, SECURITY §4). Admin bodies are
 * strict; list queries cap their page size at 100.
 */
import { z } from 'zod';
import { PERSONNEL_ROLE_VALUES, REGISTRATION_MODES, USER_STATUS } from '@pollwise/shared/constants';
import { objectIdSchema } from '@pollwise/shared/schemas';

const stateCode = z.string().regex(/^[A-Z]{2}$/, 'Unknown state.');
const lgaCode = z.string().regex(/^[A-Z]{2}-[A-Z0-9-]{1,60}$/, 'Unknown area.');
const page = z.coerce.number().int().min(1).max(10000).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(25);
const date = z.coerce.date();

export const userListQuery = z
  .object({
    q: z.string().trim().max(80).optional(),
    stateCode: stateCode.optional(),
    lgaCode: lgaCode.optional(),
    personnelRole: z.enum(PERSONNEL_ROLE_VALUES).optional(),
    status: z.enum(Object.values(USER_STATUS)).optional(),
    page,
    limit,
  })
  .strict();

/** Same filters as the list, without paging, for the CSV export. */
export const userExportQuery = userListQuery.omit({ page: true, limit: true });

export const userParams = z.object({ id: objectIdSchema });

export const userStatusBody = z
  .object({
    status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.DEACTIVATED]),
  })
  .strict();

export const grantBody = z
  .object({
    assessmentId: objectIdSchema,
  })
  .strict();

export const reportQuery = z
  .object({
    stateCode: stateCode.optional(),
  })
  .strict();

export const adminIdParams = z.object({ id: objectIdSchema });

export const settingsBody = z
  .object({
    defaultPassMark: z.number().int().min(1).max(100).optional(),
    registrationMode: z.enum(Object.values(REGISTRATION_MODES)).optional(),
    nextElectionDate: date.nullable().optional(),
    nextElectionLabel: z.string().trim().max(120).nullable().optional(),
    supportEmail: z.email().nullable().optional(),
    privacyPolicyUrl: z.url().max(300).nullable().optional(),
    aboutText: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const accessCodeBody = z
  .object({
    label: z.string().trim().min(1).max(80),
    code: z.string().min(8).max(120),
  })
  .strict();

export const accessCodeParams = z.object({ codeId: objectIdSchema });

export const accessCodeStatusBody = z.object({ active: z.boolean() }).strict();

export const auditQuery = z
  .object({
    actorId: objectIdSchema.optional(),
    action: z.string().trim().min(1).max(80).optional(),
    from: date.optional(),
    to: date.optional(),
    page,
    limit,
  })
  .strict();
