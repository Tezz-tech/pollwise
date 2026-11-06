import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/utils/logger.js';

/** Collect everything the logger writes, as parsed JSON lines. */
function captureLogger() {
  const lines = [];
  const destination = new Writable({
    write(chunk, _enc, cb) {
      lines.push(
        ...chunk
          .toString()
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l))
      );
      cb();
    },
  });
  const logger = createLogger({ level: 'trace', destination });
  return { logger, lines };
}

describe('logger redaction (SECURITY §8)', () => {
  it('redacts passwords, reset codes, tokens and cookies', () => {
    const { logger, lines } = captureLogger();
    logger.info(
      {
        req: { headers: { authorization: 'Bearer abc.def.ghi', cookie: 'refresh=zzz' } },
        body: { password: 'hunter2-long', newPassword: 'another-long-one' },
        reset: { code: '123456' },
        session: { token: 'tok-123', refreshToken: 'ref-456' },
      },
      'sensitive request'
    );

    const serialised = JSON.stringify(lines);
    for (const secret of [
      'Bearer abc.def.ghi',
      'refresh=zzz',
      'hunter2-long',
      'another-long-one',
      '123456',
      'tok-123',
      'ref-456',
    ]) {
      expect(serialised).not.toContain(secret);
    }
    expect(serialised).toContain('[REDACTED]');
  });

  it('keeps ordinary fields so logs remain useful', () => {
    const { logger, lines } = captureLogger();
    logger.info({ userId: '64b0f0f0f0f0f0f0f0f0f0f0', status: 200 }, 'done');
    expect(lines[0].userId).toBe('64b0f0f0f0f0f0f0f0f0f0f0');
    expect(lines[0].status).toBe(200);
  });
});
