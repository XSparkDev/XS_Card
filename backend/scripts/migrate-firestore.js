#!/usr/bin/env node

/**
 * Firestore Database Migration Script
 * 
 * Migrates Firestore collections from a source project to a destination project
 * using Firebase Admin SDK.
 * 
 * IMPORTANT: This script ONLY COPIES data - it never deletes or modifies
 * the source database. The source database remains completely unchanged.
 * 
 * - Reads data from source project
 * - Writes (duplicates) data to destination project
 * - Source database is never modified or deleted
 * 
 * Usage:
 *   node migrate-firestore.js [options]
 * 
 * Example:
 *   node migrate-firestore.js --mode merge --collections users,contacts
 *   node migrate-firestore.js --dry-run --max-documents 100
 */

const admin = require('firebase-admin');
const { program } = require('commander');
const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

// ============================================================================
// CONFIGURATION - Edit these values or use command-line arguments
// ============================================================================

const CONFIG = {
  // Service account file paths (relative to script directory)
  // Files should be placed in: backend/source-serviceAccount.json and backend/dest-serviceAccount.json
  SOURCE_SERVICE_ACCOUNT: path.join(__dirname, '..', 'source-serviceAccount.json'),
  DEST_SERVICE_ACCOUNT: path.join(__dirname, '..', 'dest-serviceAccount.json'),
  
  // Project IDs
  SOURCE_PROJECT_ID: 'xscard-addd4',
  DEST_PROJECT_ID: 'xscard-dev',
  
  // Default batch size for Firestore operations (max 500)
  BATCH_SIZE: 500,
  
  // Collections to exclude from migration (if not specifying specific collections)
  EXCLUDE_COLLECTIONS: [],
  
  // Default migration mode
  DEFAULT_MODE: 'merge', // 'overwrite', 'merge', or 'clear-then-copy'
};

// ============================================================================
// MIGRATION STATISTICS
// ============================================================================

const stats = {
  collectionsProcessed: 0,
  documentsCopied: 0,
  documentsSkipped: 0,
  documentsFailed: 0,
  subcollectionsProcessed: 0,
  errors: [],
  startTime: null,
  endTime: null,
};

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let sourceDb;
let destDb;
let sourceApp;
let destApp;

/**
 * Initialize Firebase Admin SDK for source and destination projects
 */
async function initializeFirebase() {
  try {
    console.log(chalk.blue('🔧 Initializing Firebase Admin SDK...\n'));
    
    // Load service account files
    const sourceServiceAccount = await loadServiceAccount(CONFIG.SOURCE_SERVICE_ACCOUNT);
    const destServiceAccount = await loadServiceAccount(CONFIG.DEST_SERVICE_ACCOUNT);
    
    // Initialize source Firebase app
    try {
      sourceApp = admin.app('source');
    } catch (e) {
      // App doesn't exist, create it
    }
    
    if (!sourceApp) {
      sourceApp = admin.initializeApp({
        credential: admin.credential.cert(sourceServiceAccount),
        projectId: CONFIG.SOURCE_PROJECT_ID,
      }, 'source');
    }
    
    sourceDb = admin.app('source').firestore();
    sourceDb.settings({ timestampsInSnapshots: true, ignoreUndefinedProperties: true });
    
    console.log(chalk.green(`✓ Source Firebase initialized: ${CONFIG.SOURCE_PROJECT_ID}`));
    
    // Initialize destination Firebase app
    try {
      destApp = admin.app('destination');
    } catch (e) {
      // App doesn't exist, create it
    }
    
    if (!destApp) {
      destApp = admin.initializeApp({
        credential: admin.credential.cert(destServiceAccount),
        projectId: CONFIG.DEST_PROJECT_ID,
      }, 'destination');
    }
    
    destDb = admin.app('destination').firestore();
    destDb.settings({ timestampsInSnapshots: true, ignoreUndefinedProperties: true });
    
    console.log(chalk.green(`✓ Destination Firebase initialized: ${CONFIG.DEST_PROJECT_ID}\n`));
    
    // Validate connection by attempting to list collections
    await sourceDb.listCollections();
    await destDb.listCollections();
    
    console.log(chalk.green('✓ Both Firebase instances validated successfully\n'));
    
    return true;
  } catch (error) {
    console.error(chalk.red(`✗ Firebase initialization failed: ${error.message}`));
    throw error;
  }
}

/**
 * Load service account JSON file
 */
async function loadServiceAccount(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    
    // Check if file exists first
    try {
      await fs.access(fullPath);
    } catch (accessError) {
      const relativePath = path.relative(process.cwd(), fullPath);
      throw new Error(
        `Service account file not found: ${relativePath}\n\n` +
        `Please create the service account file:\n` +
        `1. Go to Firebase Console → Project Settings → Service Accounts\n` +
        `2. Click "Generate New Private Key"\n` +
        `3. Save the file as: ${relativePath}\n\n` +
        `Expected full path: ${fullPath}`
      );
    }
    
    const fileContent = await fs.readFile(fullPath, 'utf8');
    const parsed = JSON.parse(fileContent);
    
    // Validate it's a service account file
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      throw new Error('Invalid service account file format. File must contain project_id, private_key, and client_email.');
    }
    
    return parsed;
  } catch (error) {
    if (error.message.includes('not found') || error.code === 'ENOENT') {
      throw error; // Re-throw our custom error
    }
    throw new Error(`Failed to load service account file: ${filePath}\nError: ${error.message}`);
  }
}

// ============================================================================
// COLLECTION DISCOVERY
// ============================================================================

/**
 * Get all collection names from source Firestore
 */
async function getAllCollections() {
  try {
    const collections = await sourceDb.listCollections();
    return collections.map(col => col.id);
  } catch (error) {
    throw new Error(`Failed to list collections: ${error.message}`);
  }
}

/**
 * Filter collections based on include/exclude lists
 */
function filterCollections(allCollections, includeList, excludeList) {
  if (includeList && includeList.length > 0) {
    // If specific collections are requested, only include those
    return allCollections.filter(col => includeList.includes(col));
  }
  
  // Otherwise, exclude specified collections
  const excludeSet = new Set(excludeList || CONFIG.EXCLUDE_COLLECTIONS);
  return allCollections.filter(col => !excludeSet.has(col));
}

// ============================================================================
// DOCUMENT MIGRATION
// ============================================================================

/**
 * Check if a document should be copied (without actually copying)
 * Returns status object indicating whether document should be copied
 */
async function shouldCopyDocument(sourceDoc, destCollection, mode, maxDocuments) {
  const data = sourceDoc.data();
  const docId = sourceDoc.id;
  
  // Check if we've reached max documents limit
  if (maxDocuments && stats.documentsCopied >= maxDocuments) {
    return { shouldCopy: false, reason: 'max-documents-reached' };
  }
  
  const destDocRef = destCollection.doc(docId);
  
  try {
    if (mode === 'merge') {
      // Check if document already exists
      const destDoc = await destDocRef.get();
      if (destDoc.exists) {
        stats.documentsSkipped++;
        return { shouldCopy: false, reason: 'already-exists' };
      }
    }
    
    // In dry-run mode, just indicate it would be copied
    if (program.opts().dryRun) {
      stats.documentsCopied++; // Count for dry-run
      return { shouldCopy: true, wouldCopy: true, data };
    }
    
    // Document should be copied
    return { shouldCopy: true, data };
    
  } catch (error) {
    stats.documentsFailed++;
    const errorInfo = {
      path: `${destCollection.path}/${docId}`,
      error: error.message,
    };
    stats.errors.push(errorInfo);
    return { shouldCopy: false, failed: true, error: error.message };
  }
}

/**
 * Copy subcollections recursively
 */
async function copySubcollections(sourceDocRef, destDocRef, mode, maxDocuments, depth = 0) {
  const maxDepth = 10; // Prevent infinite recursion
  if (depth > maxDepth) {
    console.warn(chalk.yellow(`  ⚠ Max subcollection depth (${maxDepth}) reached for ${sourceDocRef.path}`));
    return;
  }
  
  try {
    const subcollections = await sourceDocRef.listCollections();
    
    for (const subcollection of subcollections) {
      stats.subcollectionsProcessed++;
      
      const subcollectionName = subcollection.id;
      const destSubcollection = destDocRef.collection(subcollectionName);
      
      console.log(chalk.dim(`    ↳ Copying subcollection: ${subcollectionName} (depth ${depth})`));
      
      // Get all documents in subcollection
      const snapshot = await subcollection.get();
      const documents = snapshot.docs;
      
      // Process in batches
      for (let i = 0; i < documents.length; i += CONFIG.BATCH_SIZE) {
        const batch = destDb.batch();
        const batchDocs = documents.slice(i, i + CONFIG.BATCH_SIZE);
        let batchCount = 0;
        
        for (const doc of batchDocs) {
          if (maxDocuments && stats.documentsCopied >= maxDocuments) {
            break;
          }
          
          const destSubDocRef = destSubcollection.doc(doc.id);
          const docData = doc.data();
          
          if (mode === 'merge') {
            const existing = await destSubDocRef.get();
            if (existing.exists) {
              stats.documentsSkipped++;
              continue;
            }
          }
          
          if (!program.opts().dryRun) {
            batch.set(destSubDocRef, docData);
            batchCount++;
          }
          
          stats.documentsCopied++;
          
          // Recursively copy nested subcollections
          if (!program.opts().dryRun) {
            await copySubcollections(
              sourceDocRef.collection(subcollectionName).doc(doc.id),
              destDocRef.collection(subcollectionName).doc(doc.id),
              mode,
              maxDocuments,
              depth + 1
            );
          }
        }
        
        if (batchCount > 0 && !program.opts().dryRun) {
          await batch.commit();
          console.log(chalk.dim(`      ✓ Committed batch of ${batchCount} sub-documents`));
        }
      }
    }
  } catch (error) {
    console.error(chalk.red(`    ✗ Error copying subcollections for ${sourceDocRef.path}: ${error.message}`));
    stats.errors.push({
      path: sourceDocRef.path,
      error: `Subcollection error: ${error.message}`,
    });
  }
}

/**
 * Migrate a single collection
 */
async function migrateCollection(collectionName, mode, maxDocuments) {
  console.log(chalk.cyan(`\n📦 Migrating collection: ${collectionName}`));
  console.log(chalk.dim(`   Mode: ${mode}`));
  
  try {
    const sourceCollection = sourceDb.collection(collectionName);
    const destCollection = destDb.collection(collectionName);
    
    // Clear destination collection if mode is clear-then-copy
    if (mode === 'clear-then-copy' && !program.opts().dryRun) {
      console.log(chalk.yellow(`   🗑️  Clearing destination collection...`));
      const destSnapshot = await destCollection.get();
      const deletePromises = [];
      
      for (const doc of destSnapshot.docs) {
        deletePromises.push(doc.ref.delete());
      }
      
      // Process deletions in batches
      for (let i = 0; i < deletePromises.length; i += CONFIG.BATCH_SIZE) {
        await Promise.all(deletePromises.slice(i, i + CONFIG.BATCH_SIZE));
      }
      
      console.log(chalk.green(`   ✓ Cleared ${destSnapshot.docs.length} existing documents`));
    }
    
    // Get all documents from source
    const sourceSnapshot = await sourceCollection.get();
    const documents = sourceSnapshot.docs;
    const totalDocs = documents.length;
    
    console.log(chalk.dim(`   Found ${totalDocs} documents in source`));
    
    if (totalDocs === 0) {
      console.log(chalk.yellow(`   ⚠ Collection is empty, skipping`));
      return;
    }
    
    // Process documents in batches
    let processed = 0;
    for (let i = 0; i < documents.length; i += CONFIG.BATCH_SIZE) {
      const batch = destDb.batch();
      const batchDocs = documents.slice(i, i + CONFIG.BATCH_SIZE);
      let batchCount = 0;
      const batchCopiedIds = []; // Track document IDs that were actually copied (for subcollections)
      
      for (const doc of batchDocs) {
        // Check max documents limit
        if (maxDocuments && stats.documentsCopied >= maxDocuments) {
          console.log(chalk.yellow(`   ⚠ Reached max documents limit (${maxDocuments}), stopping...`));
          break;
        }
        
        const result = await shouldCopyDocument(doc, destCollection, mode, maxDocuments);
        
        if (result.shouldCopy) {
          if (!program.opts().dryRun) {
            batch.set(destCollection.doc(doc.id), result.data);
            batchCount++;
            batchCopiedIds.push(doc.id); // Track for subcollection copying
          }
          stats.documentsCopied++;
        }
        
        processed++;
        
        // Show progress every 100 documents
        if (processed % 100 === 0) {
          console.log(chalk.dim(`   Progress: ${processed}/${totalDocs} documents processed`));
        }
      }
      
      // Commit batch
      if (batchCount > 0 && !program.opts().dryRun) {
        await batch.commit();
        console.log(chalk.dim(`   ✓ Committed batch of ${batchCount} documents`));
      }
      
      // Copy subcollections for documents that were actually copied
      if (!program.opts().dryRun && batchCopiedIds.length > 0) {
        for (const doc of batchDocs) {
          if (batchCopiedIds.includes(doc.id)) {
            await copySubcollections(
              sourceCollection.doc(doc.id),
              destCollection.doc(doc.id),
              mode,
              maxDocuments
            );
          }
        }
      }
      
      // Break if max documents reached
      if (maxDocuments && stats.documentsCopied >= maxDocuments) {
        break;
      }
    }
    
    console.log(chalk.green(`   ✓ Completed: ${collectionName}`));
    stats.collectionsProcessed++;
    
  } catch (error) {
    console.error(chalk.red(`   ✗ Error migrating collection ${collectionName}: ${error.message}`));
    stats.errors.push({
      collection: collectionName,
      error: error.message,
    });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format duration in milliseconds to human-readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Print migration summary
 */
function printSummary() {
  const duration = stats.endTime - stats.startTime;
  
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan('📊 MIGRATION SUMMARY'));
  console.log(chalk.cyan('='.repeat(60)));
  
  console.log(chalk.blue('\nCollections:'));
  console.log(`  Processed: ${chalk.green(stats.collectionsProcessed)}`);
  
  console.log(chalk.blue('\nDocuments:'));
  console.log(`  Copied: ${chalk.green(stats.documentsCopied)}`);
  console.log(`  Skipped: ${chalk.yellow(stats.documentsSkipped)}`);
  console.log(`  Failed: ${chalk.red(stats.documentsFailed)}`);
  
  console.log(chalk.blue('\nSubcollections:'));
  console.log(`  Processed: ${chalk.green(stats.subcollectionsProcessed)}`);
  
  console.log(chalk.blue('\nTime:'));
  console.log(`  Duration: ${chalk.green(formatDuration(duration))}`);
  
  if (stats.errors.length > 0) {
    console.log(chalk.red(`\n⚠ Errors: ${stats.errors.length}`));
    console.log(chalk.red('='.repeat(60)));
    stats.errors.forEach((err, index) => {
      console.log(chalk.red(`\n${index + 1}. ${err.path || err.collection || 'Unknown'}`));
      console.log(chalk.dim(`   ${err.error}`));
    });
  }
  
  console.log(chalk.cyan('\n' + '='.repeat(60) + '\n'));
}

/**
 * Prompt user for confirmation
 */
function askConfirmation(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question(chalk.yellow(message), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// ============================================================================
// MAIN MIGRATION FUNCTION
// ============================================================================

/**
 * Main migration function
 */
async function runMigration() {
  try {
    stats.startTime = Date.now();
    
    // Parse command-line arguments
    program
      .option('-m, --mode <mode>', 'Migration mode: overwrite, merge, or clear-then-copy', CONFIG.DEFAULT_MODE)
      .option('-c, --collections <collections>', 'Comma-separated list of collections to migrate (default: all)')
      .option('-e, --exclude <collections>', 'Comma-separated list of collections to exclude')
      .option('-d, --dry-run', 'Show what would be copied without actually copying', false)
      .option('-f, --force', 'Skip confirmation prompt', false)
      .option('--max-documents <number>', 'Maximum number of documents to copy (for testing)')
      .option('--batch-size <number>', 'Batch size for Firestore operations', String(CONFIG.BATCH_SIZE))
      .option('--log-file <path>', 'Path to log file (optional)')
      .parse(process.argv);
    
    const options = program.opts();
    
    // Update batch size if specified
    if (options.batchSize) {
      CONFIG.BATCH_SIZE = parseInt(options.batchSize, 10);
      if (CONFIG.BATCH_SIZE > 500) {
        console.warn(chalk.yellow('⚠ Batch size capped at 500 (Firestore limit)'));
        CONFIG.BATCH_SIZE = 500;
      }
    }
    
    // Show configuration
    console.log(chalk.blue('\n' + '='.repeat(60)));
    console.log(chalk.blue('🚀 FIRESTORE MIGRATION TOOL'));
    console.log(chalk.blue('='.repeat(60)));
    console.log(chalk.dim(`\nSource:      ${CONFIG.SOURCE_PROJECT_ID}`));
    console.log(chalk.dim(`Destination: ${CONFIG.DEST_PROJECT_ID}`));
    console.log(chalk.dim(`Mode:        ${options.mode}`));
    console.log(chalk.dim(`Dry Run:     ${options.dryRun ? 'Yes' : 'No'}`));
    console.log(chalk.dim(`Batch Size:  ${CONFIG.BATCH_SIZE}`));
    
    if (options.maxDocuments) {
      console.log(chalk.dim(`Max Docs:    ${options.maxDocuments}`));
    }
    
    console.log(chalk.blue('='.repeat(60) + '\n'));
    
    // Initialize Firebase
    await initializeFirebase();
    
    // Get collections to migrate
    const allCollections = await getAllCollections();
    const includeList = options.collections ? options.collections.split(',').map(c => c.trim()) : null;
    const excludeList = options.exclude ? options.exclude.split(',').map(c => c.trim()) : CONFIG.EXCLUDE_COLLECTIONS;
    
    const collectionsToMigrate = filterCollections(allCollections, includeList, excludeList);
    
    console.log(chalk.blue(`\n📋 Collections to migrate: ${collectionsToMigrate.length}`));
    collectionsToMigrate.forEach((col, index) => {
      console.log(chalk.dim(`   ${index + 1}. ${col}`));
    });
    
    if (collectionsToMigrate.length === 0) {
      console.log(chalk.red('\n✗ No collections to migrate. Exiting.'));
      process.exit(1);
    }
    
    // Ask for confirmation unless --force flag is set
    if (!options.force && !options.dryRun) {
      const confirmed = await askConfirmation(
        `\n⚠️  This will migrate data from ${CONFIG.SOURCE_PROJECT_ID} to ${CONFIG.DEST_PROJECT_ID}.\n` +
        `   Are you sure you want to continue? (y/N): `
      );
      
      if (!confirmed) {
        console.log(chalk.yellow('\n✗ Migration cancelled by user.'));
        process.exit(0);
      }
    }
    
    // Migrate each collection
    for (const collectionName of collectionsToMigrate) {
      await migrateCollection(
        collectionName,
        options.mode,
        options.maxDocuments ? parseInt(options.maxDocuments, 10) : null
      );
      
      // Stop if max documents reached
      if (options.maxDocuments && stats.documentsCopied >= parseInt(options.maxDocuments, 10)) {
        console.log(chalk.yellow('\n⚠️  Reached maximum document limit. Stopping migration.'));
        break;
      }
    }
    
    stats.endTime = Date.now();
    
    // Print summary
    printSummary();
    
    // Write log file if specified
    if (options.logFile) {
      const logContent = {
        timestamp: new Date().toISOString(),
        source: CONFIG.SOURCE_PROJECT_ID,
        destination: CONFIG.DEST_PROJECT_ID,
        mode: options.mode,
        stats: stats,
      };
      
      await fs.writeFile(options.logFile, JSON.stringify(logContent, null, 2));
      console.log(chalk.green(`\n✓ Log file written to: ${options.logFile}`));
    }
    
    // Exit with error code if there were failures
    if (stats.errors.length > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red(`\n✗ Migration failed: ${error.message}`));
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup Firebase apps
    try {
      if (sourceApp) {
        await admin.app('source').delete();
      }
      if (destApp) {
        await admin.app('destination').delete();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

// Run migration if script is executed directly
if (require.main === module) {
  runMigration().catch((error) => {
    console.error(chalk.red(`\n✗ Fatal error: ${error.message}`));
    process.exit(1);
  });
}

module.exports = { runMigration, initializeFirebase };

