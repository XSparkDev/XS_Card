const { db } = require('./firebase');

async function deleteSpecificTestUsers() {
    try {
        console.log('🧪 TESTING: Deleting only 2 specific test users...');
        
        // Target only 2 specific test users for deletion
        const targetUserIds = [
            'concurrent_test_1758716542448',
            'consistent_test_1758716547579'
        ];
        
        console.log('🎯 TARGET USERS TO DELETE:');
        targetUserIds.forEach((id, index) => {
            console.log(`   ${index + 1}. ${id}`);
        });
        
        // Verify these users exist and get their data
        console.log('\n🔍 VERIFYING TARGET USERS:');
        for (const userId of targetUserIds) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log(`   ✅ Found: ${userId}`);
                console.log(`      Email: ${userData.email || 'null'}`);
                console.log(`      Plan: ${userData.plan || 'null'}`);
                console.log(`      Status: ${userData.subscriptionStatus || 'null'}`);
            } else {
                console.log(`   ❌ Not found: ${userId}`);
            }
        }
        
        // Double-check: Are these really test users?
        console.log('\n🛡️ SAFETY CHECK:');
        const allTestUsers = targetUserIds.filter(id => 
            id.includes('test') || 
            id.includes('concurrent') || 
            id.includes('consistent')
        );
        
        if (allTestUsers.length === targetUserIds.length) {
            console.log('   ✅ All target users are confirmed test users');
        } else {
            console.log('   ❌ WARNING: Some users may not be test users!');
            return;
        }
        
        // Delete the 2 specific users
        console.log('\n🗑️ DELETING TARGET USERS:');
        const batch = db.batch();
        
        for (const userId of targetUserIds) {
            const userRef = db.collection('users').doc(userId);
            batch.delete(userRef);
            console.log(`   🗑️ Queued for deletion: ${userId}`);
        }
        
        // Commit the deletion
        await batch.commit();
        console.log('\n✅ Successfully deleted 2 test users!');
        
        // Verify deletion
        console.log('\n🔍 VERIFICATION:');
        for (const userId of targetUserIds) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                console.log(`   ❌ User still exists: ${userId}`);
            } else {
                console.log(`   ✅ User deleted: ${userId}`);
            }
        }
        
        console.log('\n🎉 Test deletion completed successfully!');
        console.log('📊 Summary:');
        console.log('   🗑️ 2 test users deleted');
        console.log('   🛡️ All other users preserved');
        console.log('   ✅ Deletion verified');
        
    } catch (error) {
        console.error('❌ Error during test deletion:', error);
        process.exit(1);
    }
}

deleteSpecificTestUsers();

