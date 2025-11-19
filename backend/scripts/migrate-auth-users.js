#!/usr/bin/env node

/**
 * Firebase Authentication Users Migration Script
 * 
 * Migrates Firebase Auth users from source project to destination project
 * 
 * IMPORTANT: This requires Firebase CLI authentication
 * 
 * Usage:
 *   node migrate-auth-users.js
 */

const admin = require('firebase-admin');
const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');

// Configuration
const CONFIG = {
  SOURCE_SERVICE_ACCOUNT: path.join(__dirname, '..', 'source-serviceAccount.json'),
  DEST_SERVICE_ACCOUNT: path.join(__dirname, '..', 'dest-serviceAccount.json'),
  SOURCE_PROJECT_ID: 'xscard-addd4',
  DEST_PROJECT_ID: 'xscard-dev',
};

// Parse command line arguments
program
  .option('-d, --dry-run', 'Perform a dry run without actually migrating users')
  .option('-l, --limit <number>', 'Limit number of users to migrate', '1000')
  .parse(process.argv);

const options = program.opts();

// Statistics
const stats = {
  usersProcessed: 0,
  usersMigrated: 0,
  usersSkipped: 0,
  usersFailed: 0,
  errors: [],
};

/**
 * Load service account
 */
async function loadServiceAccount(filePath) {
  try {
    const fs = require('fs').promises;
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to load service account from: ${filePath}`));
    console.error(chalk.red(`   Error: ${error.message}\n`));
    throw error;
  }
}

/**
 * Initialize Firebase Admin SDKs
 */
async function initializeFirebase() {
  console.log(chalk.blue('🔧 Initializing Firebase Admin SDK...\n'));
  
  const sourceServiceAccount = await loadServiceAccount(CONFIG.SOURCE_SERVICE_ACCOUNT);
  const destServiceAccount = await loadServiceAccount(CONFIG.DEST_SERVICE_ACCOUNT);
  
  // Initialize source
  const sourceApp = admin.initializeApp({
    credential: admin.credential.cert(sourceServiceAccount),
    projectId: CONFIG.SOURCE_PROJECT_ID,
  }, 'source');
  
  console.log(chalk.green(`✓ Source Firebase initialized: ${CONFIG.SOURCE_PROJECT_ID}`));
  
  // Initialize destination
  const destApp = admin.initializeApp({
    credential: admin.credential.cert(destServiceAccount),
    projectId: CONFIG.DEST_PROJECT_ID,
  }, 'destination');
  
  console.log(chalk.green(`✓ Destination Firebase initialized: ${CONFIG.DEST_PROJECT_ID}\n`));
  
  return {
    sourceAuth: admin.app('source').auth(),
    destAuth: admin.app('destination').auth(),
  };
}

/**
 * Migrate a single user
 */
async function migrateUser(user, destAuth, dryRun) {
  stats.usersProcessed++;
  
  try {
    // Check if user already exists in destination
    try {
      const existingUser = await destAuth.getUserByEmail(user.email);
      if (existingUser) {
        console.log(chalk.yellow(`  ⊙ User already exists: ${user.email}`));
        stats.usersSkipped++;
        return;
      }
    } catch (error) {
      // User doesn't exist, which is what we want
    }
    
    if (dryRun) {
      console.log(chalk.cyan(`  → Would migrate: ${user.email}`));
      stats.usersMigrated++;
      return;
    }
    
    // Create user in destination project
    // Firebase requires displayName to be a valid non-empty string or undefined/null
    // Empty strings cause validation errors
    const userToImport = {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified || false,
      disabled: user.disabled || false,
    };
    
    // Only include displayName if it's a non-empty string
    if (user.displayName && typeof user.displayName === 'string' && user.displayName.trim().length > 0) {
      userToImport.displayName = user.displayName;
    }
    
    // Only include photoURL if it's a non-empty string
    if (user.photoURL && typeof user.photoURL === 'string' && user.photoURL.trim().length > 0) {
      userToImport.photoURL = user.photoURL;
    }
    
    // Add password hash if available (this requires the user to reset password)
    // Note: Firebase doesn't allow direct password migration without hash
    // Users will need to reset their password
    
    await destAuth.createUser(userToImport);
    
    console.log(chalk.green(`  ✓ Migrated: ${user.email}`));
    stats.usersMigrated++;
    
  } catch (error) {
    console.error(chalk.red(`  ✗ Failed to migrate ${user.email}: ${error.message}`));
    stats.usersFailed++;
    stats.errors.push({
      email: user.email,
      error: error.message,
    });
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log(chalk.bold.blue('\n📋 Firebase Authentication Users Migration\n'));
  console.log(chalk.gray('='.repeat(60) + '\n'));
  
  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No users will be actually migrated\n'));
  }
  
  console.log(`Source Project: ${chalk.cyan(CONFIG.SOURCE_PROJECT_ID)}`);
  console.log(`Destination Project: ${chalk.cyan(CONFIG.DEST_PROJECT_ID)}`);
  console.log(`Limit: ${chalk.cyan(options.limit)} users\n`);
  
  const { sourceAuth, destAuth } = await initializeFirebase();
  
  console.log(chalk.blue('📥 Fetching users from source project...\n'));
  
  // List all users from source
  const listUsersResult = await sourceAuth.listUsers(parseInt(options.limit));
  const users = listUsersResult.users;
  
  console.log(chalk.green(`✓ Found ${users.length} users to migrate\n`));
  
  console.log(chalk.blue('🚀 Starting migration...\n'));
  
  // Migrate each user
  for (const user of users) {
    await migrateUser(user, destAuth, options.dryRun);
  }
  
  // Print summary
  console.log(chalk.gray('\n' + '='.repeat(60)));
  console.log(chalk.bold.green('\n✅ Migration Complete!\n'));
  console.log(chalk.white(`Users Processed: ${stats.usersProcessed}`));
  console.log(chalk.green(`Users Migrated: ${stats.usersMigrated}`));
  console.log(chalk.yellow(`Users Skipped: ${stats.usersSkipped}`));
  console.log(chalk.red(`Users Failed: ${stats.usersFailed}\n`));
  
  if (stats.errors.length > 0) {
    console.log(chalk.red('❌ Errors encountered:\n'));
    stats.errors.forEach((err, i) => {
      console.log(chalk.red(`  ${i + 1}. ${err.email}: ${err.error}`));
    });
    console.log('');
  }
  
  if (options.dryRun) {
    console.log(chalk.yellow('⚠️  This was a dry run. No users were actually migrated.'));
    console.log(chalk.yellow('   Run without --dry-run to perform the actual migration.\n'));
  } else {
    console.log(chalk.green('✓ Users have been migrated to destination project'));
    console.log(chalk.yellow('\n⚠️  IMPORTANT: Users will need to reset their passwords'));
    console.log(chalk.yellow('   Firebase Auth cannot migrate password hashes directly.\n'));
  }
}

// Run migration
migrate()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red('\n❌ Migration failed:'), error);
    process.exit(1);
  });

