/**
 * User (SPEC §5). Security-sensitive fields are `select: false` so a stray query cannot leak them.
 */
import mongoose from 'mongoose';
import {
  DAILY_GOAL_OPTIONS,
  PERSONNEL_ROLE_VALUES,
  ROLE_VALUES,
  USER_STATUS,
} from '@pollwise/shared/constants';

const { Schema } = mongoose;

export const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_VALUES, default: 'learner' },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    profile: {
      stateCode: { type: String, maxlength: 4 },
      lgaCode: { type: String, maxlength: 64 },
      personnelRole: { type: String, enum: PERSONNEL_ROLE_VALUES },
      ward: { type: String, trim: true, maxlength: 120 },
      pollingUnit: { type: String, trim: true, maxlength: 120 },
      completedAt: Date,
    },
    learning: {
      xp: { type: Number, default: 0, min: 0 },
      dailyGoalXp: { type: Number, enum: DAILY_GOAL_OPTIONS, default: 10 },
      streak: {
        current: { type: Number, default: 0, min: 0 },
        longest: { type: Number, default: 0, min: 0 },
        lastActiveDay: String,
        freezes: { type: Number, default: 0, min: 0, max: 2 },
      },
      reminderTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    },
    prefs: {
      sound: { type: Boolean, default: true },
      haptics: { type: Boolean, default: true },
    },
    security: {
      failedLogins: { type: Number, default: 0 },
      lockouts: { type: Number, default: 0 },
      lockUntil: Date,
      tokenVersion: { type: Number, default: 0 },
      totpEnabled: { type: Boolean, default: false },
      totpSecretEnc: { type: String, select: false },
      totpPendingSecretEnc: { type: String, select: false },
      recoveryCodeHashes: { type: [String], select: false, default: [] },
      // Admin two-step login challenge, flat fields so they can be queried (SECURITY §1).
      challengeHash: { type: String, select: false },
      challengeExpiresAt: { type: Date, select: false },
      challengeAttempts: { type: Number, default: 0, select: false },
      // Last accepted TOTP time step, so one code cannot be used twice within its 30 seconds.
      lastTotpStep: { type: Number, select: false },
      passwordChangedAt: Date,
    },
    lastLoginAt: Date,
    deletionRequestedAt: Date,
    anonymisedAt: Date,
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ status: 1, deletionRequestedAt: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
