const { db } = require('./firebase');

async function purgeUsers() {
    try {
        console.log('🧹 Starting users collection purge...');
        
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Total users in collection: ${usersSnapshot.size}`);
        
        // Users to protect from deletion
        const protectedEmails = [
            'sapho@xspark.co.za',
            'khaya@xspark.co.za',
            'themba@everynationel.org'
        ];
        
        const usersToDelete = [];
        const protectedUsers = [];
        
        // Analyze and categorize users
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            
            // Check if protected
            if (protectedEmails.includes(userData.email)) {
                protectedUsers.push({
                    id: doc.id,
                    email: userData.email,
                    plan: userData.plan,
                    status: userData.subscriptionStatus
                });
                return; // Skip protected users
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
        
        console.log(`\n🛡️ Protected users (${protectedUsers.length}):`);
        protectedUsers.forEach(user => {
            console.log(`   - ${user.email} (${user.plan}) - ${user.status}`);
        });
        
        console.log(`\n🗑️ Users to delete: ${usersToDelete.length}`);
        
        if (usersToDelete.length === 0) {
            console.log('✅ No users to delete. Collection is clean!');
            return;
        }
        
        // Delete users in batches
        const batchSize = 500; // Firestore batch limit
        let deletedCount = 0;
        
        for (let i = 0; i < usersToDelete.length; i += batchSize) {
            const batch = db.batch();
            const batchUsers = usersToDelete.slice(i, i + batchSize);
            
            batchUsers.forEach(user => {
                const userRef = db.collection('users').doc(user.id);
                batch.delete(userRef);
            });
            
            await batch.commit();
            deletedCount += batchUsers.length;
            
            console.log(`   ✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batchUsers.length} users`);
        }
        
        console.log('\n🎉 Users purge completed successfully!');
        console.log('📊 Summary:');
        console.log(`   🗑️ ${deletedCount} users deleted`);
        console.log(`   🛡️ ${protectedUsers.length} users protected`);
        console.log(`   📊 ${usersSnapshot.size - deletedCount} users remaining`);
        
        console.log('\n⚠️  IMPORTANT NOTES:');
        console.log('   - Deleted users cannot be recovered');
        console.log('   - Protected users maintained');
        console.log('   - Collection cleaned of test and inactive users');
        
    } catch (error) {
        console.error('❌ Error during users purge:', error);
        process.exit(1);
    }
}

purgeUsers();

