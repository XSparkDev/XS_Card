/**
 * Jobs Index
 * Manages all scheduled jobs for the application
 */

const trialExpirationJob = require('./trialExpirationJob');
const inactiveUsersJob = require('./inactiveUsersJob');
const subscriptionListingJob = require('./subscriptionListingJob');
const pastMeetingsCleanupJob = require('./pastMeetingsCleanupJob');

/**
 * Start all jobs
 */
const startAllJobs = (db) => {
    console.log('Starting all scheduled jobs...');
    
    // Start trial expiration job
    trialExpirationJob.startTrialExpirationJob(db);
    
    // Start past meetings cleanup job (LIVE mode, daily at midnight SAST)
    pastMeetingsCleanupJob.startPastMeetingsCleanupJob(db, { dryRun: false });
    
    // Start inactive users job (TEMPORARILY DISABLED due to infinite loop)
    // inactiveUsersJob.startInactiveUsersJob(db);
    console.log('⚠️  Inactive users job temporarily disabled to prevent infinite loop');
    
    console.log('All jobs started successfully');
};

/**
 * Start individual jobs
 */
const startTrialExpirationJob = (db) => {
    trialExpirationJob.startTrialExpirationJob(db);
};

const startInactiveUsersJob = (db) => {
    inactiveUsersJob.startInactiveUsersJob(db);
};

const startPastMeetingsCleanupJob = (db, options = {}) => {
    pastMeetingsCleanupJob.startPastMeetingsCleanupJob(db, options);
};

module.exports = {
    startAllJobs,
    startTrialExpirationJob,
    startInactiveUsersJob,
    startPastMeetingsCleanupJob,
    // Export individual job functions for testing
    checkExpiredTrials: trialExpirationJob.checkExpiredTrials,
    checkInactiveUsers: inactiveUsersJob.checkInactiveUsers,
    archiveInactiveUsers: inactiveUsersJob.archiveInactiveUsers,
    // Export subscription listing functions
    checkUsersWithSubscriptions: subscriptionListingJob.checkUsersWithSubscriptions,
    checkRevenueCatSubscriptions: subscriptionListingJob.checkRevenueCatSubscriptions,
    getUserSubscriptionDetails: subscriptionListingJob.getUserSubscriptionDetails,
    // Export past meetings cleanup functions
    runPastMeetingsCleanup: pastMeetingsCleanupJob.runPastMeetingsCleanup,
    deletePastMeetings: pastMeetingsCleanupJob.deletePastMeetings,
    getAllMeetings: pastMeetingsCleanupJob.getAllMeetings,
    isMeetingPast: pastMeetingsCleanupJob.isMeetingPast
};
