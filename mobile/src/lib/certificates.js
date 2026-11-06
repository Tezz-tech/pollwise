/**
 * Certificate wording for the app (DESIGN §6.9). Pure, so the share text and dates are tested in Node.
 */

/**
 * The message a learner shares: the course, their name, and the public check link. The link shows only whether the
 * certificate is valid, the name, the course and the date (SPEC §8.6), so the message carries nothing more.
 * @param {{ courseTitle: string, learnerName: string, code: string } | null | undefined} cert
 * @param {string} verifyBase the admin site address, without a trailing slash
 */
export function certificateShareText(cert, verifyBase) {
  if (!cert) return 'PollWise certificate';
  const base = String(verifyBase).replace(/\/$/, '');
  return `I completed ${cert.courseTitle} on PollWise. Check my certificate here: ${base}/verify/${cert.code}`;
}

/**
 * "4 March 2026" style date for a certificate, in the phone's own calendar.
 * @param {string} iso
 */
export function certificateDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  // Fixed month names: Hermes locale support differs by device, and the certificate must read the same everywhere.
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
