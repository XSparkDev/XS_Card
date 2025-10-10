/**
 * DRY RUN - Preview What Will Be Deleted
 * 
 * This shows you exactly what will be cleaned up WITHOUT making changes
 */

const { db } = require('./firebase');

async function dryRunCleanup() {
    console.log('🔍 DRY RUN - Previewing subscription cleanup...\n');
    
    try {
        // Step 1: Find users with subscription data
        console.log('📊 Step 1: Users that will be reset to free plan:');
        const usersSnapshot = await db.collection('users').get();
        const usersWithSubscriptions = [];
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.plan && userData.plan !== 'free') {
                usersWithSubscriptions.push({
                    id: doc.id,
                    email: userData.email || 'No email',
                    plan: userData.plan,
                    subscriptionStatus: userData.subscriptionStatus || 'Unknown',
                    subscriptionPlatform: userData.subscriptionPlatform || 'Unknown'
                });
            }
        });
        
        console.log(`   Found ${usersWithSubscriptions.length} users with subscriptions:`);
        usersWithSubscriptions.slice(0, 10).forEach(user => {
            console.log(`   - ${user.id}: ${user.email} (${user.plan}, ${user.subscriptionStatus})`);
        });
        if (usersWithSubscriptions.length > 10) {
            console.log(`   ... and ${usersWithSubscriptions.length - 10} more users`);
        }
        
        // Step 2: Count subscriptions collection
        console.log('\n📊 Step 2: Subscription records that will be deleted:');
        const subscriptionsSnapshot = await db.collection('subscriptions').get();
        console.log(`   Found ${subscriptionsSnapshot.size} subscription records`);
        
        // Step 3: Count subscription logs
        console.log('\n📊 Step 3: Log records that will be deleted:');
        const logsSnapshot = await db.collection('subscriptionLogs').get();
        console.log(`   Found ${logsSnapshot.size} log records`);
        
        // Step 4: Count billing records
        console.log('\n📊 Step 4: Billing records that will be deleted:');
        const billingSnapshot = await db.collection('billing').get();
        console.log(`   Found ${billingSnapshot.size} billing records`);
        
        console.log('\n📋 SUMMARY OF CHANGES:');
        console.log(`   ✅ ${usersWithSubscriptions.length} users will be reset to free plan`);
        console.log(`   🗑️ ${subscriptionsSnapshot.size} subscription records will be deleted`);
        console.log(`   🗑️ ${logsSnapshot.size} log records will be deleted`);
        console.log(`   🗑️ ${billingSnapshot.size} billing records will be deleted`);
        
        console.log('\n⚠️  IMPORTANT NOTES:');
        console.log('   - All users will lose premium features');
        console.log('   - They will need to subscribe through RevenueCat to get premium back');
        console.log('   - This is a ONE-WAY operation (use backup to restore if needed)');
        
        console.log('\n🎯 To proceed with cleanup, run: node cleanup-old-subscriptions.js');
        console.log('🎯 To cancel, just don\'t run the cleanup script');
        
    } catch (error) {
        console.error('❌ Dry run failed:', error);
        throw error;
    }
}

// Run the dry run
if (require.main === module) {
    dryRunCleanup()
        .then(() => {
            console.log('\n🔍 Dry run completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Dry run failed:', error);
            process.exit(1);
        });
}

module.exports = { dryRunCleanup };
