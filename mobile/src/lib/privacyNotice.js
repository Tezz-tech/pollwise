/**
 * The first-launch privacy notice (SECURITY §11, Nigeria Data Protection Act 2023). Shown once, on the first visit
 * to the welcome screen, and remembered in secure storage.
 */
import { secureStorage } from './storage.js';

export const PRIVACY_NOTICE_KEY = 'pw.privacyNoticeSeen';

/** @returns {Promise<boolean>} true once the learner has seen and continued past the notice */
export async function privacyNoticeSeen() {
  try {
    return (await secureStorage.get(PRIVACY_NOTICE_KEY)) === 'yes';
  } catch {
    // If storage cannot be read, show the notice again rather than hide it.
    return false;
  }
}

/** Remember that the learner has seen the notice. */
export async function markPrivacyNoticeSeen() {
  await secureStorage.set(PRIVACY_NOTICE_KEY, 'yes');
}
