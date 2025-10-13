/**
 * Clean Slate - Remove All Subscription History
 * 
 * This completely removes all subscription data from the user
 * Makes it like they've never subscribed or cancelled
 */

const { db } = require('./firebase');
const admin = require('firebase-admin');

async function cleanSlateUser(userId) {
    console.log('🧹 Clean Slate: Removing all subscription history...\n');
    
    try {
        const batch = db.batch();
        
        // Update users collection - remove ALL subscription data
        const userRef = db.collection('users').doc(userId);
        batch.update(userRef, {
            plan: 'free',
            subscriptionStatus: null,
            subscriptionPlatform: null,
            subscriptionStart: admin.firestore.FieldValue.delete(),
            subscriptionEnd: admin.firestore.FieldValue.delete(),
            subscriptionCode: admin.firestore.FieldValue.delete(),
            subscriptionReference: admin.firestore.FieldValue.delete(),
            subscriptionPlan: admin.firestore.FieldValue.delete(),
            subscriptionId: admin.firestore.FieldValue.delete(),
            revenueCat: admin.firestore.FieldValue.delete(),
            paystack: admin.firestore.FieldValue.delete(),
            trialStartDate: admin.firestore.FieldValue.delete(),
            trialEndDate: admin.firestore.FieldValue.delete(),
            firstBillingDate: admin.firestore.FieldValue.delete(),
            nextBillingDate: admin.firestore.FieldValue.delete(),
            cancellationDate: admin.firestore.FieldValue.delete(),
            lastRevenueCatSync: admin.firestore.FieldValue.delete(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Delete subscriptions collection entry
        const subscriptionRef = db.collection('subscriptions').doc(userId);
        batch.delete(subscriptionRef);
        
        // Delete ALL subscription logs for this user
        const logsSnapshot = await db.collection('subscriptionLogs')
            .where('userId', '==', userId)
            .get();
        
        logsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete ALL billing records for this user
        const billingSnapshot = await db.collection('billing')
            .where('userId', '==', userId)
            .get();
        
        billingSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Log the clean slate
        const logRef = db.collection('subscriptionLogs').doc();
        batch.set(logRef, {
            userId: userId,
            eventType: 'clean_slate',
            platform: 'manual',
            status: 'free',
            verificationStatus: 'manual',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            eventData: {
                reason: 'Complete clean slate - removed all subscription history',
                performedBy: 'admin',
                removedData: [
                    'subscriptionStatus',
                    'subscriptionPlatform',
                    'subscriptionStart',
                    'subscriptionEnd',
                    'subscriptionCode',
                    'subscriptionReference',
                    'subscriptionPlan',
                    'subscriptionId',
                    'revenueCat',
                    'paystack',
                    'trialStartDate',
                    'trialEndDate',
                    'firstBillingDate',
                    'nextBillingDate',
                    'cancellationDate',
                    'lastRevenueCatSync'
                ]
            }
        });
        
        // Commit all changes
        await batch.commit();
        
        console.log('✅ Clean slate completed successfully!');
        console.log(`   User ID: ${userId}`);
        console.log(`   Plan: free`);
        console.log(`   Status: null (never subscribed)`);
        console.log(`   Platform: null`);
        
        console.log('\n🎯 User is now completely clean:');
        console.log('   - No subscription history');
        console.log('   - No trial data');
        console.log('   - No billing data');
        console.log('   - No RevenueCat data');
        console.log('   - No Paystack data');
        console.log('   - Like they never subscribed');
        
        console.log('\n📊 Data removed:');
        console.log(`   - ${logsSnapshot.size} subscription logs deleted`);
        console.log(`   - ${billingSnapshot.size} billing records deleted`);
        console.log('   - All subscription fields cleared');
        
    } catch (error) {
        console.error('❌ Failed to clean slate user:', error);
        throw error;
    }
}

// Run the clean slate
if (require.main === module) {
    const userId = process.argv[2];
    if (!userId) {
        console.error('❌ Please provide user ID: node clean-slate-user.js USER_ID');
        process.exit(1);
    }
    
    cleanSlateUser(userId)
        .then(() => {
            console.log('\n🎉 Clean slate completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Clean slate failed:', error);
            process.exit(1);
        });
}

module.exports = { cleanSlateUser };

