/**
 * Quick Bulk Registration Backend Test
 * Run with: node test-bulk-registration-quick.js
 */

const { db } = require('./backend/firebase.js');

async function quickBulkRegistrationTest() {
  console.log('🧪 Quick Bulk Registration Backend Test\n');

  try {
    // Test 1: Check if collections exist
    console.log('1. Testing collection access...');
    const bulkRegistrationsRef = db.collection('bulk_registrations');
    const ticketsRef = db.collection('tickets');
    console.log('✅ Collections accessible');

    // Test 2: Create test bulk registration
    console.log('\n2. Creating test bulk registration...');
    const testBulkRegistration = {
      eventId: 'test-event-quick',
      userId: 'test-user-quick',
      quantity: 3,
      totalAmount: 3000, // R30.00
      status: 'pending',
      attendeeDetails: [
        { name: 'Test User 1', email: 'test1@example.com', phone: '+27123456789' },
        { name: 'Test User 2', email: 'test2@example.com', phone: '+27123456790' },
        { name: 'Test User 3', email: 'test3@example.com', phone: '+27123456791' }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      testRecord: true
    };

    const bulkRegistrationRef = await bulkRegistrationsRef.add(testBulkRegistration);
    console.log(`✅ Test bulk registration created: ${bulkRegistrationRef.id}`);

    // Test 3: Create test tickets
    console.log('\n3. Creating test tickets...');
    const testTickets = [];
    
    for (let i = 0; i < 3; i++) {
      const ticketData = {
        eventId: 'test-event-quick',
        userId: 'test-user-quick',
        attendeeName: testBulkRegistration.attendeeDetails[i].name,
        attendeeEmail: testBulkRegistration.attendeeDetails[i].email,
        attendeePhone: testBulkRegistration.attendeeDetails[i].phone,
        ticketType: 'attendee',
        status: 'active',
        bulkRegistrationId: bulkRegistrationRef.id,
        attendeeIndex: i + 1,
        createdAt: new Date(),
        testRecord: true
      };

      const ticketRef = await ticketsRef.add(ticketData);
      testTickets.push(ticketRef.id);
      console.log(`✅ Test ticket ${i + 1} created: ${ticketRef.id}`);
    }

    // Test 4: Query and verify
    console.log('\n4. Querying and verifying data...');
    const bulkRegDoc = await bulkRegistrationRef.get();
    const bulkRegData = bulkRegDoc.data();
    
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
    console.log(`   - Quantity: ${bulkRegData.quantity}`);
    console.log(`   - Status: ${bulkRegData.status}`);
    console.log(`   - Tickets found: ${tickets.length}`);

    // Test 5: Cleanup
    console.log('\n5. Cleaning up test data...');
    
    // Delete test tickets
    for (const ticketId of testTickets) {
      await ticketsRef.doc(ticketId).delete();
    }
    console.log(`✅ Deleted ${testTickets.length} test tickets`);

    // Delete test bulk registration
    await bulkRegistrationRef.delete();
    console.log('✅ Deleted test bulk registration');

    console.log('\n🎉 Quick test completed successfully!');
    console.log('✅ Backend infrastructure is working correctly');
    console.log('✅ Database operations are functional');
    console.log('✅ Ready for full testing');

  } catch (error) {
    console.error('\n❌ Quick test failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run the quick test
quickBulkRegistrationTest()
  .then(() => {
    console.log('\n✨ Quick test passed - ready for full testing!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Quick test failed:', error);
    process.exit(1);
  }); 