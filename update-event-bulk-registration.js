/**
 * Update Event Bulk Registration
 * This script updates existing events to enable bulk registration
 */

const { db } = require('./backend/firebase.js');

async function updateEventBulkRegistration() {
  console.log('🔄 Updating Events to Enable Bulk Registration\n');

  try {
    // Get all events
    console.log('1. Fetching all events...');
    const eventsSnapshot = await db.collection('events').get();
    
    if (eventsSnapshot.empty) {
      console.log('❌ No events found in database');
      return;
    }

    console.log(`✅ Found ${eventsSnapshot.size} events\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Update each event
    for (const doc of eventsSnapshot.docs) {
      const eventData = doc.data();
      const eventId = doc.id;
      
      console.log(`Event: ${eventData.title || 'Untitled'} (${eventId})`);
      
      if (eventData.allowBulkRegistrations === true) {
        console.log('  ✅ Already has bulk registration enabled');
        skippedCount++;
      } else {
        console.log('  🔄 Updating to enable bulk registration...');
        
        try {
          await db.collection('events').doc(eventId).update({
            allowBulkRegistrations: true,
            updatedAt: new Date()
          });
          
          console.log('  ✅ Successfully updated');
          updatedCount++;
        } catch (error) {
          console.log(`  ❌ Failed to update: ${error.message}`);
        }
      }
      console.log('');
    }

    console.log('📊 Update Summary:');
    console.log(`  - Events updated: ${updatedCount}`);
    console.log(`  - Events skipped (already enabled): ${skippedCount}`);
    console.log(`  - Total events: ${eventsSnapshot.size}`);

    if (updatedCount > 0) {
      console.log('\n🎉 Successfully enabled bulk registration for events!');
      console.log('You should now see the "Register Multiple" button on these events.');
    } else {
      console.log('\nℹ️ No events needed updating.');
    }

  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the update
updateEventBulkRegistration()
  .then(() => {
    console.log('\n🔄 Update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Update failed:', error);
    process.exit(1);
  }); 