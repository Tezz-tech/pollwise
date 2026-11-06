#!/usr/bin/env node
/**
 * Create the first super admin (SPEC §2). There is no default account and no seeded password: the
 * operator types the email and password here.
 *
 *   npm run create-super-admin -w server
 *
 * It prints the TOTP setup URI once. The super admin scans it on first sign-in, then enters the first
 * code, which turns two-step sign-in on. Refuses to run if the email is already registered.
 */
import { createInterface } from 'node:readline';
import { ERROR_CODES, ROLES } from '@pollwise/shared/constants';
import { loadConfigOrExit } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { User } from '../src/models/index.js';
import { recordAudit } from '../src/services/auditService.js';
import { encryptSecret, newTotpSecret, totpUri } from '../src/services/totpService.js';
import { hashPassword, passwordProblem } from '../src/utils/password.js';

/**
 * One readline interface for the whole session. Reading lines through a single async iterator means
 * piped input (used in tests) is never lost between prompts, and an interactive terminal works too.
 */
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdin.isTTY,
});
const lines = rl[Symbol.asyncIterator]();
let muted = false;
rl._writeToOutput = (text) => {
  if (!muted) rl.output.write(text);
};

/**
 * Ask a question. When `hidden` is set, typed characters are not echoed.
 * @param {string} question
 * @param {{ hidden?: boolean }} [options]
 * @returns {Promise<string>}
 */
async function ask(question, { hidden = false } = {}) {
  process.stdout.write(question);
  muted = hidden;
  const { value, done } = await lines.next();
  muted = false;
  if (hidden) process.stdout.write('\n');
  if (done) throw new Error('Input ended before the setup was complete. Nothing was changed.');
  return String(value).trim();
}

async function main() {
  const config = loadConfigOrExit();
  try {
    await run(config);
  } finally {
    rl.close();
  }
}

async function run(config) {
  const email = (await ask('Email: ')).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('That does not look like an email address.');
  }

  const password = await ask('Password: ', { hidden: true });
  const repeat = await ask('Repeat password: ', { hidden: true });
  if (password !== repeat) throw new Error('The two passwords do not match.');

  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);

  await connectDatabase(config.MONGODB_URI);
  try {
    if (await User.exists({ email })) {
      throw new Error('An account with that email already exists. Nothing was changed.');
    }

    const name = (await ask('Full name: ')) || 'Super admin';
    const secret = newTotpSecret();
    const user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role: ROLES.SUPER_ADMIN,
      security: {
        passwordChangedAt: new Date(),
        totpEnabled: false,
        totpPendingSecretEnc: encryptSecret(Buffer.from(config.TOTP_ENC_KEY, 'base64'), secret),
      },
    });

    await recordAudit(
      { now: () => new Date(), logger: console },
      {
        actorRole: 'cli',
        action: 'admin.created_by_cli',
        targetType: 'user',
        targetId: user._id,
        meta: { role: ROLES.SUPER_ADMIN },
      }
    );

    console.log('\nSuper admin created.');
    console.log('Add this account to your authenticator app now. It is shown only once:\n');
    console.log(`  Secret:  ${secret}`);
    console.log(`  URI:     ${totpUri({ secret, label: email })}\n`);
    console.log(
      'Sign in to the admin site with this email and password, then enter the six-digit code.'
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(`\n${err.message ?? ERROR_CODES.INTERNAL}`);
  process.exit(1);
});
