/**
 * An error with a known HTTP status and a SCREAMING_SNAKE code. The central error handler turns it
 * into `{ error: { code, message, details? } }` (CLAUDE.md conventions). Anything that is not an
 * HttpError is treated as an unexpected failure and returned as INTERNAL with no details.
 */
export class HttpError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} code SCREAMING_SNAKE error code
   * @param {string} message Safe, human-readable message. Never include internal detail here.
   * @param {unknown} [details] Optional structured detail that is safe to show the client.
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
