/**
 * Script to create sample recurring and non-recurring events with registrations
 * This helps test the recurring events functionality
 */

const admin = require('firebase-admin');
const { db } = require('../firebase');
const moment = require('moment-timezone');

async function createSampleData() {
  console.log('========================================');
  console.log('Creating Sample Events & Registrations');
  console.log('========================================\n');

  try {
    // Get a sample user ID (you can modify this)
    // For testing, we'll create events with a placeholder organizer
    const sampleOrganizerId = 'sample_organizer_123';
    
    // Sample organizer info
    const organizerInfo = {
      name: 'Test Organizer',
      email: 'organizer@example.com',
      profileImage: null,
      company: 'Test Company'
    };

    // ========================================
    // 1. Create Non-Recurring Event
    // ========================================
    console.log('Creating non-recurring event...');
    
    const nonRecurringEvent = {
      id: db.collection('events').doc().id,
      organizerId: sampleOrganizerId,
      title: 'One-Time Tech Meetup',
      description: 'A single technology meetup event for networking and learning.',
      eventDate: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week from now
      ),
      endDate: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000) // +3 hours
      ),
      category: 'tech',
      eventType: 'free',
      ticketPrice: 0,
      maxAttendees: 50,
      currentAttendees: 0,
      attendeesList: [],
      status: 'published',
      visibility: 'public',
      location: {
        venue: 'Tech Hub Conference Room',
        address: '123 Innovation Street',
        city: 'Cape Town',
        country: 'South Africa'
      },
      tags: ['technology', 'networking', 'meetup'],
      allowBulkRegistrations: false,
      images: [],
      bannerImage: null,
      organizerInfo: organizerInfo,
      listingFee: null,
      creditApplied: null,
      paymentReference: null,
      // New recurring events fields
      isRecurring: false,
      recurrencePattern: null,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      publishedAt: admin.firestore.Timestamp.now()
    };

    await db.collection('events').doc(nonRecurringEvent.id).set(nonRecurringEvent);
    console.log(`✓ Created non-recurring event: ${nonRecurringEvent.title} (ID: ${nonRecurringEvent.id})\n`);

    // ========================================
    // 2. Create Recurring Event (Weekly)
    // ========================================
    console.log('Creating recurring event...');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Start tomorrow
    startDate.setHours(10, 0, 0, 0); // 10:00 AM
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90); // End 90 days from now
    
    const recurringEvent = {
      id: db.collection('events').doc().id,
      organizerId: sampleOrganizerId,
      title: 'Weekly Yoga Class',
      description: 'Join us every Monday for a relaxing yoga session. All skill levels welcome!',
      // Use startDate for eventDate (first occurrence)
      eventDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(
        new Date(startDate.getTime() + 2 * 60 * 60 * 1000) // +2 hours for first occurrence
      ),
      category: 'health',
      eventType: 'free',
      ticketPrice: 0,
      maxAttendees: 30,
      currentAttendees: 0,
      attendeesList: [],
      status: 'published',
      visibility: 'public',
      location: {
        venue: 'Community Center - Room A',
        address: '456 Wellness Avenue',
        city: 'Johannesburg',
        country: 'South Africa'
      },
      tags: ['yoga', 'wellness', 'fitness', 'weekly'],
      allowBulkRegistrations: false,
      images: [],
      bannerImage: null,
      organizerInfo: organizerInfo,
      listingFee: null,
      creditApplied: null,
      paymentReference: null,
      // New recurring events fields
      isRecurring: true,
      recurrencePattern: {
        type: 'weekly',
        daysOfWeek: [1], // Monday (0=Sunday, 1=Monday, etc.)
        timezone: 'Africa/Johannesburg',
        startDate: startDate.toISOString().split('T')[0], // YYYY-MM-DD
        startTime: '10:00', // 24-hour format
        endDate: endDate.toISOString().split('T')[0], // YYYY-MM-DD
        excludedDates: [] // No excluded dates initially
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      publishedAt: admin.firestore.Timestamp.now()
    };

    await db.collection('events').doc(recurringEvent.id).set(recurringEvent);
    console.log(`✓ Created recurring event: ${recurringEvent.title} (ID: ${recurringEvent.id})`);
    console.log(`  Pattern: Every Monday at 10:00 AM SAST`);
    console.log(`  Series runs until: ${endDate.toISOString().split('T')[0]}\n`);

    // ========================================
    // 3. Create Another Recurring Event (Multiple Days)
    // ========================================
    console.log('Creating multi-day recurring event...');
    
    const startDate2 = new Date();
    startDate2.setDate(startDate2.getDate() + 3); // Start in 3 days (Thursday)
    startDate2.setHours(18, 0, 0, 0); // 6:00 PM
    
    const endDate2 = new Date();
    endDate2.setDate(endDate2.getDate() + 60); // End 60 days from now
    
    const recurringEvent2 = {
      id: db.collection('events').doc().id,
      organizerId: sampleOrganizerId,
      title: 'Tech Workshops - Mon/Wed/Fri',
      description: 'Weekly tech workshops covering various programming topics. Join us Mondays, Wednesdays, and Fridays!',
      eventDate: admin.firestore.Timestamp.fromDate(startDate2),
      endDate: admin.firestore.Timestamp.fromDate(
        new Date(startDate2.getTime() + 2 * 60 * 60 * 1000) // +2 hours
      ),
      category: 'tech',
      eventType: 'paid',
      ticketPrice: 500, // R5.00
      maxAttendees: 20,
      currentAttendees: 0,
      attendeesList: [],
      status: 'published',
      visibility: 'public',
      location: {
        venue: 'Code Academy',
        address: '789 Developer Road',
        city: 'Cape Town',
        country: 'South Africa'
      },
      tags: ['programming', 'workshop', 'learning', 'coding'],
      allowBulkRegistrations: false,
      images: [],
      bannerImage: null,
      organizerInfo: organizerInfo,
      listingFee: null,
      creditApplied: null,
      paymentReference: null,
      isRecurring: true,
      recurrencePattern: {
        type: 'weekly',
        daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
        timezone: 'Africa/Johannesburg',
        startDate: startDate2.toISOString().split('T')[0],
        startTime: '18:00',
        endDate: endDate2.toISOString().split('T')[0],
        excludedDates: []
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      publishedAt: admin.firestore.Timestamp.now()
    };

    await db.collection('events').doc(recurringEvent2.id).set(recurringEvent2);
    console.log(`✓ Created recurring event: ${recurringEvent2.title} (ID: ${recurringEvent2.id})`);
    console.log(`  Pattern: Every Monday, Wednesday, Friday at 6:00 PM SAST`);
    console.log(`  Ticket Price: R${recurringEvent2.ticketPrice / 100}`);
    console.log(`  Series runs until: ${endDate2.toISOString().split('T')[0]}\n`);

    // ========================================
    // 4. Create Sample Registrations
    // ========================================
    console.log('Creating sample registrations...');

    // Generate some sample user IDs
    const sampleUserIds = [
      'sample_user_001',
      'sample_user_002',
      'sample_user_003'
    ];

    const sampleUsers = [
      { name: 'Alice Johnson', email: 'alice@example.com', phone: '+27123456789' },
      { name: 'Bob Smith', email: 'bob@example.com', phone: '+27987654321' },
      { name: 'Carol Williams', email: 'carol@example.com', phone: '+27555112233' }
    ];

    // Registration 1: Non-recurring event
    console.log('  Creating registration for non-recurring event...');
    const reg1Id = db.collection('event_registrations').doc().id;
    const ticket1Id = db.collection('tickets').doc().id;
    
    const registration1 = {
      id: reg1Id,
      eventId: nonRecurringEvent.id,
      instanceId: null, // Null for non-recurring events
      userId: sampleUserIds[0],
      userInfo: sampleUsers[0],
      status: 'confirmed',
      registeredAt: admin.firestore.Timestamp.now(),
      specialRequests: 'Vegetarian meal option please',
      ticketId: ticket1Id,
      paymentReference: null
    };

    await db.collection('event_registrations').doc(reg1Id).set(registration1);
    await db.collection('tickets').doc(ticket1Id).set({
      id: ticket1Id,
      eventId: nonRecurringEvent.id,
      userId: sampleUserIds[0],
      userInfo: sampleUsers[0],
      status: 'active',
      createdAt: admin.firestore.Timestamp.now(),
      ticketType: 'free',
      ticketPrice: 0,
      checkedIn: false,
      qrGenerated: false
    });
    
    // Update event attendee count
    await db.collection('events').doc(nonRecurringEvent.id).update({
      currentAttendees: admin.firestore.FieldValue.increment(1),
      attendeesList: admin.firestore.FieldValue.arrayUnion(sampleUserIds[0])
    });
    
    console.log(`    ✓ ${sampleUsers[0].name} registered for non-recurring event`);

    // Registration 2: Recurring event - First instance
    console.log('  Creating registrations for recurring event (first instance)...');
    const firstInstanceDate = new Date(startDate);
    const instanceId1 = `${recurringEvent.id}_${firstInstanceDate.toISOString().split('T')[0]}`;
    
    const reg2Id = db.collection('event_registrations').doc().id;
    const ticket2Id = db.collection('tickets').doc().id;
    
    const registration2 = {
      id: reg2Id,
      eventId: recurringEvent.id,
      instanceId: instanceId1, // Format: "eventId_YYYY-MM-DD"
      userId: sampleUserIds[0],
      userInfo: sampleUsers[0],
      status: 'confirmed',
      registeredAt: admin.firestore.Timestamp.now(),
      specialRequests: null,
      ticketId: ticket2Id,
      paymentReference: null
    };

    await db.collection('event_registrations').doc(reg2Id).set(registration2);
    await db.collection('tickets').doc(ticket2Id).set({
      id: ticket2Id,
      eventId: recurringEvent.id,
      userId: sampleUserIds[0],
      userInfo: sampleUsers[0],
      status: 'active',
      createdAt: admin.firestore.Timestamp.now(),
      ticketType: 'free',
      ticketPrice: 0,
      checkedIn: false,
      qrGenerated: false
    });
    
    console.log(`    ✓ ${sampleUsers[0].name} registered for instance: ${instanceId1}`);

    // Registration 3: Recurring event - Second instance (next Monday)
    const secondInstanceDate = new Date(startDate);
    secondInstanceDate.setDate(secondInstanceDate.getDate() + 7); // Next Monday
    const instanceId2 = `${recurringEvent.id}_${secondInstanceDate.toISOString().split('T')[0]}`;
    
    const reg3Id = db.collection('event_registrations').doc().id;
    const ticket3Id = db.collection('tickets').doc().id;
    
    const registration3 = {
      id: reg3Id,
      eventId: recurringEvent.id,
      instanceId: instanceId2,
      userId: sampleUserIds[1],
      userInfo: sampleUsers[1],
      status: 'confirmed',
      registeredAt: admin.firestore.Timestamp.now(),
      specialRequests: null,
      ticketId: ticket3Id,
      paymentReference: null
    };

    await db.collection('event_registrations').doc(reg3Id).set(registration3);
    await db.collection('tickets').doc(ticket3Id).set({
      id: ticket3Id,
      eventId: recurringEvent.id,
      userId: sampleUserIds[1],
      userInfo: sampleUsers[1],
      status: 'active',
      createdAt: admin.firestore.Timestamp.now(),
      ticketType: 'free',
      ticketPrice: 0,
      checkedIn: false,
      qrGenerated: false
    });
    
    console.log(`    ✓ ${sampleUsers[1].name} registered for instance: ${instanceId2}`);

    // Registration 4: Recurring event - Third instance (same as second, different user)
    const reg4Id = db.collection('event_registrations').doc().id;
    const ticket4Id = db.collection('tickets').doc().id;
    
    const registration4 = {
      id: reg4Id,
      eventId: recurringEvent.id,
      instanceId: instanceId2, // Same instance as registration 3
      userId: sampleUserIds[2],
      userInfo: sampleUsers[2],
      status: 'confirmed',
      registeredAt: admin.firestore.Timestamp.now(),
      specialRequests: 'Bringing a friend',
      ticketId: ticket4Id,
      paymentReference: null
    };

    await db.collection('event_registrations').doc(reg4Id).set(registration4);
    await db.collection('tickets').doc(ticket4Id).set({
      id: ticket4Id,
      eventId: recurringEvent.id,
      userId: sampleUserIds[2],
      userInfo: sampleUsers[2],
      status: 'active',
      createdAt: admin.firestore.Timestamp.now(),
      ticketType: 'free',
      ticketPrice: 0,
      checkedIn: false,
      qrGenerated: false
    });
    
    console.log(`    ✓ ${sampleUsers[2].name} registered for instance: ${instanceId2}`);

    // Registration 5: Paid recurring event (pending payment)
    const thirdInstanceDate = new Date(startDate2);
    // Find next Monday (day 1)
    while (thirdInstanceDate.getDay() !== 1) {
      thirdInstanceDate.setDate(thirdInstanceDate.getDate() + 1);
    }
    const instanceId3 = `${recurringEvent2.id}_${thirdInstanceDate.toISOString().split('T')[0]}`;
    
    const reg5Id = db.collection('event_registrations').doc().id;
    const ticket5Id = db.collection('tickets').doc().id;
    
    const registration5 = {
      id: reg5Id,
      eventId: recurringEvent2.id,
      instanceId: instanceId3,
      userId: sampleUserIds[0],
      userInfo: sampleUsers[0],
      status: 'pending_payment',
      registeredAt: admin.firestore.Timestamp.now(),
      specialRequests: null,
      ticketId: ticket5Id,
      paymentReference: `test_payment_ref_${Date.now()}`
    };

    await db.collection('event_registrations').doc(reg5Id).set(registration5);
    await db.collection('tickets').doc(ticket5Id).set({
      id: ticket5Id,
      eventId: recurringEvent2.id,
      userId: sampleUserIds[0],
      userInfo: sampleUsers[0],
      status: 'pending_payment',
      createdAt: admin.firestore.Timestamp.now(),
      ticketType: 'paid',
      ticketPrice: recurringEvent2.ticketPrice,
      checkedIn: false,
      qrGenerated: false
    });
    
    console.log(`    ✓ ${sampleUsers[0].name} registered (pending payment) for paid event instance: ${instanceId3}`);

    console.log('\n✓ All sample data created successfully!\n');

    // Summary
    console.log('========================================');
    console.log('Sample Data Summary');
    console.log('========================================');
    console.log('Events Created:');
    console.log(`  1. Non-Recurring: "${nonRecurringEvent.title}" (ID: ${nonRecurringEvent.id})`);
    console.log(`  2. Recurring (Weekly): "${recurringEvent.title}" (ID: ${recurringEvent.id})`);
    console.log(`  3. Recurring (Multi-Day): "${recurringEvent2.title}" (ID: ${recurringEvent2.id})`);
    console.log('\nRegistrations Created: 5');
    console.log('  - 1 for non-recurring event');
    console.log('  - 3 for recurring yoga class');
    console.log('  - 1 for paid recurring tech workshop');
    console.log('\nInstance IDs Format:');
    console.log(`  - Example: ${instanceId1}`);
    console.log(`  - Format: "eventId_YYYY-MM-DD"`);
    console.log('\n✓ You can now test the recurring events functionality!\n');

  } catch (error) {
    console.error('Error creating sample data:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  createSampleData()
    .then(() => {
      console.log('Sample data creation finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sample data creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createSampleData };

