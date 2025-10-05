/**
 * Rate Limiting Configuration
 * 
 * This file handles rate limiting configuration for subscription endpoints
 * Following Golden Rules: ALL security measures must be configurable
 */

const { getConfig, getEnvOverride } = require('./environment');

const config = getConfig();

// Rate limiting configuration
const rateLimitingConfig = {
    // Subscription endpoints rate limiting
    subscription: {
        windowMs: parseInt(getEnvOverride('SUBSCRIPTION_RATE_WINDOW_MS', config.rateLimit.windowMs)),
        max: parseInt(getEnvOverride('SUBSCRIPTION_RATE_LIMIT', config.rateLimit.subscriptionRequests)),
        message: 'Too many subscription requests, please try again later',
        standardHeaders: true,
        legacyHeaders: false
    },
    
    // Webhook endpoints rate limiting
    webhook: {
        windowMs: parseInt(getEnvOverride('WEBHOOK_RATE_WINDOW_MS', '60000')), // 1 minute
        max: parseInt(getEnvOverride('WEBHOOK_RATE_LIMIT', '100')), // 100 requests per minute
        message: 'Too many webhook requests',
        standardHeaders: true,
        legacyHeaders: false
    },
    
    // General API rate limiting
    api: {
        windowMs: parseInt(getEnvOverride('API_RATE_WINDOW_MS', '900000')), // 15 minutes
        max: parseInt(getEnvOverride('API_RATE_LIMIT', '1000')), // 1000 requests per 15 minutes
        message: 'Too many API requests, please try again later',
        standardHeaders: true,
        legacyHeaders: false
    }
};

// Validation function
const validateRateLimitingConfig = () => {
    const errors = [];
    
    if (rateLimitingConfig.subscription.max <= 0) {
        errors.push('SUBSCRIPTION_RATE_LIMIT must be greater than 0');
    }
    
    if (rateLimitingConfig.subscription.windowMs <= 0) {
        errors.push('SUBSCRIPTION_RATE_WINDOW_MS must be greater than 0');
    }
    
    if (errors.length > 0) {
        throw new Error(`Rate limiting configuration errors: ${errors.join(', ')}`);
    }
    
    return true;
};

module.exports = {
    rateLimitingConfig,
    validateRateLimitingConfig
};
