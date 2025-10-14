const { db } = require('./firebase');
const fs = require('fs');

async function restoreProtectedUsers() {
    try {
        console.log('🔄 Restoring protected users from backup...');
        
        // Read the backup file
        const backupData = JSON.parse(fs.readFileSync('./subscription-backup-1759845064923.json', 'utf8'));
        
        // Find the protected users in the backup
        const protectedEmails = [
            'sapho@xspark.co.za',
            'khaya@xspark.co.za',
            'themba@everynationel.org'
        ];
        
        const protectedUsers = backupData.users.filter(user => 
            protectedEmails.includes(user.data.email)
        );
        
        console.log(`📋 Found ${protectedUsers.length} protected users in backup:`);
        protectedUsers.forEach(user => {
            console.log(`   - ${user.data.email} (${user.data.plan})`);
        });
        
        // Restore each protected user
        const batch = db.batch();
        
        for (const user of protectedUsers) {
            const userRef = db.collection('users').doc(user.id);
            
            // Restore the user data from backup
            batch.set(userRef, user.data, { merge: true });
            console.log(`   ✅ Restored ${user.data.email} (${user.data.plan})`);
        }
        
        // Commit the changes
        await batch.commit();
        
        console.log('\n🎉 Protected users restored successfully!');
        console.log('📊 Summary:');
        console.log(`   ✅ ${protectedUsers.length} users restored`);
        console.log('   🛡️ Protected users now have their subscriptions back');
        
    } catch (error) {
        console.error('❌ Error restoring protected users:', error);
        process.exit(1);
    }
}

restoreProtectedUsers();
