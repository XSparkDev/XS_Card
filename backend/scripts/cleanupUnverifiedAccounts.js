/**
 * CLEANUP SCRIPT FOR UNVERIFIED ACCOUNTS
 * 
 * This script finds and cleans up accounts that:
 * - Have isEmailVerified = false
 * - Are older than 6 months
 * - Sends warning emails before deletion
 * 
 * IMPORTS NEEDED:
 * - const { db, admin } = require('../firebase.js');
 * - const { sendMailWithStatus } = require('../public/Utils/emailService');
 * 
 * USAGE:
 * - Run manually: node backend/scripts/cleanupUnverifiedAccounts.js
 * - Or integrate into cron job for automated cleanup
 */

// ===== IMPORTS (COMMENT OUT WHEN NOT USING) =====
// const { db, admin } = require('../firebase.js');
// const { sendMailWithStatus } = require('../public/Utils/emailService');

// ===== CONFIGURATION =====
const CLEANUP_CONFIG = {
  // Account age threshold (6 months in milliseconds)
  ACCOUNT_AGE_THRESHOLD: 6 * 30 * 24 * 60 * 60 * 1000, // 6 months
  
  // Warning periods (in milliseconds)
  FIRST_WARNING_DAYS: 14, // 2 weeks
  FINAL_WARNING_DAYS: 7,  // 1 week
  
  // Email templates
  FIRST_WARNING_SUBJECT: '⚠️ XSCard Account Verification Required - First Warning',
  FINAL_WARNING_SUBJECT: '🚨 XSCard Account Verification Required - Final Warning',
  
  // Cleanup batch size (to avoid overwhelming the system)
  BATCH_SIZE: 50
};

// ===== EMAIL TEMPLATES =====
const getFirstWarningEmail = (userName, daysLeft) => `
  <h2>Account Verification Required</h2>
  <p>Hello ${userName || 'User'},</p>
  <p>Your XSCard account was created but your email address has not been verified.</p>
  <p><strong>Your account will be deleted in ${daysLeft} days</strong> if you don't verify your email address.</p>
  <p>To keep your business card active, please verify your email by clicking the link below:</p>
  <p><a href="[VERIFICATION_LINK]" style="background-color: #1E1B4B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email Address</a></p>
  <p>If you don't verify your email, your account and business card will be permanently deleted.</p>
  <p>Best regards,<br>The XSCard Team</p>
`;

const getFinalWarningEmail = (userName, daysLeft) => `
  <h2>Final Warning - Account Deletion</h2>
  <p>Hello ${userName || 'User'},</p>
  <p>This is your final warning. Your XSCard account will be <strong>permanently deleted in ${daysLeft} days</strong>.</p>
  <p>Your email address has not been verified, and we need to clean up unverified accounts.</p>
  <p>To keep your business card active, please verify your email immediately:</p>
  <p><a href="[VERIFICATION_LINK]" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email Now</a></p>
  <p><strong>This is your last chance!</strong> After ${daysLeft} days, your account will be gone forever.</p>
  <p>Best regards,<br>The XSCard Team</p>
`;

// ===== UTILITY FUNCTIONS =====
const getAccountAge = (createdAt) => {
  const now = Date.now();
  const createdTime = createdAt.toMillis ? createdAt.toMillis() : createdAt;
  return now - createdTime;
};

const shouldSendFirstWarning = (lastWarningSent, createdAt) => {
  if (!lastWarningSent) return true;
  
  const accountAge = getAccountAge(createdAt);
  const warningThreshold = CLEANUP_CONFIG.ACCOUNT_AGE_THRESHOLD - (CLEANUP_CONFIG.FIRST_WARNING_DAYS * 24 * 60 * 60 * 1000);
  
  return accountAge >= warningThreshold && 
         (Date.now() - lastWarningSent.toMillis()) > (7 * 24 * 60 * 60 * 1000); // Don't spam - wait 7 days between warnings
};

const shouldSendFinalWarning = (lastWarningSent, createdAt) => {
  if (!lastWarningSent) return false;
  
  const accountAge = getAccountAge(createdAt);
  const finalWarningThreshold = CLEANUP_CONFIG.ACCOUNT_AGE_THRESHOLD - (CLEANUP_CONFIG.FINAL_WARNING_DAYS * 24 * 60 * 60 * 1000);
  
  return accountAge >= finalWarningThreshold && 
         (Date.now() - lastWarningSent.toMillis()) > (7 * 24 * 60 * 60 * 1000); // Don't spam - wait 7 days between warnings
};

const shouldDeleteAccount = (createdAt) => {
  const accountAge = getAccountAge(createdAt);
  return accountAge >= CLEANUP_CONFIG.ACCOUNT_AGE_THRESHOLD;
};

// ===== MAIN CLEANUP FUNCTIONS =====
const findUnverifiedAccounts = async () => {
  console.log('🔍 Finding unverified accounts...');
  
  const usersRef = db.collection('users');
  const snapshot = await usersRef
    .where('isEmailVerified', '==', false)
    .get();
  
  const unverifiedAccounts = [];
  snapshot.forEach(doc => {
    const userData = doc.data();
    unverifiedAccounts.push({
      id: doc.id,
      ...userData
    });
  });
  
  console.log(`📊 Found ${unverifiedAccounts.length} unverified accounts`);
  return unverifiedAccounts;
};

const sendWarningEmails = async (accounts) => {
  console.log('📧 Sending warning emails...');
  
  let firstWarningsSent = 0;
  let finalWarningsSent = 0;
  
  for (const account of accounts) {
    try {
      const accountAge = getAccountAge(account.createdAt);
      const daysUntilDeletion = Math.ceil((CLEANUP_CONFIG.ACCOUNT_AGE_THRESHOLD - accountAge) / (24 * 60 * 60 * 1000));
      
      // Generate verification link (you'll need to implement this based on your verification system)
      const verificationLink = `https://yourdomain.com/verify-email?token=${account.verificationToken}&uid=${account.id}`;
      
      if (shouldSendFirstWarning(account.lastWarningSent, account.createdAt)) {
        // Send first warning
        await sendMailWithStatus({
          to: account.email,
          subject: CLEANUP_CONFIG.FIRST_WARNING_SUBJECT,
          html: getFirstWarningEmail(account.name, daysUntilDeletion).replace('[VERIFICATION_LINK]', verificationLink)
        });
        
        // Update last warning sent timestamp
        await db.collection('users').doc(account.id).update({
          lastWarningSent: admin.firestore.Timestamp.now()
        });
        
        firstWarningsSent++;
        console.log(`📧 First warning sent to: ${account.email}`);
        
      } else if (shouldSendFinalWarning(account.lastWarningSent, account.createdAt)) {
        // Send final warning
        await sendMailWithStatus({
          to: account.email,
          subject: CLEANUP_CONFIG.FINAL_WARNING_SUBJECT,
          html: getFinalWarningEmail(account.name, daysUntilDeletion).replace('[VERIFICATION_LINK]', verificationLink)
        });
        
        // Update last warning sent timestamp
        await db.collection('users').doc(account.id).update({
          lastWarningSent: admin.firestore.Timestamp.now()
        });
        
        finalWarningsSent++;
        console.log(`📧 Final warning sent to: ${account.email}`);
      }
      
    } catch (error) {
      console.error(`❌ Error sending warning to ${account.email}:`, error);
    }
  }
  
  console.log(`✅ Warning emails sent - First: ${firstWarningsSent}, Final: ${finalWarningsSent}`);
};

const deleteExpiredAccounts = async (accounts) => {
  console.log('🗑️ Deleting expired accounts...');
  
  let deletedCount = 0;
  const accountsToDelete = accounts.filter(account => shouldDeleteAccount(account.createdAt));
  
  console.log(`📊 Found ${accountsToDelete.length} accounts ready for deletion`);
  
  // Delete in batches to avoid overwhelming the system
  for (let i = 0; i < accountsToDelete.length; i += CLEANUP_CONFIG.BATCH_SIZE) {
    const batch = accountsToDelete.slice(i, i + CLEANUP_CONFIG.BATCH_SIZE);
    
    for (const account of batch) {
      try {
        // Delete from Firestore
        await db.collection('users').doc(account.id).delete();
        
        // Delete from Firebase Auth (if you want to clean that up too)
        try {
          await admin.auth().deleteUser(account.id);
          console.log(`🗑️ Deleted Firebase Auth user: ${account.email}`);
        } catch (authError) {
          console.log(`⚠️ Could not delete Firebase Auth user ${account.email}:`, authError.message);
        }
        
        deletedCount++;
        console.log(`🗑️ Deleted account: ${account.email}`);
        
      } catch (error) {
        console.error(`❌ Error deleting account ${account.email}:`, error);
      }
    }
    
    // Small delay between batches
    if (i + CLEANUP_CONFIG.BATCH_SIZE < accountsToDelete.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✅ Deleted ${deletedCount} expired accounts`);
};

// ===== MAIN EXECUTION FUNCTION =====
const runCleanup = async () => {
  try {
    console.log('🚀 Starting unverified accounts cleanup...');
    console.log(`📅 Cleanup threshold: ${CLEANUP_CONFIG.ACCOUNT_AGE_THRESHOLD / (24 * 60 * 60 * 1000)} days`);
    
    // Step 1: Find all unverified accounts
    const unverifiedAccounts = await findUnverifiedAccounts();
    
    if (unverifiedAccounts.length === 0) {
      console.log('✅ No unverified accounts found. Cleanup complete.');
      return;
    }
    
    // Step 2: Send warning emails
    await sendWarningEmails(unverifiedAccounts);
    
    // Step 3: Delete expired accounts
    await deleteExpiredAccounts(unverifiedAccounts);
    
    console.log('🎉 Cleanup process completed successfully!');
    
  } catch (error) {
    console.error('❌ Cleanup process failed:', error);
    throw error;
  }
};

// ===== EXPORT FOR USE IN OTHER FILES =====
module.exports = {
  runCleanup,
  findUnverifiedAccounts,
  sendWarningEmails,
  deleteExpiredAccounts,
  CLEANUP_CONFIG
};

// ===== DIRECT EXECUTION (COMMENT OUT WHEN NOT USING) =====
// Uncomment the line below to run the cleanup directly
// runCleanup().then(() => process.exit(0)).catch(error => process.exit(1));

// ===== FEATURE DISABLED - ALL FUNCTIONS COMMENTED OUT =====
// To re-enable this feature:
// 1. Uncomment the imports above
// 2. Uncomment the direct execution line above
// 3. Add the routes to your main server file
// 4. Test with the API endpoints
