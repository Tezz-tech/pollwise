/**
 * Refresh tokens are stored only as SHA-256 hashes (SECURITY §1). Revoked rows are kept until they
 * expire so that a replayed token can be recognised and its whole family revoked.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    replacedBy: String,
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },
  },
  { timestamps: true }
);

// Mongo removes rows once they have expired, so the collection cannot grow without bound.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken =
  mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
