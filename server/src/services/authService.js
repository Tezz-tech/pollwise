/**
 * Authentication (SECURITY §1, SPEC §6 auth routes). Controllers call these functions and never touch
 * the models directly.
 *
 * Every failed credential check returns the same INVALID_CREDENTIALS error whether the account exists
 * or not, and runs an argon2 verification either way so response time does not reveal the account.
 */
import mongoose from 'mongoose';
import { ERROR_CODES, REGISTRATION_MODES, ROLES, USER_STATUS } from '@pollwise/shared/constants';
import { PasswordReset, RefreshToken, User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { randomSixDigitCode, randomToken, sha256Hex } from '../utils/crypto.js';
import { normaliseNigerianPhone } from '../utils/phone.js';
import { hashPassword, passwordProblem, verifyPassword } from '../utils/password.js';
import { lockoutDurationMs, LOCKOUT_THRESHOLD } from '../utils/lockout.js';
import { addHours, addMinutes } from '../utils/time.js';
import { recordAudit } from './auditService.js';
import { getSettings, matchAccessCode, recordAccessCodeUse } from './settingsService.js';
import { resetCodeEmail } from './mailService.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  issueRefreshToken,
  revokeAllForUser,
  revokeFamily,
  rotateRefreshToken,
  signAccessToken,
} from './tokenService.js';
import {
  checkTotpCode,
  createRecoveryCodes,
  decryptSecret,
  encryptSecret,
  matchRecoveryCode,
  newTotpSecret,
  RECOVERY_CODE_PATTERN,
  totpUri,
} from './totpService.js';

export const ADMIN_CHALLENGE_TTL_MINUTES = 5;
export const RESET_CODE_TTL_MINUTES = 15;
export const RESET_MAX_ATTEMPTS = 5;
export const INVITE_TTL_HOURS = 48;
const CHALLENGE_MAX_ATTEMPTS = 5;

const isAdminRole = (role) => role === ROLES.CONTENT_ADMIN || role === ROLES.SUPER_ADMIN;

/** A fixed argon2 hash, computed once, used to spend the same time as a real check. */
let dummyHashPromise;
function dummyHash() {
  dummyHashPromise ??= hashPassword(randomToken(24));
  return dummyHashPromise;
}

const invalidCredentials = () =>
  new HttpError(
    401,
    ERROR_CODES.INVALID_CREDENTIALS,
    'That email, phone or password is not right.'
  );

/** The user shape the app may see. Never includes hashes or security fields. */
export function toPublicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email ?? null,
    phone: user.phone ?? null,
    role: user.role,
    status: user.status,
    profile: {
      stateCode: user.profile?.stateCode ?? null,
      lgaCode: user.profile?.lgaCode ?? null,
      personnelRole: user.profile?.personnelRole ?? null,
      ward: user.profile?.ward ?? null,
      pollingUnit: user.profile?.pollingUnit ?? null,
      completedAt: user.profile?.completedAt ?? null,
    },
    learning: {
      xp: user.learning?.xp ?? 0,
      dailyGoalXp: user.learning?.dailyGoalXp ?? 10,
      streak: {
        current: user.learning?.streak?.current ?? 0,
        longest: user.learning?.streak?.longest ?? 0,
        freezes: user.learning?.streak?.freezes ?? 0,
      },
      reminderTime: user.learning?.reminderTime ?? null,
    },
    prefs: { sound: user.prefs?.sound ?? true, haptics: user.prefs?.haptics ?? true },
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

/**
 * Accept an email or a phone number. Anything else is not a valid identifier.
 * @param {string} identifier
 * @returns {{ email: string } | { phone: string } | null}
 */
export function parseIdentifier(identifier) {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) return { email: trimmed.toLowerCase() };
  const phone = normaliseNigerianPhone(trimmed);
  return phone ? { phone } : null;
}

/** @param {string} identifier @param {{ withSecrets?: boolean }} [options] */
async function findUserByIdentifier(identifier, { withSecrets = false } = {}) {
  const parsed = parseIdentifier(identifier);
  if (!parsed) return null;
  const query = User.findOne(parsed);
  if (withSecrets) query.select('+passwordHash +security.recoveryCodeHashes');
  return query;
}

/** Sessions are created the same way for learners and admins; the controller chooses how to deliver. */
async function openSession(ctx, user, meta) {
  user.lastLoginAt = ctx.now();
  await user.save();
  const refreshToken = await issueRefreshToken(ctx, user, meta);
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(ctx, user),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
  };
}

/**
 * Password check with lockout (SECURITY §1). Caller decides what to do with the user afterwards.
 * @returns {Promise<void>} resolves when the password is correct; throws INVALID_CREDENTIALS otherwise
 */
async function checkPassword(ctx, user, password) {
  const now = ctx.now();
  if (!user) {
    await verifyPassword(await dummyHash(), password);
    throw invalidCredentials();
  }

  // Locked: refuse without checking the password, and do the same work as a real check.
  if (user.security.lockUntil && user.security.lockUntil > now) {
    await verifyPassword(await dummyHash(), password);
    throw invalidCredentials();
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    user.security.failedLogins += 1;
    if (user.security.failedLogins >= LOCKOUT_THRESHOLD) {
      user.security.lockouts += 1;
      user.security.failedLogins = 0;
      user.security.lockUntil = new Date(now.getTime() + lockoutDurationMs(user.security.lockouts));
      ctx.logger.warn({ userId: String(user._id) }, 'account locked after repeated failures');
    }
    await user.save();
    throw invalidCredentials();
  }

  user.security.failedLogins = 0;
  user.security.lockouts = 0;
  user.security.lockUntil = undefined;
  await user.save();
}

/**
 * Learner registration (SPEC §3 step 3). Creates the account and signs the learner in.
 * @param {{ name: string, email: string, phone: string, password: string, accessCode?: string }} input
 * @param {{ ip?: string, userAgent?: string }} meta
 */
export async function registerLearner(ctx, input, meta) {
  let accessCodeId = null;
  const settings = await getSettings();
  if (settings.registrationMode === REGISTRATION_MODES.ACCESS_CODE) {
    accessCodeId = input.accessCode ? await matchAccessCode(input.accessCode) : null;
    if (!accessCodeId) {
      throw new HttpError(403, ERROR_CODES.INVALID_ACCESS_CODE, 'That access code is not valid.');
    }
  }

  const phone = normaliseNigerianPhone(input.phone);
  if (!phone) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      'Enter a valid Nigerian mobile number.',
      [{ path: 'phone', message: 'Enter a valid Nigerian mobile number.' }]
    );
  }

  const problem = passwordProblem(input.password);
  if (problem) {
    throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, problem, [
      { path: 'password', message: problem },
    ]);
  }

  const email = input.email.toLowerCase();
  if (await User.exists({ email })) {
    throw new HttpError(
      409,
      ERROR_CODES.EMAIL_IN_USE,
      'An account with that email already exists.'
    );
  }
  if (await User.exists({ phone })) {
    throw new HttpError(
      409,
      ERROR_CODES.PHONE_IN_USE,
      'An account with that phone number already exists.'
    );
  }

  let user;
  try {
    user = await User.create({
      name: input.name,
      email,
      phone,
      passwordHash: await hashPassword(input.password),
      role: ROLES.LEARNER,
      security: { passwordChangedAt: ctx.now() },
    });
  } catch (err) {
    // A concurrent registration can still win the unique index; report it the same way.
    if (err?.code === 11000) {
      throw new HttpError(
        409,
        ERROR_CODES.EMAIL_IN_USE,
        'An account with that email already exists.'
      );
    }
    throw err;
  }

  if (accessCodeId) await recordAccessCodeUse(accessCodeId);
  return openSession(ctx, user, meta);
}

/**
 * Learner sign-in by email or phone (SPEC §6).
 * @param {{ identifier: string, password: string }} input
 */
export async function loginLearner(ctx, input, meta) {
  const user = await findUserByIdentifier(input.identifier, { withSecrets: true });
  if (user && isAdminRole(user.role)) {
    // Admins use /auth/admin/login. Treat the attempt as a failed learner login.
    await verifyPassword(await dummyHash(), input.password);
    throw invalidCredentials();
  }
  await checkPassword(ctx, user, input.password);
  if (user.status !== USER_STATUS.ACTIVE) {
    throw new HttpError(
      403,
      ERROR_CODES.ACCOUNT_DEACTIVATED,
      'This account is not active. Contact PollWise support.'
    );
  }
  return openSession(ctx, user, meta);
}

/**
 * Rotate a refresh token. Admin callers come through the cookie route and get a new CSRF value too.
 * @param {string} raw
 * @param {{ ip?: string, userAgent?: string }} meta
 */
export async function refreshSession(ctx, raw, meta) {
  const { user, refreshToken } = await rotateRefreshToken(ctx, raw, meta);
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(ctx, user),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
  };
}

/** Revoke the session this refresh token belongs to. Unknown tokens are ignored (idempotent). */
export async function logout(ctx, raw) {
  const row = await RefreshToken.findOne({ tokenHash: sha256Hex(raw) }, { family: 1 }).lean();
  if (row) await revokeFamily(ctx, row.family);
}

/**
 * Create a fresh six-digit reset code for a user, invalidate their older codes, and email it. Shared by
 * the public forgot-password route and the admin "send reset" action (SPEC §6).
 * @param {{ _id: unknown, email: string }} user
 */
export async function sendResetCode(ctx, user) {
  const code = randomSixDigitCode();
  const now = ctx.now();
  await PasswordReset.updateMany(
    { userId: user._id, purpose: 'reset', usedAt: null },
    { $set: { usedAt: now } }
  );
  await PasswordReset.create({
    userId: user._id,
    purpose: 'reset',
    codeHash: await hashPassword(code),
    expiresAt: addMinutes(now, RESET_CODE_TTL_MINUTES),
  });
  try {
    await ctx.mailer.send({ to: user.email, ...resetCodeEmail(code) });
  } catch (err) {
    // Log the failure without the code or the address.
    ctx.logger.error({ err: err.message, userId: String(user._id) }, 'reset email failed to send');
  }
}

/**
 * Start a password reset. Always returns the same message, whether or not the account exists
 * (SPEC §6, SECURITY §1). Work is done on both branches so timing does not reveal the account.
 * @param {{ identifier: string }} input
 */
export async function forgotPassword(ctx, input) {
  const message = 'If an account matches, we have sent a six-digit code to its email address.';
  const user = await findUserByIdentifier(input.identifier);

  if (user && user.status === USER_STATUS.ACTIVE && user.email) {
    await sendResetCode(ctx, user);
  } else {
    await hashPassword(randomToken(12));
  }
  return { message };
}

/**
 * Finish a password reset with the emailed code (SPEC §6, SECURITY §1). Success bumps tokenVersion and
 * revokes every refresh token.
 * @param {{ identifier: string, code: string, newPassword: string }} input
 */
export async function resetPassword(ctx, input) {
  const invalid = () =>
    new HttpError(
      400,
      ERROR_CODES.INVALID_RESET_CODE,
      'That code is not valid or has expired. Request a new one.'
    );

  const user = await findUserByIdentifier(input.identifier, { withSecrets: true });
  if (!user) {
    await verifyPassword(await dummyHash(), input.code);
    throw invalid();
  }

  const now = ctx.now();
  const row = await PasswordReset.findOne({
    userId: user._id,
    purpose: 'reset',
    usedAt: null,
  }).sort({
    createdAt: -1,
  });
  if (!row || row.expiresAt <= now || row.attempts >= RESET_MAX_ATTEMPTS) throw invalid();

  const matches = await verifyPassword(row.codeHash, input.code);
  if (!matches) {
    row.attempts += 1;
    await row.save();
    throw invalid();
  }

  const problem = passwordProblem(input.newPassword);
  if (problem) {
    throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, problem, [
      { path: 'newPassword', message: problem },
    ]);
  }

  user.passwordHash = await hashPassword(input.newPassword);
  user.security.passwordChangedAt = now;
  user.security.tokenVersion += 1;
  user.security.failedLogins = 0;
  user.security.lockUntil = undefined;
  await user.save();

  row.usedAt = now;
  await row.save();
  await revokeAllForUser(ctx, user._id);
  return { message: 'Your password has changed. Sign in with your new password.' };
}

/**
 * Admin step 1: password. Super admins always need TOTP; content admins need it only if enabled.
 * Returns a single-use challenge for step 2, or a session when no TOTP is needed.
 * @param {{ email: string, password: string }} input
 */
export async function adminLogin(ctx, input, meta) {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    '+passwordHash +security.challengeHash +security.challengeExpiresAt +security.challengeAttempts'
  );

  // Non-admins and unknown emails get the generic failure with no audit row naming them.
  if (!user || !isAdminRole(user.role)) {
    await verifyPassword(await dummyHash(), input.password);
    throw invalidCredentials();
  }

  try {
    await checkPassword(ctx, user, input.password);
  } catch (err) {
    await recordAudit(ctx, {
      actorId: user._id,
      actorRole: user.role,
      action: 'admin.login_failed',
      ip: meta.ip,
      meta: { reason: 'password' },
    });
    throw err;
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new HttpError(403, ERROR_CODES.ACCOUNT_DEACTIVATED, 'This account is not active.');
  }

  const needsTotp = user.role === ROLES.SUPER_ADMIN || user.security.totpEnabled;
  if (!needsTotp) {
    await recordAudit(ctx, {
      actorId: user._id,
      actorRole: user.role,
      action: 'admin.login',
      ip: meta.ip,
    });
    return { needsTotp: false, ...(await openSession(ctx, user, meta)) };
  }

  const challengeToken = randomToken(32);
  user.security.challengeHash = sha256Hex(challengeToken);
  user.security.challengeExpiresAt = addMinutes(ctx.now(), ADMIN_CHALLENGE_TTL_MINUTES);
  user.security.challengeAttempts = 0;
  await user.save();
  return {
    needsTotp: true,
    totpSetupRequired: !user.security.totpEnabled,
    challengeToken,
  };
}

function clearChallenge(user) {
  user.security.challengeHash = undefined;
  user.security.challengeExpiresAt = undefined;
  user.security.challengeAttempts = 0;
}

/** Load the user behind a live challenge, or throw UNAUTHORIZED. */
async function userForChallenge(ctx, challengeToken) {
  const user = await User.findOne({
    'security.challengeHash': sha256Hex(challengeToken),
    // sanitizeFilter (SECURITY §4) blocks operators in filters unless they are marked trusted here.
    'security.challengeExpiresAt': mongoose.trusted({ $gt: ctx.now() }),
  }).select(
    '+security.challengeHash +security.challengeExpiresAt +security.challengeAttempts +security.lastTotpStep +security.totpSecretEnc +security.totpPendingSecretEnc +security.recoveryCodeHashes +passwordHash'
  );
  if (!user || !isAdminRole(user.role)) {
    throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Your sign-in has timed out. Start again.');
  }
  return user;
}

/**
 * Admin TOTP setup (first login). Creates a pending secret and returns the otpauth URI. The secret is
 * only enabled after the first valid code (adminTotp).
 * @param {{ challengeToken: string }} input
 */
export async function adminTotpSetup(ctx, input) {
  const user = await userForChallenge(ctx, input.challengeToken);
  if (user.security.totpEnabled) {
    throw new HttpError(
      409,
      ERROR_CODES.CONFLICT,
      'Two-step sign-in is already set up. Enter your code instead.'
    );
  }
  // Reuse a pending secret if one exists (the create-super-admin CLI prints the same one), so the
  // URI a person already scanned keeps working.
  let secret;
  if (user.security.totpPendingSecretEnc) {
    secret = decryptSecret(ctx.totpKey, user.security.totpPendingSecretEnc);
  } else {
    secret = newTotpSecret();
    user.security.totpPendingSecretEnc = encryptSecret(ctx.totpKey, secret);
    await user.save();
  }
  return {
    secret,
    otpauthUri: totpUri({ secret, label: user.email }),
  };
}

/**
 * Admin step 2: six-digit code (or a recovery code). The first correct code during setup enables TOTP
 * and returns the recovery codes, which are shown once.
 * @param {{ challengeToken: string, code: string }} input
 */
export async function adminTotp(ctx, input, meta) {
  const user = await userForChallenge(ctx, input.challengeToken);

  if (user.security.challengeAttempts >= CHALLENGE_MAX_ATTEMPTS) {
    clearChallenge(user);
    await user.save();
    throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Too many attempts. Start sign-in again.');
  }

  const setupPending = !user.security.totpEnabled;
  const encrypted = setupPending ? user.security.totpPendingSecretEnc : user.security.totpSecretEnc;
  if (!encrypted) {
    throw new HttpError(409, ERROR_CODES.TOTP_REQUIRED, 'Set up two-step sign-in first.');
  }
  const secret = decryptSecret(ctx.totpKey, encrypted);

  // A code works once: anything at or before the last accepted 30-second step is refused.
  const totp = await checkTotpCode(secret, input.code, user.security.lastTotpStep ?? undefined);
  let verified = totp.valid;
  let usedRecoveryIndex = -1;
  if (!verified && !setupPending && RECOVERY_CODE_PATTERN.test(input.code)) {
    usedRecoveryIndex = await matchRecoveryCode(user.security.recoveryCodeHashes ?? [], input.code);
    verified = usedRecoveryIndex >= 0;
  }
  if (totp.valid) user.security.lastTotpStep = totp.timeStep;

  if (!verified) {
    user.security.challengeAttempts += 1;
    await user.save();
    await recordAudit(ctx, {
      actorId: user._id,
      actorRole: user.role,
      action: 'admin.login_failed',
      ip: meta.ip,
      meta: { reason: 'totp' },
    });
    throw new HttpError(
      401,
      ERROR_CODES.INVALID_TOTP,
      'That code is not right. Check your authenticator app and try again.'
    );
  }

  let recoveryCodes;
  if (setupPending) {
    const generated = await createRecoveryCodes();
    recoveryCodes = generated.plain;
    user.security.totpSecretEnc = user.security.totpPendingSecretEnc;
    user.security.totpPendingSecretEnc = undefined;
    user.security.totpEnabled = true;
    user.security.recoveryCodeHashes = generated.hashes;
    await recordAudit(ctx, {
      actorId: user._id,
      actorRole: user.role,
      action: 'admin.totp_enabled',
      targetType: 'user',
      targetId: user._id,
      ip: meta.ip,
    });
  } else if (usedRecoveryIndex >= 0) {
    user.security.recoveryCodeHashes.splice(usedRecoveryIndex, 1);
  }

  clearChallenge(user);
  await recordAudit(ctx, {
    actorId: user._id,
    actorRole: user.role,
    action: 'admin.login',
    ip: meta.ip,
  });
  const session = await openSession(ctx, user, meta);
  return recoveryCodes ? { ...session, recoveryCodes } : session;
}

/**
 * Invite an admin (SECURITY §1 "Admin invitations"). The invitee chooses their own password through
 * the link; nobody else sets it. Called from adminService.
 * @returns {Promise<{ token: string }>} the one-time token, to be placed in the invitation link
 */
export async function createInviteToken(ctx, userId) {
  const token = randomToken(32);
  await PasswordReset.create({
    userId,
    purpose: 'invite',
    codeHash: sha256Hex(token),
    expiresAt: addHours(ctx.now(), INVITE_TTL_HOURS),
  });
  return { token };
}

/**
 * Accept an invitation: set the password. The admin then signs in and sets up TOTP.
 * @param {{ token: string, password: string }} input
 */
export async function acceptInvite(ctx, input, meta) {
  const row = await PasswordReset.findOne({
    codeHash: sha256Hex(input.token),
    purpose: 'invite',
    usedAt: null,
  });
  const user = row ? await User.findById(row.userId) : null;
  if (
    !row ||
    row.expiresAt <= ctx.now() ||
    !user ||
    !isAdminRole(user.role) ||
    user.status !== USER_STATUS.ACTIVE
  ) {
    throw new HttpError(
      401,
      ERROR_CODES.UNAUTHORIZED,
      'This invitation link is no longer valid. Ask for a new one.'
    );
  }

  const problem = passwordProblem(input.password);
  if (problem) {
    throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, problem, [
      { path: 'password', message: problem },
    ]);
  }

  user.passwordHash = await hashPassword(input.password);
  user.security.passwordChangedAt = ctx.now();
  user.security.tokenVersion += 1;
  await user.save();
  row.usedAt = ctx.now();
  await row.save();
  await recordAudit(ctx, {
    actorId: user._id,
    actorRole: user.role,
    action: 'admin.invite_accepted',
    targetType: 'user',
    targetId: user._id,
    ip: meta.ip,
  });
  return { email: user.email };
}
