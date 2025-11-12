const { db } = require('./firebase');

async function fixProtectedUsers() {
    try {
        console.log('🔄 Fixing protected users status and creating subscriptions...');
        
        const protectedEmails = [
            'sapho@xspark.co.za',
            'khaya@xspark.co.za'
        ];
        
        // Get the protected users
        const usersSnapshot = await db.collection('users').where('email', 'in', protectedEmails).get();
        
        const batch = db.batch();
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            
            // Only fix users with premium plan
            if (userData.plan === 'premium') {
                const userRef = db.collection('users').doc(userDoc.id);
                
                // Update user to active status
                batch.update(userRef, {
                    subscriptionStatus: 'active',
                    subscriptionPlatform: 'legacy_protected',
                    lastSubscriptionUpdate: new Date()
                });
                
                // Create a subscription record
                const subscriptionRef = db.collection('subscriptions').doc(userDoc.id);
                batch.set(subscriptionRef, {
                    userId: userDoc.id,
                    platform: 'legacy_protected',
                    status: 'active',
                    planId: 'PREMIUM_PLAN',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                
                console.log(`   ✅ Fixed ${userData.email} - set to active with subscription record`);
            }
        }
        
        // Commit the changes
        await batch.commit();
        
        console.log('\n🎉 Protected users fixed successfully!');
        console.log('📊 Summary:');
        console.log('   ✅ Users set to active status');
        console.log('   ✅ Subscription records created');
        console.log('   🛡️ Protected users now have proper premium access');
        
    } catch (error) {
        console.error('❌ Error fixing protected users:', error);
        process.exit(1);
    }
}

fixProtectedUsers();

