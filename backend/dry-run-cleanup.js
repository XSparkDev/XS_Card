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
        
        // Users to exclude from cleanup (preserve their subscriptions)
        const excludedEmails = [
            'sapho@xspark.co.za',
            'khaya@xspark.co.za',
            'themba@everynationel.org'
        ];
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.plan && userData.plan !== 'free') {
                const isExcluded = excludedEmails.includes(userData.email);
                usersWithSubscriptions.push({
                    id: doc.id,
                    email: userData.email || 'No email',
                    plan: userData.plan,
                    subscriptionStatus: userData.subscriptionStatus || 'Unknown',
                    subscriptionPlatform: userData.subscriptionPlatform || 'Unknown',
                    willBeExcluded: isExcluded
                });
            }
        });
        
        console.log(`   Found ${usersWithSubscriptions.length} users with subscriptions:`);
        console.log('\n📋 DETAILED USER BREAKDOWN:');
        usersWithSubscriptions.forEach((user, index) => {
            const statusIcon = user.willBeExcluded ? '🛡️' : '❌';
            const statusText = user.willBeExcluded ? 'EXCLUDED (will keep subscription)' : 'WILL BE RESET';
            
            console.log(`\n   ${index + 1}. User ID: ${user.id}`);
            console.log(`      Email: ${user.email}`);
            console.log(`      Plan: ${user.plan}`);
            console.log(`      Status: ${user.subscriptionStatus}`);
            console.log(`      Platform: ${user.subscriptionPlatform}`);
            console.log(`      ${statusIcon} ${statusText}`);
        });
        
        // Step 2: Count subscriptions collection
        console.log('\n📊 Step 2: Subscription records that will be deleted:');
        const subscriptionsSnapshot = await db.collection('subscriptions').get();
        console.log(`   Found ${subscriptionsSnapshot.size} subscription records`);
        
        if (subscriptionsSnapshot.size > 0) {
            console.log('\n📋 SUBSCRIPTION RECORDS DETAILS:');
            subscriptionsSnapshot.forEach((doc, index) => {
                const subData = doc.data();
                console.log(`\n   ${index + 1}. Subscription ID: ${doc.id}`);
                console.log(`      User ID: ${subData.userId || 'Unknown'}`);
                console.log(`      Platform: ${subData.platform || 'Unknown'}`);
                console.log(`      Status: ${subData.status || 'Unknown'}`);
                console.log(`      Created: ${subData.createdAt ? new Date(subData.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}`);
                if (subData.amount) console.log(`      Amount: ${subData.amount}`);
                if (subData.planId) console.log(`      Plan ID: ${subData.planId}`);
            });
        }
        
        // Step 3: Count subscription logs
        console.log('\n📊 Step 3: Log records that will be deleted:');
        const logsSnapshot = await db.collection('subscriptionLogs').get();
        console.log(`   Found ${logsSnapshot.size} log records`);
        
        // Step 4: Count billing records
        console.log('\n📊 Step 4: Billing records that will be deleted:');
        const billingSnapshot = await db.collection('billing').get();
        console.log(`   Found ${billingSnapshot.size} billing records`);
        
        // Plan type breakdown
        const planBreakdown = usersWithSubscriptions.reduce((acc, user) => {
            acc[user.plan] = (acc[user.plan] || 0) + 1;
            return acc;
        }, {});
        
        // Exclusion breakdown
        const excludedUsers = usersWithSubscriptions.filter(user => user.willBeExcluded);
        const affectedUsers = usersWithSubscriptions.filter(user => !user.willBeExcluded);
        
        console.log('\n📊 PLAN TYPE BREAKDOWN:');
        Object.entries(planBreakdown).forEach(([plan, count]) => {
            console.log(`   ${plan}: ${count} users`);
        });
        
        console.log('\n🛡️ EXCLUSION BREAKDOWN:');
        console.log(`   🛡️ Excluded users (will keep subscriptions): ${excludedUsers.length}`);
        console.log(`   ❌ Affected users (will be reset): ${affectedUsers.length}`);
        
        if (excludedUsers.length > 0) {
            console.log('\n🛡️ EXCLUDED USERS (will keep their subscriptions):');
            excludedUsers.forEach(user => {
                console.log(`   - ${user.email} (${user.plan})`);
            });
        }
        
        console.log('\n📋 SUMMARY OF CHANGES:');
        console.log(`   ✅ ${affectedUsers.length} users will be reset to free plan`);
        console.log(`   🛡️ ${excludedUsers.length} users will keep their subscriptions`);
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
