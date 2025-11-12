/**
 * Inactive Users Job
 * Finds and lists inactive user accounts (active: false) for Apple compliance
 * Can optionally archive and delete users from both Firestore and Firebase Auth
 */

const { admin } = require('../firebase');

// Rate limiting to prevent excessive runs
let lastRunTime = 0;
const MIN_RUN_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check for inactive users and list them
 */
const checkInactiveUsers = async (db) => {
    try {
        const now = new Date();
        const currentTime = now.getTime();
        
        // Rate limiting check
        if (currentTime - lastRunTime < MIN_RUN_INTERVAL) {
            console.log(`Skipping inactive users check: Too soon since last run (${Math.round((currentTime - lastRunTime) / 1000 / 60)} minutes ago)`);
            return;
        }
        
        lastRunTime = currentTime;
        console.log(`Checking for inactive users: ${now.toISOString()}`);
        
        // Get inactive users (active: false)
        const inactiveUsersSnapshot = await db.collection('users')
            .where('active', '==', false)
            .get();
        
        if (inactiveUsersSnapshot.empty) {
            console.log('No inactive users found');
            return;
        }
        
        console.log(`Found ${inactiveUsersSnapshot.docs.length} inactive users to list:`);
        
        // List inactive users (for now, just log them)
        const inactiveUsers = [];
        inactiveUsersSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            inactiveUsers.push({
                id: doc.id,
                email: userData.email || 'No email',
                name: userData.name || 'No name',
                surname: userData.surname || 'No surname',
                lastLoginTime: userData.lastLoginTime || 'Never',
                createdAt: userData.createdAt || 'Unknown',
                active: userData.active
            });
        });
        
        // Log inactive users for review
        console.log('=== INACTIVE USERS LIST ===');
        inactiveUsers.forEach((user, index) => {
            console.log(`${index + 1}. ID: ${user.id}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Name: ${user.name} ${user.surname}`);
            console.log(`   Last Login: ${user.lastLoginTime}`);
            console.log(`   Created: ${user.createdAt}`);
            console.log(`   Active: ${user.active}`);
            console.log('---');
        });
        console.log(`=== END INACTIVE USERS LIST (${inactiveUsers.length} total) ===`);
        
        // Check if archiving is enabled
        const shouldArchive = process.env.ARCHIVE_INACTIVE_USERS === 'true';
        const shouldDeleteAuth = process.env.DELETE_FIREBASE_AUTH_USERS === 'true';
        
        if (shouldArchive) {
            console.log('Archiving inactive users...');
            await archiveInactiveUsers(db, inactiveUsersSnapshot.docs, shouldDeleteAuth);
        } else {
            console.log('Archiving disabled. Set ARCHIVE_INACTIVE_USERS=true to enable.');
        }
        
    } catch (error) {
        console.error('Error checking inactive users:', error);
    }
};

/**
 * Archive inactive users to separate collection and optionally delete from Firebase Auth
 */
const archiveInactiveUsers = async (db, inactiveUserDocs, shouldDeleteAuth = false) => {
    try {
        console.log(`Starting archive process for ${inactiveUserDocs.length} inactive users...`);
        
        let archivedCount = 0;
        let authDeletedCount = 0;
        let errors = [];
        
        for (const doc of inactiveUserDocs) {
            try {
                const userData = doc.data();
                const userId = doc.id;
                
                console.log(`Archiving user: ${userId} (${userData.email || 'No email'})`);
                
                // 1. Create archive record
                const archiveData = {
                    ...userData,
                    originalId: userId,
                    archivedAt: new Date().toISOString(),
                    archivedBy: 'system',
                    archiveReason: 'inactive_user',
                    archiveVersion: '1.0'
                };
                
                await db.collection('archived_users').add(archiveData);
                console.log(`✅ Archived Firestore data for user: ${userId}`);
                archivedCount++;
                
                // 2. Delete from Firebase Auth if enabled
                if (shouldDeleteAuth) {
                    try {
                        await admin.auth().deleteUser(userId);
                        console.log(`✅ Deleted Firebase Auth user: ${userId}`);
                        authDeletedCount++;
                    } catch (authError) {
                        console.error(`❌ Failed to delete Firebase Auth user ${userId}:`, authError.message);
                        errors.push({
                            userId,
                            type: 'auth_deletion',
                            error: authError.message
                        });
                    }
                }
                
                // 3. Delete from active users collection
                await doc.ref.delete();
                console.log(`✅ Removed from active users: ${userId}`);
                
            } catch (error) {
                console.error(`❌ Error archiving user ${doc.id}:`, error.message);
                errors.push({
                    userId: doc.id,
                    type: 'archiving',
                    error: error.message
                });
            }
        }
        
        // Summary
        console.log('=== ARCHIVE SUMMARY ===');
        console.log(`Total users processed: ${inactiveUserDocs.length}`);
        console.log(`Successfully archived: ${archivedCount}`);
        console.log(`Firebase Auth deleted: ${authDeletedCount}`);
        console.log(`Errors encountered: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log('=== ERRORS ===');
            errors.forEach((error, index) => {
                console.log(`${index + 1}. User: ${error.userId}`);
                console.log(`   Type: ${error.type}`);
                console.log(`   Error: ${error.error}`);
            });
        }
        
        console.log('=== ARCHIVE COMPLETE ===');
        
    } catch (error) {
        console.error('Error in archive process:', error);
    }
};

/**
 * Start the inactive users job
 */
const startInactiveUsersJob = (db) => {
    // Get interval from environment variable (in minutes, default to 6 months)
    const INACTIVE_USERS_CHECK_INTERVAL = parseInt(process.env.INACTIVE_USERS_CHECK_INTERVAL_MINUTES) || (6 * 30 * 24 * 60); // 6 months in minutes
    const intervalMs = INACTIVE_USERS_CHECK_INTERVAL * 60 * 1000; // Convert to milliseconds

    console.log(`Inactive users check scheduled to run every ${INACTIVE_USERS_CHECK_INTERVAL} minutes (${INACTIVE_USERS_CHECK_INTERVAL / (24 * 60)} days)`);
    
    // Only start the job if interval is reasonable (at least 1 hour)
    if (INACTIVE_USERS_CHECK_INTERVAL < 60) {
        console.log('⚠️  Inactive users job disabled: Interval too short (must be at least 60 minutes)');
        return;
    }
    
    // Run the inactive users check
    setInterval(() => {
        checkInactiveUsers(db);
    }, intervalMs);
    
    // Run immediately on startup (only if interval is reasonable)
    if (INACTIVE_USERS_CHECK_INTERVAL >= 60) {
        console.log('Running initial inactive users check...');
        checkInactiveUsers(db);
    }
};

module.exports = {
    checkInactiveUsers,
    startInactiveUsersJob,
    archiveInactiveUsers
};
