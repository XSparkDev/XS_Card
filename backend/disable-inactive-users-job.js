/**
 * Temporary script to disable the inactive users job
 * Run this to stop the infinite loop
 */

const { startAllJobs } = require('./jobs');

// Override the inactive users job to do nothing
const originalStartInactiveUsersJob = require('./jobs/inactiveUsersJob').startInactiveUsersJob;

require('./jobs/inactiveUsersJob').startInactiveUsersJob = (db) => {
    console.log('🚫 Inactive users job DISABLED to prevent infinite loop');
    console.log('   To re-enable, fix the INACTIVE_USERS_CHECK_INTERVAL_MINUTES environment variable');
    console.log('   Recommended value: 259200 (6 months) or 1440 (1 day) for testing');
};

console.log('Inactive users job has been disabled');
console.log('You can now start your server without the infinite loop');
