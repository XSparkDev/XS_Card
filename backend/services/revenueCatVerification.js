/**
 * RevenueCat Server-Side Verification Service
 * 
 * Following golden rules:
 * 1. NEVER trust client data - always verify with RevenueCat API
 * 2. All verification happens server-side
 * 3. Comprehensive error handling
 * 4. Full audit logging
 */

const https = require('https');
const { REVENUECAT_CONFIG } = require('../config/revenueCatConfig');

/**
 * Make authenticated request to RevenueCat API
 * @param {string} path - API endpoint path
 * @param {string} method - HTTP method
 * @param {object} data - Request body (optional)
 * @returns {Promise<object>} API response
 */
const makeRevenueCatApiRequest = (path, method = 'GET', data = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.revenuecat.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${REVENUECAT_CONFIG.API_KEYS.secret}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Platform': 'server'
            },
            timeout: REVENUECAT_CONFIG.API.timeout
        };

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        reject({
                            statusCode: res.statusCode,
                            message: parsedData.message || 'RevenueCat API error',
                            data: parsedData
                        });
                    }
                } catch (error) {
                    reject({
                        statusCode: res.statusCode,
                        message: 'Failed to parse RevenueCat response',
                        rawData: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject({
                message: 'Network error communicating with RevenueCat',
                error: error.message
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject({
                message: 'RevenueCat API request timeout',
                timeout: REVENUECAT_CONFIG.API.timeout
            });
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
};

/**
 * Get subscriber information from RevenueCat
 * This is the PRIMARY verification method - ALWAYS use this
 * 
 * @param {string} appUserId - The app user ID (Firebase UID)
 * @returns {Promise<object>} Subscriber information with entitlements
 */
const getSubscriberInfo = async (appUserId) => {
    try {
        console.log(`[RevenueCat Verification] Fetching subscriber info for user: ${appUserId}`);
        
        const path = `/v1/subscribers/${encodeURIComponent(appUserId)}`;
        const response = await makeRevenueCatApiRequest(path, 'GET');
        
        console.log(`[RevenueCat Verification] ✅ Successfully retrieved subscriber info`);
        return response;
        
    } catch (error) {
        console.error(`[RevenueCat Verification] ❌ Failed to get subscriber info:`, error);
        throw {
            code: 'VERIFICATION_FAILED',
            message: 'Failed to verify subscription with RevenueCat',
            details: error
        };
    }
};

/**
 * Verify that user has active entitlement
 * This is the CRITICAL verification function
 * 
 * @param {string} appUserId - The app user ID
 * @param {string} entitlementId - The entitlement to verify (default: 'premium')
 * @returns {Promise<object>} Verification result with subscription data
 */
const verifyActiveEntitlement = async (appUserId, entitlementId = null) => {
    try {
        const targetEntitlement = entitlementId || REVENUECAT_CONFIG.ENTITLEMENT_ID;
        
        console.log(`[RevenueCat Verification] Verifying entitlement '${targetEntitlement}' for user: ${appUserId}`);
        
        // Get subscriber info from RevenueCat API
        const subscriberData = await getSubscriberInfo(appUserId);
        
        // Extract entitlements
        const entitlements = subscriberData.subscriber?.entitlements || {};
        const entitlement = entitlements[targetEntitlement];
        
        if (!entitlement) {
            console.log(`[RevenueCat Verification] ❌ No entitlement '${targetEntitlement}' found`);
            return {
                isActive: false,
                reason: 'NO_ENTITLEMENT',
                message: 'User does not have the required entitlement'
            };
        }
        
        // Check if entitlement is expired
        const expiresDate = entitlement.expires_date ? new Date(entitlement.expires_date) : null;
        const now = new Date();
        
        if (expiresDate && expiresDate < now) {
            console.log(`[RevenueCat Verification] ❌ Entitlement expired on ${expiresDate.toISOString()}`);
            return {
                isActive: false,
                reason: 'EXPIRED',
                message: 'Subscription has expired',
                expiresDate: expiresDate.toISOString()
            };
        }
        
        // Extract subscription details
        const subscriptionData = {
            isActive: true,
            entitlementId: targetEntitlement,
            productIdentifier: entitlement.product_identifier,
            purchaseDate: entitlement.purchase_date,
            expiresDate: expiresDate ? expiresDate.toISOString() : null,
            willRenew: entitlement.will_renew || false,
            periodType: entitlement.period_type || 'normal',
            store: entitlement.store || 'unknown',
            isSandbox: entitlement.is_sandbox || false,
            originalTransactionId: entitlement.original_transaction_id || null,
            billingIssueDetectedAt: entitlement.billing_issues_detected_at || null,
            unsubscribeDetectedAt: entitlement.unsubscribe_detected_at || null,
            gracePeriodExpiresDate: entitlement.grace_period_expires_date || null,
        };
        
        console.log(`[RevenueCat Verification] ✅ Active entitlement verified`);
        console.log(`   Product: ${subscriptionData.productIdentifier}`);
        console.log(`   Expires: ${subscriptionData.expiresDate || 'Never'}`);
        console.log(`   Will Renew: ${subscriptionData.willRenew}`);
        console.log(`   Store: ${subscriptionData.store}`);
        
        return subscriptionData;
        
    } catch (error) {
        console.error(`[RevenueCat Verification] ❌ Verification failed:`, error);
        throw error;
    }
};

/**
 * Get all active subscriptions for a user
 * @param {string} appUserId - The app user ID
 * @returns {Promise<object>} All subscription data
 */
const getAllSubscriptions = async (appUserId) => {
    try {
        console.log(`[RevenueCat Verification] Fetching all subscriptions for user: ${appUserId}`);
        
        const subscriberData = await getSubscriberInfo(appUserId);
        const subscriptions = subscriberData.subscriber?.subscriptions || {};
        
        // Filter active subscriptions
        const activeSubscriptions = {};
        const now = new Date();
        
        Object.keys(subscriptions).forEach(productId => {
            const subscription = subscriptions[productId];
            const expiresDate = subscription.expires_date ? new Date(subscription.expires_date) : null;
            
            if (!expiresDate || expiresDate > now) {
                activeSubscriptions[productId] = subscription;
            }
        });
        
        console.log(`[RevenueCat Verification] Found ${Object.keys(activeSubscriptions).length} active subscriptions`);
        
        return {
            subscriptions: activeSubscriptions,
            rawData: subscriberData
        };
        
    } catch (error) {
        console.error(`[RevenueCat Verification] Failed to get subscriptions:`, error);
        throw error;
    }
};

/**
 * Verify webhook signature
 * RevenueCat uses Bearer token authentication for webhooks
 * 
 * @param {object} req - Express request object
 * @returns {boolean} Whether signature is valid
 */
const verifyWebhookSignature = (req) => {
    try {
        const authHeader = req.headers['authorization'];
        const expectedAuth = `Bearer ${REVENUECAT_CONFIG.WEBHOOK.authToken}`;
        
        // If no auth token is configured, skip verification
        if (!REVENUECAT_CONFIG.WEBHOOK.authToken || REVENUECAT_CONFIG.WEBHOOK.authToken === 'your_secure_token_123') {
            console.log('[RevenueCat Webhook] ⚠️  No auth token configured, skipping verification');
            return true;
        }
        
        if (!authHeader) {
            console.error('[RevenueCat Webhook] ❌ No authorization header present');
            return false;
        }
        
        if (authHeader !== expectedAuth) {
            console.error('[RevenueCat Webhook] ❌ Invalid authorization token');
            console.error('[RevenueCat Webhook] Expected:', expectedAuth);
            console.error('[RevenueCat Webhook] Received:', authHeader);
            return false;
        }
        
        console.log('[RevenueCat Webhook] ✅ Signature verified');
        return true;
        
    } catch (error) {
        console.error('[RevenueCat Webhook] ❌ Signature verification error:', error);
        return false;
    }
};

/**
 * Parse and validate webhook event
 * @param {object} webhookData - Raw webhook data
 * @returns {object} Parsed event data
 */
const parseWebhookEvent = (webhookData) => {
    try {
        const event = webhookData.event;
        
        if (!event || !event.type) {
            throw new Error('Invalid webhook event structure');
        }
        
        return {
            type: event.type,
            appUserId: event.app_user_id,
            originalAppUserId: event.original_app_user_id,
            productId: event.product_id,
            entitlementId: event.entitlement_id || event.entitlement_ids?.[0],
            periodType: event.period_type,
            purchasedAt: event.purchased_at_ms ? new Date(event.purchased_at_ms) : null,
            expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
            store: event.store,
            environment: event.environment,
            isTrialConversion: event.is_trial_conversion || false,
            rawEvent: event
        };
        
    } catch (error) {
        console.error('[RevenueCat Webhook] Failed to parse webhook event:', error);
        throw {
            code: 'WEBHOOK_PARSE_ERROR',
            message: 'Failed to parse webhook event',
            details: error.message
        };
    }
};

module.exports = {
    getSubscriberInfo,
    verifyActiveEntitlement,
    getAllSubscriptions,
    verifyWebhookSignature,
    parseWebhookEvent,
    makeRevenueCatApiRequest
};




