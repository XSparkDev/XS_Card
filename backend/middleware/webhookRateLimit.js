/**
 * Webhook Rate Limiting Middleware
 * 
 * This file provides rate limiting specifically for webhook endpoints
 * Following Golden Rules: ALL webhooks MUST have rate limiting protection
 */

const rateLimit = require('express-rate-limit');
const { getEnvOverride } = require('../config/environment');

/**
 * Create webhook-specific rate limiter
 */
const createWebhookRateLimit = () => {
    return rateLimit({
        windowMs: parseInt(getEnvOverride('WEBHOOK_RATE_WINDOW', '60000')), // 1 minute
        max: parseInt(getEnvOverride('WEBHOOK_RATE_LIMIT', '100')), // 100 requests per minute
        message: {
            error: 'Too many webhook requests',
            message: 'Rate limit exceeded for webhook endpoint',
            retryAfter: Math.ceil(parseInt(getEnvOverride('WEBHOOK_RATE_WINDOW', '60000')) / 1000)
        },
        standardHeaders: true, // Return rate limit info in headers
        legacyHeaders: false, // Disable X-RateLimit-* headers
        
        // Use standard IP key generator to handle IPv6 properly
        standardHeaders: true,
        legacyHeaders: false,
        
        // Custom handler for rate limit exceeded
        handler: (req, res) => {
            const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            
            console.error('Webhook rate limit exceeded:', {
                ip: clientIP,
                userAgent,
                timestamp: new Date().toISOString(),
                path: req.path
            });
            
            // Log security event
            console.log('WEBHOOK SECURITY EVENT:', JSON.stringify({
                eventType: 'rate_limit_exceeded',
                timestamp: new Date().toISOString(),
                details: {
                    ip: clientIP,
                    userAgent,
                    path: req.path,
                    attempts: req.rateLimit?.totalHits || 'unknown'
                }
            }, null, 2));
            
            res.status(429).json({
                error: 'Too many webhook requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil(parseInt(getEnvOverride('WEBHOOK_RATE_WINDOW', '60000')) / 1000)
            });
        },
        
        // Skip rate limiting for certain conditions (if needed)
        skip: (req) => {
            // Skip rate limiting in test environment
            if (process.env.NODE_ENV === 'test') {
                return true;
            }
            
            // You could add other skip conditions here
            return false;
        },
        
        // Store rate limit data in memory (for production, consider Redis)
        store: undefined // Uses default memory store
    });
};

/**
 * Create subscription-specific webhook rate limiter (more restrictive)
 */
const createSubscriptionWebhookRateLimit = () => {
    return rateLimit({
        windowMs: parseInt(getEnvOverride('SUBSCRIPTION_WEBHOOK_RATE_WINDOW', '900000')), // 15 minutes
        max: parseInt(getEnvOverride('SUBSCRIPTION_WEBHOOK_RATE_LIMIT', '50')), // 50 requests per 15 minutes
        message: {
            error: 'Too many subscription webhook requests',
            message: 'Rate limit exceeded for subscription webhook endpoint',
            retryAfter: Math.ceil(parseInt(getEnvOverride('SUBSCRIPTION_WEBHOOK_RATE_WINDOW', '900000')) / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        
        // Use standard IP handling for IPv6 compatibility
        
        handler: (req, res) => {
            const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            
            console.error('Subscription webhook rate limit exceeded:', {
                ip: clientIP,
                userAgent,
                timestamp: new Date().toISOString(),
                path: req.path
            });
            
            // Log critical security event for subscription endpoints
            console.log('CRITICAL WEBHOOK SECURITY EVENT:', JSON.stringify({
                eventType: 'subscription_webhook_rate_limit_exceeded',
                timestamp: new Date().toISOString(),
                severity: 'HIGH',
                details: {
                    ip: clientIP,
                    userAgent,
                    path: req.path,
                    attempts: req.rateLimit?.totalHits || 'unknown',
                    note: 'Potential attack on subscription webhook endpoint'
                }
            }, null, 2));
            
            res.status(429).json({
                error: 'Too many subscription webhook requests',
                message: 'Rate limit exceeded for subscription operations. Contact support if this is legitimate traffic.',
                retryAfter: Math.ceil(parseInt(getEnvOverride('SUBSCRIPTION_WEBHOOK_RATE_WINDOW', '900000')) / 1000)
            });
        },
        
        skip: (req) => {
            return process.env.NODE_ENV === 'test';
        }
    });
};

/**
 * Create IP-based rate limiter with sliding window
 */
const createIPBasedRateLimit = () => {
    return rateLimit({
        windowMs: parseInt(getEnvOverride('IP_RATE_WINDOW', '300000')), // 5 minutes
        max: parseInt(getEnvOverride('IP_RATE_LIMIT', '200')), // 200 requests per 5 minutes per IP
        message: {
            error: 'Too many requests from this IP',
            message: 'Rate limit exceeded for this IP address',
            retryAfter: Math.ceil(parseInt(getEnvOverride('IP_RATE_WINDOW', '300000')) / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        
        // Use standard IP handling for IPv6 compatibility
        
        handler: (req, res) => {
            const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
            
            console.warn('IP-based rate limit exceeded:', {
                ip: clientIP,
                timestamp: new Date().toISOString(),
                path: req.path
            });
            
            res.status(429).json({
                error: 'Too many requests',
                message: 'Rate limit exceeded for this IP address',
                retryAfter: Math.ceil(parseInt(getEnvOverride('IP_RATE_WINDOW', '300000')) / 1000)
            });
        },
        
        skip: (req) => {
            return process.env.NODE_ENV === 'test';
        }
    });
};

/**
 * Rate limiting configuration for different webhook types
 */
const WEBHOOK_RATE_LIMITS = {
    general: createWebhookRateLimit(),
    subscription: createSubscriptionWebhookRateLimit(),
    ipBased: createIPBasedRateLimit()
};

/**
 * Get appropriate rate limiter for webhook endpoint
 * @param {string} type - Type of webhook endpoint
 * @returns {Function} - Rate limiting middleware
 */
const getWebhookRateLimit = (type = 'general') => {
    return WEBHOOK_RATE_LIMITS[type] || WEBHOOK_RATE_LIMITS.general;
};

/**
 * Middleware to log rate limit information
 */
const logRateLimitInfo = (req, res, next) => {
    if (req.rateLimit) {
        let resetTimeString = 'unknown';
        try {
            if (req.rateLimit.resetTime) {
                const resetDate = new Date(req.rateLimit.resetTime);
                if (!isNaN(resetDate.getTime())) {
                    resetTimeString = resetDate.toISOString();
                }
            }
        } catch (error) {
            // If date conversion fails, use 'unknown'
            resetTimeString = 'unknown';
        }
        
        console.log('Rate limit info:', {
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            remaining: req.rateLimit.remaining,
            total: req.rateLimit.limit,
            resetTime: resetTimeString,
            path: req.path
        });
    }
    next();
};

module.exports = {
    createWebhookRateLimit,
    createSubscriptionWebhookRateLimit,
    createIPBasedRateLimit,
    getWebhookRateLimit,
    logRateLimitInfo,
    WEBHOOK_RATE_LIMITS
};
