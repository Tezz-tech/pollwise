/**
 * Audit trail writes (SECURITY §10). Only this module writes AuditLog; nothing updates or deletes it.
 */
import { AuditLog } from '../models/AuditLog.js';

/**
 * @param {{ now: () => Date, logger: import('pino').Logger }} ctx
 * @param {{
 *   actorId?: unknown, actorRole?: string, action: string,
 *   targetType?: string, targetId?: unknown, meta?: Record<string, unknown>, ip?: string
 * }} entry
 */
export async function recordAudit(ctx, entry) {
  await AuditLog.create({
    actorId: entry.actorId ?? undefined,
    actorRole: entry.actorRole,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId == null ? undefined : String(entry.targetId),
    meta: entry.meta ?? {},
    ip: entry.ip,
    at: ctx.now(),
  });
}
