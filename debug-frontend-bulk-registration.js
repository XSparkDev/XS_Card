/**
 * Debug Frontend Bulk Registration Logic
 * This script helps debug why the "Register Multiple" button isn't showing
 */

console.log('🔍 Debugging Frontend Bulk Registration Logic\n');

// Simulate the exact functions from the frontend
const checkEventBulkRegistrationSupport = (event) => {
  console.log(`  - allowBulkRegistrations: ${event.allowBulkRegistrations}`);
  console.log(`  - Type: ${typeof event.allowBulkRegistrations}`);
  const result = event.allowBulkRegistrations === true;
  console.log(`  - Support check result: ${result}`);
  return result;
};

const getAvailableCapacity = (event, currentRegistrations = 0) => {
  const capacity = event.capacity || event.maxAttendees || 0;
  const available = Math.max(0, capacity - currentRegistrations);
  console.log(`  - Capacity: ${capacity}`);
  console.log(`  - Current registrations: ${currentRegistrations}`);
  console.log(`  - Available capacity: ${available}`);
  return available;
};

const canBulkRegister = (event, currentRegistrations = 0) => {
  console.log(`\n🔍 Checking if bulk registration is possible for: ${event.title}`);
  
  console.log('1. Checking bulk registration support...');
  if (!checkEventBulkRegistrationSupport(event)) {
    console.log('❌ Event does not support bulk registrations');
    return false;
  }

  console.log('2. Checking available capacity...');
  const availableCapacity = getAvailableCapacity(event, currentRegistrations);
  
  if (availableCapacity < 2) {
    console.log('❌ Not enough capacity for bulk registration (need >= 2 spots)');
    return false;
  }

  console.log('✅ Event supports bulk registration');
  return true;
};

// Test with your actual event data
console.log('🧪 Testing with your event data:');
const yourEvent = {
  id: 'your-event-id',
  title: 'Your Test Event',
  allowBulkRegistrations: true, // This should be true from your DB
  maxAttendees: 50,
  currentAttendees: 10,
  status: 'published'
};

const canRegister = canBulkRegister(yourEvent, 10);
console.log(`\n🎯 Final result: ${canRegister ? '✅ CAN bulk register' : '❌ CANNOT bulk register'}`);

console.log('\n🔍 Additional debugging info:');
console.log('If the result is false, check:');
console.log('  1. Event status is "published"');
console.log('  2. Event is not full');
console.log('  3. User is authenticated');
console.log('  4. No existing registration by the user');

console.log('\n🔍 If the result is true but button still not showing:');
console.log('  1. Check browser console for JavaScript errors');
console.log('  2. Verify the component is re-rendering');
console.log('  3. Check if there are any conditional renders');
console.log('  4. Verify the event data is being passed correctly');

console.log('\n🎯 Next steps:');
console.log('1. Check the browser console for any errors');
console.log('2. Verify the event data structure matches what we expect');
console.log('3. Check if the component is receiving the updated event data'); 