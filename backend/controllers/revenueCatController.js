/**
 * RevenueCat Controller
 * 
 * Handles RevenueCat webhook events and subscription management
 * Following golden rules:
 * 1. All webhook events verified with signature
 * 2. All database updates are atomic transactions
 * 3. Comprehensive error handling with rollback
 * 4. Full audit logging
 * 5. Server-side verification for all operations
 */

const { db, admin } = require('../firebase');
const { 
    verifyActiveEntitlement, 
    verifyWebhookSignature, 
    parseWebhookEvent,
    getSubscriberInfo 
} = require('../services/revenueCatVerification');
const { REVENUECAT_CONFIG } = require('../config/revenueCatConfig');
const { logSubscriptionEvent } = require('../models/subscriptionLog');

/**
 * Calculate subscription end date based on product
 * @param {Date} startDate - Subscription start date
 * @param {string} productId - Product identifier
 * @returns {Date} Calculated end date
 */
const calculateSubscriptionEndDate = (startDate, productId) => {
    const start = new Date(startDate);
    
    // Check if annual or monthly based on product ID
    const isAnnual = productId.toLowerCase().includes('annual') || productId.toLowerCase().includes('year');
    
    if (isAnnual) {
        // Add 365 days for annual
        return new Date(start.getTime() + (365 * 24 * 60 * 60 * 1000));
    } else {
        // Add 30 days for monthly
        return new Date(start.getTime() + (30 * 24 * 60 * 60 * 1000));
    }
};

/**
 * Update subscription atomically
 * This is the CORE function - all subscription updates MUST go through this
 * 
 * @param {string} userId - User ID
 * @param {object} subscriptionData - Subscription data
 * @param {string} eventType - Event type for logging
 * @returns {Promise<boolean>} Success status
 */
const updateSubscriptionAtomic = async (userId, subscriptionData, eventType) => {
    const batch = db.batch();
    
    try {
        console.log(`[RevenueCat Controller] Starting atomic update for user: ${userId}`);
        console.log(`[RevenueCat Controller] Event type: ${eventType}`);
        
        // Prepare user update data
        const userUpdateData = {
            plan: subscriptionData.isActive ? 'premium' : 'free',
            subscriptionStatus: subscriptionData.status,
            subscriptionPlatform: 'revenuecat',
            subscriptionStart: subscriptionData.purchaseDate || admin.firestore.Timestamp.now(),
            subscriptionEnd: subscriptionData.expiresDate ? admin.firestore.Timestamp.fromDate(new Date(subscriptionData.expiresDate)) : null,
            revenueCat: {
                customerId: subscriptionData.appUserId || userId,
                entitlementId: subscriptionData.entitlementId,
                productId: subscriptionData.productIdentifier,
                originalTransactionId: subscriptionData.originalTransactionId,
                isActive: subscriptionData.isActive,
                willRenew: subscriptionData.willRenew || false,
                periodType: subscriptionData.periodType || 'normal',
                store: subscriptionData.store || 'unknown',
                environment: subscriptionData.environment || 'production',
            },
            updatedAt: admin.firestore.Timestamp.now(),
            lastRevenueCatSync: admin.firestore.Timestamp.now()
        };
        
        // Add billing issue fields if present
        if (subscriptionData.billingIssueDetectedAt) {
            userUpdateData.revenueCat.billingIssueDetectedAt = subscriptionData.billingIssueDetectedAt;
        }
        
        if (subscriptionData.unsubscribeDetectedAt) {
            userUpdateData.revenueCat.unsubscribeDetectedAt = subscriptionData.unsubscribeDetectedAt;
        }
        
        // Update user document (use set with merge to avoid update failures)
        const userRef = db.collection('users').doc(userId);
        batch.set(userRef, userUpdateData, { merge: true });
        console.log(`[RevenueCat Controller] 📝 Queuing user update: plan=${userUpdateData.plan}, status=${userUpdateData.subscriptionStatus}`);
        
        // Prepare subscription document data
        const subscriptionDocData = {
            userId: userId,
            platform: 'revenuecat',
            status: subscriptionData.status,
            isActive: subscriptionData.isActive,
            productId: subscriptionData.productIdentifier,
            entitlementId: subscriptionData.entitlementId,
            startDate: subscriptionData.purchaseDate || admin.firestore.Timestamp.now(),
            endDate: subscriptionData.expiresDate ? admin.firestore.Timestamp.fromDate(new Date(subscriptionData.expiresDate)) : null,
            willRenew: subscriptionData.willRenew || false,
            store: subscriptionData.store || 'unknown',
            environment: subscriptionData.environment || 'production',
            revenueCatData: subscriptionData,
            lastUpdated: admin.firestore.Timestamp.now(),
            lastEventType: eventType
        };
        
        // Update or create subscription document
        const subRef = db.collection('subscriptions').doc(userId);
        batch.set(subRef, subscriptionDocData, { merge: true });
        
        // Create audit log entry
        const logRef = db.collection('subscriptionLogs').doc();
        batch.set(logRef, {
            userId: userId,
            eventType: eventType,
            platform: 'revenuecat',
            timestamp: admin.firestore.Timestamp.now(),
            eventData: {
                productId: subscriptionData.productIdentifier,
                entitlementId: subscriptionData.entitlementId,
                isActive: subscriptionData.isActive,
                status: subscriptionData.status,
                store: subscriptionData.store,
                environment: subscriptionData.environment
            },
            verificationStatus: 'verified',
            verificationTimestamp: admin.firestore.Timestamp.now()
        });
        
        // Commit all changes atomically
        await batch.commit();
        
        console.log(`[RevenueCat Controller] ✅ Atomic update completed successfully`);
        console.log(`   User: ${userId}`);
        console.log(`   Status: ${subscriptionData.status}`);
        console.log(`   Product: ${subscriptionData.productIdentifier}`);
        
        return true;
        
    } catch (error) {
        console.error(`[RevenueCat Controller] ❌ Atomic update failed:`, error);
        // Batch automatically rolls back on error
        throw {
            code: 'ATOMIC_UPDATE_FAILED',
            message: 'Failed to update subscription atomically',
            userId: userId,
            eventType: eventType,
            error: error.message
        };
    }
};

/**
 * Handle INITIAL_PURCHASE event
 */
const handleInitialPurchase = async (userId, eventData) => {
    try {
        console.log(`[RevenueCat Webhook] Processing INITIAL_PURCHASE for user: ${userId}`);
        
        // ALWAYS verify with RevenueCat API - NEVER trust webhook data alone
        const verification = await verifyActiveEntitlement(userId, eventData.entitlementId);
        
        if (!verification.isActive) {
            throw new Error(`Entitlement verification failed: ${verification.reason}`);
        }
        
        // Prepare subscription data
        const subscriptionData = {
            ...verification,
            appUserId: userId,
            status: 'active',
            purchaseDate: eventData.purchasedAt,
            environment: eventData.environment
        };
        
        // Update atomically
        await updateSubscriptionAtomic(userId, subscriptionData, 'initial_purchase');
        
        console.log(`[RevenueCat Webhook] ✅ Initial purchase processed successfully`);
        
  } catch (error) {
        console.error(`[RevenueCat Webhook] ❌ Failed to process initial purchase:`, error);
        throw error;
  }
};

/**
 * Handle RENEWAL event
 */
const handleRenewal = async (userId, eventData) => {
  try {
        console.log(`[RevenueCat Webhook] Processing RENEWAL for user: ${userId}`);
    
        // Verify with RevenueCat API
        const verification = await verifyActiveEntitlement(userId, eventData.entitlementId);
    
        if (!verification.isActive) {
            throw new Error(`Entitlement verification failed: ${verification.reason}`);
    }
    
    const subscriptionData = {
            ...verification,
            appUserId: userId,
            status: 'active',
            purchaseDate: eventData.purchasedAt,
            environment: eventData.environment
        };
        
        await updateSubscriptionAtomic(userId, subscriptionData, 'renewal');
        
        console.log(`[RevenueCat Webhook] ✅ Renewal processed successfully`);
        
  } catch (error) {
        console.error(`[RevenueCat Webhook] ❌ Failed to process renewal:`, error);
        throw error;
  }
};

/**
 * Handle CANCELLATION event
 */
const handleCancellation = async (userId, eventData) => {
    try {
        console.log(`[RevenueCat Webhook] Processing CANCELLATION for user: ${userId}`);
        
        // Verify current state with RevenueCat API
        const verification = await verifyActiveEntitlement(userId, eventData.entitlementId);
        
        const subscriptionData = {
            ...verification,
            appUserId: userId,
            status: 'cancelled',
            environment: eventData.environment
        };
        
        await updateSubscriptionAtomic(userId, subscriptionData, 'cancellation');
        
        console.log(`[RevenueCat Webhook] ✅ Cancellation processed successfully`);
        
  } catch (error) {
        console.error(`[RevenueCat Webhook] ❌ Failed to process cancellation:`, error);
        throw error;
  }
};

/**
 * Handle EXPIRATION event
 */
const handleExpiration = async (userId, eventData) => {
    try {
        console.log(`[RevenueCat Webhook] Processing EXPIRATION for user: ${userId}`);
        
        // Verify expiration with RevenueCat API
        const verification = await verifyActiveEntitlement(userId, eventData.entitlementId);
        
        const subscriptionData = {
            isActive: false,
            appUserId: userId,
            status: 'expired',
            productIdentifier: eventData.productId,
            entitlementId: eventData.entitlementId,
            expiresDate: eventData.expiresAt,
            willRenew: false,
            store: eventData.store,
            environment: eventData.environment
        };
        
        await updateSubscriptionAtomic(userId, subscriptionData, 'expiration');
        
        console.log(`[RevenueCat Webhook] ✅ Expiration processed successfully`);
        
  } catch (error) {
        console.error(`[RevenueCat Webhook] ❌ Failed to process expiration:`, error);
        throw error;
  }
};

/**
 * Handle BILLING_ISSUE event
 */
const handleBillingIssue = async (userId, eventData) => {
    try {
        console.log(`[RevenueCat Webhook] Processing BILLING_ISSUE for user: ${userId}`);
        
        // Verify with RevenueCat API
        const verification = await verifyActiveEntitlement(userId, eventData.entitlementId);
        
        const subscriptionData = {
            ...verification,
            appUserId: userId,
            status: 'billing_issue',
            environment: eventData.environment,
            billingIssueDetectedAt: new Date().toISOString()
        };
        
        await updateSubscriptionAtomic(userId, subscriptionData, 'billing_issue');
        
        console.log(`[RevenueCat Webhook] ✅ Billing issue processed successfully`);
        
  } catch (error) {
        console.error(`[RevenueCat Webhook] ❌ Failed to process billing issue:`, error);
        throw error;
  }
};

/**
 * Handle PRODUCT_CHANGE event
 */
const handleProductChange = async (userId, eventData) => {
    try {
        console.log(`[RevenueCat Webhook] Processing PRODUCT_CHANGE for user: ${userId}`);
        
        // Verify with RevenueCat API
        const verification = await verifyActiveEntitlement(userId, eventData.entitlementId);
        
        if (!verification.isActive) {
            throw new Error(`Entitlement verification failed: ${verification.reason}`);
        }
        
        const subscriptionData = {
            ...verification,
            appUserId: userId,
            status: 'active',
            environment: eventData.environment
        };
        
        await updateSubscriptionAtomic(userId, subscriptionData, 'product_change');
        
        console.log(`[RevenueCat Webhook] ✅ Product change processed successfully`);
        
    } catch (error) {
        console.error(`[RevenueCat Webhook] ❌ Failed to process product change:`, error);
        throw error;
    }
};

/**
 * Handle RevenueCat webhook
 * This is the main webhook endpoint
 */
const handleRevenueCatWebhook = async (req, res) => {
    try {
        console.log('[RevenueCat Webhook] ========================================');
        console.log('[RevenueCat Webhook] Received webhook event');
        
        // STEP 1: Verify webhook signature (NON-NEGOTIABLE)
        if (!verifyWebhookSignature(req)) {
            console.error('[RevenueCat Webhook] ❌ Signature verification failed');
            return res.status(401).json({ 
                error: 'Unauthorized',
                message: 'Invalid webhook signature' 
            });
        }
        
        // STEP 2: Parse webhook event
        let eventData;
        try {
            eventData = parseWebhookEvent(req.body);
        } catch (error) {
            console.error('[RevenueCat Webhook] ❌ Failed to parse webhook:', error);
            return res.status(400).json({ 
                error: 'Bad Request',
                message: 'Invalid webhook payload' 
            });
        }
        
        // STEP 3: Extract user ID
        const userId = eventData.appUserId || eventData.originalAppUserId;
        
        if (!userId) {
            console.error('[RevenueCat Webhook] ❌ No user ID in webhook event');
            return res.status(400).json({ 
                error: 'Bad Request',
                message: 'No user ID found in webhook' 
            });
        }
        
        console.log(`[RevenueCat Webhook] Event type: ${eventData.type}`);
        console.log(`[RevenueCat Webhook] User ID: ${userId}`);
        console.log(`[RevenueCat Webhook] Product ID: ${eventData.productId}`);
        
        // STEP 4: Acknowledge webhook immediately (RevenueCat best practice)
        res.status(200).json({ received: true });
        
        // STEP 5: Process event asynchronously
        try {
            switch (eventData.type) {
                case REVENUECAT_CONFIG.WEBHOOK_EVENTS.INITIAL_PURCHASE:
                    await handleInitialPurchase(userId, eventData);
                    break;
                    
                case REVENUECAT_CONFIG.WEBHOOK_EVENTS.RENEWAL:
                    await handleRenewal(userId, eventData);
                    break;
                    
                case REVENUECAT_CONFIG.WEBHOOK_EVENTS.CANCELLATION:
                    await handleCancellation(userId, eventData);
                    break;
                    
                case REVENUECAT_CONFIG.WEBHOOK_EVENTS.EXPIRATION:
                    await handleExpiration(userId, eventData);
                    break;
                    
                case REVENUECAT_CONFIG.WEBHOOK_EVENTS.BILLING_ISSUE:
                    await handleBillingIssue(userId, eventData);
                    break;
                    
                case REVENUECAT_CONFIG.WEBHOOK_EVENTS.PRODUCT_CHANGE:
                    await handleProductChange(userId, eventData);
                    break;
                    
                default:
                    console.log(`[RevenueCat Webhook] ⚠️  Unhandled event type: ${eventData.type}`);
            }
        } catch (processingError) {
            console.error('[RevenueCat Webhook] ❌ Error processing webhook:', processingError);
            // Don't return error - we already acknowledged the webhook
        }
        
        console.log('[RevenueCat Webhook] ========================================');
        
  } catch (error) {
        console.error('[RevenueCat Webhook] ❌ Webhook handler error:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: 'Failed to process webhook' 
        });
  }
};

/**
 * Get user subscription status (with verification)
 * This endpoint ALWAYS verifies with RevenueCat API
 */
const getUserSubscriptionStatus = async (req, res) => {
    try {
        const userId = req.user?.uid || req.params.userId;
        
        if (!userId) {
            return res.status(400).json({ 
                error: 'Bad Request',
                message: 'User ID is required' 
            });
        }
        
        console.log(`[RevenueCat API] Fetching subscription status for user: ${userId}`);
        
        // ALWAYS verify with RevenueCat API
        const verification = await verifyActiveEntitlement(userId);
        
        // Also get local database record
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        const response = {
            isActive: verification.isActive,
            plan: verification.isActive ? 'premium' : 'free',
            subscriptionStatus: verification.isActive ? 'active' : (verification.reason || 'inactive'),
            productId: verification.productIdentifier || null,
            expiresDate: verification.expiresDate || null,
            willRenew: verification.willRenew || false,
            store: verification.store || null,
            verifiedAt: new Date().toISOString(),
            localData: userData.revenueCat || null
        };
        
        console.log(`[RevenueCat API] ✅ Status retrieved successfully`);
        res.json(response);
        
  } catch (error) {
        console.error('[RevenueCat API] ❌ Failed to get subscription status:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: 'Failed to get subscription status',
            details: error.message 
        });
  }
};

/**
 * Manually sync user subscription from RevenueCat
 * Useful for troubleshooting or manual verification
 */
const syncUserSubscription = async (req, res) => {
    try {
        const userId = req.user?.uid || req.params.userId;
        
        if (!userId) {
            return res.status(400).json({ 
                error: 'Bad Request',
                message: 'User ID is required' 
            });
        }
        
        console.log(`[RevenueCat API] Manually syncing subscription for user: ${userId}`);
        
        // Get latest data from RevenueCat
        const verification = await verifyActiveEntitlement(userId);
        console.log(`[RevenueCat API] 📊 Verification result: isActive=${verification.isActive}, product=${verification.productIdentifier}`);
        
        // Update database atomically
        const subscriptionData = {
            ...verification,
            appUserId: userId,
            status: verification.isActive ? 'active' : 'expired'
        };
        console.log(`[RevenueCat API] 📦 Subscription data prepared: isActive=${subscriptionData.isActive}, status=${subscriptionData.status}`);
        
        await updateSubscriptionAtomic(userId, subscriptionData, 'manual_sync');
        
        console.log(`[RevenueCat API] ✅ Subscription synced successfully`);
        res.json({ 
            success: true,
            message: 'Subscription synced successfully',
            data: verification 
        });
        
  } catch (error) {
        console.error('[RevenueCat API] ❌ Failed to sync subscription:', error);
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: 'Failed to sync subscription',
            details: error.message 
        });
  }
};

module.exports = {
  handleRevenueCatWebhook,
    getUserSubscriptionStatus,
    syncUserSubscription,
    updateSubscriptionAtomic // Export for testing
};
