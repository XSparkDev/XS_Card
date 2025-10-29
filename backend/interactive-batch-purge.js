const { db, admin } = require('./firebase');
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to ask for user input
function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

// Function to delete user and all related data
async function deleteUserCompletely(userId, userEmail) {
    try {
        console.log(`🗑️ Deleting user ${userEmail} (${userId}) and all related data...`);
        
        // 1. Delete from Firebase Auth
        try {
            await admin.auth().deleteUser(userId);
            console.log(`   ✅ Deleted from Firebase Auth`);
        } catch (authError) {
            console.log(`   ⚠️ Auth deletion failed (user may not exist in Auth): ${authError.message}`);
        }
        
        // 2. Delete user document
        await db.collection('users').doc(userId).delete();
        console.log(`   ✅ Deleted user document`);
        
        // 3. Delete user's contacts
        const contactsSnapshot = await db.collection('contacts').where('userId', '==', userId).get();
        if (contactsSnapshot.size > 0) {
            const contactsBatch = db.batch();
            contactsSnapshot.forEach(doc => {
                contactsBatch.delete(doc.ref);
            });
            await contactsBatch.commit();
            console.log(`   ✅ Deleted ${contactsSnapshot.size} contacts`);
        }
        
        // 4. Delete user's meetings
        const meetingsSnapshot = await db.collection('meetings').where('userId', '==', userId).get();
        if (meetingsSnapshot.size > 0) {
            const meetingsBatch = db.batch();
            meetingsSnapshot.forEach(doc => {
                meetingsBatch.delete(doc.ref);
            });
            await meetingsBatch.commit();
            console.log(`   ✅ Deleted ${meetingsSnapshot.size} meetings`);
        }
        
        // 5. Delete user's events
        const eventsSnapshot = await db.collection('events').where('userId', '==', userId).get();
        if (eventsSnapshot.size > 0) {
            const eventsBatch = db.batch();
            eventsSnapshot.forEach(doc => {
                eventsBatch.delete(doc.ref);
            });
            await eventsBatch.commit();
            console.log(`   ✅ Deleted ${eventsSnapshot.size} events`);
        }
        
        // 6. Delete user's cards
        const cardsSnapshot = await db.collection('cards').where('userId', '==', userId).get();
        if (cardsSnapshot.size > 0) {
            const cardsBatch = db.batch();
            cardsSnapshot.forEach(doc => {
                cardsBatch.delete(doc.ref);
            });
            await cardsBatch.commit();
            console.log(`   ✅ Deleted ${cardsSnapshot.size} cards`);
        }
        
        // 7. Delete user's subscriptions
        const subscriptionsSnapshot = await db.collection('subscriptions').where('userId', '==', userId).get();
        if (subscriptionsSnapshot.size > 0) {
            const subscriptionsBatch = db.batch();
            subscriptionsSnapshot.forEach(doc => {
                subscriptionsBatch.delete(doc.ref);
            });
            await subscriptionsBatch.commit();
            console.log(`   ✅ Deleted ${subscriptionsSnapshot.size} subscriptions`);
        }
        
        console.log(`   🎉 User ${userEmail} completely deleted!`);
        
    } catch (error) {
        console.error(`❌ Error deleting user ${userEmail}:`, error);
        throw error;
    }
}

async function interactiveBatchPurge() {
    try {
        console.log('🧹 Starting INTERACTIVE batch users collection purge...');
        
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Total users in collection: ${usersSnapshot.size}`);
        
        // Users to protect from deletion
        let protectedEmails = [
            'sapho@xspark.co.za',
            'khaya@xspark.co.za',
            'themba@everynationel.org'
        ];
        
        const usersToDelete = [];
        let protectedUsers = [];
        
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
        
        console.log(`\n🛡️ Initial protected users (${protectedUsers.length}):`);
        protectedUsers.forEach(user => {
            console.log(`   - ${user.email} (${user.plan}) - ${user.status}`);
        });
        
        console.log(`\n🗑️ Users to delete: ${usersToDelete.length}`);
        
        if (usersToDelete.length === 0) {
            console.log('✅ No users to delete. Collection is clean!');
            rl.close();
            return;
        }
        
        // Process in batches of 20
        const batchSize = 20;
        let processedBatches = 0;
        let deletedCount = 0;
        
        for (let i = 0; i < usersToDelete.length; i += batchSize) {
            const batchUsers = usersToDelete.slice(i, i + batchSize);
            processedBatches++;
            
            console.log(`\n📦 BATCH ${processedBatches} (Users ${i + 1}-${Math.min(i + batchSize, usersToDelete.length)}):`);
            console.log('='.repeat(60));
            
            batchUsers.forEach((user, index) => {
                const category = user.isTest ? 'TEST' : (user.plan === 'free' ? 'FREE' : 'OTHER');
                console.log(`${index + 1}. ${user.email} (${user.plan}) - ${category} - ${user.status}`);
            });
            
            console.log('\n🛡️ CURRENT EXCLUDED USERS:');
            protectedUsers.forEach((user, index) => {
                console.log(`${index + 1}. ${user.email} (${user.plan}) - ${user.status}`);
            });
            
            console.log('\n❌ USERS TO BE DELETED IN THIS BATCH:');
            batchUsers.forEach((user, index) => {
                console.log(`${index + 1}. ${user.email} (${user.plan}) - ${user.isTest ? 'TEST' : 'FREE'}`);
            });
            
            console.log('\n🎯 AWAITING YOUR DECISION:');
            console.log('   - Enter user number (1-20) to EXCLUDE from deletion');
            console.log('   - Enter "kill" to DELETE this batch');
            console.log('   - Enter "skip" to SKIP this batch');
            console.log('   - Enter "quit" to STOP the purge');
            
            const decision = await askQuestion('\nYour decision: ');
            
            if (decision.toLowerCase() === 'quit') {
                console.log('🛑 Purge stopped by user.');
                break;
            } else if (decision.toLowerCase() === 'skip') {
                console.log('⏭️ Batch skipped.');
                continue;
            } else if (decision.toLowerCase() === 'kill') {
                console.log('💀 Deleting batch...');
                
                for (const user of batchUsers) {
                    try {
                        await deleteUserCompletely(user.id, user.email);
                        deletedCount++;
                    } catch (error) {
                        console.error(`❌ Failed to delete ${user.email}:`, error.message);
                    }
                }
                
                console.log(`✅ Batch ${processedBatches} deleted (${batchUsers.length} users)`);
            } else {
                // User wants to exclude someone
                const userIndex = parseInt(decision) - 1;
                if (userIndex >= 0 && userIndex < batchUsers.length) {
                    const userToExclude = batchUsers[userIndex];
                    protectedEmails.push(userToExclude.email);
                    protectedUsers.push({
                        id: userToExclude.id,
                        email: userToExclude.email,
                        plan: userToExclude.plan,
                        status: userToExclude.status
                    });
                    
                    console.log(`🛡️ Added ${userToExclude.email} to exclusion list`);
                    
                    // Remove from current batch
                    batchUsers.splice(userIndex, 1);
                    
                    // Show updated lists
                    console.log('\n🛡️ UPDATED EXCLUDED USERS:');
                    protectedUsers.forEach((user, index) => {
                        console.log(`${index + 1}. ${user.email} (${user.plan}) - ${user.status}`);
                    });
                    
                    console.log('\n❌ REMAINING USERS IN THIS BATCH:');
                    batchUsers.forEach((user, index) => {
                        console.log(`${index + 1}. ${user.email} (${user.plan}) - ${user.isTest ? 'TEST' : 'FREE'}`);
                    });
                    
                    // Ask again for this batch
                    const newDecision = await askQuestion('\nYour decision for remaining users: ');
                    
                    if (newDecision.toLowerCase() === 'kill') {
                        console.log('💀 Deleting remaining users in batch...');
                        
                        for (const user of batchUsers) {
                            try {
                                await deleteUserCompletely(user.id, user.email);
                                deletedCount++;
                            } catch (error) {
                                console.error(`❌ Failed to delete ${user.email}:`, error.message);
                            }
                        }
                        
                        console.log(`✅ Batch ${processedBatches} deleted (${batchUsers.length} users)`);
                    } else if (newDecision.toLowerCase() === 'skip') {
                        console.log('⏭️ Batch skipped.');
                    }
                } else {
                    console.log('❌ Invalid user number. Please try again.');
                    i -= batchSize; // Repeat this batch
                }
            }
        }
        
        console.log('\n🎉 Interactive batch users purge completed!');
        console.log('📊 Summary:');
        console.log(`   📦 ${processedBatches} batches processed`);
        console.log(`   🛡️ ${protectedUsers.length} users protected`);
        console.log(`   🗑️ ${deletedCount} users deleted`);
        console.log(`   📊 ${usersSnapshot.size - deletedCount} users remaining`);
        
        rl.close();
        
    } catch (error) {
        console.error('❌ Error during interactive batch users purge:', error);
        rl.close();
        process.exit(1);
    }
}

// Run the interactive purge
interactiveBatchPurge();

