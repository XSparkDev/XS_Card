/**
 * Backup Script - Before Subscription Cleanup
 * 
 * This creates a backup of all subscription data before cleanup
 */

const { db } = require('./firebase');
const fs = require('fs');
const path = require('path');

async function backupSubscriptionData() {
    console.log('💾 Creating backup before subscription cleanup...\n');
    
    try {
        const backupData = {
            timestamp: new Date().toISOString(),
            users: [],
            subscriptions: [],
            subscriptionLogs: [],
            billing: []
        };
        
        // Backup users with subscriptions
        console.log('📊 Backing up users with subscriptions...');
        const usersSnapshot = await db.collection('users').get();
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.plan && userData.plan !== 'free') {
                backupData.users.push({
                    id: doc.id,
                    data: userData
                });
            }
        });
        
        // Backup subscriptions
        console.log('📊 Backing up subscriptions...');
        const subscriptionsSnapshot = await db.collection('subscriptions').get();
        subscriptionsSnapshot.forEach(doc => {
            backupData.subscriptions.push({
                id: doc.id,
                data: doc.data()
            });
        });
        
        // Backup subscription logs
        console.log('📊 Backing up subscription logs...');
        const logsSnapshot = await db.collection('subscriptionLogs').get();
        logsSnapshot.forEach(doc => {
            backupData.subscriptionLogs.push({
                id: doc.id,
                data: doc.data()
            });
        });
        
        // Backup billing
        console.log('📊 Backing up billing records...');
        const billingSnapshot = await db.collection('billing').get();
        billingSnapshot.forEach(doc => {
            backupData.billing.push({
                id: doc.id,
                data: doc.data()
            });
        });
        
        // Save backup to file
        const backupPath = path.join(__dirname, `subscription-backup-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        
        console.log('\n✅ Backup completed successfully!');
        console.log(`📁 Backup saved to: ${backupPath}`);
        console.log('\n📊 Backup Summary:');
        console.log(`   - Users with subscriptions: ${backupData.users.length}`);
        console.log(`   - Subscription records: ${backupData.subscriptions.length}`);
        console.log(`   - Log records: ${backupData.subscriptionLogs.length}`);
        console.log(`   - Billing records: ${backupData.billing.length}`);
        
        return backupPath;
        
    } catch (error) {
        console.error('❌ Backup failed:', error);
        throw error;
    }
}

// Run the backup
if (require.main === module) {
    backupSubscriptionData()
        .then((backupPath) => {
            console.log(`\n🎯 Backup completed: ${backupPath}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Backup failed:', error);
            process.exit(1);
        });
}

module.exports = { backupSubscriptionData };
