/**
 * Signed upload to Cloudinary (SECURITY §7). The server signs one public_id in one folder for one kind
 * and expires the signature after five minutes. The browser uploads straight to Cloudinary, then asks
 * the server to confirm the file before any content may use it.
 */
import { api } from './api.js';

/**
 * @param {{ courseId: string, kind: 'image' | 'pdf', file: File }} input
 * @returns {Promise<{ url: string, publicId: string, bytes: number, pages: number | null, format: string }>}
 */
export async function uploadAndConfirm({ courseId, kind, file }) {
  const signed = await api('/admin/uploads/sign', { method: 'POST', body: { courseId, kind } });

  if (file.size > signed.maxBytes) {
    throw new Error(
      `That file is too large. The limit is ${Math.round(signed.maxBytes / (1024 * 1024))} MB.`
    );
  }

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  form.append('public_id', signed.publicId);
  form.append('allowed_formats', signed.allowedFormats.join(','));

  const res = await fetch(signed.uploadUrl, { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error('The file did not upload. Check your connection and try again.');
  }

  return api('/admin/uploads/confirm', { method: 'POST', body: { publicId: signed.publicId } });
}
