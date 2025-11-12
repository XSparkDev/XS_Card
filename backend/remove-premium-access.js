/**
 * Emergency Fix - Remove Premium Access
 * 
 * This immediately removes premium access from the user
 */

const { db } = require('./firebase');
const admin = require('firebase-admin');

async function removePremiumAccess(userId) {
    console.log('🚨 Emergency: Removing premium access...\n');
    
    try {
        const batch = db.batch();
        
        // Update users collection - remove premium
        const userRef = db.collection('users').doc(userId);
        batch.update(userRef, {
            plan: 'free',
            subscriptionStatus: 'inactive',
            subscriptionPlatform: null,
            subscriptionStart: admin.firestore.FieldValue.delete(),
            subscriptionEnd: admin.firestore.FieldValue.delete(),
            revenueCat: admin.firestore.FieldValue.delete(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Update subscriptions collection - remove subscription
        const subscriptionRef = db.collection('subscriptions').doc(userId);
        batch.update(subscriptionRef, {
            status: 'inactive',
            isActive: false,
            revenueCatData: admin.firestore.FieldValue.delete(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Log the removal
        const logRef = db.collection('subscriptionLogs').doc();
        batch.set(logRef, {
            userId: userId,
            eventType: 'premium_removed',
            platform: 'manual',
            status: 'inactive',
            verificationStatus: 'manual',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            eventData: {
                reason: 'Emergency removal of premium access',
                removedBy: 'admin',
                previousStatus: 'premium'
            }
        });
        
        // Commit all changes
        await batch.commit();
        
        console.log('✅ Premium access removed successfully!');
        console.log(`   User ID: ${userId}`);
        console.log(`   Plan: free`);
        console.log(`   Status: inactive`);
        console.log(`   Platform: removed`);
        
        console.log('\n🎯 User now has free plan only!');
        console.log('   - Dashboard should be hidden');
        console.log('   - Premium features should be locked');
        console.log('   - Only 1 card allowed');
        
    } catch (error) {
        console.error('❌ Failed to remove premium access:', error);
        throw error;
    }
}

// Run the removal
if (require.main === module) {
    const userId = process.argv[2];
    if (!userId) {
        console.error('❌ Please provide user ID: node remove-premium-access.js USER_ID');
        process.exit(1);
    }
    
    removePremiumAccess(userId)
        .then(() => {
            console.log('\n🎉 Premium access removed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Removal failed:', error);
            process.exit(1);
        });
}

module.exports = { removePremiumAccess };

