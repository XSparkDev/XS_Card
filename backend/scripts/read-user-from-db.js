#!/usr/bin/env node

/**
 * Read User and All Associated Data from a Firebase Project
 *
 * Connects to a single Firebase project (prod or staging) and reads:
 * - Auth user (by email)
 * - users/{uid}, cards/{uid}, contacts/{uid}, event_organisers/{uid}, subscriptions/{uid}
 * - enterprise docs where this user appears (enterprise/{eid}/users/{uid})
 *
 * Uses the same service account pattern as migrate-firestore.js and migrate-auth-users.js.
 * For prod use source-serviceAccount.json; for staging use dest-serviceAccount.json.
 *
 * Usage:
 *   node scripts/read-user-from-db.js --email xenacoh740@percyfx.com --project prod
 *   node scripts/read-user-from-db.js --email xenacoh740@percyfx.com --project staging --output user-dump.json
 */

const admin = require('firebase-admin');
const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;

const CONFIG = {
  SOURCE_SERVICE_ACCOUNT: path.join(__dirname, '..', 'source-serviceAccount.json'),
  DEST_SERVICE_ACCOUNT: path.join(__dirname, '..', 'dest-serviceAccount.json'),
  PROJECT_IDS: {
    prod: 'xscard-addd4',
    staging: 'xscard-dev',
  },
};

// Top-level collections where doc id = userId
const USER_KEYED_COLLECTIONS = [
  'users',
  'cards',
  'contacts',
  'event_organisers',
  'subscriptions',
];

/**
 * Load service account JSON
 */
async function loadServiceAccount(filePath) {
  const content = await fs.readFile(path.resolve(filePath), 'utf8');
  return JSON.parse(content);
}

/**
 * Serialize Firestore data for JSON (Timestamps -> ISO string, refs -> path)
 */
function serializeForJson(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof admin.firestore.Timestamp) {
    return obj.toDate().toISOString();
  }
  if (obj instanceof Date) return obj.toISOString();
  if (obj && typeof obj === 'object' && typeof obj.path === 'string') {
    return { __ref: obj.path };
  }
  if (Array.isArray(obj)) return obj.map(serializeForJson);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serializeForJson(v);
    return out;
  }
  return obj;
}

/**
 * Initialize Firebase for a single project
 */
async function initializeFirebase(projectKey) {
  const projectId = CONFIG.PROJECT_IDS[projectKey];
  if (!projectId) {
    throw new Error(`Unknown project: ${projectKey}. Use "prod" or "staging".`);
  }
  const credPath = projectKey === 'prod' ? CONFIG.SOURCE_SERVICE_ACCOUNT : CONFIG.DEST_SERVICE_ACCOUNT;
  const serviceAccount = await loadServiceAccount(credPath);

  try {
    admin.app(projectKey);
  } catch (_) {
    admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId,
      },
      projectKey
    );
  }

  const db = admin.app(projectKey).firestore();
  db.settings({ timestampsInSnapshots: true, ignoreUndefinedProperties: true });
  const auth = admin.app(projectKey).auth();
  return { db, auth, projectId };
}

/**
 * Find enterprises that contain this user in users subcollection
 */
async function findEnterpriseUsersForUid(db, uid) {
  const results = [];
  const enterprisesSnap = await db.collection('enterprise').get();
  for (const entDoc of enterprisesSnap.docs) {
    const userDoc = await entDoc.ref.collection('users').doc(uid).get();
    if (userDoc.exists) {
      results.push({
        enterpriseId: entDoc.id,
        enterpriseDoc: serializeForJson(entDoc.data()),
        usersSubDoc: serializeForJson(userDoc.data()),
      });
    }
  }
  return results;
}

/**
 * Main: read everything for one user by email
 */
async function run() {
  program
    .requiredOption('-e, --email <email>', 'User email')
    .option('-p, --project <prod|staging>', 'Which project to read from', 'prod')
    .option('-o, --output <path>', 'Write full dump to JSON file')
    .parse(process.argv);

  const { email, project, output } = program.opts();

  console.log(chalk.blue('\n📖 Read user and associated data from Firebase\n'));
  console.log(chalk.dim(`Email: ${email}`));
  console.log(chalk.dim(`Project: ${project}\n`));

  const { db, auth, projectId } = await initializeFirebase(project);
  console.log(chalk.green(`✓ Connected to project: ${projectId}\n`));

  let uid = null;
  let authUser = null;
  try {
    authUser = await auth.getUserByEmail(email);
    uid = authUser.uid;
    console.log(chalk.green(`✓ Auth user found: uid=${uid}`));
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(chalk.red(`✗ No Auth user found for email: ${email}`));
      process.exit(1);
    }
    throw err;
  }

  const dump = {
    email,
    uid,
    projectId,
    readAt: new Date().toISOString(),
    auth: authUser ? {
      uid: authUser.uid,
      email: authUser.email,
      emailVerified: authUser.emailVerified,
      displayName: authUser.displayName || null,
      photoURL: authUser.photoURL || null,
      disabled: authUser.disabled,
      metadata: authUser.metadata,
    } : null,
    firestore: {},
    enterprise: [],
  };

  for (const coll of USER_KEYED_COLLECTIONS) {
    const docRef = db.collection(coll).doc(uid);
    const snap = await docRef.get();
    if (snap.exists) {
      dump.firestore[coll] = serializeForJson(snap.data());
      console.log(chalk.green(`  ✓ ${coll}/${uid}`));
    } else {
      dump.firestore[coll] = null;
      console.log(chalk.dim(`  - ${coll}/${uid} (missing)`));
    }
  }

  console.log(chalk.blue('\n  Checking enterprise...'));
  dump.enterprise = await findEnterpriseUsersForUid(db, uid);
  if (dump.enterprise.length) {
    console.log(chalk.green(`  ✓ Found in ${dump.enterprise.length} enterprise(s)`));
  } else {
    console.log(chalk.dim('  - Not in any enterprise'));
  }

  if (output) {
    await fs.writeFile(output, JSON.stringify(dump, null, 2), 'utf8');
    console.log(chalk.green(`\n✓ Dump written to: ${output}`));
  }

  console.log(chalk.blue('\n--- Summary ---'));
  console.log(chalk.white(`UID: ${uid}`));
  const docCount = Object.values(dump.firestore).filter(Boolean).length;
  console.log(chalk.white(`Firestore docs: ${docCount}`));
  console.log(chalk.white(`Enterprise links: ${dump.enterprise.length}\n`));

  return dump;
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(chalk.red(err.message));
      process.exit(1);
    });
}

module.exports = { run, serializeForJson, USER_KEYED_COLLECTIONS, findEnterpriseUsersForUid };
