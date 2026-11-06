/**
 * Request schemas for /auth (SECURITY §4). Learner bodies strip unknown keys; admin bodies reject them.
 */
import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address.'));
const password = z.string().min(1).max(128);
const token = z.string().min(20).max(200);
const identifier = z.string().trim().min(3).max(254);

export const registerBody = z.object({
  name: z.string().trim().min(1).max(120),
  email,
  phone: z.string().trim().min(1).max(20),
  password,
  accessCode: z.string().trim().min(1).max(120).optional(),
});

export const loginBody = z.object({
  identifier,
  password,
});

export const refreshBody = z.object({
  refreshToken: token.optional(),
});

export const forgotPasswordBody = z.object({
  identifier,
});

export const resetPasswordBody = z.object({
  identifier,
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code from the email.'),
  newPassword: password,
});

export const adminLoginBody = z
  .object({
    email,
    password,
  })
  .strict();

export const challengeBody = z
  .object({
    challengeToken: token,
  })
  .strict();

export const totpBody = z
  .object({
    challengeToken: token,
    // Six-digit authenticator code, or a recovery code in the form XXXX-XXXX.
    code: z
      .string()
      .trim()
      .regex(/^(\d{6}|[0-9A-Z]{4}-[0-9A-Z]{4})$/, 'Enter the six-digit code from your app.'),
  })
  .strict();

export const acceptInviteBody = z
  .object({
    token,
    password,
  })
  .strict();

export const logoutBody = refreshBody;
