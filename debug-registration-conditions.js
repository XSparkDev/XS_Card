/**
 * Debug Registration Conditions
 * This script helps debug why the "Register Multiple" button isn't showing
 */

console.log('🔍 Debugging Registration Conditions\n');

// Simulate the conditions from EventDetailsScreen
const debugRegistrationConditions = (event, userRegistration) => {
  console.log(`Event: ${event.title}`);
  console.log(`Event ID: ${event.id}`);
  console.log('');

  // Check each condition
  console.log('1. Checking userRegistration condition:');
  console.log(`   - userRegistration: ${userRegistration}`);
  console.log(`   - !userRegistration: ${!userRegistration}`);
  console.log(`   - Result: ${!userRegistration ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  console.log('2. Checking isEventFull condition:');
  const isEventFull = event.maxAttendees !== -1 && event.currentAttendees >= event.maxAttendees;
  console.log(`   - maxAttendees: ${event.maxAttendees}`);
  console.log(`   - currentAttendees: ${event.currentAttendees}`);
  console.log(`   - isEventFull: ${isEventFull}`);
  console.log(`   - !isEventFull: ${!isEventFull}`);
  console.log(`   - Result: ${!isEventFull ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  console.log('3. Checking event status condition:');
  console.log(`   - event.status: ${event.status}`);
  console.log(`   - event.status === 'published': ${event.status === 'published'}`);
  console.log(`   - Result: ${event.status === 'published' ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  // Final canRegister calculation
  const canRegister = !userRegistration && !isEventFull && event.status === 'published';
  console.log('4. Final canRegister calculation:');
  console.log(`   - canRegister = !userRegistration && !isEventFull && event.status === 'published'`);
  console.log(`   - canRegister = ${!userRegistration} && ${!isEventFull} && ${event.status === 'published'}`);
  console.log(`   - canRegister = ${canRegister}`);
  console.log(`   - Result: ${canRegister ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  // Check bulk registration specifically
  console.log('5. Checking bulk registration conditions:');
  const allowBulkRegistrations = event.allowBulkRegistrations === true;
  const availableCapacity = Math.max(0, (event.maxAttendees || 0) - (event.currentAttendees || 0));
  const hasEnoughCapacity = availableCapacity >= 2;
  
  console.log(`   - allowBulkRegistrations: ${event.allowBulkRegistrations}`);
  console.log(`   - availableCapacity: ${availableCapacity}`);
  console.log(`   - hasEnoughCapacity (>= 2): ${hasEnoughCapacity}`);
  
  const canBulkRegister = canRegister && allowBulkRegistrations && hasEnoughCapacity;
  console.log(`   - canBulkRegister: ${canBulkRegister}`);
  console.log(`   - Result: ${canBulkRegister ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  return {
    canRegister,
    canBulkRegister,
    conditions: {
      noUserRegistration: !userRegistration,
      notEventFull: !isEventFull,
      isPublished: event.status === 'published',
      allowBulkRegistrations,
      hasEnoughCapacity
    }
  };
};

// Test scenarios
console.log('🧪 Testing different scenarios:\n');

console.log('=== Scenario 1: Perfect conditions ===');
const event1 = {
  id: 'test-1',
  title: 'Test Event 1',
  maxAttendees: 50,
  currentAttendees: 10,
  status: 'published',
  allowBulkRegistrations: true
};
const result1 = debugRegistrationConditions(event1, null);
console.log('');

console.log('=== Scenario 2: User already registered ===');
const event2 = {
  id: 'test-2',
  title: 'Test Event 2',
  maxAttendees: 50,
  currentAttendees: 10,
  status: 'published',
  allowBulkRegistrations: true
};
const result2 = debugRegistrationConditions(event2, { id: 'registration-1' });
console.log('');

console.log('=== Scenario 3: Event not published ===');
const event3 = {
  id: 'test-3',
  title: 'Test Event 3',
  maxAttendees: 50,
  currentAttendees: 10,
  status: 'draft',
  allowBulkRegistrations: true
};
const result3 = debugRegistrationConditions(event3, null);
console.log('');

console.log('=== Scenario 4: Event full ===');
const event4 = {
  id: 'test-4',
  title: 'Test Event 4',
  maxAttendees: 10,
  currentAttendees: 10,
  status: 'published',
  allowBulkRegistrations: true
};
const result4 = debugRegistrationConditions(event4, null);
console.log('');

console.log('🎯 Summary:');
console.log('For the "Register Multiple" button to show, ALL conditions must be true:');
console.log('  1. User is NOT already registered (!userRegistration)');
console.log('  2. Event is NOT full (!isEventFull)');
console.log('  3. Event status is "published"');
console.log('  4. Event allows bulk registrations (allowBulkRegistrations: true)');
console.log('  5. Event has enough capacity (>= 2 spots available)');
console.log('');
console.log('🔍 To debug your specific case:');
console.log('1. Check if you are already registered for this event');
console.log('2. Check if the event status is "published"');
console.log('3. Check if the event has enough capacity');
console.log('4. Check the browser console for any JavaScript errors'); 