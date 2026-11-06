/**
 * Certificates for learners and the public verify check (SPEC §6, §8.6, SECURITY §11).
 */
import { ERROR_CODES, ROLES } from '@pollwise/shared/constants';
import { Certificate } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { renderCertificatePdf } from '../domain/certificatePdf.js';
import { CERTIFICATE_CODE_PATTERN } from './progressService.js';
import { signCertificateDownload, CERT_DOWNLOAD_TTL_SECONDS } from './tokenService.js';

const view = (c) => ({
  id: String(c._id),
  courseId: String(c.courseId),
  courseTitle: c.courseTitle,
  learnerName: c.learnerName,
  score: c.score,
  code: c.code,
  issuedAt: c.issuedAt,
});

/** @returns {Promise<{ items: object[] }>} */
export async function listMine(userId) {
  const rows = await Certificate.find({ userId, revokedAt: null }).sort({ issuedAt: -1 }).lean();
  return { items: rows.map(view) };
}

/**
 * A two-minute download link for the owner's certificate (see middleware/certificateAuth.js). The path is relative to
 * the API base, so the app and the browser both build the same URL.
 */
export async function certificatePdfLink(ctx, userId, certificateId) {
  const cert = await Certificate.findOne(
    { _id: certificateId, userId, revokedAt: null },
    { _id: 1 }
  ).lean();
  if (!cert) throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That certificate does not exist.');
  const token = signCertificateDownload(ctx, {
    userId: String(userId),
    certificateId: String(cert._id),
  });
  return {
    path: `/certificates/${cert._id}/pdf?download=${encodeURIComponent(token)}`,
    expiresInSec: CERT_DOWNLOAD_TTL_SECONDS,
  };
}

/** The owner's certificate as a PDF. Anyone else gets 404, so ids cannot be probed. */
export async function certificatePdf(ctx, userId, certificateId) {
  const cert = await Certificate.findOne({ _id: certificateId, userId, revokedAt: null }).lean();
  if (!cert) throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That certificate does not exist.');
  return renderCertificatePdf(cert, { verifyBase: ctx.config.ADMIN_PUBLIC_URL.replace(/\/$/, '') });
}

/**
 * Public check (SPEC §8.6): valid or not, the learner's name, the course title and the date. Nothing else.
 * @param {string} code
 */
export async function verify(code) {
  const normal = String(code).toUpperCase();
  if (!CERTIFICATE_CODE_PATTERN.test(normal)) return { valid: false };
  const cert = await Certificate.findOne({ code: normal }).lean();
  if (!cert || cert.revokedAt) return { valid: false };
  return {
    valid: true,
    learnerName: cert.learnerName,
    courseTitle: cert.courseTitle,
    issuedAt: cert.issuedAt,
  };
}

export { ROLES };
