#!/usr/bin/env node

/**
 * Set password for a user in staging (xscard-dev).
 * Uses dest-serviceAccount.json. Run after migrating the user to staging.
 *
 * Usage:
 *   node scripts/set-staging-user-password.js --email xenacoh740@percyfx.com
 */

const admin = require('firebase-admin');
const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;

const PASSWORD = 'Password.10';

const CONFIG = {
  DEST_SERVICE_ACCOUNT: path.join(__dirname, '..', 'dest-serviceAccount.json'),
  DEST_PROJECT_ID: 'xscard-dev',
};

async function loadServiceAccount(filePath) {
  const content = await fs.readFile(path.resolve(filePath), 'utf8');
  return JSON.parse(content);
}

async function run() {
  program.requiredOption('-e, --email <email>', 'User email in staging').parse(process.argv);
  const email = program.opts().email;

  const cred = await loadServiceAccount(CONFIG.DEST_SERVICE_ACCOUNT);
  try {
    admin.app('staging');
  } catch (_) {
    admin.initializeApp(
      { credential: admin.credential.cert(cred), projectId: CONFIG.DEST_PROJECT_ID },
      'staging'
    );
  }

  const auth = admin.app('staging').auth();
  const user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password: PASSWORD });
  console.log(chalk.green(`✓ Password set for ${email} (uid=${user.uid}) in staging.\n`));
}

run().catch((err) => {
  console.error(chalk.red(err.message || err));
  process.exit(1);
});
