import { describe, expect, it } from 'vitest';
import { extractYoutubeId, lookupYoutubeVideo } from '../src/domain/youtube.js';

const ID = 'dQw4w9WgXcQ';

describe('extractYoutubeId: every URL form in SPEC §7', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?feature=share&v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?t=42`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `  https://youtu.be/${ID}  `,
  ])('reads the ID from %s', (url) => {
    expect(extractYoutubeId(url)).toBe(ID);
  });
});

describe('extractYoutubeId: malicious and malformed input is refused', () => {
  it.each([
    ['not a URL', 'hello world'],
    ['empty', ''],
    ['non-string', 42],
    ['javascript scheme', `javascript:alert('${ID}')`],
    ['http, not https', `http://www.youtube.com/watch?v=${ID}`],
    ['lookalike host', `https://youtube.com.evil.example/watch?v=${ID}`],
    ['other host with a v parameter', `https://evil.example/watch?v=${ID}`],
    ['credentials trick', `https://youtube.com@evil.example/watch?v=${ID}`],
    ['explicit port', `https://www.youtube.com:8443/watch?v=${ID}`],
    ['ID too short', 'https://youtu.be/short'],
    ['ID too long', `https://youtu.be/${ID}X`],
    ['ID with illegal characters', 'https://youtu.be/dQw4w9Wg<cQ'],
    ['path traversal after the ID', `https://youtu.be/${ID}/../../x`],
    ['percent-encoded ID', `https://www.youtube.com/watch?v=${ID.slice(0, 5)}%20${ID.slice(6)}`],
    ['watch without v', 'https://www.youtube.com/watch'],
    ['watch with an invalid v', 'https://www.youtube.com/watch?v=abc'],
    ['playlist only', 'https://www.youtube.com/playlist?list=PL1234567890'],
    ['channel page', 'https://www.youtube.com/@PollWiseNG'],
    ['over-long input', `https://youtu.be/${'a'.repeat(400)}`],
  ])('refuses %s', (_label, input) => {
    expect(extractYoutubeId(input)).toBeNull();
  });
});

describe('lookupYoutubeVideo (oEmbed, no API key)', () => {
  const ok = (body) => ({ ok: true, status: 200, json: async () => body });

  it('returns title and a thumbnail from YouTube’s image host', async () => {
    const fetchImpl = async (url) => {
      expect(url).toContain('https://www.youtube.com/oembed');
      expect(url).toContain(encodeURIComponent(`https://www.youtube.com/watch?v=${ID}`));
      return ok({
        title: '  Opening the polling unit  ',
        thumbnail_url: `https://i.ytimg.com/vi/${ID}/hq.jpg`,
      });
    };
    const result = await lookupYoutubeVideo(fetchImpl, ID);
    expect(result).toEqual({
      youtubeId: ID,
      title: 'Opening the polling unit',
      thumbnailUrl: `https://i.ytimg.com/vi/${ID}/hq.jpg`,
    });
  });

  it('ignores a thumbnail from any other host and builds the standard one', async () => {
    const fetchImpl = async () =>
      ok({ title: 'Video', thumbnail_url: 'https://evil.example/pixel.gif' });
    const result = await lookupYoutubeVideo(fetchImpl, ID);
    expect(result.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  });

  it('answers 502 when the network fails', async () => {
    const fetchImpl = async () => {
      throw new Error('ECONNRESET');
    };
    await expect(lookupYoutubeVideo(fetchImpl, ID)).rejects.toMatchObject({
      status: 502,
      code: 'UPSTREAM_UNAVAILABLE',
    });
  });

  it('answers 502 on a server error', async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await expect(lookupYoutubeVideo(fetchImpl, ID)).rejects.toMatchObject({ status: 502 });
  });

  it('answers 502 when the body is not JSON', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    await expect(lookupYoutubeVideo(fetchImpl, ID)).rejects.toMatchObject({ status: 502 });
  });

  it('answers 502 when the response has no title', async () => {
    const fetchImpl = async () => ok({ thumbnail_url: 'https://i.ytimg.com/x.jpg' });
    await expect(lookupYoutubeVideo(fetchImpl, ID)).rejects.toMatchObject({ status: 502 });
  });

  it('answers 404 with a helpful message for a video YouTube does not know', async () => {
    const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
    await expect(lookupYoutubeVideo(fetchImpl, ID)).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining('Unlisted'),
    });
  });
});
