/**
 * Plan Management Controller
 * 
 * Handles HTTP requests for subscription plan management
 * Following Golden Rules: ALWAYS validate all financial data server-side
 */

const {
    changePlan,
    calculateProration,
    validatePlanChange
} = require('../services/planManagementService');
const { logSubscriptionEvent } = require('../models/subscriptionLog');
const { db } = require('../firebase');

/**
 * POST /subscription/change-plan
 * Change user's subscription plan with proration
 */
const changePlanController = async (req, res) => {
    try {
        console.log('🔄 Plan change request received');
        
        // Validate authentication
        if (!req.user || !req.user.uid) {
            console.error('❌ Unauthorized plan change request');
            
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to change your plan'
            });
        }
        
        const userId = req.user.uid;
        const userEmail = req.user.email;
        const { newPlanId, currentPlanId } = req.body;
        
        console.log(`📋 Plan change request: ${currentPlanId} -> ${newPlanId} for ${userEmail}`);
        
        // Validate required fields
        if (!newPlanId || !currentPlanId) {
            console.error('❌ Missing required plan change parameters');
            
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                message: 'Both currentPlanId and newPlanId are required'
            });
        }
        
        // Get current billing period for proration calculation
        let billingPeriod = null;
        try {
            const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
            if (subscriptionDoc.exists) {
                const subscriptionData = subscriptionDoc.data();
                
                // Try to extract billing period from various sources
                const periodStart = subscriptionData.currentPeriodStart || 
                                  subscriptionData.trialStartDate || 
                                  subscriptionData.createdAt;
                                  
                const periodEnd = subscriptionData.currentPeriodEnd || 
                                subscriptionData.trialEndDate || 
                                subscriptionData.subscriptionEnd;
                
                if (periodStart && periodEnd) {
                    billingPeriod = {
                        start: periodStart,
                        end: periodEnd
                    };
                    
                    console.log('📅 Billing period found:', billingPeriod);
                } else {
                    console.warn('⚠️  No billing period found - proration may not be accurate');
                }
            }
        } catch (error) {
            console.warn('⚠️  Could not fetch billing period:', error.message);
        }
        
        // Execute comprehensive plan change
        const result = await changePlan(userId, currentPlanId, newPlanId, billingPeriod);
        
        if (result.success) {
            console.log(`✅ Plan change successful for ${userEmail}:`, {
                changeType: result.planChange.changeType,
                transactionId: result.transactionId
            });
            
            // Return success response
            return res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    planChange: result.planChange,
                    proration: result.proration,
                    effectiveDate: result.effectiveDate,
                    transactionId: result.transactionId
                }
            });
        } else {
            console.error(`❌ Plan change failed for ${userEmail}:`, result.error);
            
            // Determine appropriate status code
            let statusCode = 400;
            if (result.errorCode === 'SYSTEM_ERROR') {
                statusCode = 500;
            } else if (result.errorCode === 'NO_SUBSCRIPTION_CODE') {
                statusCode = 404;
            }
            
            // Log the failure for audit trail
            await logSubscriptionEvent(userId, 'plan_change_controller_error', {
                currentPlan: currentPlanId,
                newPlan: newPlanId,
                error: result.error,
                errorCode: result.errorCode
            });
            
            return res.status(statusCode).json({
                success: false,
                error: result.error,
                errorCode: result.errorCode,
                ...(result.errors && { errors: result.errors }),
                ...(result.requiresManualReview && { 
                    requiresManualReview: true,
                    message: 'Plan change requires manual review. Please contact support.'
                })
            });
        }
        
    } catch (error) {
        console.error('❌ Plan change controller error:', error.message);
        
        // Log system error
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'plan_change_controller_system_error', {
                error: error.message,
                stack: error.stack,
                requestBody: req.body
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to process plan change. Please try again later.'
        });
    }
};

/**
 * POST /subscription/preview-plan-change
 * Preview plan change with proration calculation (no actual change)
 */
const previewPlanChangeController = async (req, res) => {
    try {
        console.log('🔍 Plan change preview request received');
        
        // Validate authentication
        if (!req.user || !req.user.uid) {
            console.error('❌ Unauthorized plan change preview request');
            
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to preview plan changes'
            });
        }
        
        const userId = req.user.uid;
        const userEmail = req.user.email;
        const { newPlanId, currentPlanId } = req.body;
        
        console.log(`🔍 Plan change preview: ${currentPlanId} -> ${newPlanId} for ${userEmail}`);
        
        // Validate required fields
        if (!newPlanId || !currentPlanId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                message: 'Both currentPlanId and newPlanId are required'
            });
        }
        
        // Validate plan change (without executing)
        const validation = await validatePlanChange(userId, currentPlanId, newPlanId);
        
        if (!validation.isValid) {
            console.log('❌ Plan change preview validation failed:', validation.errors);
            
            return res.status(400).json({
                success: false,
                error: 'Plan change validation failed',
                errors: validation.errors
            });
        }
        
        // Get billing period for proration calculation
        let billingPeriod = null;
        let prorationResult = null;
        
        try {
            const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
            if (subscriptionDoc.exists) {
                const subscriptionData = subscriptionDoc.data();
                
                const periodStart = subscriptionData.currentPeriodStart || 
                                  subscriptionData.trialStartDate || 
                                  subscriptionData.createdAt;
                                  
                const periodEnd = subscriptionData.currentPeriodEnd || 
                                subscriptionData.trialEndDate || 
                                subscriptionData.subscriptionEnd;
                
                if (periodStart && periodEnd) {
                    billingPeriod = { start: periodStart, end: periodEnd };
                    
                    // Calculate proration
                    const { calculateProration } = require('../services/planManagementService');
                    prorationResult = calculateProration(
                        validation.currentPlan,
                        validation.newPlan,
                        periodStart,
                        periodEnd
                    );
                }
            }
        } catch (error) {
            console.warn('⚠️  Could not calculate proration for preview:', error.message);
        }
        
        console.log(`✅ Plan change preview generated for ${userEmail}`);
        
        // Log preview request
        await logSubscriptionEvent(userId, 'plan_change_preview', {
            currentPlan: currentPlanId,
            newPlan: newPlanId,
            changeType: validation.changeType,
            hasProration: !!prorationResult
        });
        
        // Return preview data
        return res.status(200).json({
            success: true,
            message: 'Plan change preview generated',
            data: {
                validation: {
                    isValid: validation.isValid,
                    changeType: validation.changeType
                },
                planChange: {
                    fromPlan: {
                        id: validation.currentPlan.id,
                        name: validation.currentPlan.name,
                        amount: validation.currentPlan.amount,
                        interval: validation.currentPlan.interval
                    },
                    toPlan: {
                        id: validation.newPlan.id,
                        name: validation.newPlan.name,
                        amount: validation.newPlan.amount,
                        interval: validation.newPlan.interval
                    }
                },
                proration: prorationResult ? {
                    type: prorationResult.prorationType,
                    netAmount: prorationResult.netAmount,
                    netAmountCents: prorationResult.netAmountCents,
                    description: prorationResult.prorationType === 'upgrade_charge' 
                        ? `You will be charged an additional R${Math.abs(prorationResult.netAmount)} for the upgrade, prorated for the remaining ${prorationResult.period.remainingDays} days of your current billing period.`
                        : prorationResult.prorationType === 'downgrade_credit'
                        ? `You will receive a credit of R${Math.abs(prorationResult.netAmount)} for the downgrade, prorated for the remaining ${prorationResult.period.remainingDays} days of your current billing period.`
                        : 'No additional charge or credit will be applied.',
                    calculation: prorationResult.calculation,
                    period: prorationResult.period
                } : {
                    type: 'no_proration',
                    description: 'Proration could not be calculated. The plan change will take effect at the next billing cycle.'
                },
                effectiveDate: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Plan change preview controller error:', error.message);
        
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'plan_change_preview_error', {
                error: error.message,
                requestBody: req.body
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to generate plan change preview. Please try again later.'
        });
    }
};

/**
 * GET /subscription/available-plans
 * Get available plans for plan changes
 */
const getAvailablePlansController = async (req, res) => {
    try {
        console.log('📋 Available plans request received');
        
        // Validate authentication
        if (!req.user || !req.user.uid) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to view available plans'
            });
        }
        
        const userId = req.user.uid;
        
        // Get current plan from database
        let currentPlan = null;
        try {
            const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
            if (subscriptionDoc.exists) {
                const subscriptionData = subscriptionDoc.data();
                currentPlan = subscriptionData.planId;
            }
        } catch (error) {
            console.warn('⚠️  Could not fetch current plan:', error.message);
        }
        
        // Get available plans from configuration
        const { SUBSCRIPTION_PLANS } = require('../config/subscriptionPlans');
        
        const availablePlans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
            id: plan.id,
            name: plan.name,
            amount: plan.amount,
            currency: plan.currency || 'ZAR',
            interval: plan.interval,
            description: plan.description || '',
            features: plan.features || [],
            isCurrent: plan.id === currentPlan
        }));
        
        console.log(`✅ Available plans returned for user ${userId}: ${availablePlans.length} plans`);
        
        // Log request
        await logSubscriptionEvent(userId, 'available_plans_requested', {
            currentPlan: currentPlan,
            availablePlansCount: availablePlans.length
        });
        
        return res.status(200).json({
            success: true,
            message: 'Available plans retrieved',
            data: {
                currentPlan: currentPlan,
                availablePlans: availablePlans,
                planCount: availablePlans.length
            }
        });
        
    } catch (error) {
        console.error('❌ Available plans controller error:', error.message);
        
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'available_plans_error', {
                error: error.message
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to retrieve available plans. Please try again later.'
        });
    }
};

module.exports = {
    changePlanController,
    previewPlanChangeController,
    getAvailablePlansController
};
