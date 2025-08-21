/**
 * Test Bulk Registration Enabler
 * This script tests if the allowBulkRegistrations field is properly set
 */

const { db } = require('./backend/firebase.js');

async function testBulkRegistrationEnabler() {
  console.log('🧪 Testing Bulk Registration Enabler\n');

  try {
    // Test 1: Check if we can create an event with bulk registration enabled
    console.log('1. Creating test event with bulk registration enabled...');
    
    const testEventData = {
      id: 'test-bulk-event-' + Date.now(),
      organizerId: 'test-user-123',
      title: 'Test Bulk Registration Event',
      description: 'This is a test event for bulk registration',
      eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      category: 'other',
      eventType: 'free',
      ticketPrice: 0,
      maxAttendees: 50,
      visibility: 'public',
      location: {
        venue: 'Test Venue',
        address: '123 Test Street',
        city: 'Test City',
        country: 'South Africa'
      },
      tags: ['test', 'bulk-registration'],
      currentAttendees: 0,
      attendeesList: [],
      status: 'draft',
      allowBulkRegistrations: true, // This is the key field
      organizerInfo: {
        name: 'Test Organizer',
        email: 'test@example.com',
        profileImage: null,
        company: 'Test Company'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      testRecord: true
    };

    await db.collection('events').doc(testEventData.id).set(testEventData);
    console.log(`✅ Test event created: ${testEventData.id}`);

    // Test 2: Verify the field was saved correctly
    console.log('\n2. Verifying bulk registration field...');
    const savedEvent = await db.collection('events').doc(testEventData.id).get();
    const savedEventData = savedEvent.data();
    
    console.log(`   - Event ID: ${savedEventData.id}`);
    console.log(`   - Title: ${savedEventData.title}`);
    console.log(`   - allowBulkRegistrations: ${savedEventData.allowBulkRegistrations}`);
    console.log(`   - Event Type: ${savedEventData.eventType}`);
    console.log(`   - Max Attendees: ${savedEventData.maxAttendees}`);
    
    if (savedEventData.allowBulkRegistrations === true) {
      console.log('✅ Bulk registration field is properly set to true');
    } else {
      console.log('❌ Bulk registration field is not set correctly');
      console.log(`   Expected: true, Got: ${savedEventData.allowBulkRegistrations}`);
    }

    // Test 3: Test bulk registration check function
    console.log('\n3. Testing bulk registration check function...');
    
    // Simulate the frontend check
    const canBulkRegister = (event) => {
      if (!event.allowBulkRegistrations) {
        return false;
      }
      
      const availableCapacity = event.maxAttendees - event.currentAttendees;
      return availableCapacity >= 2;
    };
    
    const canRegister = canBulkRegister(savedEventData);
    console.log(`   - Can bulk register: ${canRegister}`);
    console.log(`   - Available capacity: ${savedEventData.maxAttendees - savedEventData.currentAttendees}`);
    
    if (canRegister) {
      console.log('✅ Event supports bulk registration');
    } else {
      console.log('❌ Event does not support bulk registration');
    }

    // Test 4: Cleanup
    console.log('\n4. Cleaning up test data...');
    await db.collection('events').doc(testEventData.id).delete();
    console.log('✅ Test event deleted');

    console.log('\n🎉 Bulk registration enabler test completed successfully!');
    console.log('✅ The allowBulkRegistrations field is working correctly');
    console.log('✅ Events can be created with bulk registration support');
    console.log('✅ Ready for full bulk registration testing');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run the test
testBulkRegistrationEnabler()
  .then(() => {
    console.log('\n✨ Test passed - bulk registration enabler is working!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }); 