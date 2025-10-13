/**
 * Fix User Subscription
 * 
 * This script manually fixes a user's subscription status
 * after the API key is corrected
 */

const { verifyActiveEntitlement } = require('./services/revenueCatVerification');
const { updateSubscriptionAtomic } = require('./controllers/revenueCatController');
const { db } = require('./firebase');

async function fixUserSubscription(userId) {
    try {
        console.log('🔧 FIXING USER SUBSCRIPTION');
        console.log('============================');
        console.log(`User ID: ${userId}`);
        console.log('');
        
        // Step 1: Verify with RevenueCat API
        console.log('🌐 STEP 1: Verifying with RevenueCat API...');
        const verification = await verifyActiveEntitlement(userId);
        
        if (!verification.isActive) {
            console.log('   ❌ User does not have active subscription in RevenueCat');
            console.log(`   Reason: ${verification.reason}`);
            return;
        }
        
        console.log('   ✅ User has active subscription in RevenueCat');
        console.log(`   Product: ${verification.productIdentifier}`);
        console.log(`   Expires: ${verification.expiresDate || 'Never'}`);
        console.log('');
        
        // Step 2: Update database atomically
        console.log('💾 STEP 2: Updating database...');
        const subscriptionData = {
            ...verification,
            appUserId: userId,
            status: 'active'
        };
        
        await updateSubscriptionAtomic(userId, subscriptionData, 'manual_fix');
        
        console.log('   ✅ Database updated successfully');
        console.log('');
        
        // Step 3: Verify the fix
        console.log('✅ STEP 3: Verifying fix...');
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        console.log('   Updated user data:');
        console.log(`   - Plan: ${userData.plan}`);
        console.log(`   - Subscription Status: ${userData.subscriptionStatus}`);
        console.log(`   - RevenueCat Active: ${userData.revenueCat?.isActive}`);
        console.log(`   - RevenueCat Status: ${userData.revenueCat?.status}`);
        
        if (userData.plan === 'premium' && userData.subscriptionStatus === 'active') {
            console.log('');
            console.log('🎉 SUCCESS! User now has premium access!');
        } else {
            console.log('');
            console.log('❌ Fix failed - user still not premium');
        }
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
    }
}

// Get user ID from command line argument
const userId = process.argv[2];
if (!userId) {
    console.error('❌ Please provide user ID: node fix-user-subscription.js <userId>');
    process.exit(1);
}

fixUserSubscription(userId);