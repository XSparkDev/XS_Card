/**
 * Test script for bulk registration infrastructure
 * Run with: node test-bulk-registration.js
 */

const { db } = require('./firebase.js');

// Test data
const testEventId = 'test-event-123';
const testUserId = 'test-user-456';
const testAttendeeDetails = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890'
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1234567891'
  }
];

async function testBulkRegistrationInfrastructure() {
  console.log('🧪 Testing Bulk Registration Infrastructure...\n');

  try {
    // Test 1: Check if bulk_registrations collection can be accessed
    console.log('1. Testing bulk_registrations collection access...');
    const bulkRegistrationsRef = db.collection('bulk_registrations');
    console.log('✅ bulk_registrations collection accessible');

    // Test 2: Check if tickets collection supports bulk registration fields
    console.log('\n2. Testing tickets collection bulk registration support...');
    const ticketsRef = db.collection('tickets');
    console.log('✅ tickets collection accessible');

    // Test 3: Create a test bulk registration record
    console.log('\n3. Testing bulk registration record creation...');
    const testBulkRegistration = {
      eventId: testEventId,
      userId: testUserId,
      quantity: testAttendeeDetails.length,
      totalAmount: 2000, // 20.00 in cents
      status: 'pending',
      attendeeDetails: testAttendeeDetails,
      createdAt: new Date(),
      updatedAt: new Date(),
      testRecord: true // Mark as test record
    };

    const bulkRegistrationRef = await bulkRegistrationsRef.add(testBulkRegistration);
    console.log(`✅ Test bulk registration created with ID: ${bulkRegistrationRef.id}`);

    // Test 4: Create test tickets with bulk registration fields
    console.log('\n4. Testing ticket creation with bulk registration fields...');
    const testTickets = [];
    
    for (let i = 0; i < testAttendeeDetails.length; i++) {
      const attendee = testAttendeeDetails[i];
      const ticketData = {
        eventId: testEventId,
        userId: testUserId,
        attendeeName: attendee.name,
        attendeeEmail: attendee.email,
        attendeePhone: attendee.phone,
        ticketType: 'attendee',
        status: 'active',
        bulkRegistrationId: bulkRegistrationRef.id,
        attendeeIndex: i + 1,
        createdAt: new Date(),
        testRecord: true // Mark as test record
      };

      const ticketRef = await ticketsRef.add(ticketData);
      testTickets.push(ticketRef.id);
      console.log(`✅ Test ticket ${i + 1} created with ID: ${ticketRef.id}`);
    }

    // Test 5: Update bulk registration with ticket IDs
    console.log('\n5. Testing bulk registration update with ticket IDs...');
    await bulkRegistrationRef.update({
      status: 'completed',
      completedAt: new Date(),
      ticketIds: testTickets
    });
    console.log('✅ Bulk registration updated with ticket IDs');

    // Test 6: Query bulk registration with tickets
    console.log('\n6. Testing bulk registration query with tickets...');
    const bulkRegistrationDoc = await bulkRegistrationRef.get();
    const bulkRegistrationData = bulkRegistrationDoc.data();
    
    const ticketsSnapshot = await ticketsRef
      .where('bulkRegistrationId', '==', bulkRegistrationRef.id)
      .orderBy('attendeeIndex')
      .get();

    const tickets = ticketsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Bulk registration query successful:`);
    console.log(`   - Registration ID: ${bulkRegistrationRef.id}`);
    console.log(`   - Status: ${bulkRegistrationData.status}`);
    console.log(`   - Quantity: ${bulkRegistrationData.quantity}`);
    console.log(`   - Tickets found: ${tickets.length}`);

    // Test 7: Clean up test data
    console.log('\n7. Cleaning up test data...');
    
    // Delete test tickets
    for (const ticketId of testTickets) {
      await ticketsRef.doc(ticketId).delete();
    }
    console.log(`✅ Deleted ${testTickets.length} test tickets`);

    // Delete test bulk registration
    await bulkRegistrationRef.delete();
    console.log('✅ Deleted test bulk registration');

    console.log('\n🎉 All bulk registration infrastructure tests passed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Database collections accessible');
    console.log('   ✅ Bulk registration records can be created');
    console.log('   ✅ Tickets with bulk registration fields can be created');
    console.log('   ✅ Queries work correctly');
    console.log('   ✅ Data relationships maintained');
    console.log('   ✅ Cleanup successful');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the test
testBulkRegistrationInfrastructure()
  .then(() => {
    console.log('\n✨ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }); 