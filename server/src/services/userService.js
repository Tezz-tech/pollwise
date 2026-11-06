/**
 * Learner self-service (SPEC §6 /me) and the account deletion job (SECURITY §11).
 *
 * Writes use explicit allowlists. role, status, xp, streak and security.* can never be set from a
 * request body (SECURITY §4 mass assignment). The route schemas strip them before they arrive here.
 */
import mongoose from 'mongoose';
import { ERROR_CODES, PERSONNEL_ROLES, USER_STATUS } from '@pollwise/shared/constants';
import { User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { hashPassword } from '../utils/password.js';
import { randomToken } from '../utils/crypto.js';
import { addDays } from '../utils/time.js';
import { lgaBelongsToState } from './geoService.js';
import { revokeAllForUser } from './tokenService.js';
import { Certificate } from '../models/index.js';
import { toPublicUser } from './authService.js';

export const DELETION_GRACE_DAYS = 7;

async function loadUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'We could not find that account.');
  return user;
}

export async function getMe(_ctx, userId) {
  return toPublicUser(await loadUser(userId));
}

/**
 * @param {{ name?: string, prefs?: { sound?: boolean, haptics?: boolean }, dailyGoalXp?: 10|20|30,
 *   reminderTime?: string | null }} patch already validated and stripped by the route schema
 */
export async function updateMe(ctx, userId, patch) {
  const user = await loadUser(userId);

  if (patch.name !== undefined) user.name = patch.name;
  if (patch.prefs?.sound !== undefined) user.prefs.sound = patch.prefs.sound;
  if (patch.prefs?.haptics !== undefined) user.prefs.haptics = patch.prefs.haptics;
  if (patch.dailyGoalXp !== undefined) user.learning.dailyGoalXp = patch.dailyGoalXp;
  if (patch.reminderTime !== undefined) {
    user.learning.reminderTime = patch.reminderTime ?? undefined;
  }

  await user.save();
  return toPublicUser(user);
}

/**
 * Onboarding answers (SPEC §3 step 4). The LGA must belong to the chosen state.
 * @param {{ stateCode?: string, lgaCode?: string, personnelRole?: string,
 *   ward?: string | null, pollingUnit?: string | null }} patch
 */
export async function updateProfile(ctx, userId, patch) {
  const user = await loadUser(userId);

  if (patch.stateCode !== undefined || patch.lgaCode !== undefined) {
    const stateCode = patch.stateCode ?? user.profile.stateCode;
    const lgaCode = patch.lgaCode ?? user.profile.lgaCode;
    if (!stateCode || !lgaCode || !(await lgaBelongsToState(stateCode, lgaCode))) {
      throw new HttpError(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        'Choose a local government area in your state.',
        [{ path: 'lgaCode', message: 'This area is not in the chosen state.' }]
      );
    }
    user.profile.stateCode = stateCode;
    user.profile.lgaCode = lgaCode;
  }

  if (patch.personnelRole !== undefined) {
    if (!(patch.personnelRole in PERSONNEL_ROLES)) {
      throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, 'Choose one of the listed roles.');
    }
    user.profile.personnelRole = patch.personnelRole;
  }
  if (patch.ward !== undefined) user.profile.ward = patch.ward ?? undefined;
  if (patch.pollingUnit !== undefined) user.profile.pollingUnit = patch.pollingUnit ?? undefined;

  if (
    user.profile.stateCode &&
    user.profile.lgaCode &&
    user.profile.personnelRole &&
    !user.profile.completedAt
  ) {
    user.profile.completedAt = ctx.now();
  }

  await user.save();
  return toPublicUser(user);
}

/**
 * In-app account deletion (SECURITY §11). The account is disabled at once; the daily job anonymises
 * it after the grace period.
 */
export async function requestDeletion(ctx, userId) {
  const user = await loadUser(userId);
  const now = ctx.now();
  user.status = USER_STATUS.PENDING_DELETION;
  user.deletionRequestedAt = now;
  user.security.tokenVersion += 1;
  await user.save();
  await revokeAllForUser(ctx, user._id);
  return {
    status: USER_STATUS.PENDING_DELETION,
    anonymisedAfter: addDays(now, DELETION_GRACE_DAYS).toISOString(),
  };
}

/**
 * Anonymise accounts whose grace period has passed. Name becomes "Deleted user", email and phone are
 * removed, and the password hash is replaced so nobody can sign in. Learning totals are kept without
 * identity for aggregate reporting.
 * @returns {Promise<number>} how many accounts were anonymised
 */
export async function anonymiseDueAccounts(ctx) {
  const cutoff = addDays(ctx.now(), -DELETION_GRACE_DAYS);
  const due = await User.find(
    {
      status: USER_STATUS.PENDING_DELETION,
      deletionRequestedAt: mongoose.trusted({ $lte: cutoff }),
    },
    { _id: 1 }
  ).lean();

  for (const { _id } of due) {
    // Certificates carry the learner's name, so they stop verifying once the account is anonymised.
    await Certificate.updateMany(
      { userId: _id, revokedAt: null },
      { $set: { revokedAt: ctx.now() } }
    );
    await User.updateOne(
      { _id },
      {
        $set: {
          name: 'Deleted user',
          status: USER_STATUS.DEACTIVATED,
          passwordHash: await hashPassword(randomToken(32)),
          anonymisedAt: ctx.now(),
          'security.totpEnabled': false,
        },
        $unset: {
          'profile.ward': '',
          'profile.pollingUnit': '',
          email: '',
          phone: '',
          'security.totpSecretEnc': '',
          'security.totpPendingSecretEnc': '',
          'security.recoveryCodeHashes': '',
          'security.challengeHash': '',
          'security.challengeExpiresAt': '',
        },
      }
    );
  }
  return due.length;
}
