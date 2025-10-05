/**
 * CRON JOB SCRIPT FOR AUTOMATED CLEANUP
 * 
 * This script can be run as a cron job to automatically clean up unverified accounts
 * 
 * IMPORTS NEEDED:
 * - const { runCleanup } = require('./cleanupUnverifiedAccounts');
 * 
 * CRON SETUP:
 * - Run monthly: 0 0 1 * * (1st of every month at midnight)
 * - Run weekly: 0 0 * * 0 (Every Sunday at midnight)
 * - Run daily: 0 0 * * * (Every day at midnight)
 * 
 * USAGE:
 * - Add to crontab: 0 0 1 * * /usr/bin/node /path/to/backend/scripts/cronCleanup.js
 * - Or use PM2: pm2 start cronCleanup.js --cron "0 0 1 * *"
 */

// ===== IMPORTS (COMMENT OUT WHEN NOT USING) =====
// const { runCleanup } = require('./cleanupUnverifiedAccounts');

// ===== LOGGING SETUP =====
const logWithTimestamp = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

// ===== MAIN EXECUTION =====
const main = async () => {
  try {
    logWithTimestamp('🚀 Starting automated cleanup process...');
    
    // Run the cleanup
    await runCleanup();
    
    logWithTimestamp('✅ Automated cleanup completed successfully');
    process.exit(0);
    
  } catch (error) {
    logWithTimestamp(`❌ Automated cleanup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

// ===== EXECUTION (COMMENT OUT WHEN NOT USING) =====
// Uncomment the line below to run the cron job
// main();

// ===== FEATURE DISABLED =====
// To re-enable this feature:
// 1. Uncomment the import above
// 2. Uncomment the main() call above
// 3. Set up the cron job
// 4. Test the cleanup functionality
