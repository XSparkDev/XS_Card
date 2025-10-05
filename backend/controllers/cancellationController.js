/**
 * Cancellation Controller
 * 
 * Enhanced subscription cancellation controllers
 * Following Golden Rules: ALWAYS provide clear cancellation process
 */

const {
    cancelSubscription,
    getCancellationReasons,
    processRetentionOfferResponse,
    validateCancellationRequest
} = require('../services/cancellationService');
const { logSubscriptionEvent } = require('../models/subscriptionLog');

/**
 * POST /subscription/cancel
 * Enhanced subscription cancellation with retention offers
 */
const cancelSubscriptionController = async (req, res) => {
    try {
        console.log('🔄 Enhanced cancellation request received');
        
        // Validate authentication
        if (!req.user || !req.user.uid) {
            console.error('❌ Unauthorized cancellation request');
            
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to cancel your subscription'
            });
        }
        
        const userId = req.user.uid;
        const userEmail = req.user.email;
        const { reason, feedback } = req.body;
        
        console.log(`📋 Cancellation request: reason=${reason} for ${userEmail}`);
        
        // Execute enhanced cancellation process
        const result = await cancelSubscription(userId, reason, feedback);
        
        if (result.success) {
            console.log(`✅ Cancellation successful for ${userEmail}`);
            
            return res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    cancellation: result.cancellation,
                    nextSteps: result.nextSteps,
                    transactionId: result.transactionId
                }
            });
        } else {
            console.error(`❌ Cancellation failed for ${userEmail}:`, result.error);
            
            // Determine appropriate status code
            let statusCode = 400;
            if (result.errorCode === 'SYSTEM_ERROR') {
                statusCode = 500;
            }
            
            // Log the failure
            await logSubscriptionEvent(userId, 'cancellation_controller_error', {
                reason: reason,
                error: result.error,
                errorCode: result.errorCode
            });
            
            return res.status(statusCode).json({
                success: false,
                error: result.error,
                errorCode: result.errorCode,
                ...(result.errors && { errors: result.errors }),
                ...(result.paystackCancelled && { 
                    paystackCancelled: true,
                    message: 'Paystack cancellation succeeded but database update failed. Please contact support.'
                })
            });
        }
        
    } catch (error) {
        console.error('❌ Cancellation controller error:', error.message);
        
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'cancellation_controller_system_error', {
                error: error.message,
                stack: error.stack,
                requestBody: req.body
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to process cancellation. Please try again later.'
        });
    }
};

/**
 * GET /subscription/cancellation-reasons
 * Get available cancellation reasons for UI
 */
const getCancellationReasonsController = async (req, res) => {
    try {
        console.log('📋 Cancellation reasons request received');
        
        // Validate authentication (optional for this endpoint)
        if (!req.user || !req.user.uid) {
            console.warn('⚠️  Unauthenticated cancellation reasons request');
        }
        
        const reasons = getCancellationReasons();
        
        console.log(`✅ Cancellation reasons returned: ${reasons.length} reasons`);
        
        // Log request if user is authenticated
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'cancellation_reasons_requested', {
                reasonsCount: reasons.length
            });
        }
        
        return res.status(200).json({
            success: true,
            message: 'Cancellation reasons retrieved',
            data: {
                reasons: reasons,
                reasonsCount: reasons.length
            }
        });
        
    } catch (error) {
        console.error('❌ Cancellation reasons controller error:', error.message);
        
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'cancellation_reasons_error', {
                error: error.message
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to retrieve cancellation reasons. Please try again later.'
        });
    }
};


/**
 * GET /subscription/cancellation-preview
 * Preview cancellation details without actually cancelling
 */
const cancellationPreviewController = async (req, res) => {
    try {
        console.log('🔍 Cancellation preview request received');
        
        // Validate authentication
        if (!req.user || !req.user.uid) {
            console.error('❌ Unauthorized cancellation preview request');
            
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to preview cancellation'
            });
        }
        
        const userId = req.user.uid;
        const userEmail = req.user.email;
        
        console.log(`🔍 Cancellation preview for ${userEmail}`);
        
        // Validate cancellation eligibility
        const validation = await validateCancellationRequest(userId);
        
        if (!validation.isValid) {
            console.log('❌ Cancellation preview validation failed:', validation.errors);
            
            return res.status(400).json({
                success: false,
                error: 'Cannot cancel subscription',
                errors: validation.errors
            });
        }
        
        console.log(`✅ Cancellation preview generated for ${userEmail}`);
        
        // Log preview request
        await logSubscriptionEvent(userId, 'cancellation_preview_requested', {
            subscriptionStatus: validation.subscriptionData.status,
            hasGracePeriod: !!validation.gracePeriod
        });
        
        // Return preview data
        return res.status(200).json({
            success: true,
            message: 'Cancellation preview generated',
            data: {
                canCancel: validation.canCancel,
                currentSubscription: {
                    status: validation.subscriptionData.status,
                    planId: validation.subscriptionData.planId,
                    planName: validation.subscriptionData.planName || 'Premium',
                    amount: validation.subscriptionData.amount
                },
                gracePeriod: validation.gracePeriod,
                cancellationReasons: getCancellationReasons(),
                warnings: validation.warnings,
                effectiveDate: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Cancellation preview controller error:', error.message);
        
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'cancellation_preview_error', {
                error: error.message
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to generate cancellation preview. Please try again later.'
        });
    }
};

module.exports = {
    cancelSubscriptionController,
    getCancellationReasonsController,
    cancellationPreviewController
};
