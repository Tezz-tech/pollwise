/**
 * Outgoing email for password-reset codes and admin invitations (SPEC §6, SECURITY §1).
 *
 * The mailer is an object with `send({ to, subject, text })` so tests can capture messages without a
 * real SMTP server. Message bodies may contain codes or links; they are never logged.
 */
import nodemailer from 'nodemailer';

/**
 * @param {{
 *   SMTP_HOST?: string, SMTP_PORT: number, SMTP_USER?: string, SMTP_PASS?: string, MAIL_FROM?: string,
 * }} config
 * @param {import('pino').Logger} logger
 */
export function createMailer(config, logger) {
  if (!config.SMTP_HOST) {
    // Development without SMTP: say so, but never log the message body.
    return {
      async send({ to, subject }) {
        logger.warn(
          { subject, recipientConfigured: Boolean(to) },
          'mail not sent: SMTP_HOST is not set'
        );
      },
    };
  }

  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });

  return {
    async send({ to, subject, text }) {
      await transport.sendMail({ from: config.MAIL_FROM, to, subject, text });
    },
  };
}

/** @param {string} code */
export function resetCodeEmail(code) {
  return {
    subject: 'Your PollWise password reset code',
    text:
      `Your PollWise password reset code is ${code}.\n\n` +
      'It is valid for 15 minutes. If you did not ask to reset your password, ignore this message.',
  };
}

/** @param {string} link */
export function adminInviteEmail(link) {
  return {
    subject: 'You have been invited to the PollWise admin site',
    text:
      'You have been invited to manage PollWise content.\n\n' +
      `Set your password here (the link works once and expires in 48 hours):\n${link}\n\n` +
      'If you were not expecting this invitation, ignore this message.',
  };
}
