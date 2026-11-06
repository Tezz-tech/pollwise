/**
 * One-time codes and tokens. `reset` holds a 6-digit code (argon2-hashed, 15 minutes, 5 attempts).
 * `invite` holds a random link token (SHA-256 hashed, 48 hours). SPEC §5 / SECURITY §1.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: ['reset', 'invite'], default: 'reset' },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const PasswordReset =
  mongoose.models.PasswordReset || mongoose.model('PasswordReset', passwordResetSchema);
