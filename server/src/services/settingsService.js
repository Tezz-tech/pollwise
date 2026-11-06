/**
 * Platform settings (SPEC §5 Settings, §6 /settings/public). One document, created with defaults on
 * first read.
 */
import { REGISTRATION_MODES } from '@pollwise/shared/constants';
import { Settings, SETTINGS_KEY } from '../models/Settings.js';
import { argon2Check } from './accessCodes.js';

/**
 * @param {{ includeAccessCodes?: boolean }} [options]
 */
export async function getSettings({ includeAccessCodes = false } = {}) {
  const query = Settings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  if (includeAccessCodes) query.select('+accessCodes');
  return query.lean();
}

/** Only the fields the public app may see (SPEC §6). */
export async function getPublicSettings() {
  const s = await getSettings();
  return {
    nextElectionDate: s.nextElectionDate ?? null,
    nextElectionLabel: s.nextElectionLabel ?? null,
    registrationMode: s.registrationMode ?? REGISTRATION_MODES.OPEN,
    aboutText: s.aboutText ?? null,
    // The app links to these from its profile screen, so they are public (SPEC §9).
    supportEmail: s.supportEmail ?? null,
    privacyPolicyUrl: s.privacyPolicyUrl ?? null,
  };
}

/**
 * Check a typed access code against the active codes. Returns the matching entry's id, or null.
 * Codes are argon2-hashed, so a leaked database does not reveal them.
 * @param {string} code
 */
export async function matchAccessCode(code) {
  const settings = await getSettings({ includeAccessCodes: true });
  for (const entry of settings.accessCodes ?? []) {
    if (!entry.active) continue;
    if (await argon2Check(entry.codeHash, code)) return entry._id;
  }
  return null;
}

/** Count one successful use of an access code. */
export async function recordAccessCodeUse(codeId) {
  await Settings.updateOne(
    { key: SETTINGS_KEY, 'accessCodes._id': codeId },
    { $inc: { 'accessCodes.$.uses': 1 } }
  );
}
