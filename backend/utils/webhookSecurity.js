/**
 * Webhook Security Utilities
 * 
 * This file provides comprehensive security utilities for webhook endpoints
 * Following Golden Rules: ALL webhooks MUST have signature verification
 */

const crypto = require('crypto');
const { getEnvOverride } = require('../config/environment');

/**
 * Verify Paystack webhook signature
 * @param {string} payload - Raw webhook payload (JSON string)
 * @param {string} signature - Signature from x-paystack-signature header
 * @param {string} secret - Paystack webhook secret key
 * @returns {boolean} - True if signature is valid
 */
const verifyPaystackSignature = (payload, signature, secret) => {
    try {
        console.log('Verifying Paystack webhook signature...');
        
        // Validate inputs
        if (!payload || typeof payload !== 'string') {
            console.error('Invalid payload for signature verification');
            return false;
        }
        
        if (!signature || typeof signature !== 'string') {
            console.error('Missing or invalid signature header');
            return false;
        }
        
        if (!secret || typeof secret !== 'string') {
            console.error('Missing or invalid webhook secret');
            return false;
        }
        
        // Generate expected signature using HMAC-SHA512
        const expectedSignature = crypto
            .createHmac('sha512', secret)
            .update(payload, 'utf8')
            .digest('hex');
        
        console.log('Signature verification:', {
            received: signature.substring(0, 10) + '...',
            expected: expectedSignature.substring(0, 10) + '...',
            match: signature === expectedSignature
        });
        
        // Use constant-time comparison to prevent timing attacks
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
        
    } catch (error) {
        console.error('Error verifying webhook signature:', error.message);
        return false;
    }
};

/**
 * Validate webhook payload structure
 * @param {Object} payload - Parsed webhook payload
 * @returns {Object} - Validation result
 */
const validateWebhookPayload = (payload) => {
    const errors = [];
    const warnings = [];
    
    try {
        // Check basic structure
        if (!payload || typeof payload !== 'object') {
            errors.push('Payload must be a valid JSON object');
            return { isValid: false, errors, warnings };
        }
        
        // Check required fields
        if (!payload.event || typeof payload.event !== 'string') {
            errors.push('Missing or invalid event field');
        }
        
        if (!payload.data || typeof payload.data !== 'object') {
            errors.push('Missing or invalid data field');
        }
        
        // Validate event type
        const validEvents = [
            'subscription.disable',
            'subscription.not_renewing',
            'subscription.deactivate',
            'charge.success',
            'charge.failed',
            'subscription.create',
            'invoice.create',
            'invoice.payment_failed'
        ];
        
        if (payload.event && !validEvents.includes(payload.event)) {
            warnings.push(`Unknown event type: ${payload.event}`);
        }
        
        // Validate data structure based on event type
        if (payload.event && payload.data) {
            switch (payload.event) {
                case 'subscription.disable':
                case 'subscription.not_renewing':
                case 'subscription.deactivate':
                    if (!payload.data.subscription && !payload.data.customer) {
                        errors.push('Missing subscription or customer data for subscription event');
                    }
                    break;
                    
                case 'charge.success':
                case 'charge.failed':
                    if (!payload.data.reference) {
                        errors.push('Missing reference for charge event');
                    }
                    if (!payload.data.customer || !payload.data.customer.email) {
                        errors.push('Missing customer email for charge event');
                    }
                    break;
            }
        }
        
        // Check for suspicious patterns
        if (payload.data && typeof payload.data === 'object') {
            const dataString = JSON.stringify(payload.data);
            
            // Check for potential injection attempts
            const suspiciousPatterns = [
                /<script/i,
                /javascript:/i,
                /on\w+\s*=/i,
                /eval\s*\(/i,
                /expression\s*\(/i
            ];
            
            for (const pattern of suspiciousPatterns) {
                if (pattern.test(dataString)) {
                    errors.push('Potentially malicious content detected in payload');
                    break;
                }
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
        
    } catch (error) {
        console.error('Error validating webhook payload:', error.message);
        return {
            isValid: false,
            errors: ['Payload validation failed'],
            warnings: []
        };
    }
};

/**
 * Sanitize webhook data
 * @param {Object} data - Webhook data to sanitize
 * @returns {Object} - Sanitized data
 */
const sanitizeWebhookData = (data) => {
    try {
        if (!data || typeof data !== 'object') {
            return {};
        }
        
        const sanitized = {};
        
        // Recursively sanitize object properties
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                // Remove potentially dangerous characters and patterns
                sanitized[key] = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '')
                    .replace(/eval\s*\(/gi, '')
                    .replace(/expression\s*\(/gi, '')
                    .trim();
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = sanitizeWebhookData(value);
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                sanitized[key] = value;
            } else {
                // Skip undefined, null, functions, etc.
                continue;
            }
        }
        
        return sanitized;
        
    } catch (error) {
        console.error('Error sanitizing webhook data:', error.message);
        return {};
    }
};

/**
 * Check if request is from allowed sources (Paystack IP whitelist)
 * @param {string} clientIP - Client IP address
 * @returns {boolean} - True if IP is allowed
 */
const isAllowedIP = (clientIP) => {
    try {
        // Current Paystack webhook IP addresses (as of 2024)
        // These are the ONLY IPs that Paystack sends webhooks from
        const paystackIPs = [
            '52.31.139.75',    // Primary Paystack webhook IP
            '52.49.173.169',   // Secondary Paystack webhook IP  
            '52.214.14.220',   // Tertiary Paystack webhook IP
            '52.31.139.75',    // Duplicate for redundancy check
            '52.49.173.169',   // Duplicate for redundancy check
            '52.214.14.220'    // Duplicate for redundancy check
        ];
        
        // Development/testing IPs (ONLY for development environment)
        const developmentIPs = [
            '127.0.0.1',       // Localhost IPv4
            '::1',             // Localhost IPv6
            'localhost'        // Localhost hostname
        ];
        
        // Get environment configuration
        const nodeEnv = getEnvOverride('NODE_ENV', 'development');
        const allowDevelopmentIPs = getEnvOverride('ALLOW_DEVELOPMENT_IPS', 'true') === 'true';
        
        // In development, allow both Paystack IPs and development IPs
        if (nodeEnv === 'development' && allowDevelopmentIPs) {
            const isPaystackIP = paystackIPs.includes(clientIP);
            const isDevelopmentIP = developmentIPs.includes(clientIP);
            
            if (isPaystackIP) {
                console.log(`✅ Development mode: Paystack IP ${clientIP} allowed`);
                return true;
            } else if (isDevelopmentIP) {
                console.log(`✅ Development mode: Development IP ${clientIP} allowed`);
                return true;
            } else {
                console.log(`⚠️  Development mode: Unknown IP ${clientIP} - checking if it's a valid development IP`);
                // Allow ngrok and other development tunneling services
                if (clientIP.includes('ngrok') || clientIP.includes('tunnel') || clientIP.includes('localhost')) {
                    console.log(`✅ Development mode: Tunneling service IP ${clientIP} allowed`);
                    return true;
                }
            }
        }
        
        // In production, ONLY allow Paystack IPs
        if (nodeEnv === 'production') {
            const isPaystackIP = paystackIPs.includes(clientIP);
            
            if (isPaystackIP) {
                console.log(`✅ Production mode: Paystack IP ${clientIP} allowed`);
                return true;
            } else {
                console.error(`❌ Production mode: Unauthorized IP ${clientIP} blocked`);
                return false;
            }
        }
        
        // Default: be strict and only allow Paystack IPs
        const isPaystackIP = paystackIPs.includes(clientIP);
        
        if (!isPaystackIP) {
            console.warn(`⚠️  Webhook request from unauthorized IP: ${clientIP}`);
            console.warn(`Expected Paystack IPs: ${paystackIPs.join(', ')}`);
        }
        
        return isPaystackIP;
        
    } catch (error) {
        console.error('Error checking IP allowlist:', error.message);
        return false;
    }
};

/**
 * Log webhook security event
 * @param {string} eventType - Type of security event
 * @param {Object} details - Event details
 */
const logSecurityEvent = async (eventType, details) => {
    try {
        const securityLog = {
            eventType,
            timestamp: new Date().toISOString(),
            details: {
                ...details,
                userAgent: details.userAgent || 'unknown',
                ip: details.ip || 'unknown'
            }
        };
        
        console.log('WEBHOOK SECURITY EVENT:', JSON.stringify(securityLog, null, 2));
        
        // In production, you might want to send this to a security monitoring service
        // or store in a separate security logs collection
        
    } catch (error) {
        console.error('Error logging security event:', error.message);
    }
};

/**
 * Comprehensive webhook security validation
 * @param {Object} req - Express request object
 * @returns {Object} - Security validation result
 */
const validateWebhookSecurity = async (req) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
        const userAgent = req.headers['user-agent'];
        const signature = req.headers['x-paystack-signature'];
        const rawPayload = JSON.stringify(req.body);
        
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        // 1. IP Validation
        if (!isAllowedIP(clientIP)) {
            result.isValid = false;
            result.errors.push('Request from unauthorized IP address');
            await logSecurityEvent('unauthorized_ip', { ip: clientIP, userAgent });
        }
        
        // 2. Signature Verification
        const webhookSecret = getEnvOverride('PAYSTACK_WEBHOOK_SECRET', process.env.PAYSTACK_SECRET_KEY);
        if (!verifyPaystackSignature(rawPayload, signature, webhookSecret)) {
            result.isValid = false;
            result.errors.push('Invalid webhook signature');
            await logSecurityEvent('invalid_signature', { ip: clientIP, userAgent });
        }
        
        // 3. Payload Validation
        const payloadValidation = validateWebhookPayload(req.body);
        if (!payloadValidation.isValid) {
            result.isValid = false;
            result.errors.push(...payloadValidation.errors);
        }
        result.warnings.push(...payloadValidation.warnings);
        
        // 4. Rate Limiting Check (basic)
        // Note: Express rate limiting middleware should handle this, but we log it here
        if (req.rateLimit && req.rateLimit.remaining < 10) {
            result.warnings.push('Approaching rate limit');
            await logSecurityEvent('rate_limit_warning', { 
                ip: clientIP, 
                remaining: req.rateLimit.remaining 
            });
        }
        
        // Log successful validation
        if (result.isValid) {
            console.log('Webhook security validation passed:', {
                ip: clientIP,
                event: req.body?.event,
                timestamp: new Date().toISOString()
            });
        } else {
            await logSecurityEvent('security_validation_failed', {
                ip: clientIP,
                userAgent,
                errors: result.errors,
                event: req.body?.event
            });
        }
        
        return result;
        
    } catch (error) {
        console.error('Error in webhook security validation:', error.message);
        return {
            isValid: false,
            errors: ['Security validation failed'],
            warnings: []
        };
    }
};

module.exports = {
    verifyPaystackSignature,
    validateWebhookPayload,
    sanitizeWebhookData,
    isAllowedIP,
    logSecurityEvent,
    validateWebhookSecurity
};
