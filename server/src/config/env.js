/**
 * Environment validation (SECURITY §8). Runs once at boot. Missing or weak values are reported by
 * name only (never by value) and the process refuses to start.
 *
 * loadEnv() is pure so the tests can exercise it. loadConfigOrExit() is the only boot path.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const SERVER_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Words that only show up in placeholder secrets copied from docs or .env.example. */
const PLACEHOLDER_PATTERN = /replace|change|example|placeholder|secret|password|dummy|todo/i;

const byteLength = (value) => Buffer.byteLength(value, 'utf8');

/** A JWT signing secret: at least 32 random bytes, and not an obvious placeholder. */
const strongSecret = (name) =>
  z
    .string({ error: `${name} is required` })
    .refine((value) => byteLength(value) >= 32, `${name} must be at least 32 bytes`)
    .refine((value) => !PLACEHOLDER_PATTERN.test(value), `${name} looks like a placeholder value`);

/** AES-256 key for TOTP secrets, supplied as base64 of exactly 32 bytes (SECURITY §1). */
const totpKey = z.string({ error: 'TOTP_ENC_KEY is required' }).refine((value) => {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  return Buffer.from(value, 'base64').length === 32;
}, 'TOTP_ENC_KEY must be base64 encoding exactly 32 bytes');

/** Comma-separated list of origins; empty entries are dropped. */
const originList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  )
  .pipe(z.array(z.url()));

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value.trim() : undefined));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MONGODB_URI: z
      .string({ error: 'MONGODB_URI is required' })
      .regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must start with mongodb:// or mongodb+srv://'),
    JWT_ACCESS_SECRET: strongSecret('JWT_ACCESS_SECRET'),
    TOTP_ENC_KEY: totpKey,
    /** Browsers allowed to call the API with credentials (the admin site). Mobile needs no CORS. */
    ADMIN_ORIGIN: originList,
    /** Public URL of the admin site, used to build invitation links. */
    ADMIN_PUBLIC_URL: z.url().default('http://localhost:5173'),
    /** Number of reverse proxies in front of the app (SECURITY §5). 0 = none. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    /** SMTP for password-reset codes and admin invitations (SPEC §6, SECURITY §1). */
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: optionalString.pipe(z.email().optional()),
    /**
     * Cloudinary for images and PDFs (SECURITY §7). Optional: without them, upload endpoints answer
     * 503 UPLOADS_DISABLED, so the rest of the API still runs locally.
     */
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.SMTP_HOST && !env.MAIL_FROM) {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_FROM'],
        message: 'MAIL_FROM is required when SMTP_HOST is set',
      });
    }
    if (env.NODE_ENV === 'production' && !env.SMTP_HOST) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST is required in production',
      });
    }
  });

/**
 * @param {Record<string, string | undefined>} source usually process.env
 * @returns {{ ok: true, env: z.infer<typeof envSchema> } | { ok: false, problems: string[] }}
 */
export function loadEnv(source) {
  const result = envSchema.safeParse(source);
  if (result.success) return { ok: true, env: result.data };

  const problems = result.error.issues.map((issue) => {
    const key = issue.path.join('.') || '(root)';
    return `${key}: ${issue.message}`;
  });
  return { ok: false, problems };
}

/**
 * Load `.env` from the server folder when present. Node 22 has process.loadEnvFile built in, so no
 * dotenv dependency is needed. Values already set in the real environment win.
 */
export function loadDotEnvFile() {
  const path = join(SERVER_ROOT, '.env');
  if (existsSync(path)) process.loadEnvFile(path);
}

/**
 * Boot-time check used by src/server.js only. Modules never read process.env directly; they receive
 * the validated config they need, which keeps them testable.
 * @returns {Readonly<z.infer<typeof envSchema>>}
 */
export function loadConfigOrExit() {
  loadDotEnvFile();
  const outcome = loadEnv(process.env);
  if (!outcome.ok) {
    console.error('PollWise server refused to start. Fix these environment variables:');
    for (const problem of outcome.problems) console.error(`  - ${problem}`);
    console.error('See server/.env.example for every variable and how to generate values.');
    process.exit(1);
  }
  return Object.freeze(outcome.env);
}
