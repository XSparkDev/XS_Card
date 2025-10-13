/**
 * RevenueCat Routes
 * 
 * API routes for RevenueCat integration
 * Following golden rules: Authentication, rate limiting, comprehensive error handling
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { 
    handleRevenueCatWebhook, 
    getUserSubscriptionStatus,
    syncUserSubscription 
} = require('../controllers/revenueCatController');
const { authenticateUser } = require('../middleware/auth');

// Rate limiting for webhook endpoint (CRITICAL for security)
const webhookRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Max 10 webhook calls per minute per IP
    message: {
        error: 'Too many webhook requests',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for localhost during development
        return req.ip === '127.0.0.1' || req.ip === '::1';
    }
});

/**
 * PUBLIC ROUTE: RevenueCat webhook endpoint
 * POST /api/revenuecat/webhook
 * 
 * NOTE: This endpoint has NO user authentication (webhooks come from RevenueCat servers)
 * Security is handled via webhook signature verification inside the controller
 * Rate limiting applied to prevent abuse
 */
router.post('/webhook', webhookRateLimit, handleRevenueCatWebhook);

/**
 * PROTECTED ROUTE: Get user subscription status
 * GET /api/revenuecat/status
 * 
 * Returns current subscription status verified with RevenueCat API
 * Requires user authentication
 */
router.get('/status', authenticateUser, getUserSubscriptionStatus);

/**
 * PROTECTED ROUTE: Get subscription status for specific user (admin/testing)
 * GET /api/revenuecat/status/:userId
 * 
 * Useful for admin dashboard or troubleshooting
 * Requires user authentication
 */
router.get('/status/:userId', authenticateUser, getUserSubscriptionStatus);

/**
 * PROTECTED ROUTE: Manually sync subscription from RevenueCat
 * POST /api/revenuecat/sync
 * 
 * Forces a sync with RevenueCat API and updates local database
 * Useful when subscription status seems out of sync
 * Requires user authentication
 */
router.post('/sync', authenticateUser, syncUserSubscription);

/**
 * PROTECTED ROUTE: Manually sync specific user (admin/testing)
 * POST /api/revenuecat/sync/:userId
 * 
 * Requires user authentication
 */
router.post('/sync/:userId', authenticateUser, syncUserSubscription);

/**
 * PROTECTED ROUTE: Get product IDs for frontend
 * GET /api/revenuecat/products
 * 
 * Returns the configured product IDs from environment variables
 * Requires user authentication
 */
router.get('/products', authenticateUser, (req, res) => {
    try {
        const productIds = [];
        const userAgent = req.headers['user-agent'] || '';
        const isAndroid = userAgent.includes('Android') || userAgent.includes('ReactNative') || userAgent.includes('Expo') || userAgent.includes('okhttp');
        
        console.log(`[RevenueCat Products] User agent: ${userAgent}`);
        console.log(`[RevenueCat Products] Detected platform: ${isAndroid ? 'android' : 'ios'}`);
        
        if (isAndroid) {
            // Only return Android product IDs for Android devices
            console.log(`[RevenueCat Products] Android path - adding Android products`);
            if (process.env.REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID) {
                console.log(`[RevenueCat Products] Adding Android Monthly: ${process.env.REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID}`);
                productIds.push(process.env.REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID);
            }
            
            if (process.env.REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID) {
                console.log(`[RevenueCat Products] Adding Android Annual: ${process.env.REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID}`);
                productIds.push(process.env.REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID);
            }
        } else {
            // Only return iOS product IDs for iOS devices
            console.log(`[RevenueCat Products] iOS path - adding iOS products`);
            if (process.env.REVENUECAT_IOS_MONTHLY_PRODUCT_ID) {
                console.log(`[RevenueCat Products] Adding iOS Monthly: ${process.env.REVENUECAT_IOS_MONTHLY_PRODUCT_ID}`);
                productIds.push(process.env.REVENUECAT_IOS_MONTHLY_PRODUCT_ID);
            }
            
            if (process.env.REVENUECAT_IOS_ANNUAL_PRODUCT_ID) {
                console.log(`[RevenueCat Products] Adding iOS Annual: ${process.env.REVENUECAT_IOS_ANNUAL_PRODUCT_ID}`);
                productIds.push(process.env.REVENUECAT_IOS_ANNUAL_PRODUCT_ID);
            }
        }
        
        console.log(`[RevenueCat Products] Returning ${productIds.length} product IDs for ${isAndroid ? 'android' : 'ios'}:`, productIds);
        
        res.json({
            productIds: productIds,
            platform: isAndroid ? 'android' : 'ios'
        });
        
  } catch (error) {
        console.error('[RevenueCat Products] Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get product IDs'
        });
  }
});

module.exports = router;
