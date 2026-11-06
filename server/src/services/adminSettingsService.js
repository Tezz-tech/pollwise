/**
 * Platform settings, access codes and the audit log for super admins (SPEC §9, §6, SECURITY §10).
 */
import mongoose from 'mongoose';
import { ERROR_CODES } from '@pollwise/shared/constants';
import { AuditLog, Settings, SETTINGS_KEY } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { recordAudit } from './auditService.js';
import { getSettings } from './settingsService.js';
import { hashAccessCode } from './accessCodes.js';

const SETTABLE = [
  'defaultPassMark',
  'registrationMode',
  'nextElectionDate',
  'nextElectionLabel',
  'supportEmail',
  'privacyPolicyUrl',
  'aboutText',
];

/** Settings as the super admin sees them. Access codes appear by label only; the hash never leaves. */
export async function getAdminSettings() {
  const s = await getSettings({ includeAccessCodes: true });
  return {
    defaultPassMark: s.defaultPassMark,
    registrationMode: s.registrationMode,
    nextElectionDate: s.nextElectionDate ?? null,
    nextElectionLabel: s.nextElectionLabel ?? null,
    supportEmail: s.supportEmail ?? null,
    privacyPolicyUrl: s.privacyPolicyUrl ?? null,
    aboutText: s.aboutText ?? null,
    accessCodes: (s.accessCodes ?? []).map((c) => ({
      id: String(c._id),
      label: c.label ?? '',
      active: c.active,
      uses: c.uses,
    })),
  };
}

export async function updateSettings(ctx, actor, patch, meta) {
  const changed = Object.keys(patch).filter((k) => SETTABLE.includes(k));
  const update = {};
  for (const key of changed) update[key] = patch[key];
  await getSettings();
  await Settings.updateOne({ key: SETTINGS_KEY }, { $set: update });
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'settings.update',
    targetType: 'settings',
    meta: { fields: changed },
    ip: meta.ip,
  });
  return getAdminSettings();
}

/** Add an access code. Only its hash is stored (SECURITY §1, decisions log). */
export async function addAccessCode(ctx, actor, { label, code }, meta) {
  const hash = await hashAccessCode(code);
  const id = new mongoose.Types.ObjectId();
  await getSettings();
  await Settings.updateOne(
    { key: SETTINGS_KEY },
    { $push: { accessCodes: { _id: id, codeHash: hash, label, active: true, uses: 0 } } }
  );
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'settings.access_code_add',
    targetType: 'settings',
    targetId: id,
    meta: { label },
    ip: meta.ip,
  });
  return { id: String(id), label, active: true, uses: 0 };
}

/** Switch an access code on or off. Codes are never deleted, so their use counts stay accurate. */
export async function setAccessCodeActive(ctx, actor, codeId, active, meta) {
  const result = await Settings.updateOne(
    { key: SETTINGS_KEY, 'accessCodes._id': new mongoose.Types.ObjectId(codeId) },
    { $set: { 'accessCodes.$.active': active } }
  );
  if (result.matchedCount !== 1)
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That access code does not exist.');
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: active ? 'settings.access_code_enable' : 'settings.access_code_disable',
    targetType: 'settings',
    targetId: codeId,
    ip: meta.ip,
  });
  return { id: codeId, active };
}

/**
 * Audit log query (SECURITY §10). Nothing here writes or deletes; the API offers no path to change it.
 * @param {{ actorId?: string, action?: string, from?: Date, to?: Date }} f
 */
export async function queryAuditLog(f, page) {
  const conditions = [];
  if (f.actorId) conditions.push({ actorId: new mongoose.Types.ObjectId(f.actorId) });
  if (f.action) conditions.push({ action: f.action });
  if (f.from || f.to) {
    const range = {};
    if (f.from) range.$gte = f.from;
    if (f.to) range.$lte = f.to;
    conditions.push({ at: mongoose.trusted(range) });
  }
  const filter = conditions.length ? { $and: conditions } : {};
  const [rows, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1, _id: -1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    items: rows.map((r) => ({
      id: String(r._id),
      actorId: r.actorId ? String(r.actorId) : null,
      actorRole: r.actorRole ?? null,
      action: r.action,
      targetType: r.targetType ?? null,
      targetId: r.targetId ?? null,
      meta: r.meta ?? {},
      at: r.at,
    })),
    page: page.page,
    limit: page.limit,
    total,
  };
}
