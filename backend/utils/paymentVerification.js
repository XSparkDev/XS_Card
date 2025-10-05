/**
 * Payment Verification Utilities
 * 
 * This file provides enhanced payment verification for subscription operations
 * Following Golden Rules: ALWAYS verify with Paystack API before processing any payment
 */

const https = require('https');
const crypto = require('crypto');
const { getRequestOptions } = require('../config/paystack');
const { logSubscriptionEvent } = require('../models/subscriptionLog');
const { db } = require('../firebase');

/**
 * Enhanced Paystack transaction verification with multiple checks
 * @param {string} reference - Transaction reference
 * @param {number} expectedAmount - Expected amount in kobo/cents
 * @param {string} expectedEmail - Expected customer email
 * @returns {Object} - Comprehensive verification result
 */
const enhancedPaystackVerification = async (reference, expectedAmount = null, expectedEmail = null) => {
    try {
        console.log(`🔍 Enhanced Paystack verification for reference: ${reference}`);
        
        // Validate inputs
        if (!reference || typeof reference !== 'string') {
            return {
                isValid: false,
                error: 'Transaction reference is required',
                errorCode: 'MISSING_REFERENCE',
                transactionData: null
            };
        }
        
        // Make request to Paystack verification endpoint
        const options = getRequestOptions(`/transaction/verify/${reference}`, 'GET');
        
        const verificationData = await new Promise((resolve, reject) => {
            const req = https.request(options, res => {
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Invalid JSON response from Paystack'));
                    }
                });
            });
            
            req.on('error', reject);
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Paystack verification request timeout'));
            });
            
            req.end();
        });
        
        console.log('Paystack verification response received');
        
        // Validate Paystack response structure
        if (!verificationData.status || !verificationData.data) {
            console.error('❌ Invalid Paystack verification response:', verificationData);
            
            return {
                isValid: false,
                error: verificationData.message || 'Invalid Paystack response',
                errorCode: 'INVALID_PAYSTACK_RESPONSE',
                transactionData: null
            };
        }
        
        const transaction = verificationData.data;
        
        // Comprehensive transaction validation
        const validationChecks = [];
        
        // 1. Transaction status check
        if (transaction.status !== 'success') {
            validationChecks.push({
                check: 'transaction_status',
                passed: false,
                expected: 'success',
                actual: transaction.status,
                message: `Transaction status is ${transaction.status}, expected success`
            });
        } else {
            validationChecks.push({
                check: 'transaction_status',
                passed: true,
                message: 'Transaction status is success'
            });
        }
        
        // 2. Amount validation (if expected amount provided)
        if (expectedAmount !== null) {
            const amountMatch = Math.abs(transaction.amount - expectedAmount) <= 1; // Allow 1 kobo tolerance
            validationChecks.push({
                check: 'amount_validation',
                passed: amountMatch,
                expected: expectedAmount,
                actual: transaction.amount,
                message: amountMatch 
                    ? 'Transaction amount matches expected amount'
                    : `Amount mismatch: expected ${expectedAmount}, got ${transaction.amount}`
            });
        }
        
        // 3. Email validation (if expected email provided)
        if (expectedEmail !== null && transaction.customer) {
            const emailMatch = transaction.customer.email?.toLowerCase() === expectedEmail.toLowerCase();
            validationChecks.push({
                check: 'email_validation',
                passed: emailMatch,
                expected: expectedEmail,
                actual: transaction.customer.email,
                message: emailMatch 
                    ? 'Customer email matches expected email'
                    : `Email mismatch: expected ${expectedEmail}, got ${transaction.customer.email}`
            });
        }
        
        // 4. Reference validation
        const referenceMatch = transaction.reference === reference;
        validationChecks.push({
            check: 'reference_validation',
            passed: referenceMatch,
            expected: reference,
            actual: transaction.reference,
            message: referenceMatch 
                ? 'Transaction reference matches'
                : `Reference mismatch: expected ${reference}, got ${transaction.reference}`
        });
        
        // 5. Currency validation (should be ZAR for South African transactions)
        const expectedCurrency = 'ZAR';
        const currencyMatch = transaction.currency === expectedCurrency;
        validationChecks.push({
            check: 'currency_validation',
            passed: currencyMatch,
            expected: expectedCurrency,
            actual: transaction.currency,
            message: currencyMatch 
                ? 'Transaction currency is correct'
                : `Currency mismatch: expected ${expectedCurrency}, got ${transaction.currency}`
        });
        
        // 6. Gateway response validation
        const gatewaySuccess = transaction.gateway_response === 'Successful' || 
                             transaction.gateway_response === 'Approved';
        validationChecks.push({
            check: 'gateway_response',
            passed: gatewaySuccess,
            actual: transaction.gateway_response,
            message: gatewaySuccess 
                ? 'Gateway response indicates success'
                : `Gateway response: ${transaction.gateway_response}`
        });
        
        // 7. Transaction age validation (not too old)
        const transactionDate = new Date(transaction.created_at || transaction.createdAt);
        const now = new Date();
        const ageInMinutes = (now - transactionDate) / (1000 * 60);
        const maxAgeMinutes = 60; // 1 hour maximum age
        const ageValid = ageInMinutes <= maxAgeMinutes;
        
        validationChecks.push({
            check: 'transaction_age',
            passed: ageValid,
            actual: `${Math.round(ageInMinutes)} minutes`,
            threshold: `${maxAgeMinutes} minutes`,
            message: ageValid 
                ? 'Transaction age is acceptable'
                : `Transaction too old: ${Math.round(ageInMinutes)} minutes (max ${maxAgeMinutes})`
        });
        
        // Determine overall validation result
        const failedChecks = validationChecks.filter(check => !check.passed);
        const isValid = failedChecks.length === 0;
        
        if (isValid) {
            console.log('✅ Enhanced Paystack verification passed all checks');
        } else {
            console.error('❌ Enhanced Paystack verification failed checks:', failedChecks.map(c => c.message));
        }
        
        return {
            isValid: isValid,
            error: isValid ? null : 'Transaction verification failed',
            errorCode: isValid ? null : 'VERIFICATION_FAILED',
            transactionData: transaction,
            validationChecks: validationChecks,
            failedChecks: failedChecks,
            summary: {
                reference: transaction.reference,
                status: transaction.status,
                amount: transaction.amount,
                currency: transaction.currency,
                customerEmail: transaction.customer?.email,
                gatewayResponse: transaction.gateway_response,
                createdAt: transaction.created_at || transaction.createdAt
            }
        };
        
    } catch (error) {
        console.error('❌ Enhanced Paystack verification error:', error.message);
        
        return {
            isValid: false,
            error: 'Payment verification failed due to system error',
            errorCode: 'VERIFICATION_SYSTEM_ERROR',
            transactionData: null,
            systemError: error.message
        };
    }
};

/**
 * Check for duplicate transaction references
 * @param {string} reference - Transaction reference to check
 * @param {string} userId - User ID for scoped duplicate check
 * @returns {Object} - Duplicate check result
 */
const checkDuplicateTransaction = async (reference, userId = null) => {
    try {
        console.log(`🔍 Checking for duplicate transaction: ${reference}`);
        
        // Check in subscription logs
        const logQuery = db.collection('subscriptionLogs')
            .where('eventData.reference', '==', reference)
            .limit(1);
        
        const logSnapshot = await logQuery.get();
        
        if (!logSnapshot.empty) {
            const duplicateLog = logSnapshot.docs[0].data();
            console.warn('⚠️  Duplicate transaction reference found in logs:', reference);
            
            return {
                isDuplicate: true,
                source: 'subscription_logs',
                originalTransaction: {
                    userId: duplicateLog.userId,
                    timestamp: duplicateLog.timestamp,
                    eventType: duplicateLog.eventType
                },
                error: 'Transaction reference already processed',
                errorCode: 'DUPLICATE_REFERENCE'
            };
        }
        
        // Check in subscriptions collection for this reference
        const subscriptionQuery = db.collection('subscriptions')
            .where('reference', '==', reference)
            .limit(1);
        
        const subscriptionSnapshot = await subscriptionQuery.get();
        
        if (!subscriptionSnapshot.empty) {
            const duplicateSubscription = subscriptionSnapshot.docs[0].data();
            console.warn('⚠️  Duplicate transaction reference found in subscriptions:', reference);
            
            return {
                isDuplicate: true,
                source: 'subscriptions',
                originalTransaction: {
                    userId: duplicateSubscription.userId,
                    createdAt: duplicateSubscription.createdAt,
                    status: duplicateSubscription.status
                },
                error: 'Transaction reference already used for subscription',
                errorCode: 'DUPLICATE_SUBSCRIPTION_REFERENCE'
            };
        }
        
        console.log('✅ No duplicate transaction found');
        
        return {
            isDuplicate: false,
            source: null,
            originalTransaction: null,
            error: null,
            errorCode: null
        };
        
    } catch (error) {
        console.error('❌ Error checking duplicate transaction:', error.message);
        
        return {
            isDuplicate: false, // Fail open - allow transaction if check fails
            source: null,
            originalTransaction: null,
            error: 'Duplicate check failed due to system error',
            errorCode: 'DUPLICATE_CHECK_ERROR',
            systemError: error.message
        };
    }
};

/**
 * Cross-validate payment amount with multiple sources
 * @param {number} paystackAmount - Amount from Paystack verification
 * @param {Object} plan - Plan configuration
 * @param {number} clientAmount - Amount from client request (optional)
 * @returns {Object} - Cross-validation result
 */
const crossValidateAmount = (paystackAmount, plan, clientAmount = null) => {
    try {
        console.log(`🔍 Cross-validating payment amount: Paystack=${paystackAmount}, Plan=${plan.amount * 100}`);
        
        const expectedAmount = Math.round(plan.amount * 100); // Convert to kobo/cents
        const validationResults = [];
        
        // 1. Validate against plan amount
        const planAmountDiff = Math.abs(paystackAmount - expectedAmount);
        const planAmountValid = planAmountDiff <= 1; // Allow 1 kobo tolerance
        
        validationResults.push({
            source: 'plan_configuration',
            expected: expectedAmount,
            actual: paystackAmount,
            difference: planAmountDiff,
            isValid: planAmountValid,
            message: planAmountValid 
                ? 'Amount matches plan configuration'
                : `Amount differs from plan by ${planAmountDiff} kobo`
        });
        
        // 2. Validate against client amount (if provided)
        if (clientAmount !== null) {
            const clientAmountDiff = Math.abs(paystackAmount - clientAmount);
            const clientAmountValid = clientAmountDiff <= 1;
            
            validationResults.push({
                source: 'client_request',
                expected: clientAmount,
                actual: paystackAmount,
                difference: clientAmountDiff,
                isValid: clientAmountValid,
                message: clientAmountValid 
                    ? 'Amount matches client request'
                    : `Amount differs from client request by ${clientAmountDiff} kobo`
            });
        }
        
        // 3. Validate amount is positive and reasonable
        const reasonableMin = 100; // R1.00 minimum
        const reasonableMax = 500000; // R5000.00 maximum
        const amountReasonable = paystackAmount >= reasonableMin && paystackAmount <= reasonableMax;
        
        validationResults.push({
            source: 'reasonableness_check',
            expected: `${reasonableMin}-${reasonableMax} kobo`,
            actual: paystackAmount,
            isValid: amountReasonable,
            message: amountReasonable 
                ? 'Amount is within reasonable range'
                : `Amount ${paystackAmount} is outside reasonable range (${reasonableMin}-${reasonableMax} kobo)`
        });
        
        // Determine overall validation result
        const failedValidations = validationResults.filter(v => !v.isValid);
        const isValid = failedValidations.length === 0;
        
        if (isValid) {
            console.log('✅ Payment amount cross-validation passed');
        } else {
            console.error('❌ Payment amount cross-validation failed:', failedValidations.map(v => v.message));
        }
        
        return {
            isValid: isValid,
            validationResults: validationResults,
            failedValidations: failedValidations,
            summary: {
                paystackAmount: paystackAmount,
                expectedAmount: expectedAmount,
                planAmount: plan.amount,
                currency: plan.currency || 'ZAR'
            }
        };
        
    } catch (error) {
        console.error('❌ Error in payment amount cross-validation:', error.message);
        
        return {
            isValid: false,
            validationResults: [],
            failedValidations: [{ message: 'Cross-validation system error' }],
            systemError: error.message
        };
    }
};

/**
 * Enhanced reference validation to prevent replay attacks
 * @param {string} reference - Transaction reference
 * @param {string} expectedPattern - Expected reference pattern (optional)
 * @returns {Object} - Reference validation result
 */
const validateTransactionReference = (reference, expectedPattern = null) => {
    try {
        console.log(`🔍 Validating transaction reference: ${reference}`);
        
        const validationChecks = [];
        
        // 1. Basic format validation
        if (!reference || typeof reference !== 'string') {
            validationChecks.push({
                check: 'reference_format',
                passed: false,
                message: 'Reference must be a non-empty string'
            });
        } else {
            validationChecks.push({
                check: 'reference_format',
                passed: true,
                message: 'Reference format is valid'
            });
        }
        
        // 2. Length validation (Paystack references are typically 10+ characters)
        const lengthValid = reference && reference.length >= 8 && reference.length <= 50;
        validationChecks.push({
            check: 'reference_length',
            passed: lengthValid,
            actual: reference?.length || 0,
            expected: '8-50 characters',
            message: lengthValid 
                ? 'Reference length is acceptable'
                : `Reference length ${reference?.length || 0} is invalid (expected 8-50 characters)`
        });
        
        // 3. Character validation (alphanumeric and common symbols)
        const validCharPattern = /^[a-zA-Z0-9_-]+$/;
        const charactersValid = reference && validCharPattern.test(reference);
        validationChecks.push({
            check: 'reference_characters',
            passed: charactersValid,
            message: charactersValid 
                ? 'Reference contains valid characters'
                : 'Reference contains invalid characters (only alphanumeric, underscore, hyphen allowed)'
        });
        
        // 4. Pattern validation (if expected pattern provided)
        if (expectedPattern) {
            const patternRegex = new RegExp(expectedPattern);
            const patternValid = patternRegex.test(reference);
            validationChecks.push({
                check: 'reference_pattern',
                passed: patternValid,
                expected: expectedPattern,
                actual: reference,
                message: patternValid 
                    ? 'Reference matches expected pattern'
                    : `Reference does not match expected pattern: ${expectedPattern}`
            });
        }
        
        // 5. Uniqueness validation (basic - not obviously sequential)
        const notSequential = !/^(.*?)\1+$/.test(reference) && !/^(012|123|234|345|456|567|678|789|890|901)/.test(reference);
        validationChecks.push({
            check: 'reference_uniqueness',
            passed: notSequential,
            message: notSequential 
                ? 'Reference appears to be unique'
                : 'Reference appears to be sequential or repetitive'
        });
        
        const failedChecks = validationChecks.filter(check => !check.passed);
        const isValid = failedChecks.length === 0;
        
        if (isValid) {
            console.log('✅ Transaction reference validation passed');
        } else {
            console.error('❌ Transaction reference validation failed:', failedChecks.map(c => c.message));
        }
        
        return {
            isValid: isValid,
            validationChecks: validationChecks,
            failedChecks: failedChecks,
            reference: reference
        };
        
    } catch (error) {
        console.error('❌ Error validating transaction reference:', error.message);
        
        return {
            isValid: false,
            validationChecks: [],
            failedChecks: [{ message: 'Reference validation system error' }],
            systemError: error.message
        };
    }
};

/**
 * Comprehensive payment verification combining all checks
 * @param {string} reference - Transaction reference
 * @param {Object} plan - Plan configuration
 * @param {string} userEmail - Expected customer email
 * @param {string} userId - User ID for duplicate checking
 * @param {number} clientAmount - Amount from client request (optional)
 * @returns {Object} - Comprehensive verification result
 */
const comprehensivePaymentVerification = async (reference, plan, userEmail, userId, clientAmount = null) => {
    try {
        console.log(`🔍 Starting comprehensive payment verification for reference: ${reference}`);
        
        const verificationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            checks: {},
            summary: {
                reference: reference,
                userEmail: userEmail,
                userId: userId,
                planId: plan.id,
                timestamp: new Date().toISOString()
            }
        };
        
        // 1. Reference validation
        const referenceValidation = validateTransactionReference(reference);
        verificationResult.checks.referenceValidation = referenceValidation;
        
        if (!referenceValidation.isValid) {
            verificationResult.isValid = false;
            verificationResult.errors.push('Invalid transaction reference format');
        }
        
        // 2. Duplicate check
        const duplicateCheck = await checkDuplicateTransaction(reference, userId);
        verificationResult.checks.duplicateCheck = duplicateCheck;
        
        if (duplicateCheck.isDuplicate) {
            verificationResult.isValid = false;
            verificationResult.errors.push('Duplicate transaction reference');
        }
        
        // 3. Enhanced Paystack verification
        const expectedAmount = Math.round(plan.amount * 100);
        const paystackVerification = await enhancedPaystackVerification(reference, expectedAmount, userEmail);
        verificationResult.checks.paystackVerification = paystackVerification;
        
        if (!paystackVerification.isValid) {
            verificationResult.isValid = false;
            verificationResult.errors.push('Paystack verification failed');
        }
        
        // 4. Amount cross-validation (if Paystack verification passed)
        if (paystackVerification.isValid && paystackVerification.transactionData) {
            const amountCrossValidation = crossValidateAmount(
                paystackVerification.transactionData.amount, 
                plan, 
                clientAmount
            );
            verificationResult.checks.amountCrossValidation = amountCrossValidation;
            
            if (!amountCrossValidation.isValid) {
                verificationResult.isValid = false;
                verificationResult.errors.push('Payment amount validation failed');
            }
        }
        
        // Log comprehensive verification result
        if (verificationResult.isValid) {
            console.log('✅ Comprehensive payment verification passed all checks');
            
            await logSubscriptionEvent(userId, 'payment_verification_success', {
                reference: reference,
                planId: plan.id,
                amount: paystackVerification.transactionData?.amount,
                checks: Object.keys(verificationResult.checks).length
            });
        } else {
            console.error('❌ Comprehensive payment verification failed:', verificationResult.errors);
            
            await logSubscriptionEvent(userId, 'payment_verification_failed', {
                reference: reference,
                planId: plan.id,
                errors: verificationResult.errors,
                failedChecks: Object.keys(verificationResult.checks).filter(
                    key => !verificationResult.checks[key].isValid
                )
            });
        }
        
        return verificationResult;
        
    } catch (error) {
        console.error('❌ Error in comprehensive payment verification:', error.message);
        
        return {
            isValid: false,
            errors: ['Payment verification system error'],
            warnings: [],
            checks: {},
            systemError: error.message,
            summary: {
                reference: reference,
                timestamp: new Date().toISOString()
            }
        };
    }
};

module.exports = {
    enhancedPaystackVerification,
    checkDuplicateTransaction,
    crossValidateAmount,
    validateTransactionReference,
    comprehensivePaymentVerification
};
