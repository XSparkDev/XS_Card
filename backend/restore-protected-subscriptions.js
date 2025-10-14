const { db } = require('./firebase');
const fs = require('fs');

async function restoreProtectedSubscriptions() {
    try {
        console.log('🔄 Restoring protected user subscriptions from backup...');
        
        // Read the backup file
        const backupData = JSON.parse(fs.readFileSync('./subscription-backup-1759845064923.json', 'utf8'));
        
        // Find subscriptions for protected users
        const protectedEmails = [
            'sapho@xspark.co.za',
            'khaya@xspark.co.za',
            'themba@everynationel.org'
        ];
        
        // Get user IDs for protected emails
        const protectedUserIds = [];
        backupData.users.forEach(user => {
            if (protectedEmails.includes(user.data.email)) {
                protectedUserIds.push(user.id);
                console.log(`   📋 Found protected user: ${user.data.email} (ID: ${user.id})`);
            }
        });
        
        // Find subscriptions for these users
        const protectedSubscriptions = backupData.subscriptions.filter(sub => 
            protectedUserIds.includes(sub.data.userId)
        );
        
        console.log(`\n📋 Found ${protectedSubscriptions.length} subscriptions for protected users:`);
        protectedSubscriptions.forEach(sub => {
            console.log(`   - User ID: ${sub.data.userId}, Status: ${sub.data.status}, Platform: ${sub.data.platform}`);
        });
        
        // Restore subscriptions
        const batch = db.batch();
        
        for (const sub of protectedSubscriptions) {
            const subRef = db.collection('subscriptions').doc(sub.id);
            batch.set(subRef, sub.data, { merge: true });
            console.log(`   ✅ Restored subscription ${sub.id} for user ${sub.data.userId}`);
        }
        
        // Commit the changes
        await batch.commit();
        
        console.log('\n🎉 Protected user subscriptions restored successfully!');
        console.log('📊 Summary:');
        console.log(`   ✅ ${protectedSubscriptions.length} subscriptions restored`);
        console.log('   🛡️ Protected users now have their subscription records back');
        
    } catch (error) {
        console.error('❌ Error restoring protected subscriptions:', error);
        process.exit(1);
    }
}

restoreProtectedSubscriptions();

