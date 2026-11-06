/**
 * Admin account management. Phase 1 covers invitations only; listing, revoking and the rest of the
 * admin area follow in Phase 4.
 */
import { ERROR_CODES, ROLES, USER_STATUS } from '@pollwise/shared/constants';
import { User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { hashPassword } from '../utils/password.js';
import { randomToken } from '../utils/crypto.js';
import { adminInviteEmail } from './mailService.js';
import { recordAudit } from './auditService.js';
import { createInviteToken } from './authService.js';

/**
 * Invite a content admin or super admin by email (SPEC §6, SECURITY §1).
 * @param {{ _id: unknown, role: string }} actor the super admin doing the inviting
 * @param {{ email: string, name: string, role: 'content_admin' | 'super_admin' }} input
 * @param {{ ip?: string }} meta
 */
export async function inviteAdmin(ctx, actor, input, meta) {
  const email = input.email.toLowerCase();
  if (await User.exists({ email })) {
    throw new HttpError(409, ERROR_CODES.CONFLICT, 'An account with that email already exists.');
  }

  // The stored password is random and unknown to everyone. The invitee sets their own through the link.
  const user = await User.create({
    name: input.name,
    email,
    passwordHash: await hashPassword(randomToken(32)),
    role: input.role,
    status: USER_STATUS.ACTIVE,
    security: { passwordChangedAt: ctx.now() },
  });

  const { token } = await createInviteToken(ctx, user._id);
  const link = `${ctx.config.ADMIN_PUBLIC_URL.replace(/\/$/, '')}/accept-invite?token=${token}`;
  try {
    await ctx.mailer.send({ to: email, ...adminInviteEmail(link) });
  } catch (err) {
    // The invitation exists even if the email fails; the logs record the failure without the link.
    ctx.logger.error(
      { err: err.message, userId: String(user._id) },
      'invitation email failed to send'
    );
  }

  await recordAudit(ctx, {
    actorId: actor._id,
    actorRole: actor.role,
    action: 'admin.invite',
    targetType: 'user',
    targetId: user._id,
    meta: { role: input.role },
    ip: meta.ip,
  });

  return { id: String(user._id), email, role: input.role, name: input.name };
}

export const INVITABLE_ROLES = Object.freeze([ROLES.CONTENT_ADMIN, ROLES.SUPER_ADMIN]);
