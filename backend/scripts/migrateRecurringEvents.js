/**
 * Migration Script: Add Recurring Events Support
 * 
 * This script adds the necessary fields to existing events and registrations
 * to support recurring events functionality.
 * 
 * IDEMPOTENT: Safe to run multiple times
 */

const admin = require('firebase-admin');

// Try to load Firebase, but handle gracefully if credentials are missing
let db;
try {
  const firebaseModule = require('../firebase');
  db = firebaseModule.db;
  
  // Check if db is actually functional
  if (!db || typeof db.collection !== 'function') {
    throw new Error('Firestore not properly initialized');
  }
} catch (error) {
  console.error('⚠️  Firebase initialization error:', error.message);
  console.error('\nThe migration script requires Firebase credentials to run.');
  console.error('Please ensure you have:');
  console.error('  1. Firebase service account credentials in your .env file');
  console.error('  2. Or a valid firebase service account JSON file');
  console.error('\nFor dry-run mode with missing credentials, the script cannot');
  console.error('preview changes, but you can see the required indexes below.\n');
}

async function migrateRecurringEvents(dryRun = false) {
  console.log('========================================');
  console.log('Starting Recurring Events Migration');
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
  }
  console.log('========================================\n');

  // Check if Firebase is available
  if (!db || typeof db.collection !== 'function') {
    console.log('⚠️  Firebase not available - showing index requirements only\n');
    showIndexRequirements();
    console.log('\n⚠️  To run the migration, ensure Firebase credentials are configured.');
    console.log('   Then run: node scripts/migrateRecurringEvents.js\n');
    return;
  }

  let eventsUpdated = 0;
  let registrationsUpdated = 0;
  let eventsToUpdate = 0;
  let registrationsToUpdate = 0;
  let errors = 0;

  try {
    // Step 1: Migrate Events Collection
    console.log('Step 1: Migrating events collection...');
    
    const eventsSnapshot = await db.collection('events').get();
    console.log(`Found ${eventsSnapshot.size} events to check`);

    const eventBatch = db.batch();
    let eventBatchCount = 0;
    const eventsNeedingUpdate = [];

    for (const doc of eventsSnapshot.docs) {
      const eventData = doc.data();
      
      // Only update if isRecurring field doesn't exist
      if (eventData.isRecurring === undefined) {
        eventsNeedingUpdate.push({
          id: doc.id,
          title: eventData.title || 'Untitled'
        });
        
        if (!dryRun) {
          eventBatch.update(doc.ref, {
            isRecurring: false,
            recurrencePattern: null
          });
          eventBatchCount++;
          eventsUpdated++;

          // Firestore batch limit is 500 operations
          if (eventBatchCount >= 500) {
            await eventBatch.commit();
            console.log(`  Committed batch of ${eventBatchCount} event updates`);
            eventBatchCount = 0;
          }
        } else {
          eventsToUpdate++;
        }
      }
    }

    if (!dryRun && eventBatchCount > 0) {
      await eventBatch.commit();
      console.log(`  Committed final batch of ${eventBatchCount} event updates`);
    }

    if (dryRun) {
      console.log(`  Would update ${eventsToUpdate} events:`);
      if (eventsNeedingUpdate.length > 0 && eventsNeedingUpdate.length <= 20) {
        eventsNeedingUpdate.forEach(evt => {
          console.log(`    - ${evt.title} (ID: ${evt.id})`);
        });
      } else if (eventsNeedingUpdate.length > 20) {
        eventsNeedingUpdate.slice(0, 20).forEach(evt => {
          console.log(`    - ${evt.title} (ID: ${evt.id})`);
        });
        console.log(`    ... and ${eventsNeedingUpdate.length - 20} more`);
      }
      console.log(`✓ Events migration preview: ${eventsToUpdate} events would be updated\n`);
    } else {
      console.log(`✓ Events migration complete: ${eventsUpdated} events updated\n`);
    }

    // Step 2: Migrate Event Registrations Collection
    console.log('Step 2: Migrating event_registrations collection...');
    
    const registrationsSnapshot = await db.collection('event_registrations').get();
    console.log(`Found ${registrationsSnapshot.size} registrations to check`);

    const regBatch = db.batch();
    let regBatchCount = 0;

    for (const doc of registrationsSnapshot.docs) {
      const regData = doc.data();
      
      // Only update if instanceId field doesn't exist
      if (regData.instanceId === undefined) {
        if (!dryRun) {
          regBatch.update(doc.ref, {
            instanceId: null
          });
          regBatchCount++;
          registrationsUpdated++;

          // Firestore batch limit is 500 operations
          if (regBatchCount >= 500) {
            await regBatch.commit();
            console.log(`  Committed batch of ${regBatchCount} registration updates`);
            regBatchCount = 0;
          }
        } else {
          registrationsToUpdate++;
        }
      }
    }

    if (!dryRun && regBatchCount > 0) {
      await regBatch.commit();
      console.log(`  Committed final batch of ${regBatchCount} registration updates`);
    }

    if (dryRun) {
      console.log(`✓ Registrations migration preview: ${registrationsToUpdate} registrations would be updated\n`);
    } else {
      console.log(`✓ Registrations migration complete: ${registrationsUpdated} registrations updated\n`);
    }

    // Step 3: Display Index Requirements
    showIndexRequirements();

    // Summary
    console.log('Migration Summary');
    console.log('=================');
    if (dryRun) {
      console.log(`Events that would be updated: ${eventsToUpdate}`);
      console.log(`Registrations that would be updated: ${registrationsToUpdate}`);
      console.log(`Errors: ${errors}`);
      console.log('\n⚠️  DRY RUN COMPLETE - No changes were made');
      console.log('\nTo perform the actual migration, run:');
      console.log('   node scripts/migrateRecurringEvents.js');
      console.log('\nOr to force dry-run mode again:');
      console.log('   node scripts/migrateRecurringEvents.js --dry-run\n');
    } else {
      console.log(`Events updated: ${eventsUpdated}`);
      console.log(`Registrations updated: ${registrationsUpdated}`);
      console.log(`Errors: ${errors}`);
      console.log('\n✓ Migration completed successfully!');
    }
    console.log('\n⚠️  IMPORTANT: Create the Firestore indexes shown above');
    console.log('   before using recurring events functionality.\n');

  } catch (error) {
    console.error('Migration failed:', error);
    errors++;
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  // Check for dry-run flag
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
  
  migrateRecurringEvents(dryRun)
    .then(() => {
      console.log('Migration script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

/**
 * Display Firestore index requirements
 */
function showIndexRequirements() {
  console.log('Step 3: Required Firestore Indexes');
  console.log('=====================================');
  console.log('Please create the following composite indexes in Firestore Console:\n');
  console.log('Collection: events');
  console.log('  Index 1: [isRecurring (Ascending), eventDate (Ascending)]');
  console.log('  Index 2: [status (Ascending), isRecurring (Ascending), eventDate (Ascending)]');
  console.log('\nCollection: event_registrations');
  console.log('  Index 3: [instanceId (Ascending), status (Ascending)] ← CRITICAL for attendee counts');
  console.log('\nOr add to firestore.indexes.json:\n');
  
  const indexConfig = {
    indexes: [
      {
        collectionGroup: "events",
        queryScope: "COLLECTION",
        fields: [
          { fieldPath: "isRecurring", order: "ASCENDING" },
          { fieldPath: "eventDate", order: "ASCENDING" }
        ]
      },
      {
        collectionGroup: "events",
        queryScope: "COLLECTION",
        fields: [
          { fieldPath: "status", order: "ASCENDING" },
          { fieldPath: "isRecurring", order: "ASCENDING" },
          { fieldPath: "eventDate", order: "ASCENDING" }
        ]
      },
      {
        collectionGroup: "event_registrations",
        queryScope: "COLLECTION",
        fields: [
          { fieldPath: "instanceId", order: "ASCENDING" },
          { fieldPath: "status", order: "ASCENDING" }
        ]
      }
    ]
  };
  
  console.log(JSON.stringify(indexConfig, null, 2));
  console.log('\n=====================================\n');
}

module.exports = { migrateRecurringEvents };

