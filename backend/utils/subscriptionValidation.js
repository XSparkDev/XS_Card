/**
 * Subscription Validation Utilities
 * 
 * This file provides comprehensive server-side validation for subscription operations
 * Following Golden Rules: NEVER trust client-side data for financial decisions
 */

const { SUBSCRIPTION_PLANS, SUBSCRIPTION_CONSTANTS } = require('../config/subscriptionPlans');
const { logSubscriptionEvent } = require('../models/subscriptionLog');

/**
 * Validate plan ID against configuration
 * @param {string} planId - Plan ID to validate
 * @returns {Object} - Validation result with plan details
 */
const validatePlanId = (planId) => {
    try {
        console.log(`🔍 Validating plan ID: ${planId}`);
        
        // Check if planId is provided
        if (!planId || typeof planId !== 'string') {
            return {
                isValid: false,
                error: 'Plan ID is required and must be a string',
                errorCode: 'INVALID_PLAN_ID_FORMAT',
                plan: null
            };
        }
        
        // Sanitize planId
        const sanitizedPlanId = planId.trim().toUpperCase();
        
        // Check if plan exists in configuration
        const plan = SUBSCRIPTION_PLANS[sanitizedPlanId];
        if (!plan) {
            console.error(`❌ Invalid plan ID: ${planId}`);
            console.log(`Available plans: ${Object.keys(SUBSCRIPTION_PLANS).join(', ')}`);
            
            return {
                isValid: false,
                error: `Invalid plan ID: ${planId}. Available plans: ${Object.keys(SUBSCRIPTION_PLANS).join(', ')}`,
                errorCode: 'PLAN_NOT_FOUND',
                plan: null,
                availablePlans: Object.keys(SUBSCRIPTION_PLANS)
            };
        }
        
        // Validate plan structure
        const requiredFields = ['id', 'name', 'amount', 'planCode', 'interval'];
        const missingFields = requiredFields.filter(field => !plan[field]);
        
        if (missingFields.length > 0) {
            console.error(`❌ Plan ${planId} missing required fields:`, missingFields);
            
            return {
                isValid: false,
                error: `Plan configuration error: missing fields ${missingFields.join(', ')}`,
                errorCode: 'INVALID_PLAN_CONFIGURATION',
                plan: null
            };
        }
        
        console.log(`✅ Plan ID validated: ${planId} -> ${plan.name}`);
        
        return {
            isValid: true,
            error: null,
            errorCode: null,
            plan: plan
        };
        
    } catch (error) {
        console.error('Error validating plan ID:', error.message);
        
        return {
            isValid: false,
            error: 'Plan validation failed due to system error',
            errorCode: 'PLAN_VALIDATION_ERROR',
            plan: null
        };
    }
};

/**
 * Validate payment amount against plan price
 * @param {number} amount - Amount to validate (in cents)
 * @param {Object} plan - Plan object to validate against
 * @returns {Object} - Validation result
 */
const validatePaymentAmount = (amount, plan) => {
    try {
        console.log(`🔍 Validating payment amount: ${amount} against plan: ${plan.name}`);
        
        // Validate amount format
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
            return {
                isValid: false,
                error: 'Payment amount must be a positive number',
                errorCode: 'INVALID_AMOUNT_FORMAT',
                expectedAmount: null
            };
        }
        
        // Calculate expected amount in cents
        const expectedAmount = Math.round(plan.amount * 100);
        
        // Allow for small rounding differences (±1 cent)
        const amountDifference = Math.abs(amount - expectedAmount);
        const tolerance = 1; // 1 cent tolerance
        
        if (amountDifference > tolerance) {
            console.error(`❌ Payment amount mismatch: received ${amount}, expected ${expectedAmount}`);
            
            return {
                isValid: false,
                error: `Payment amount mismatch. Expected: ${expectedAmount} cents (${plan.amount} ${plan.currency || 'ZAR'}), received: ${amount} cents`,
                errorCode: 'AMOUNT_MISMATCH',
                expectedAmount: expectedAmount,
                receivedAmount: amount,
                difference: amountDifference
            };
        }
        
        console.log(`✅ Payment amount validated: ${amount} cents for ${plan.name}`);
        
        return {
            isValid: true,
            error: null,
            errorCode: null,
            expectedAmount: expectedAmount,
            receivedAmount: amount,
            difference: amountDifference
        };
        
    } catch (error) {
        console.error('Error validating payment amount:', error.message);
        
        return {
            isValid: false,
            error: 'Amount validation failed due to system error',
            errorCode: 'AMOUNT_VALIDATION_ERROR',
            expectedAmount: null
        };
    }
};

/**
 * Validate user authentication for subscription operations
 * @param {Object} user - User object from authentication middleware
 * @returns {Object} - Validation result
 */
const validateUserAuthentication = (user) => {
    try {
        console.log(`🔍 Validating user authentication: ${user?.email || 'unknown'}`);
        
        // Check if user object exists
        if (!user || typeof user !== 'object') {
            return {
                isValid: false,
                error: 'User authentication required',
                errorCode: 'AUTHENTICATION_REQUIRED',
                user: null
            };
        }
        
        // Validate required user fields
        const requiredFields = ['uid', 'email'];
        const missingFields = requiredFields.filter(field => !user[field]);
        
        if (missingFields.length > 0) {
            console.error(`❌ User missing required fields:`, missingFields);
            
            return {
                isValid: false,
                error: `User authentication incomplete: missing ${missingFields.join(', ')}`,
                errorCode: 'INCOMPLETE_AUTHENTICATION',
                user: null
            };
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user.email)) {
            console.error(`❌ Invalid email format: ${user.email}`);
            
            return {
                isValid: false,
                error: 'Invalid email format',
                errorCode: 'INVALID_EMAIL_FORMAT',
                user: null
            };
        }
        
        // Validate UID format (Firebase UID should be non-empty string)
        if (typeof user.uid !== 'string' || user.uid.length < 10) {
            console.error(`❌ Invalid user ID format: ${user.uid}`);
            
            return {
                isValid: false,
                error: 'Invalid user ID format',
                errorCode: 'INVALID_USER_ID_FORMAT',
                user: null
            };
        }
        
        console.log(`✅ User authentication validated: ${user.email}`);
        
        return {
            isValid: true,
            error: null,
            errorCode: null,
            user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || null
            }
        };
        
    } catch (error) {
        console.error('Error validating user authentication:', error.message);
        
        return {
            isValid: false,
            error: 'User authentication validation failed',
            errorCode: 'AUTHENTICATION_VALIDATION_ERROR',
            user: null
        };
    }
};

/**
 * Sanitize and validate subscription request data
 * @param {Object} requestData - Raw request data from client
 * @returns {Object} - Sanitized and validated data
 */
const sanitizeSubscriptionData = (requestData) => {
    try {
        console.log('🔍 Sanitizing subscription request data');
        
        if (!requestData || typeof requestData !== 'object') {
            return {
                isValid: false,
                error: 'Invalid request data format',
                errorCode: 'INVALID_REQUEST_FORMAT',
                sanitizedData: null
            };
        }
        
        const sanitized = {};
        const warnings = [];
        
        // Sanitize planId
        if (requestData.planId) {
            let planIdString;
            if (typeof requestData.planId === 'string') {
                planIdString = requestData.planId;
            } else {
                warnings.push('planId converted to string');
                planIdString = String(requestData.planId);
            }
            
            // Remove HTML tags and dangerous content
            planIdString = planIdString
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .replace(/[<>'"]/g, '')
                .trim()
                .toUpperCase();
            
            sanitized.planId = planIdString;
        }
        
        // Sanitize amount (if provided)
        if (requestData.amount !== undefined) {
            const amount = parseFloat(requestData.amount);
            if (!isNaN(amount) && amount > 0) {
                sanitized.amount = Math.round(amount); // Round to nearest cent
            } else {
                return {
                    isValid: false,
                    error: 'Invalid amount format',
                    errorCode: 'INVALID_AMOUNT',
                    sanitizedData: null
                };
            }
        }
        
        // Sanitize metadata (if provided)
        if (requestData.metadata && typeof requestData.metadata === 'object') {
            sanitized.metadata = {};
            for (const [key, value] of Object.entries(requestData.metadata)) {
                // Only allow safe metadata fields
                if (['userId', 'planId', 'source', 'testMode'].includes(key)) {
                    if (typeof value === 'string') {
                        sanitized.metadata[key] = value.trim();
                    } else if (typeof value === 'boolean' || typeof value === 'number') {
                        sanitized.metadata[key] = value;
                    }
                }
            }
        }
        
        // Remove any potentially dangerous fields
        const dangerousFields = ['__proto__', 'constructor', 'prototype'];
        dangerousFields.forEach(field => {
            if (requestData[field]) {
                warnings.push(`Removed dangerous field: ${field}`);
            }
        });
        
        console.log('✅ Subscription data sanitized successfully');
        if (warnings.length > 0) {
            console.warn('Sanitization warnings:', warnings);
        }
        
        return {
            isValid: true,
            error: null,
            errorCode: null,
            sanitizedData: sanitized,
            warnings: warnings
        };
        
    } catch (error) {
        console.error('Error sanitizing subscription data:', error.message);
        
        return {
            isValid: false,
            error: 'Data sanitization failed',
            errorCode: 'SANITIZATION_ERROR',
            sanitizedData: null
        };
    }
};

/**
 * Comprehensive subscription request validation
 * @param {Object} req - Express request object
 * @returns {Object} - Complete validation result
 */
const validateSubscriptionRequest = async (req) => {
    try {
        console.log('🔍 Starting comprehensive subscription request validation');
        
        const validationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            validatedData: {},
            auditLog: {
                timestamp: new Date().toISOString(),
                ip: req.ip || req.connection.remoteAddress || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
            }
        };
        
        // 1. Validate user authentication
        const userValidation = validateUserAuthentication(req.user);
        if (!userValidation.isValid) {
            validationResult.isValid = false;
            validationResult.errors.push(userValidation.error);
            validationResult.auditLog.authenticationError = userValidation.errorCode;
        } else {
            validationResult.validatedData.user = userValidation.user;
        }
        
        // 2. Sanitize request data
        const sanitizationResult = sanitizeSubscriptionData(req.body);
        if (!sanitizationResult.isValid) {
            validationResult.isValid = false;
            validationResult.errors.push(sanitizationResult.error);
            validationResult.auditLog.sanitizationError = sanitizationResult.errorCode;
        } else {
            validationResult.validatedData.request = sanitizationResult.sanitizedData;
            validationResult.warnings.push(...sanitizationResult.warnings);
        }
        
        // 3. Validate plan ID (if request data is valid)
        if (sanitizationResult.isValid && sanitizationResult.sanitizedData.planId) {
            const planValidation = validatePlanId(sanitizationResult.sanitizedData.planId);
            if (!planValidation.isValid) {
                validationResult.isValid = false;
                validationResult.errors.push(planValidation.error);
                validationResult.auditLog.planValidationError = planValidation.errorCode;
            } else {
                validationResult.validatedData.plan = planValidation.plan;
            }
            
            // 4. Validate payment amount (if plan is valid and amount provided)
            if (planValidation.isValid && sanitizationResult.sanitizedData.amount) {
                const amountValidation = validatePaymentAmount(
                    sanitizationResult.sanitizedData.amount, 
                    planValidation.plan
                );
                if (!amountValidation.isValid) {
                    validationResult.isValid = false;
                    validationResult.errors.push(amountValidation.error);
                    validationResult.auditLog.amountValidationError = amountValidation.errorCode;
                } else {
                    validationResult.validatedData.amount = amountValidation;
                }
            }
        }
        
        // Log validation result
        if (validationResult.isValid) {
            console.log('✅ Comprehensive subscription validation passed');
            
            // Log successful validation
            if (userValidation.isValid) {
                await logSubscriptionEvent(
                    userValidation.user.uid,
                    'subscription_validation_success',
                    {
                        planId: validationResult.validatedData.plan?.id,
                        ip: validationResult.auditLog.ip,
                        userAgent: validationResult.auditLog.userAgent
                    }
                );
            }
        } else {
            console.error('❌ Comprehensive subscription validation failed:', validationResult.errors);
            
            // Log validation failure
            if (userValidation.isValid) {
                await logSubscriptionEvent(
                    userValidation.user.uid,
                    'subscription_validation_failed',
                    {
                        errors: validationResult.errors,
                        ip: validationResult.auditLog.ip,
                        userAgent: validationResult.auditLog.userAgent
                    }
                );
            }
        }
        
        return validationResult;
        
    } catch (error) {
        console.error('Error in comprehensive subscription validation:', error.message);
        
        return {
            isValid: false,
            errors: ['Subscription validation system error'],
            warnings: [],
            validatedData: {},
            auditLog: {
                timestamp: new Date().toISOString(),
                systemError: error.message
            }
        };
    }
};

module.exports = {
    validatePlanId,
    validatePaymentAmount,
    validateUserAuthentication,
    sanitizeSubscriptionData,
    validateSubscriptionRequest
};
