const https = require('https');

/**
 * Trial Expiration Job
 * Checks for expired trial users and converts them to active subscriptions or marks them as cancelled
 */

/**
 * Verify subscription status with Paystack
 */
const verifySubscriptionStatus = async (subscriptionCode) => {
    const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: `/subscription/${subscriptionCode}`,
        method: 'GET',
        headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.status && response.data) {
                        resolve(response.data.status);
                    } else {
                        reject(new Error('Invalid response from Paystack'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
};

/**
 * Check for expired trials and process them
 */
const checkExpiredTrials = async (db) => {
    try {
        const now = new Date();
        console.log(`Checking for any expired trials: ${now.toISOString()}`);
        
        // Get all trial users first, then filter in memory
        // This avoids the need for a composite index
        const trialUsersSnapshot = await db.collection('users')
            .where('subscriptionStatus', '==', 'trial')
            .get();
        
        if (trialUsersSnapshot.empty) {
            console.log('No trial users found');
            return;
        }
        
        // Filter expired trials in memory
        const expiredTrials = trialUsersSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.trialEndDate && data.trialEndDate <= now.toISOString();
        });
        
        if (expiredTrials.length === 0) {
            console.log('No expired trials found');
            return;
        }
        
        console.log(`Found ${expiredTrials.length} expired trials to process`);
        
        for (const doc of expiredTrials) {
            const userId = doc.id;
            const userData = doc.data();
            
            // Verify subscription is still valid with Paystack before converting
            let isSubscriptionValid = true;
            if (userData.subscriptionCode) {
                try {
                    // Check subscription status with Paystack
                    const subscriptionStatus = await verifySubscriptionStatus(userData.subscriptionCode);
                    isSubscriptionValid = subscriptionStatus === 'active';
                    
                    if (!isSubscriptionValid) {
                        console.log(`Subscription ${userData.subscriptionCode} is no longer valid for user ${userId}`);
                    }
                } catch (error) {
                    console.error(`Error verifying subscription for ${userId}:`, error);
                    // Continue with conversion, we'll handle errors separately
                }
            }
            
            if (isSubscriptionValid) {
                console.log(`Converting trial to active subscription for user: ${userId}`);
                
                // Update user status from trial to active
                await doc.ref.update({
                    subscriptionStatus: 'active',
                    lastUpdated: new Date().toISOString(),
                    trialEndDate: new Date().toISOString(),
                    firstBillingDate: new Date().toISOString()
                });
                
                // Also update the subscription document
                await db.collection('subscriptions').doc(userId).update({
                    status: 'active',
                    trialEndDate: new Date().toISOString(),
                    firstBillingDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
                
                console.log(`User ${userId} subscription updated from trial to active`);
            } else {
                // User cancelled during trial
                console.log(`Marking cancelled trial for user: ${userId}`);
                
                // Update user status to reflect cancellation and change plan to free
                await doc.ref.update({
                    subscriptionStatus: 'cancelled',
                    plan: 'free', // Change plan back to free when subscription is cancelled
                    lastUpdated: new Date().toISOString(),
                    trialEndDate: new Date().toISOString(),
                    cancellationDate: new Date().toISOString()
                });
                
                // Also update the subscription document
                await db.collection('subscriptions').doc(userId).update({
                    status: 'cancelled',
                    trialEndDate: new Date().toISOString(),
                    cancellationDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                });
                
                console.log(`User ${userId} trial marked as cancelled and plan changed to free`);
            }
        }
    } catch (error) {
        console.error('Error checking expired trials:', error);
    }
};

/**
 * Start the trial expiration job
 */
const startTrialExpirationJob = (db) => {
    console.log('Starting trial expiration job - runs every 12 hours');
    
    // Run the check every 12 hours
    setInterval(() => {
        checkExpiredTrials(db);
    }, 12 * 60 * 60 * 1000);
    
    // Run immediately on startup
    checkExpiredTrials(db);
};

module.exports = {
    checkExpiredTrials,
    startTrialExpirationJob
};
