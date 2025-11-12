/**
 * RevenueCat Configuration
 * 
 * Centralized configuration for RevenueCat integration
 * Following golden rules: NO assumptions, all data from environment variables
 */

const REVENUECAT_CONFIG = {
    // API Keys - MUST be set in environment variables
    API_KEYS: {
        ios: process.env.REVENUECAT_IOS_PUBLIC_KEY || null,
        android: process.env.REVENUECAT_ANDROID_PUBLIC_KEY || null,
        // Secret key for backend API calls
        secret: process.env.REVENUECAT_SECRET_KEY || null,
    },
    
    // Webhook Configuration
    WEBHOOK: {
        authToken: process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN || null,
        // Webhook URL will be: https://yourdomain.com/api/revenuecat/webhook
    },
    
    // Product Configuration
    PRODUCTS: {
        monthly: {
            ios: process.env.REVENUECAT_IOS_MONTHLY_PRODUCT_ID || null,
            android: process.env.REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID || null,
            duration: 30, // days
            planId: 'MONTHLY_PLAN'
        },
        annual: {
            ios: process.env.REVENUECAT_IOS_ANNUAL_PRODUCT_ID || null,
            android: process.env.REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID || null,
            duration: 365, // days
            planId: 'ANNUAL_PLAN'
        }
    },
    
    // Entitlements
    ENTITLEMENT_ID: process.env.REVENUECAT_ENTITLEMENT_ID || 'premium',
    
    // API Configuration
    API: {
        baseURL: 'https://api.revenuecat.com',
        version: 'v1',
        timeout: 30000, // 30 seconds
    },
    
    // Subscription Status Mapping
    STATUS_MAPPING: {
        active: 'active',
        expired: 'expired',
        cancelled: 'cancelled',
        grace_period: 'grace_period',
        billing_retry: 'billing_retry',
        billing_issue: 'billing_issue',
        in_trial: 'active', // Treat trial as active
    },
    
    // Webhook Event Types
    WEBHOOK_EVENTS: {
        INITIAL_PURCHASE: 'INITIAL_PURCHASE',
        RENEWAL: 'RENEWAL',
        CANCELLATION: 'CANCELLATION',
        EXPIRATION: 'EXPIRATION',
        BILLING_ISSUE: 'BILLING_ISSUE',
        PRODUCT_CHANGE: 'PRODUCT_CHANGE',
        NON_RENEWING_PURCHASE: 'NON_RENEWING_PURCHASE',
        SUBSCRIBER_ALIAS: 'SUBSCRIBER_ALIAS',
    }
};

/**
 * Validate configuration
 * Ensures all required configuration is present
 */
const validateConfig = () => {
    const errors = [];
    
    if (!REVENUECAT_CONFIG.API_KEYS.secret) {
        errors.push('REVENUECAT_SECRET_KEY is not set');
    }
    
    if (!REVENUECAT_CONFIG.WEBHOOK.authToken) {
        errors.push('REVENUECAT_WEBHOOK_AUTH_TOKEN is not set');
    }
    
    if (!REVENUECAT_CONFIG.API_KEYS.android && !REVENUECAT_CONFIG.API_KEYS.ios) {
        errors.push('At least one platform API key (iOS or Android) must be set');
    }
    
    if (errors.length > 0) {
        console.warn('⚠️  RevenueCat Configuration Warnings:');
        errors.forEach(error => console.warn(`   - ${error}`));
        console.warn('   Some features may not work until configuration is complete.');
    }
    
    return errors.length === 0;
};

/**
 * Get platform-specific API key
 */
const getPlatformApiKey = (platform) => {
    if (platform === 'ios') {
        return REVENUECAT_CONFIG.API_KEYS.ios;
    } else if (platform === 'android') {
        return REVENUECAT_CONFIG.API_KEYS.android;
    }
    return null;
};

/**
 * Get product ID for platform and interval
 */
const getProductId = (platform, interval) => {
    const product = interval === 'annually' ? REVENUECAT_CONFIG.PRODUCTS.annual : REVENUECAT_CONFIG.PRODUCTS.monthly;
    return product[platform];
};

/**
 * Get subscription duration in days
 */
const getSubscriptionDuration = (interval) => {
    return interval === 'annually' ? REVENUECAT_CONFIG.PRODUCTS.annual.duration : REVENUECAT_CONFIG.PRODUCTS.monthly.duration;
};

module.exports = {
    REVENUECAT_CONFIG,
    validateConfig,
    getPlatformApiKey,
    getProductId,
    getSubscriptionDuration
};




