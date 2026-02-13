#!/usr/bin/env node

/**
 * Migrate a Single User (and All Associated Data) from Prod to Staging
 *
 * Uses the same pattern as migrate-firestore.js and migrate-auth-users.js:
 * - source-serviceAccount.json → prod (xscard-addd4)
 * - dest-serviceAccount.json   → staging (xscard-dev)
 *
 * 1. Finds user in source Auth by email
 * 2. Creates Auth user in destination (same uid)
 * 3. Copies Firestore: users, cards, contacts, event_organisers, subscriptions (by uid)
 * 4. Copies enterprise links: enterprise/{eid} doc (if missing) and enterprise/{eid}/users/{uid}
 *
 * Usage:
 *   node scripts/migrate-user-between-dbs.js --email xenacoh740@percyfx.com
 *   node scripts/migrate-user-between-dbs.js --email xenacoh740@percyfx.com --dry-run
 */

const admin = require('firebase-admin');
const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;

const CONFIG = {
  SOURCE_SERVICE_ACCOUNT: path.join(__dirname, '..', 'source-serviceAccount.json'),
  DEST_SERVICE_ACCOUNT: path.join(__dirname, '..', 'dest-serviceAccount.json'),
  SOURCE_PROJECT_ID: 'xscard-addd4',
  DEST_PROJECT_ID: 'xscard-dev',
};

const USER_KEYED_COLLECTIONS = [
  'users',
  'cards',
  'contacts',
  'event_organisers',
  'subscriptions',
];

async function loadServiceAccount(filePath) {
  const content = await fs.readFile(path.resolve(filePath), 'utf8');
  return JSON.parse(content);
}

/**
 * Initialize source and destination Firebase (same as migrate-firestore / migrate-auth-users)
 */
async function initializeFirebase() {
  console.log(chalk.blue('🔧 Initializing Firebase Admin SDK...\n'));

  const sourceCred = await loadServiceAccount(CONFIG.SOURCE_SERVICE_ACCOUNT);
  const destCred = await loadServiceAccount(CONFIG.DEST_SERVICE_ACCOUNT);

  try {
    admin.app('source');
  } catch (_) {
    admin.initializeApp(
      { credential: admin.credential.cert(sourceCred), projectId: CONFIG.SOURCE_PROJECT_ID },
      'source'
    );
  }
  try {
    admin.app('destination');
  } catch (_) {
    admin.initializeApp(
      { credential: admin.credential.cert(destCred), projectId: CONFIG.DEST_PROJECT_ID },
      'destination'
    );
  }

  const sourceDb = admin.app('source').firestore();
  const destDb = admin.app('destination').firestore();
  sourceDb.settings({ timestampsInSnapshots: true, ignoreUndefinedProperties: true });
  destDb.settings({ timestampsInSnapshots: true, ignoreUndefinedProperties: true });
  const sourceAuth = admin.app('source').auth();
  const destAuth = admin.app('destination').auth();

  console.log(chalk.green(`✓ Source: ${CONFIG.SOURCE_PROJECT_ID}`));
  console.log(chalk.green(`✓ Destination: ${CONFIG.DEST_PROJECT_ID}\n`));
  return { sourceDb, destDb, sourceAuth, destAuth };
}

/**
 * Create Auth user in destination (same uid as source)
 */
async function ensureAuthUserInDest(sourceUser, destAuth, dryRun) {
  try {
    await destAuth.getUserByEmail(sourceUser.email);
    console.log(chalk.yellow(`  ⊙ Auth user already exists: ${sourceUser.email}`));
    return;
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }

  if (dryRun) {
    console.log(chalk.cyan(`  → Would create Auth user: ${sourceUser.email} (${sourceUser.uid})`));
    return;
  }

  const userToImport = {
    uid: sourceUser.uid,
    email: sourceUser.email,
    emailVerified: sourceUser.emailVerified || false,
    disabled: sourceUser.disabled || false,
  };
  if (sourceUser.displayName && String(sourceUser.displayName).trim()) userToImport.displayName = sourceUser.displayName;
  if (sourceUser.photoURL && String(sourceUser.photoURL).trim()) userToImport.photoURL = sourceUser.photoURL;

  await destAuth.createUser(userToImport);
  console.log(chalk.green(`  ✓ Auth user created: ${sourceUser.email}`));
}

/**
 * Copy one document from source to dest (merge)
 */
async function copyDoc(sourceDb, destDb, collectionName, docId, dryRun) {
  const snap = await sourceDb.collection(collectionName).doc(docId).get();
  if (!snap.exists) return false;
  const destRef = destDb.collection(collectionName).doc(docId);
  if (!dryRun) await destRef.set(snap.data(), { merge: true });
  return true;
}

/**
 * Find enterprise ids where this user is in users subcollection; return list of { enterpriseId }
 */
async function findEnterpriseIdsForUser(db, uid) {
  const out = [];
  const snap = await db.collection('enterprise').get();
  for (const doc of snap.docs) {
    const userSnap = await doc.ref.collection('users').doc(uid).get();
    if (userSnap.exists) out.push(doc.id);
  }
  return out;
}

async function run() {
  program
    .requiredOption('-e, --email <email>', 'User email to migrate')
    .option('-d, --dry-run', 'Only show what would be copied', false)
    .parse(process.argv);

  const { email, dryRun } = program.opts();

  console.log(chalk.bold.blue('\n📦 Migrate single user: Prod → Staging\n'));
  if (dryRun) console.log(chalk.yellow('🔍 DRY RUN - no changes will be made\n'));
  console.log(chalk.dim(`Email: ${email}\n`));

  const { sourceDb, destDb, sourceAuth, destAuth } = await initializeFirebase();

  let authUser;
  try {
    authUser = await sourceAuth.getUserByEmail(email);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.log(chalk.red(`✗ No user in source (prod) with email: ${email}`));
      process.exit(1);
    }
    throw e;
  }

  const uid = authUser.uid;
  console.log(chalk.green(`✓ Found in source: uid=${uid}\n`));

  console.log(chalk.blue('1) Auth'));
  await ensureAuthUserInDest(authUser, destAuth, dryRun);

  console.log(chalk.blue('\n2) Firestore (user-keyed collections)'));
  for (const coll of USER_KEYED_COLLECTIONS) {
    const copied = await copyDoc(sourceDb, destDb, coll, uid, dryRun);
    if (copied) console.log(chalk.green(`  ✓ ${coll}/${uid}`));
    else console.log(chalk.dim(`  - ${coll}/${uid} (missing in source)`));
  }

  console.log(chalk.blue('\n3) Enterprise'));
  const enterpriseIds = await findEnterpriseIdsForUser(sourceDb, uid);
  for (const eid of enterpriseIds) {
    const entSnap = await sourceDb.collection('enterprise').doc(eid).get();
    if (entSnap.exists) {
      const destEntRef = destDb.collection('enterprise').doc(eid);
      if (!dryRun) await destEntRef.set(entSnap.data(), { merge: true });
      console.log(chalk.green(`  ✓ enterprise/${eid} (doc)`));

      const userSubSnap = await sourceDb.collection('enterprise').doc(eid).collection('users').doc(uid).get();
      if (userSubSnap.exists) {
        const destUserRef = destDb.collection('enterprise').doc(eid).collection('users').doc(uid);
        if (!dryRun) await destUserRef.set(userSubSnap.data(), { merge: true });
        console.log(chalk.green(`  ✓ enterprise/${eid}/users/${uid}`));
      }
    }
  }
  if (enterpriseIds.length === 0) console.log(chalk.dim('  - Not in any enterprise'));

  console.log(chalk.bold.green('\n✅ Done.\n'));
  if (dryRun) console.log(chalk.yellow('Run without --dry-run to perform the migration.\n'));
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(chalk.red(err.message || err));
      process.exit(1);
    });
}

module.exports = { run, USER_KEYED_COLLECTIONS };
