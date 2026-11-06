/**
 * YouTube video IDs (SPEC §7). Extraction is strict: only the four URL shapes in the spec, only known
 * YouTube hosts, only https, and only an 11-character ID. Anything else returns null.
 */
import { ERROR_CODES } from '@pollwise/shared/constants';
import { HttpError } from '../utils/httpError.js';

const ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const SHORT_HOST = 'youtu.be';
const THUMBNAIL_HOST = 'i.ytimg.com';
const OEMBED_ENDPOINT = 'https://www.youtube.com/oembed';
const LOOKUP_TIMEOUT_MS = 5000;

/**
 * @param {unknown} input any string the admin pasted
 * @returns {string | null} the 11-character ID, or null when the input is not a YouTube video URL
 */
export function extractYoutubeId(input) {
  if (typeof input !== 'string' || input.length > 300) return null;
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  // No credentials, no odd ports, https only. This stops tricks such as youtube.com@evil.example.
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase();
  let candidate = null;

  if (host === SHORT_HOST) {
    // https://youtu.be/ID
    const [only, ...rest] = url.pathname.split('/').filter(Boolean);
    if (rest.length === 0) candidate = only;
  } else if (WATCH_HOSTS.has(host)) {
    const segments = url.pathname.split('/').filter(Boolean);
    if (url.pathname === '/watch' || url.pathname === '/watch/') {
      // https://www.youtube.com/watch?v=ID (extra parameters are fine)
      candidate = url.searchParams.get('v');
    } else if (segments.length === 2 && ['shorts', 'embed'].includes(segments[0])) {
      // https://www.youtube.com/shorts/ID and /embed/ID
      candidate = segments[1];
    }
  }

  return candidate && ID.test(candidate) ? candidate : null;
}

/**
 * Look up a video's title and thumbnail through YouTube's public oEmbed endpoint (SPEC §7, no API key).
 * The thumbnail is only accepted from YouTube's image host; otherwise the standard URL is built from the
 * ID, so nothing from the response is trusted as a URL.
 * @param {typeof fetch} fetchImpl injectable for tests
 * @param {string} youtubeId already validated by extractYoutubeId()
 * @returns {Promise<{ youtubeId: string, title: string, thumbnailUrl: string }>}
 */
export async function lookupYoutubeVideo(fetchImpl, youtubeId) {
  const target = `https://www.youtube.com/watch?v=${youtubeId}`;
  const endpoint = `${OEMBED_ENDPOINT}?format=json&url=${encodeURIComponent(target)}`;

  let response;
  try {
    response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
  } catch {
    throw unavailable();
  }
  if (response.status === 404 || response.status === 401) {
    throw new HttpError(
      404,
      ERROR_CODES.NOT_FOUND,
      'YouTube could not find that video. Check the link and that it is set to Unlisted.'
    );
  }
  if (!response.ok) throw unavailable();

  let data;
  try {
    data = await response.json();
  } catch {
    throw unavailable();
  }
  if (typeof data?.title !== 'string' || data.title.trim() === '') throw unavailable();

  const fromResponse = typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '';
  let thumbnailUrl = `https://${THUMBNAIL_HOST}/vi/${youtubeId}/hqdefault.jpg`;
  try {
    const parsed = new URL(fromResponse);
    if (parsed.protocol === 'https:' && parsed.hostname === THUMBNAIL_HOST)
      thumbnailUrl = parsed.href;
  } catch {
    // keep the standard thumbnail
  }

  return { youtubeId, title: data.title.trim().slice(0, 200), thumbnailUrl };
}

function unavailable() {
  return new HttpError(
    502,
    ERROR_CODES.UPSTREAM_UNAVAILABLE,
    'YouTube did not answer. Check your connection and try the link again.'
  );
}
