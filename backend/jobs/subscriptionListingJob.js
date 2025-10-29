/**
 * Subscription Listing Job
 * Checks and lists every user that has a subscription (trial, active, or premium plan)
 * Can be run manually with: node backend/jobs/subscriptionListingJob.js
 */

const { db } = require('../firebase');

/**
 * Check and list all users with subscriptions
 */
const checkUsersWithSubscriptions = async () => {
    try {
        const now = new Date();
        console.log(`Checking for users with subscriptions: ${now.toISOString()}`);
        console.log('='.repeat(80));
        
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        
        if (usersSnapshot.empty) {
            console.log('No users found in database');
            return;
        }
        
        console.log(`Found ${usersSnapshot.docs.length} total users`);
        console.log('='.repeat(80));
        
        // Categorize users by subscription status
        const subscriptionUsers = [];
        const freeUsers = [];
        const trialUsers = [];
        const activeUsers = [];
        const cancelledUsers = [];
        const expiredUsers = [];
        const premiumUsers = [];
        const unknownStatus = [];
        
        // Process each user
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const userId = doc.id;
            
            const userInfo = {
                id: userId,
                email: userData.email || 'No email',
                name: userData.name || 'No name',
                surname: userData.surname || 'No surname',
                plan: userData.plan || 'unknown',
                subscriptionStatus: userData.subscriptionStatus || 'none',
                subscriptionPlan: userData.subscriptionPlan || 'none',
                trialStartDate: userData.trialStartDate || null,
                trialEndDate: userData.trialEndDate || null,
                subscriptionStart: userData.subscriptionStart || null,
                subscriptionEnd: userData.subscriptionEnd || null,
                customerCode: userData.customerCode || null,
                subscriptionCode: userData.subscriptionCode || null,
                lastLoginTime: userData.lastLoginTime || 'Never',
                createdAt: userData.createdAt || 'Unknown',
                active: userData.active !== false // Default to true if not specified
            };
            
            // Categorize based on subscription status and plan
            if (userInfo.subscriptionStatus === 'trial') {
                trialUsers.push(userInfo);
                subscriptionUsers.push(userInfo);
            } else if (userInfo.subscriptionStatus === 'active') {
                activeUsers.push(userInfo);
                subscriptionUsers.push(userInfo);
            } else if (userInfo.subscriptionStatus === 'cancelled') {
                cancelledUsers.push(userInfo);
            } else if (userInfo.subscriptionStatus === 'expired') {
                expiredUsers.push(userInfo);
            } else if (userInfo.plan === 'premium') {
                premiumUsers.push(userInfo);
                subscriptionUsers.push(userInfo);
            } else if (userInfo.plan === 'free') {
                freeUsers.push(userInfo);
            } else {
                unknownStatus.push(userInfo);
            }
        }
        
        // Display results
        console.log('\n📊 SUBSCRIPTION ANALYSIS RESULTS');
        console.log('='.repeat(80));
        
        console.log(`\n🟢 ACTIVE SUBSCRIPTIONS: ${activeUsers.length}`);
        if (activeUsers.length > 0) {
            activeUsers.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.name} ${user.surname} (${user.email})`);
                console.log(`     Plan: ${user.subscriptionPlan} | Status: ${user.subscriptionStatus}`);
                console.log(`     Start: ${user.subscriptionStart || 'N/A'} | End: ${user.subscriptionEnd || 'N/A'}`);
                console.log(`     Customer Code: ${user.customerCode || 'N/A'}`);
                console.log('');
            });
        }
        
        console.log(`\n🟡 TRIAL SUBSCRIPTIONS: ${trialUsers.length}`);
        if (trialUsers.length > 0) {
            trialUsers.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.name} ${user.surname} (${user.email})`);
                console.log(`     Plan: ${user.subscriptionPlan} | Status: ${user.subscriptionStatus}`);
                console.log(`     Trial Start: ${user.trialStartDate || 'N/A'} | Trial End: ${user.trialEndDate || 'N/A'}`);
                console.log(`     Customer Code: ${user.customerCode || 'N/A'}`);
                console.log('');
            });
        }
        
        console.log(`\n🔵 PREMIUM PLAN USERS: ${premiumUsers.length}`);
        if (premiumUsers.length > 0) {
            premiumUsers.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.name} ${user.surname} (${user.email})`);
                console.log(`     Plan: ${user.plan} | Status: ${user.subscriptionStatus}`);
                console.log(`     Last Login: ${user.lastLoginTime}`);
                console.log('');
            });
        }
        
        console.log(`\n🔴 CANCELLED SUBSCRIPTIONS: ${cancelledUsers.length}`);
        if (cancelledUsers.length > 0) {
            cancelledUsers.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.name} ${user.surname} (${user.email})`);
                console.log(`     Plan: ${user.plan} | Status: ${user.subscriptionStatus}`);
                console.log(`     Last Login: ${user.lastLoginTime}`);
                console.log('');
            });
        }
        
        console.log(`\n⚫ EXPIRED SUBSCRIPTIONS: ${expiredUsers.length}`);
        if (expiredUsers.length > 0) {
            expiredUsers.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.name} ${user.surname} (${user.email})`);
                console.log(`     Plan: ${user.plan} | Status: ${user.subscriptionStatus}`);
                console.log(`     Last Login: ${user.lastLoginTime}`);
                console.log('');
            });
        }
        
        console.log(`\n⚪ FREE PLAN USERS: ${freeUsers.length}`);
        if (freeUsers.length > 0) {
            console.log('  (First 10 free users shown)');
            freeUsers.slice(0, 10).forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.name} ${user.surname} (${user.email})`);
                console.log(`     Plan: ${user.plan} | Status: ${user.subscriptionStatus}`);
                console.log(`     Last Login: ${user.lastLoginTime}`);
                console.log('');
            });
            if (freeUsers.length > 10) {
                console.log(`  ... and ${freeUsers.length - 10} more free users`);
            }
        }
        
        console.log(`\n❓ UNKNOWN STATUS: ${unknownStatus.length}`);
        if (unknownStatus.length > 0) {
            unknownStatus.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.name} ${user.surname} (${user.email})`);
                console.log(`     Plan: ${user.plan} | Status: ${user.subscriptionStatus}`);
                console.log(`     Last Login: ${user.lastLoginTime}`);
                console.log('');
            });
        }
        
        // Summary statistics
        console.log('\n📈 SUMMARY STATISTICS');
        console.log('='.repeat(80));
        console.log(`Total Users: ${usersSnapshot.docs.length}`);
        console.log(`Users with Subscriptions: ${subscriptionUsers.length}`);
        console.log(`  - Active Subscriptions: ${activeUsers.length}`);
        console.log(`  - Trial Subscriptions: ${trialUsers.length}`);
        console.log(`  - Premium Plan Users: ${premiumUsers.length}`);
        console.log(`Free Users: ${freeUsers.length}`);
        console.log(`Cancelled Subscriptions: ${cancelledUsers.length}`);
        console.log(`Expired Subscriptions: ${expiredUsers.length}`);
        console.log(`Unknown Status: ${unknownStatus.length}`);
        
        // Calculate subscription rate
        const subscriptionRate = ((subscriptionUsers.length / usersSnapshot.docs.length) * 100).toFixed(2);
        console.log(`\nSubscription Rate: ${subscriptionRate}%`);
        
        // Check for RevenueCat subscriptions
        await checkRevenueCatSubscriptions();
        
        console.log('\n✅ Subscription listing completed successfully');
        
    } catch (error) {
        console.error('Error checking users with subscriptions:', error);
        throw error;
    }
};

/**
 * Check RevenueCat subscriptions
 */
const checkRevenueCatSubscriptions = async () => {
    try {
        console.log('\n🔍 CHECKING REVENUECAT SUBSCRIPTIONS');
        console.log('='.repeat(50));
        
        // Check if there are any RevenueCat-related collections
        const revenueCatCollections = ['revenuecat_subscriptions', 'revenuecat_entitlements', 'revenuecat_customers'];
        
        for (const collectionName of revenueCatCollections) {
            try {
                const snapshot = await db.collection(collectionName).get();
                if (!snapshot.empty) {
                    console.log(`\n📱 ${collectionName.toUpperCase()}: ${snapshot.docs.length} records`);
                    
                    // Show first few records
                    snapshot.docs.slice(0, 3).forEach((doc, index) => {
                        const data = doc.data();
                        console.log(`  ${index + 1}. User: ${data.userId || data.customerId || 'Unknown'}`);
                        console.log(`     Status: ${data.status || 'Unknown'}`);
                        console.log(`     Plan: ${data.planId || data.entitlement || 'Unknown'}`);
                        console.log(`     Created: ${data.createdAt || 'Unknown'}`);
                        console.log('');
                    });
                    
                    if (snapshot.docs.length > 3) {
                        console.log(`  ... and ${snapshot.docs.length - 3} more records`);
                    }
                } else {
                    console.log(`📱 ${collectionName.toUpperCase()}: No records found`);
                }
            } catch (error) {
                console.log(`📱 ${collectionName.toUpperCase()}: Collection not found or error accessing`);
            }
        }
        
    } catch (error) {
        console.error('Error checking RevenueCat subscriptions:', error);
    }
};

/**
 * Get detailed subscription information for a specific user
 */
const getUserSubscriptionDetails = async (userId) => {
    try {
        console.log(`\n🔍 DETAILED SUBSCRIPTION INFO FOR USER: ${userId}`);
        console.log('='.repeat(60));
        
        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            console.log('User not found');
            return;
        }
        
        const userData = userDoc.data();
        console.log('USER DATA:');
        console.log(`  Name: ${userData.name || 'N/A'} ${userData.surname || 'N/A'}`);
        console.log(`  Email: ${userData.email || 'N/A'}`);
        console.log(`  Plan: ${userData.plan || 'N/A'}`);
        console.log(`  Subscription Status: ${userData.subscriptionStatus || 'N/A'}`);
        console.log(`  Subscription Plan: ${userData.subscriptionPlan || 'N/A'}`);
        console.log(`  Customer Code: ${userData.customerCode || 'N/A'}`);
        console.log(`  Subscription Code: ${userData.subscriptionCode || 'N/A'}`);
        console.log(`  Trial Start: ${userData.trialStartDate || 'N/A'}`);
        console.log(`  Trial End: ${userData.trialEndDate || 'N/A'}`);
        console.log(`  Subscription Start: ${userData.subscriptionStart || 'N/A'}`);
        console.log(`  Subscription End: ${userData.subscriptionEnd || 'N/A'}`);
        console.log(`  Active: ${userData.active !== false}`);
        console.log(`  Last Login: ${userData.lastLoginTime || 'Never'}`);
        
        // Get subscription document
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        if (subscriptionDoc.exists) {
            const subscriptionData = subscriptionDoc.data();
            console.log('\nSUBSCRIPTION COLLECTION DATA:');
            console.log(`  Status: ${subscriptionData.status || 'N/A'}`);
            console.log(`  Plan ID: ${subscriptionData.planId || 'N/A'}`);
            console.log(`  Amount: ${subscriptionData.amount || 'N/A'}`);
            console.log(`  Customer Code: ${subscriptionData.customerCode || 'N/A'}`);
            console.log(`  Subscription Code: ${subscriptionData.subscriptionCode || 'N/A'}`);
            console.log(`  Created: ${subscriptionData.createdAt || 'N/A'}`);
            console.log(`  Last Updated: ${subscriptionData.lastUpdated || 'N/A'}`);
        } else {
            console.log('\nSUBSCRIPTION COLLECTION: No data found');
        }
        
    } catch (error) {
        console.error('Error getting user subscription details:', error);
    }
};

/**
 * Export functions for manual execution
 */
module.exports = {
    checkUsersWithSubscriptions,
    checkRevenueCatSubscriptions,
    getUserSubscriptionDetails
};

// If this file is run directly, execute the main function
if (require.main === module) {
    console.log('🚀 Starting Subscription Listing Job...');
    console.log('This job will check and list all users with subscriptions\n');
    
    checkUsersWithSubscriptions()
        .then(() => {
            console.log('\n✅ Job completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Job failed:', error);
            process.exit(1);
        });
}
