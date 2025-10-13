/**
 * Database Cleanup Script - Remove All Old Subscriptions
 * 
 * This script will:
 * 1. Remove all subscription data from users collection
 * 2. Remove all subscriptions collection entries
 * 3. Remove all subscription logs
 * 4. Reset all users to free plan
 * 
 * WARNING: This will remove ALL subscription data. Only run if you're sure!
 */

const { db } = require('./firebase');
const admin = require('firebase-admin');

async function cleanupOldSubscriptions() {
    console.log('🧹 Starting database cleanup for RevenueCat migration...\n');
    
    try {
        // Step 1: Get all users with subscription data
        console.log('📊 Step 1: Finding users with subscription data...');
        const usersSnapshot = await db.collection('users').get();
        const usersWithSubscriptions = [];
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.plan && userData.plan !== 'free') {
                usersWithSubscriptions.push({
                    id: doc.id,
                    data: userData
                });
            }
        });
        
        console.log(`   Found ${usersWithSubscriptions.length} users with subscriptions`);
        
        // Step 2: Reset all users to free plan
        console.log('\n🔄 Step 2: Resetting users to free plan...');
        const batch = db.batch();
        
        // Users to exclude from cleanup (preserve their subscriptions)
        const excludedEmails = [
            'sapho@xspark.co.za',
            'khaya@xspark.co.za',
            'themba@everynationel.org'
        ];
        
        for (const user of usersWithSubscriptions) {
            const isExcluded = excludedEmails.includes(user.email);
            
            if (isExcluded) {
                console.log(`   🛡️ EXCLUDED: ${user.email} (${user.plan}) - keeping subscription`);
                continue;
            }
            
            const userRef = db.collection('users').doc(user.id);
            
            // Reset to free plan, remove subscription fields
            batch.update(userRef, {
                plan: 'free',
                subscriptionStatus: 'inactive',
                subscriptionPlatform: null,
                subscriptionStart: admin.firestore.FieldValue.delete(),
                subscriptionEnd: admin.firestore.FieldValue.delete(),
                subscriptionCode: admin.firestore.FieldValue.delete(),
                subscriptionReference: admin.firestore.FieldValue.delete(),
                paystack: admin.firestore.FieldValue.delete(),
                revenueCat: admin.firestore.FieldValue.delete(),
                lastSubscriptionUpdate: admin.firestore.FieldValue.delete()
            });
            
            console.log(`   ✅ Reset user ${user.id} to free plan`);
        }
        
        // Step 3: Delete all subscriptions collection
        console.log('\n🗑️ Step 3: Deleting subscriptions collection...');
        const subscriptionsSnapshot = await db.collection('subscriptions').get();
        console.log(`   Found ${subscriptionsSnapshot.size} subscription records`);
        
        subscriptionsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Step 4: Delete all subscription logs
        console.log('\n🗑️ Step 4: Deleting subscription logs...');
        const logsSnapshot = await db.collection('subscriptionLogs').get();
        console.log(`   Found ${logsSnapshot.size} log records`);
        
        logsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Step 5: Delete any billing records
        console.log('\n🗑️ Step 5: Cleaning up billing records...');
        const billingSnapshot = await db.collection('billing').get();
        console.log(`   Found ${billingSnapshot.size} billing records`);
        
        billingSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Step 6: Commit all changes
        console.log('\n💾 Step 6: Committing all changes...');
        await batch.commit();
        
        console.log('\n✅ Database cleanup completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Reset ${usersWithSubscriptions.length} users to free plan`);
        console.log(`   - Deleted ${subscriptionsSnapshot.size} subscription records`);
        console.log(`   - Deleted ${logsSnapshot.size} log records`);
        console.log(`   - Deleted ${billingSnapshot.size} billing records`);
        
        console.log('\n🎉 Database is now clean and ready for RevenueCat!');
        console.log('\n⚠️  IMPORTANT: All users now have free plan. They will need to subscribe through RevenueCat to get premium features.');
        
    } catch (error) {
        console.error('❌ Database cleanup failed:', error);
        throw error;
    }
}

// Run the cleanup
if (require.main === module) {
    cleanupOldSubscriptions()
        .then(() => {
            console.log('\n🎯 Cleanup completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Cleanup failed:', error);
            process.exit(1);
        });
}

module.exports = { cleanupOldSubscriptions };
