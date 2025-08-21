/**
 * Check Specific Event for Bulk Registration
 * This script checks why a specific event isn't showing the bulk registration button
 */

const { db } = require('./backend/firebase.js');

async function checkSpecificEvent() {
  console.log('🔍 Checking Specific Event for Bulk Registration\n');

  try {
    // Get all events and find the one you're testing
    console.log('1. Fetching all events...');
    const eventsSnapshot = await db.collection('events').get();
    
    if (eventsSnapshot.empty) {
      console.log('❌ No events found');
      return;
    }

    console.log(`✅ Found ${eventsSnapshot.size} events\n`);

    // List all events so you can identify which one you're testing
    console.log('📋 Available Events:');
    const events = [];
    eventsSnapshot.forEach(doc => {
      const eventData = doc.data();
      events.push({
        id: doc.id,
        title: eventData.title,
        status: eventData.status,
        maxAttendees: eventData.maxAttendees || 0,
        currentAttendees: eventData.currentAttendees || 0,
        allowBulkRegistrations: eventData.allowBulkRegistrations
      });
      
      console.log(`  - ${eventData.title || 'Untitled'} (${doc.id})`);
      console.log(`    Status: ${eventData.status}`);
      console.log(`    Capacity: ${eventData.currentAttendees || 0}/${eventData.maxAttendees || 'unlimited'}`);
      console.log(`    Bulk Registration: ${eventData.allowBulkRegistrations}`);
      console.log('');
    });

    // Analyze each event for bulk registration capability
    console.log('🔍 Bulk Registration Analysis:');
    events.forEach(event => {
      console.log(`\n📝 Event: ${event.title}`);
      console.log(`   ID: ${event.id}`);
      
      // Check each condition
      const isPublished = event.status === 'published';
      const isNotFull = event.maxAttendees === 0 || event.currentAttendees < event.maxAttendees;
      const hasBulkSupport = event.allowBulkRegistrations === true;
      const availableCapacity = event.maxAttendees === 0 ? 999 : event.maxAttendees - event.currentAttendees;
      const hasEnoughCapacity = availableCapacity >= 2;
      
      console.log(`   ✓ Published: ${isPublished ? '✅' : '❌'} (${event.status})`);
      console.log(`   ✓ Not Full: ${isNotFull ? '✅' : '❌'} (${event.currentAttendees}/${event.maxAttendees})`);
      console.log(`   ✓ Bulk Support: ${hasBulkSupport ? '✅' : '❌'} (${event.allowBulkRegistrations})`);
      console.log(`   ✓ Enough Capacity: ${hasEnoughCapacity ? '✅' : '❌'} (${availableCapacity} spots)`);
      
      const canShowBulkButton = isPublished && isNotFull && hasBulkSupport && hasEnoughCapacity;
      console.log(`   🎯 Can Show Bulk Button: ${canShowBulkButton ? '✅ YES' : '❌ NO'}`);
      
      if (!canShowBulkButton) {
        console.log(`   🔧 Issues to fix:`);
        if (!isPublished) console.log(`      - Event must be published (currently: ${event.status})`);
        if (!isNotFull) console.log(`      - Event is full (${event.currentAttendees}/${event.maxAttendees})`);
        if (!hasBulkSupport) console.log(`      - Enable bulk registration (currently: ${event.allowBulkRegistrations})`);
        if (!hasEnoughCapacity) console.log(`      - Need at least 2 spots (currently: ${availableCapacity})`);
      }
    });

    console.log('\n🎯 Summary:');
    const eligibleEvents = events.filter(event => {
      const isPublished = event.status === 'published';
      const isNotFull = event.maxAttendees === 0 || event.currentAttendees < event.maxAttendees;
      const hasBulkSupport = event.allowBulkRegistrations === true;
      const availableCapacity = event.maxAttendees === 0 ? 999 : event.maxAttendees - event.currentAttendees;
      const hasEnoughCapacity = availableCapacity >= 2;
      return isPublished && isNotFull && hasBulkSupport && hasEnoughCapacity;
    });
    
    console.log(`Events eligible for bulk registration: ${eligibleEvents.length}/${events.length}`);
    
    if (eligibleEvents.length > 0) {
      console.log('\n✅ Events that should show "Register Multiple" button:');
      eligibleEvents.forEach(event => {
        console.log(`  - ${event.title} (${event.id})`);
      });
    } else {
      console.log('\n❌ No events are currently eligible for bulk registration');
      console.log('Make sure your test event has:');
      console.log('  1. Status: published');
      console.log('  2. allowBulkRegistrations: true');
      console.log('  3. At least 2 available spots');
      console.log('  4. You are not already registered');
    }

  } catch (error) {
    console.error('\n❌ Check failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the check
checkSpecificEvent()
  .then(() => {
    console.log('\n🔍 Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  }); 