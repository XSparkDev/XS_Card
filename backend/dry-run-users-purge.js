const { db } = require('./firebase');

async function dryRunUsersPurge() {
    try {
        console.log('🔍 DRY RUN - Previewing users collection purge...');
        
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Total users in collection: ${usersSnapshot.size}`);
        
        // Analyze user data
        const userAnalysis = {
            total: usersSnapshot.size,
            withEmail: 0,
            withoutEmail: 0,
            premium: 0,
            free: 0,
            enterprise: 0,
            active: 0,
            inactive: 0,
            unknown: 0,
            protected: 0,
            testUsers: 0,
            realUsers: 0
        };
        
        const usersToDelete = [];
        const protectedUsers = [];
        
        // Users to protect from deletion
        const protectedEmails = [
            'sapho@xspark.co.za',
            'khaya@xspark.co.za',
            'themba@everynationel.org'
        ];
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            
            // Basic analysis
            if (userData.email && userData.email !== 'No email') {
                userAnalysis.withEmail++;
            } else {
                userAnalysis.withoutEmail++;
            }
            
            // Plan analysis
            if (userData.plan === 'premium') userAnalysis.premium++;
            else if (userData.plan === 'free') userAnalysis.free++;
            else if (userData.plan === 'enterprise') userAnalysis.enterprise++;
            
            // Status analysis
            if (userData.subscriptionStatus === 'active') userAnalysis.active++;
            else if (userData.subscriptionStatus === 'inactive') userAnalysis.inactive++;
            else userAnalysis.unknown++;
            
            // Check if protected
            if (protectedEmails.includes(userData.email)) {
                protectedUsers.push({
                    id: doc.id,
                    email: userData.email,
                    plan: userData.plan,
                    status: userData.subscriptionStatus
                });
                userAnalysis.protected++;
            }
            
            // Identify test users
            const isTestUser = 
                userData.email?.includes('test') ||
                userData.email?.includes('@example.com') ||
                userData.email?.includes('@test') ||
                doc.id.includes('test') ||
                doc.id.includes('concurrent') ||
                doc.id.includes('consistent') ||
                userData.email?.includes('@xspark.co.za') ||
                userData.email?.includes('@xspark.com') ||
                userData.email?.includes('@testcompany.com') ||
                userData.email?.includes('@testenterprise.com');
            
            if (isTestUser) {
                userAnalysis.testUsers++;
            } else {
                userAnalysis.realUsers++;
            }
            
            // Determine if user should be deleted
            const shouldDelete = 
                !protectedEmails.includes(userData.email) && (
                    // Delete users without email
                    !userData.email || 
                    userData.email === 'No email' ||
                    // Delete test users
                    isTestUser ||
                    // Delete users with free plan and no activity
                    (userData.plan === 'free' && userData.subscriptionStatus !== 'active')
                );
            
            if (shouldDelete) {
                usersToDelete.push({
                    id: doc.id,
                    email: userData.email || 'No email',
                    plan: userData.plan,
                    status: userData.subscriptionStatus,
                    isTest: isTestUser
                });
            }
        });
        
        // Display analysis
        console.log('\n📊 USER ANALYSIS:');
        console.log(`   Total users: ${userAnalysis.total}`);
        console.log(`   With email: ${userAnalysis.withEmail}`);
        console.log(`   Without email: ${userAnalysis.withoutEmail}`);
        console.log(`   Premium users: ${userAnalysis.premium}`);
        console.log(`   Free users: ${userAnalysis.free}`);
        console.log(`   Enterprise users: ${userAnalysis.enterprise}`);
        console.log(`   Active status: ${userAnalysis.active}`);
        console.log(`   Inactive status: ${userAnalysis.inactive}`);
        console.log(`   Unknown status: ${userAnalysis.unknown}`);
        console.log(`   Test users: ${userAnalysis.testUsers}`);
        console.log(`   Real users: ${userAnalysis.realUsers}`);
        console.log(`   Protected users: ${userAnalysis.protected}`);
        
        console.log('\n🛡️ PROTECTED USERS (will be kept):');
        protectedUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.email} (${user.plan}) - ${user.status}`);
        });
        
        console.log('\n❌ USERS TO BE DELETED:');
        console.log(`   Total users to delete: ${usersToDelete.length}`);
        
        // Show breakdown by category
        const testUsersToDelete = usersToDelete.filter(u => u.isTest);
        const noEmailUsers = usersToDelete.filter(u => !u.email || u.email === 'No email');
        const freeUsers = usersToDelete.filter(u => u.plan === 'free' && !u.isTest);
        
        console.log(`   - Test users: ${testUsersToDelete.length}`);
        console.log(`   - Users without email: ${noEmailUsers.length}`);
        console.log(`   - Free plan users: ${freeUsers.length}`);
        
        // Show sample of users to be deleted
        console.log('\n📋 SAMPLE USERS TO BE DELETED:');
        usersToDelete.slice(0, 10).forEach((user, index) => {
            const category = user.isTest ? 'TEST' : (user.plan === 'free' ? 'FREE' : 'OTHER');
            console.log(`   ${index + 1}. ${user.email} (${user.plan}) - ${category}`);
        });
        
        if (usersToDelete.length > 10) {
            console.log(`   ... and ${usersToDelete.length - 10} more users`);
        }
        
        console.log('\n📋 SUMMARY OF CHANGES:');
        console.log(`   🗑️ ${usersToDelete.length} users will be deleted`);
        console.log(`   🛡️ ${protectedUsers.length} users will be kept`);
        console.log(`   📊 ${userAnalysis.total - usersToDelete.length} users will remain`);
        
        console.log('\n⚠️  IMPORTANT NOTES:');
        console.log('   - This will permanently delete user accounts');
        console.log('   - Protected users will be kept');
        console.log('   - Test users and users without emails will be removed');
        console.log('   - This is a ONE-WAY operation');
        
        console.log('\n🎯 To proceed with purge, run: node users-purge.js');
        console.log('🎯 To cancel, just don\'t run the purge script');
        
        console.log('\n🔍 Dry run completed successfully!');
        
    } catch (error) {
        console.error('❌ Error in dry run:', error);
        process.exit(1);
    }
}

dryRunUsersPurge();

