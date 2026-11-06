/**
 * Append-only audit trail (SECURITY §10). The API has no update or delete path for this collection.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: String,
    action: { type: String, required: true, index: true },
    targetType: String,
    targetId: String,
    meta: { type: Schema.Types.Mixed, default: {} },
    ip: String,
    at: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
