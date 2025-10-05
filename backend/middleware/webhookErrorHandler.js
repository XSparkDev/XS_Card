/**
 * Webhook Error Handling Middleware
 * 
 * This file provides secure error handling for webhook endpoints
 * Following Golden Rules: Error handling without information leakage
 */

const { logSecurityEvent } = require('../utils/webhookSecurity');

/**
 * Secure webhook error handler that prevents information leakage
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const webhookErrorHandler = async (err, req, res, next) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const timestamp = new Date().toISOString();
        
        // Log detailed error information internally
        const errorDetails = {
            message: err.message,
            stack: err.stack,
            code: err.code,
            statusCode: err.statusCode || 500,
            path: req.path,
            method: req.method,
            ip: clientIP,
            userAgent,
            timestamp,
            headers: {
                'content-type': req.headers['content-type'],
                'x-paystack-signature': req.headers['x-paystack-signature'] ? 'present' : 'missing',
                'user-agent': userAgent
            },
            bodySize: req.body ? JSON.stringify(req.body).length : 0
        };
        
        console.error('Webhook error occurred:', errorDetails);
        
        // Determine error type and security implications
        let errorType = 'webhook_error';
        let securityLevel = 'LOW';
        let publicMessage = 'Webhook processing failed';
        let statusCode = 500;
        
        if (err.name === 'ValidationError' || err.message.includes('validation')) {
            errorType = 'webhook_validation_error';
            securityLevel = 'MEDIUM';
            publicMessage = 'Invalid webhook data';
            statusCode = 400;
        } else if (err.message.includes('signature') || err.message.includes('authentication')) {
            errorType = 'webhook_security_error';
            securityLevel = 'HIGH';
            publicMessage = 'Authentication failed';
            statusCode = 401;
        } else if (err.message.includes('rate limit') || err.code === 'RATE_LIMITED') {
            errorType = 'webhook_rate_limit_error';
            securityLevel = 'MEDIUM';
            publicMessage = 'Rate limit exceeded';
            statusCode = 429;
        } else if (err.message.includes('timeout') || err.code === 'TIMEOUT') {
            errorType = 'webhook_timeout_error';
            securityLevel = 'LOW';
            publicMessage = 'Request timeout';
            statusCode = 408;
        } else if (err.message.includes('database') || err.message.includes('firestore')) {
            errorType = 'webhook_database_error';
            securityLevel = 'HIGH';
            publicMessage = 'Internal processing error';
            statusCode = 500;
        }
        
        // Log security event
        await logSecurityEvent(errorType, {
            ip: clientIP,
            userAgent,
            errorMessage: err.message,
            securityLevel,
            path: req.path,
            method: req.method,
            statusCode
        });
        
        // Check for potential attack patterns
        if (isLikelyAttack(err, req)) {
            await logSecurityEvent('potential_webhook_attack', {
                ip: clientIP,
                userAgent,
                errorMessage: err.message,
                securityLevel: 'CRITICAL',
                path: req.path,
                method: req.method,
                attackIndicators: getAttackIndicators(err, req)
            });
        }
        
        // Always return 200 to Paystack to prevent retries for security errors
        if (errorType === 'webhook_security_error' || securityLevel === 'HIGH') {
            return res.status(200).json({
                received: true,
                processed: false,
                message: 'Webhook received but not processed due to security constraints'
            });
        }
        
        // For non-security errors, return appropriate status
        res.status(statusCode).json({
            error: publicMessage,
            timestamp: timestamp,
            // Never include sensitive information in response
            details: getPublicErrorDetails(errorType, statusCode)
        });
        
    } catch (handlerError) {
        // If error handler itself fails, log and return minimal response
        console.error('Error in webhook error handler:', handlerError);
        
        res.status(500).json({
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Check if error indicates a potential attack
 * @param {Error} err - Error object
 * @param {Object} req - Request object
 * @returns {boolean} - True if likely attack
 */
const isLikelyAttack = (err, req) => {
    const attackIndicators = [
        // Signature manipulation attempts
        err.message.includes('signature') && req.headers['x-paystack-signature'],
        
        // Malformed JSON with suspicious content
        err.message.includes('JSON') && req.body && JSON.stringify(req.body).includes('<script'),
        
        // Multiple rapid requests with different signatures
        err.message.includes('signature') && req.rateLimit && req.rateLimit.remaining < 5,
        
        // Suspicious user agents
        req.headers['user-agent'] && (
            req.headers['user-agent'].includes('bot') ||
            req.headers['user-agent'].includes('crawler') ||
            req.headers['user-agent'].includes('scanner')
        ),
        
        // Requests without proper content type
        req.headers['content-type'] !== 'application/json' && req.method === 'POST',
        
        // Oversized payloads
        req.body && JSON.stringify(req.body).length > 10000
    ];
    
    return attackIndicators.filter(Boolean).length >= 2;
};

/**
 * Get attack indicators for logging
 * @param {Error} err - Error object
 * @param {Object} req - Request object
 * @returns {Array} - Array of attack indicators
 */
const getAttackIndicators = (err, req) => {
    const indicators = [];
    
    if (err.message.includes('signature')) {
        indicators.push('signature_manipulation');
    }
    
    if (req.body && JSON.stringify(req.body).includes('<script')) {
        indicators.push('xss_attempt');
    }
    
    if (req.rateLimit && req.rateLimit.remaining < 5) {
        indicators.push('rapid_requests');
    }
    
    if (req.headers['user-agent'] && req.headers['user-agent'].includes('bot')) {
        indicators.push('suspicious_user_agent');
    }
    
    if (req.headers['content-type'] !== 'application/json' && req.method === 'POST') {
        indicators.push('invalid_content_type');
    }
    
    if (req.body && JSON.stringify(req.body).length > 10000) {
        indicators.push('oversized_payload');
    }
    
    return indicators;
};

/**
 * Get public error details (safe to expose)
 * @param {string} errorType - Type of error
 * @param {number} statusCode - HTTP status code
 * @returns {Object} - Public error details
 */
const getPublicErrorDetails = (errorType, statusCode) => {
    const publicDetails = {
        webhook_validation_error: {
            code: 'VALIDATION_ERROR',
            message: 'The webhook payload does not meet the required format'
        },
        webhook_rate_limit_error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later'
        },
        webhook_timeout_error: {
            code: 'TIMEOUT',
            message: 'Request processing timeout'
        },
        webhook_error: {
            code: 'PROCESSING_ERROR',
            message: 'Unable to process webhook at this time'
        }
    };
    
    return publicDetails[errorType] || {
        code: 'UNKNOWN_ERROR',
        message: 'An error occurred while processing the webhook'
    };
};

/**
 * Middleware to catch async errors in webhook handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function with error handling
 */
const asyncWebhookHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Validation error handler
 * @param {Error} err - Validation error
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const validationErrorHandler = (err, req, res, next) => {
    if (err.name === 'ValidationError') {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        
        console.warn('Webhook validation error:', {
            ip: clientIP,
            path: req.path,
            error: err.message,
            timestamp: new Date().toISOString()
        });
        
        return res.status(400).json({
            error: 'Invalid webhook data',
            timestamp: new Date().toISOString(),
            details: {
                code: 'VALIDATION_ERROR',
                message: 'The webhook payload does not meet the required format'
            }
        });
    }
    
    next(err);
};

/**
 * Security error handler for immediate response
 * @param {string} errorType - Type of security error
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleSecurityError = async (errorType, req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await logSecurityEvent(errorType, {
        ip: clientIP,
        userAgent,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    
    // Always return 200 for security errors to prevent information leakage
    res.status(200).json({
        received: true,
        processed: false,
        message: 'Webhook received'
    });
};

module.exports = {
    webhookErrorHandler,
    asyncWebhookHandler,
    validationErrorHandler,
    handleSecurityError,
    isLikelyAttack,
    getAttackIndicators
};
