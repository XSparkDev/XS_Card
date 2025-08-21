/**
 * Debug Event Bulk Registration
 * This script helps debug why bulk registration isn't showing up
 */

const { db } = require('./backend/firebase.js');

async function debugEventBulkRegistration() {
  console.log('🔍 Debugging Event Bulk Registration\n');

  try {
    // Get all events to check their bulk registration status
    console.log('1. Checking all events for bulk registration support...');
    const eventsSnapshot = await db.collection('events').get();
    
    if (eventsSnapshot.empty) {
      console.log('❌ No events found in database');
      return;
    }

    console.log(`✅ Found ${eventsSnapshot.size} events\n`);

    let eventsWithBulkSupport = 0;
    let eventsWithoutBulkSupport = 0;

    eventsSnapshot.forEach(doc => {
      const eventData = doc.data();
      const hasBulkSupport = eventData.allowBulkRegistrations === true;
      
      console.log(`Event: ${eventData.title || 'Untitled'}`);
      console.log(`  - ID: ${doc.id}`);
      console.log(`  - allowBulkRegistrations: ${eventData.allowBulkRegistrations}`);
      console.log(`  - Event Type: ${eventData.eventType}`);
      console.log(`  - Capacity: ${eventData.maxAttendees || eventData.capacity || 'unlimited'}`);
      console.log(`  - Current Attendees: ${eventData.currentAttendees || 0}`);
      console.log(`  - Status: ${eventData.status}`);
      
      // Check if bulk registration would be available
      const availableCapacity = (eventData.maxAttendees || eventData.capacity || 0) - (eventData.currentAttendees || 0);
      const canBulkRegister = hasBulkSupport && availableCapacity >= 2;
      
      console.log(`  - Available Capacity: ${availableCapacity}`);
      console.log(`  - Can Bulk Register: ${canBulkRegister ? '✅ YES' : '❌ NO'}`);
      console.log('');

      if (hasBulkSupport) {
        eventsWithBulkSupport++;
      } else {
        eventsWithoutBulkSupport++;
      }
    });

    console.log('📊 Summary:');
    console.log(`  - Events with bulk support: ${eventsWithBulkSupport}`);
    console.log(`  - Events without bulk support: ${eventsWithoutBulkSupport}`);
    console.log(`  - Total events: ${eventsSnapshot.size}`);

    if (eventsWithBulkSupport === 0) {
      console.log('\n❌ No events have bulk registration enabled!');
      console.log('This means:');
      console.log('  1. Events were created before the bulk registration feature was added');
      console.log('  2. The allowBulkRegistrations field is not being set properly');
      console.log('  3. You need to create a new event with bulk registration enabled');
    } else {
      console.log('\n✅ Some events have bulk registration enabled');
      console.log('If you\'re not seeing the "Register Multiple" button:');
      console.log('  1. Check if the event has sufficient capacity (>= 2 spots)');
      console.log('  2. Verify the event status is "published"');
      console.log('  3. Make sure you\'re looking at the right event');
    }

  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the debug
debugEventBulkRegistration()
  .then(() => {
    console.log('\n🔍 Debug complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Debug failed:', error);
    process.exit(1);
  }); 