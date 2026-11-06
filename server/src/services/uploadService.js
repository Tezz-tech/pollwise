/**
 * Signed uploads and post-upload verification (SECURITY §7).
 *
 * 1. The admin asks for a signature for one course and one kind (image or PDF). The signature covers
 *    one public_id inside one folder and the allowed formats, and it expires after five minutes.
 * 2. The browser uploads straight to Cloudinary with that signature.
 * 3. The admin confirms the upload. The server asks Cloudinary for the asset's real format, size and
 *    folder, and only then records it. Content may refer to confirmed uploads and nothing else.
 */
import { ERROR_CODES, ROLES } from '@pollwise/shared/constants';
import { Upload } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { randomItemId } from '../domain/questionIds.js';
import { recordAudit } from './auditService.js';
import { loadCourse, assertCanEdit } from './contentService.js';

export const UPLOAD_WINDOW_MS = 5 * 60 * 1000;
export const LIMITS = Object.freeze({
  image: { formats: ['jpg', 'jpeg', 'png', 'webp'], maxBytes: 5 * 1024 * 1024 },
  pdf: { formats: ['pdf'], maxBytes: 20 * 1024 * 1024 },
});
const RESOURCE_TYPE = 'image';
const CLOUDINARY_HOST = 'res.cloudinary.com';

const unavailable = () =>
  new HttpError(503, ERROR_CODES.UPLOADS_DISABLED, 'Uploads are not set up on this server yet.');

/**
 * @param {{ courseId: string, kind: 'image' | 'pdf' }} input
 */
export async function signUpload(ctx, actor, input, meta) {
  if (!ctx.cloudinary) throw unavailable();
  const course = await loadCourse(input.courseId);
  assertCanEdit(actor, course);

  const folder = `pollwise/courses/${course._id}/${input.kind === 'pdf' ? 'documents' : 'images'}`;
  const publicId = `${folder}/${randomItemId()}`;
  const timestamp = Math.floor(ctx.now().getTime() / 1000);
  const { formats, maxBytes } = LIMITS[input.kind];
  const allowedFormats = formats.join(',');
  const signature = ctx.cloudinary.sign({
    allowed_formats: allowedFormats,
    public_id: publicId,
    timestamp,
  });
  const expiresAt = new Date(ctx.now().getTime() + UPLOAD_WINDOW_MS);

  await Upload.create({
    userId: actor.id,
    courseId: course._id,
    kind: input.kind,
    publicId,
    folder,
    expiresAt,
  });
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'upload.sign',
    targetType: 'course',
    targetId: course._id,
    meta: { kind: input.kind },
    ip: meta.ip,
  });

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${ctx.cloudinary.cloudName}/${RESOURCE_TYPE}/upload`,
    apiKey: ctx.cloudinary.apiKey,
    timestamp,
    signature,
    publicId,
    allowedFormats: formats,
    maxBytes,
    expiresAt: expiresAt.toISOString(),
  };
}

/** Reject an upload and remove the asset. Removal is best effort: the record is refused either way. */
async function reject(ctx, actor, upload, reason, meta) {
  try {
    await ctx.cloudinary.destroy(upload.publicId, RESOURCE_TYPE);
  } catch (err) {
    ctx.logger.error(
      { err: err.message, publicId: upload.publicId },
      'could not remove rejected upload'
    );
  }
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'upload.rejected',
    targetType: 'upload',
    targetId: upload._id,
    meta: { reason, kind: upload.kind },
    ip: meta.ip,
  });
  throw new HttpError(422, ERROR_CODES.UPLOAD_REJECTED, reason);
}

/**
 * Verify a finished upload against Cloudinary and record its real properties.
 * @param {{ publicId: string }} input
 */
export async function confirmUpload(ctx, actor, input, meta) {
  if (!ctx.cloudinary) throw unavailable();

  const upload = await Upload.findOne({ publicId: input.publicId });
  if (!upload || (String(upload.userId) !== actor.id && actor.role !== ROLES.SUPER_ADMIN)) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'That upload does not exist.');
  }
  if (upload.confirmedAt) {
    throw new HttpError(409, ERROR_CODES.CONFLICT, 'That upload has already been confirmed.');
  }
  if (upload.expiresAt <= ctx.now()) {
    throw new HttpError(
      422,
      ERROR_CODES.UPLOAD_REJECTED,
      'The upload window has closed. Upload the file again.'
    );
  }

  let info;
  try {
    info = await ctx.cloudinary.resource(upload.publicId, RESOURCE_TYPE);
  } catch {
    throw new HttpError(
      422,
      ERROR_CODES.UPLOAD_REJECTED,
      'The file did not arrive. Upload it again.'
    );
  }

  const limits = LIMITS[upload.kind];
  const format = String(info.format ?? '').toLowerCase();
  if (!limits.formats.includes(format)) {
    const list = upload.kind === 'pdf' ? 'PDF' : 'JPEG, PNG or WebP';
    await reject(ctx, actor, upload, `Only ${list} files are allowed.`, meta);
  }
  if (!(Number(info.bytes) > 0) || Number(info.bytes) > limits.maxBytes) {
    await reject(ctx, actor, upload, 'That file is too large for this kind of upload.', meta);
  }
  if (typeof info.public_id !== 'string' || !info.public_id.startsWith(`${upload.folder}/`)) {
    await reject(ctx, actor, upload, 'The file was not uploaded to the expected place.', meta);
  }
  let url;
  try {
    const parsed = new URL(info.secure_url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== CLOUDINARY_HOST)
      throw new Error('host');
    url = parsed.href;
  } catch {
    await reject(ctx, actor, upload, 'The file address was not recognised.', meta);
  }

  upload.url = url;
  upload.format = format;
  upload.bytes = Number(info.bytes);
  if (upload.kind === 'pdf' && Number.isInteger(info.pages)) upload.pages = info.pages;
  upload.confirmedAt = ctx.now();
  await upload.save();

  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'upload.confirm',
    targetType: 'upload',
    targetId: upload._id,
    meta: { kind: upload.kind, format, bytes: upload.bytes },
    ip: meta.ip,
  });
  return {
    url: upload.url,
    publicId: upload.publicId,
    format: upload.format,
    bytes: upload.bytes,
    pages: upload.pages ?? null,
  };
}
