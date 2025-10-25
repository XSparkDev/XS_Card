/**
 * Check Anonymized Data Script
 * Lists all anonymized users and cards in the database
 * Anonymized data is created when users delete their accounts
 */

const { admin, db } = require('../firebase');

/**
 * Check for anonymized users in the users collection
 */
const checkAnonymizedUsers = async () => {
    try {
        console.log('\n=== CHECKING FOR ANONYMIZED USERS ===\n');
        
        // Find users with deleted flag or anonymized email pattern
        const deletedUsersSnapshot = await db.collection('users')
            .where('deleted', '==', true)
            .get();
        
        if (deletedUsersSnapshot.empty) {
            console.log('✅ No anonymized users found in users collection');
            return [];
        }
        
        console.log(`📊 Found ${deletedUsersSnapshot.docs.length} anonymized user(s):\n`);
        
        const anonymizedUsers = [];
        deletedUsersSnapshot.docs.forEach((doc, index) => {
            const userData = doc.data();
            anonymizedUsers.push({
                id: doc.id,
                ...userData
            });
            
            console.log(`${index + 1}. USER ID: ${doc.id}`);
            console.log(`   Name: ${userData.name} ${userData.surname}`);
            console.log(`   Email: ${userData.email}`);
            console.log(`   Active: ${userData.active}`);
            console.log(`   Deleted: ${userData.deleted}`);
            console.log(`   Deleted At: ${userData.deletedAt?.toDate?.() || 'N/A'}`);
            console.log(`   Account Created: ${userData.accountCreatedAt?.toDate?.() || userData.createdAt?.toDate?.() || 'N/A'}`);
            console.log(`   Plan: ${userData.plan || 'N/A'}`);
            console.log(`   Phone: ${userData.phone || 'N/A'}`);
            console.log('   ---');
        });
        
        return anonymizedUsers;
        
    } catch (error) {
        console.error('❌ Error checking anonymized users:', error);
        return [];
    }
};

/**
 * Check for anonymized cards in the cards collection
 */
const checkAnonymizedCards = async () => {
    try {
        console.log('\n=== CHECKING FOR ANONYMIZED CARDS ===\n');
        
        // Get all cards documents
        const cardsSnapshot = await db.collection('cards').get();
        
        if (cardsSnapshot.empty) {
            console.log('✅ No cards found in cards collection');
            return [];
        }
        
        const anonymizedCardsData = [];
        let totalAnonymizedCards = 0;
        
        // Check each cards document for anonymized cards
        for (const doc of cardsSnapshot.docs) {
            const cardsData = doc.data();
            
            if (!cardsData.cards || !Array.isArray(cardsData.cards)) {
                continue;
            }
            
            // Find cards with anonymized data
            const anonymizedCardsInDoc = cardsData.cards.filter(card => {
                return card.email?.includes('@deleted.local') || 
                       card.name === 'Deleted' || 
                       card.deletedAt;
            });
            
            if (anonymizedCardsInDoc.length > 0) {
                anonymizedCardsData.push({
                    userId: doc.id,
                    totalCards: cardsData.cards.length,
                    anonymizedCards: anonymizedCardsInDoc
                });
                totalAnonymizedCards += anonymizedCardsInDoc.length;
            }
        }
        
        if (anonymizedCardsData.length === 0) {
            console.log('✅ No anonymized cards found in cards collection');
            return [];
        }
        
        console.log(`📊 Found ${totalAnonymizedCards} anonymized card(s) across ${anonymizedCardsData.length} user(s):\n`);
        
        anonymizedCardsData.forEach((userCards, userIndex) => {
            console.log(`${userIndex + 1}. USER ID: ${userCards.userId}`);
            console.log(`   Total Cards: ${userCards.totalCards}`);
            console.log(`   Anonymized Cards: ${userCards.anonymizedCards.length}`);
            
            userCards.anonymizedCards.forEach((card, cardIndex) => {
                console.log(`\n   Card #${cardIndex + 1}:`);
                console.log(`     Name: ${card.name} ${card.surname}`);
                console.log(`     Email: ${card.email}`);
                console.log(`     Phone: ${card.phone || 'N/A'}`);
                console.log(`     Company: ${card.company || 'N/A'}`);
                console.log(`     Occupation: ${card.occupation || 'N/A'}`);
                console.log(`     Deleted At: ${card.deletedAt?.toDate?.() || 'N/A'}`);
                console.log(`     Was Active: ${card.wasActive || 'N/A'}`);
                console.log(`     Color Scheme: ${card.colorScheme || 'N/A'}`);
            });
            
            console.log('   ---\n');
        });
        
        return anonymizedCardsData;
        
    } catch (error) {
        console.error('❌ Error checking anonymized cards:', error);
        return [];
    }
};

/**
 * Check deletion logs
 */
const checkDeletionLogs = async () => {
    try {
        console.log('\n=== CHECKING DELETION LOGS ===\n');
        
        const logsSnapshot = await db.collection('deletionLogs')
            .orderBy('deletedAt', 'desc')
            .limit(50)
            .get();
        
        if (logsSnapshot.empty) {
            console.log('✅ No deletion logs found');
            return [];
        }
        
        console.log(`📊 Found ${logsSnapshot.docs.length} deletion log(s):\n`);
        
        const logs = [];
        logsSnapshot.docs.forEach((doc, index) => {
            const logData = doc.data();
            logs.push({
                id: doc.id,
                ...logData
            });
            
            console.log(`${index + 1}. LOG ID: ${doc.id}`);
            console.log(`   Original User ID: ${logData.originalUserId}`);
            console.log(`   Anonymized Email: ${logData.anonymizedEmail}`);
            console.log(`   Deleted At: ${logData.deletedAt?.toDate?.() || 'N/A'}`);
            console.log(`   Had Cards: ${logData.hadCards}`);
            console.log(`   Card Count: ${logData.cardCount}`);
            console.log(`   User Plan: ${logData.userPlan}`);
            console.log(`   Account Age (days): ${logData.accountAge || 'N/A'}`);
            console.log('   ---');
        });
        
        return logs;
        
    } catch (error) {
        console.error('❌ Error checking deletion logs:', error);
        return [];
    }
};

/**
 * Main function to check all anonymized data
 */
const checkAllAnonymizedData = async () => {
    try {
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║     ANONYMIZED DATA CHECKER - XSCard App              ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');
        console.log(`Timestamp: ${new Date().toISOString()}\n`);
        
        // Check all collections
        const anonymizedUsers = await checkAnonymizedUsers();
        const anonymizedCards = await checkAnonymizedCards();
        const deletionLogs = await checkDeletionLogs();
        
        // Summary
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║                    SUMMARY                             ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');
        console.log(`📊 Anonymized Users: ${anonymizedUsers.length}`);
        console.log(`📊 Users with Anonymized Cards: ${anonymizedCards.length}`);
        console.log(`📊 Total Anonymized Cards: ${anonymizedCards.reduce((sum, uc) => sum + uc.anonymizedCards.length, 0)}`);
        console.log(`📊 Deletion Log Entries: ${deletionLogs.length}`);
        console.log('\n');
        
        return {
            anonymizedUsers,
            anonymizedCards,
            deletionLogs,
            summary: {
                totalAnonymizedUsers: anonymizedUsers.length,
                totalUsersWithAnonymizedCards: anonymizedCards.length,
                totalAnonymizedCards: anonymizedCards.reduce((sum, uc) => sum + uc.anonymizedCards.length, 0),
                totalDeletionLogs: deletionLogs.length
            }
        };
        
    } catch (error) {
        console.error('❌ Error in anonymized data checker:', error);
        throw error;
    }
};

/**
 * Export check function for use in other modules
 */
const checkAnonymizedDataForJob = async (db) => {
    return await checkAllAnonymizedData();
};

// If running directly (not as module)
if (require.main === module) {
    console.log('Running Anonymized Data Checker...\n');
    
    checkAllAnonymizedData()
        .then(() => {
            console.log('✅ Check completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Check failed:', error);
            process.exit(1);
        });
}

module.exports = {
    checkAllAnonymizedData,
    checkAnonymizedUsers,
    checkAnonymizedCards,
    checkDeletionLogs,
    checkAnonymizedDataForJob
};







