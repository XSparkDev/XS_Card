/**
 * Test Event Data Structure
 * This script helps understand the event data structure for bulk registration
 */

console.log('🔍 Testing Event Data Structure for Bulk Registration\n');

// Simulate the canBulkRegister function
const checkEventBulkRegistrationSupport = (event) => {
  return event.allowBulkRegistrations === true;
};

const getAvailableCapacity = (event, currentRegistrations = 0) => {
  const capacity = event.capacity || event.maxAttendees || 0;
  return Math.max(0, capacity - currentRegistrations);
};

const canBulkRegister = (event, currentRegistrations = 0) => {
  if (!checkEventBulkRegistrationSupport(event)) {
    console.log('❌ Event does not support bulk registrations');
    console.log(`   allowBulkRegistrations: ${event.allowBulkRegistrations}`);
    return false;
  }

  const availableCapacity = getAvailableCapacity(event, currentRegistrations);
  console.log(`📊 Available capacity: ${availableCapacity}`);
  
  if (availableCapacity < 2) {
    console.log('❌ Not enough capacity for bulk registration (need >= 2 spots)');
    return false;
  }

  console.log('✅ Event supports bulk registration');
  return true;
};

// Test different event scenarios
console.log('1. Testing event with bulk registration enabled:');
const eventWithBulk = {
  id: 'test-1',
  title: 'Test Event with Bulk',
  allowBulkRegistrations: true,
  maxAttendees: 50,
  currentAttendees: 10,
  status: 'published'
};
canBulkRegister(eventWithBulk, 10);
console.log('');

console.log('2. Testing event without bulk registration:');
const eventWithoutBulk = {
  id: 'test-2',
  title: 'Test Event without Bulk',
  allowBulkRegistrations: false,
  maxAttendees: 50,
  currentAttendees: 10,
  status: 'published'
};
canBulkRegister(eventWithoutBulk, 10);
console.log('');

console.log('3. Testing event with insufficient capacity:');
const eventLowCapacity = {
  id: 'test-3',
  title: 'Test Event Low Capacity',
  allowBulkRegistrations: true,
  maxAttendees: 5,
  currentAttendees: 4,
  status: 'published'
};
canBulkRegister(eventLowCapacity, 4);
console.log('');

console.log('4. Testing event with undefined bulk registration:');
const eventUndefined = {
  id: 'test-4',
  title: 'Test Event Undefined',
  // allowBulkRegistrations is undefined
  maxAttendees: 50,
  currentAttendees: 10,
  status: 'published'
};
canBulkRegister(eventUndefined, 10);
console.log('');

console.log('🎯 Summary:');
console.log('For bulk registration to work, an event needs:');
console.log('  1. allowBulkRegistrations: true');
console.log('  2. Available capacity >= 2 spots');
console.log('  3. Status: published');
console.log('');
console.log('If you\'re not seeing the "Register Multiple" button:');
console.log('  1. Check if your event has allowBulkRegistrations: true');
console.log('  2. Verify there are at least 2 spots available');
console.log('  3. Make sure the event is published');
console.log('');
console.log('To fix this:');
console.log('  1. Create a new event with bulk registration enabled');
console.log('  2. Or update an existing event to enable bulk registration'); 