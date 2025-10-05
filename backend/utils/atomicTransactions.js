/**
 * Atomic Transaction Utilities
 * 
 * This file provides atomic transaction utilities for subscription operations
 * Following Golden Rules: ALL subscription updates MUST be atomic transactions
 */

const { db } = require('../firebase');
const { logSubscriptionEvent } = require('../models/subscriptionLog');

/**
 * Execute atomic subscription update across users and subscriptions collections
 * @param {string} userId - User ID
 * @param {Object} userData - Data to update in users collection
 * @param {Object} subscriptionData - Data to update in subscriptions collection
 * @param {string} operation - Operation type for logging
 * @returns {Promise<boolean>} - Success status
 */
const executeAtomicSubscriptionUpdate = async (userId, userData, subscriptionData, operation) => {
    try {
        console.log(`Starting atomic transaction for user ${userId}: ${operation}`);
        
        // Validate input data
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
            throw new Error('Valid User ID is required for atomic transaction');
        }
        
        if (!userData && !subscriptionData) {
            throw new Error('At least one data object (userData or subscriptionData) is required');
        }
        
        // Validate userData if provided
        if (userData && (typeof userData !== 'object' || Object.keys(userData).length === 0)) {
            throw new Error('userData must be a non-empty object when provided');
        }
        
        // Validate subscriptionData if provided
        if (subscriptionData && (typeof subscriptionData !== 'object' || Object.keys(subscriptionData).length === 0)) {
            throw new Error('subscriptionData must be a non-empty object when provided');
        }
        
        // Create batch operation
        const batch = db.batch();
        
        // Add user document update if provided
        if (userData) {
            const userRef = db.collection('users').doc(userId);
            
            // Check if user document exists
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                // Document exists - use update
                batch.update(userRef, {
                    ...userData,
                    lastUpdated: new Date().toISOString()
                });
                console.log(`Added user update to batch: ${Object.keys(userData).join(', ')}`);
            } else {
                // Document doesn't exist - use set
                batch.set(userRef, {
                    ...userData,
                    userId: userId,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
                console.log(`Added user creation to batch: ${Object.keys(userData).join(', ')}`);
            }
        }
        
        // Add subscription document update if provided
        if (subscriptionData) {
            const subscriptionRef = db.collection('subscriptions').doc(userId);
            
            // NEW: Add retry tracking for payment failures
            if (operation === 'payment_failure') {
                const retryData = {
                    retryAttempts: 0,
                    maxRetries: 3,
                    nextRetryDate: new Date(Date.now() + 1 * 60 * 1000).toISOString(), // 1 minute for testing
                    gracePeriodEnd: new Date(Date.now() + (process.env.PAYMENT_GRACE_PERIOD_MINUTES || 10080) * 60 * 1000).toISOString(), // From env or 7 days
                    status: 'retry_scheduled',
                    retryHistory: []
                };
                
                subscriptionData.paymentRetry = retryData;
                console.log(`Added payment retry tracking to subscription data`);
            }
            
            // NEW: Update retry tracking for retry attempts
            if (operation === 'payment_retry_success') {
                subscriptionData.paymentRetry = null; // Clear retry data on success
                subscriptionData.status = 'active';
                console.log(`Cleared payment retry tracking - payment successful`);
            }
            
            if (operation === 'payment_retry_failed') {
                // This would be called when updating retry attempt results
                const currentRetryAttempt = subscriptionData.retryAttempt || 1;
                if (currentRetryAttempt >= 3) {
                    subscriptionData.status = 'grace_period';
                    console.log(`All retries failed - entered grace period`);
                } else {
                    subscriptionData.status = 'retry_scheduled';
                    console.log(`Retry ${currentRetryAttempt} failed - scheduling next attempt`);
                }
            }
            
            // Always use set with merge for subscriptions to handle both create and update
            batch.set(subscriptionRef, {
                ...subscriptionData,
                userId: userId,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            console.log(`Added subscription update to batch: ${Object.keys(subscriptionData).join(', ')}`);
        }
        
        // Commit the atomic transaction
        await batch.commit();
        console.log(`Atomic transaction completed successfully for user ${userId}: ${operation}`);
        
        // Log the successful operation
        await logSubscriptionEvent(userId, `atomic_${operation}`, {
            userData: userData || null,
            subscriptionData: subscriptionData || null,
            timestamp: new Date().toISOString()
        });
        
        return true;
        
    } catch (error) {
        console.error(`Atomic transaction failed for user ${userId}: ${operation}`, error);
        
        // Log the failed operation
        try {
            await logSubscriptionEvent(userId, `atomic_${operation}_failed`, {
                error: error.message,
                userData: userData || null,
                subscriptionData: subscriptionData || null,
                timestamp: new Date().toISOString()
            });
        } catch (logError) {
            console.error('Failed to log atomic transaction error:', logError);
        }
        
        throw new Error(`Atomic subscription update failed: ${error.message}`);
    }
};

/**
 * Execute atomic subscription creation
 * @param {string} userId - User ID
 * @param {Object} userData - Data to update in users collection
 * @param {Object} subscriptionData - Data to create in subscriptions collection
 * @returns {Promise<boolean>} - Success status
 */
const executeAtomicSubscriptionCreation = async (userId, userData, subscriptionData) => {
    return executeAtomicSubscriptionUpdate(userId, userData, subscriptionData, 'subscription_creation');
};

/**
 * Execute atomic subscription cancellation
 * @param {string} userId - User ID
 * @param {Object} userData - Data to update in users collection
 * @param {Object} subscriptionData - Data to update in subscriptions collection
 * @returns {Promise<boolean>} - Success status
 */
const executeAtomicSubscriptionCancellation = async (userId, userData, subscriptionData) => {
    return executeAtomicSubscriptionUpdate(userId, userData, subscriptionData, 'subscription_cancellation');
};

/**
 * Execute atomic trial to active subscription conversion
 * @param {string} userId - User ID
 * @param {Object} userData - Data to update in users collection
 * @param {Object} subscriptionData - Data to update in subscriptions collection
 * @returns {Promise<boolean>} - Success status
 */
const executeAtomicTrialConversion = async (userId, userData, subscriptionData) => {
    return executeAtomicSubscriptionUpdate(userId, userData, subscriptionData, 'trial_conversion');
};

/**
 * Execute atomic payment failure update
 * @param {string} userId - User ID
 * @param {Object} userData - Data to update in users collection
 * @returns {Promise<boolean>} - Success status
 */
const executeAtomicPaymentFailure = async (userId, userData) => {
    // Add minimal subscription data to trigger retry tracking
    const subscriptionData = {
        status: 'payment_failed'
    };
    return executeAtomicSubscriptionUpdate(userId, userData, subscriptionData, 'payment_failure');
};

/**
 * Execute payment retry - NEW FUNCTION
 * Following Golden Rules: ALWAYS use atomic transactions for payment operations
 * @param {string} userId - User ID
 * @param {number} attempt - Retry attempt number
 * @returns {Object} - Retry result with transaction details
 */
const executePaymentRetry = async (userId, attempt) => {
    try {
        console.log(`🔄 Executing payment retry ${attempt} for user: ${userId}`);
        
        // Get subscription data
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        if (!subscriptionDoc.exists) {
            throw new Error('Subscription not found');
        }
        
        const subscriptionData = subscriptionDoc.data();
        const subscriptionCode = subscriptionData.subscriptionCode;
        
        if (!subscriptionCode) {
            throw new Error('No Paystack subscription code found');
        }
        
        // Attempt payment retry with Paystack
        const { retryPaystackPayment } = require('../services/paymentRetryService');
        const retryResult = await retryPaystackPayment(subscriptionCode, attempt);
        
        if (retryResult.success) {
            // Payment successful - clear retry data
            const success = await executeAtomicSubscriptionUpdate(userId, {}, {
                status: 'active',
                lastPaymentDate: new Date().toISOString(),
                paymentRetry: null // Clear retry data
            }, 'payment_retry_success');
            
            if (success) {
                const transactionId = `retry_success_${userId}_${Date.now()}`;
                await logSubscriptionEvent(userId, 'payment_retry_successful', {
                    attempt: attempt,
                    transactionId: transactionId,
                    paystackData: retryResult.data
                });
                
                return { 
                    success: true, 
                    message: 'Payment retry successful',
                    transactionId: transactionId
                };
            }
        } else {
            // Payment failed - update retry status
            if (attempt < 3) {
                // Schedule next retry
                const success = await executeAtomicSubscriptionUpdate(userId, {}, {
                    retryAttempt: attempt,
                    status: 'retry_scheduled'
                }, 'payment_retry_failed');
                
                if (success) {
                    await logSubscriptionEvent(userId, 'payment_retry_failed', {
                        attempt: attempt,
                        error: retryResult.error,
                        nextAttempt: attempt + 1
                    });
                    
                    return { 
                        success: false, 
                        message: 'Payment retry failed, next attempt scheduled',
                        nextAttempt: attempt + 1
                    };
                }
            } else {
                // All retries failed - enter grace period
                const success = await executeAtomicSubscriptionUpdate(userId, {}, {
                    status: 'grace_period',
                    retryAttempt: attempt
                }, 'payment_retry_failed');
                
                if (success) {
                    await logSubscriptionEvent(userId, 'grace_period_activated', {
                        gracePeriodEnd: new Date(Date.now() + (process.env.PAYMENT_GRACE_PERIOD_MINUTES || 10080) * 60 * 1000).toISOString(), // From env or 7 days
                        daysRemaining: 0,
                        minutesRemaining: 2, // 2 minutes for testing
                        actionRequired: 'update_payment_method'
                    });
                    
                    return { 
                        success: false, 
                        message: 'All retry attempts failed, grace period activated',
                        gracePeriod: true
                    };
                }
            }
        }
        
        return { success: false, error: 'Atomic transaction failed' };
        
    } catch (error) {
        console.error('❌ Payment retry execution failed:', error.message);
        
        await logSubscriptionEvent(userId, 'payment_retry_execution_error', {
            attempt: attempt,
            error: error.message,
            stack: error.stack
        });
        
        return { 
            success: false, 
            error: error.message,
            errorCode: 'RETRY_EXECUTION_ERROR'
        };
    }
};

/**
 * Validate data consistency between users and subscriptions collections
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Consistency check result
 */
const validateDataConsistency = async (userId) => {
    try {
        console.log(`Checking data consistency for user ${userId}`);
        
        // Get both documents
        const userDoc = await db.collection('users').doc(userId).get();
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        
        if (!userDoc.exists) {
            throw new Error(`User document not found: ${userId}`);
        }
        
        const userData = userDoc.data();
        const subscriptionData = subscriptionDoc.exists ? subscriptionDoc.data() : null;
        
        const inconsistencies = [];
        
        // Check if subscription status matches
        if (subscriptionData && userData.subscriptionStatus !== subscriptionData.status) {
            inconsistencies.push({
                field: 'subscriptionStatus/status',
                userValue: userData.subscriptionStatus,
                subscriptionValue: subscriptionData.status
            });
        }
        
        // Check if plan matches
        if (subscriptionData && userData.subscriptionPlan !== subscriptionData.planId) {
            inconsistencies.push({
                field: 'subscriptionPlan/planId',
                userValue: userData.subscriptionPlan,
                subscriptionValue: subscriptionData.planId
            });
        }
        
        // Check if reference matches
        if (subscriptionData && userData.subscriptionReference !== subscriptionData.reference) {
            inconsistencies.push({
                field: 'subscriptionReference/reference',
                userValue: userData.subscriptionReference,
                subscriptionValue: subscriptionData.reference
            });
        }
        
        const isConsistent = inconsistencies.length === 0;
        
        if (!isConsistent) {
            console.error(`Data inconsistency detected for user ${userId}:`, inconsistencies);
        } else {
            console.log(`Data consistency check passed for user ${userId}`);
        }
        
        return {
            isConsistent,
            inconsistencies,
            userData,
            subscriptionData
        };
        
    } catch (error) {
        console.error(`Data consistency check failed for user ${userId}:`, error);
        throw new Error(`Data consistency check failed: ${error.message}`);
    }
};

module.exports = {
    executeAtomicSubscriptionUpdate,
    executeAtomicSubscriptionCreation,
    executeAtomicSubscriptionCancellation,
    executeAtomicTrialConversion,
    executeAtomicPaymentFailure,
    executePaymentRetry, // NEW: Payment retry execution
    validateDataConsistency
};
