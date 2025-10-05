/**
 * CLEANUP CONTROLLER
 * 
 * Provides API endpoints for managing unverified account cleanup
 * 
 * IMPORTS NEEDED:
 * - const { runCleanup, findUnverifiedAccounts } = require('../scripts/cleanupUnverifiedAccounts');
 * 
 * ROUTES TO ADD:
 * - router.get('/admin/cleanup/status', cleanupController.getCleanupStatus);
 * - router.post('/admin/cleanup/run', cleanupController.runCleanup);
 */

// ===== IMPORTS (COMMENT OUT WHEN NOT USING) =====
// const { runCleanup, findUnverifiedAccounts } = require('../scripts/cleanupUnverifiedAccounts');

// ===== CONTROLLER FUNCTIONS =====

// Get cleanup status (how many accounts would be affected)
exports.getCleanupStatus = async (req, res) => {
  try {
    console.log('📊 Getting cleanup status...');
    
    // const unverifiedAccounts = await findUnverifiedAccounts();
    
    // FEATURE DISABLED - Return disabled message
    return res.json({
      success: false,
      message: 'Cleanup feature is currently disabled',
      data: { totalUnverified: 0, readyForDeletion: 0, needFirstWarning: 0, needFinalWarning: 0, recentlyCreated: 0, accounts: [] }
    });
    
    // Categorize accounts by their status
    const now = Date.now();
    const sixMonthsAgo = now - (6 * 30 * 24 * 60 * 60 * 1000);
    const twoWeeksFromDeletion = now - (6 * 30 * 24 * 60 * 60 * 1000) + (14 * 24 * 60 * 60 * 1000);
    const oneWeekFromDeletion = now - (6 * 30 * 24 * 60 * 60 * 1000) + (7 * 24 * 60 * 60 * 1000);
    
    const stats = {
      totalUnverified: unverifiedAccounts.length,
      readyForDeletion: 0,
      needFirstWarning: 0,
      needFinalWarning: 0,
      recentlyCreated: 0,
      accounts: []
    };
    
    unverifiedAccounts.forEach(account => {
      const createdAt = account.createdAt.toMillis ? account.createdAt.toMillis() : account.createdAt;
      const accountAge = now - createdAt;
      
      let status = 'recently_created';
      if (createdAt < sixMonthsAgo) {
        status = 'ready_for_deletion';
        stats.readyForDeletion++;
      } else if (createdAt < oneWeekFromDeletion) {
        status = 'need_final_warning';
        stats.needFinalWarning++;
      } else if (createdAt < twoWeeksFromDeletion) {
        status = 'need_first_warning';
        stats.needFirstWarning++;
      } else {
        stats.recentlyCreated++;
      }
      
      stats.accounts.push({
        id: account.id,
        email: account.email,
        name: account.name,
        createdAt: createdAt,
        daysOld: Math.floor(accountAge / (24 * 60 * 60 * 1000)),
        status: status,
        lastWarningSent: account.lastWarningSent ? account.lastWarningSent.toMillis() : null
      });
    });
    
    res.json({
      success: true,
      message: 'Cleanup status retrieved successfully',
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Error getting cleanup status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cleanup status',
      error: error.message
    });
  }
};

// Run the cleanup process
exports.runCleanup = async (req, res) => {
  try {
    console.log('🚀 Running cleanup process...');
    
    // FEATURE DISABLED - Return disabled message
    return res.json({
      success: false,
      message: 'Cleanup feature is currently disabled'
    });
    
    // Run the cleanup
    // await runCleanup();
    
    res.json({
      success: true,
      message: 'Cleanup process completed successfully'
    });
    
  } catch (error) {
    console.error('❌ Error running cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run cleanup process',
      error: error.message
    });
  }
};

// Test function to see what would be cleaned up (dry run)
exports.testCleanup = async (req, res) => {
  try {
    console.log('🧪 Running cleanup test (dry run)...');
    
    // FEATURE DISABLED - Return disabled message
    return res.json({
      success: false,
      message: 'Cleanup feature is currently disabled',
      data: { totalAccounts: 0, wouldSendFirstWarning: 0, wouldSendFinalWarning: 0, wouldDelete: 0, accounts: [] }
    });
    
    // const unverifiedAccounts = await findUnverifiedAccounts();
    
    // Simulate what would happen without actually doing it
    const simulation = {
      totalAccounts: unverifiedAccounts.length,
      wouldSendFirstWarning: 0,
      wouldSendFinalWarning: 0,
      wouldDelete: 0,
      accounts: []
    };
    
    unverifiedAccounts.forEach(account => {
      const accountAge = Date.now() - (account.createdAt.toMillis ? account.createdAt.toMillis() : account.createdAt);
      const sixMonths = 6 * 30 * 24 * 60 * 60 * 1000;
      const twoWeeks = 14 * 24 * 60 * 60 * 1000;
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      
      let action = 'no_action';
      if (accountAge >= sixMonths) {
        action = 'delete';
        simulation.wouldDelete++;
      } else if (accountAge >= (sixMonths - oneWeek)) {
        action = 'final_warning';
        simulation.wouldSendFinalWarning++;
      } else if (accountAge >= (sixMonths - twoWeeks)) {
        action = 'first_warning';
        simulation.wouldSendFirstWarning++;
      }
      
      simulation.accounts.push({
        email: account.email,
        name: account.name,
        daysOld: Math.floor(accountAge / (24 * 60 * 60 * 1000)),
        action: action
      });
    });
    
    res.json({
      success: true,
      message: 'Cleanup test completed (dry run)',
      data: simulation
    });
    
  } catch (error) {
    console.error('❌ Error running cleanup test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run cleanup test',
      error: error.message
    });
  }
};
