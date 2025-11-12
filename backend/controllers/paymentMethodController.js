/**
 * Payment Method Controller
 * 
 * Handles HTTP requests for payment method management
 * Following Golden Rules: ALWAYS secure payment method updates
 */

const {
    updatePaymentMethod,
    getCurrentPaymentMethod,
    generatePaymentMethodUpdateToken,
    verifyPaymentMethodUpdateToken
} = require('../services/paymentMethodService');
const { logSubscriptionEvent } = require('../models/subscriptionLog');

/**
 * PUT /subscription/payment-method
 * Update user's payment method
 */
const updatePaymentMethodController = async (req, res) => {
    try {
        console.log('🔄 Payment method update request received');
        
        // Validate authentication
        if (!req.user || !req.user.uid) {
            console.error('❌ Unauthorized payment method update request');
            
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to update your payment method'
            });
        }
        
        const userId = req.user.uid;
        const userEmail = req.user.email;
        const paymentMethodData = req.body;
        
        console.log(`💳 Payment method update request for ${userEmail}:`, {
            type: paymentMethodData.type,
            hasAuthCode: !!paymentMethodData.authorization_code
        });
        
        // Validate required fields
        if (!paymentMethodData || !paymentMethodData.type) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                message: 'Payment method type is required'
            });
        }
        
        // Execute payment method update
        const result = await updatePaymentMethod(userId, paymentMethodData);
        
        if (result.success) {
            console.log(`✅ Payment method update successful for ${userEmail}:`, {
                type: result.paymentMethodUpdate.type,
                paystackUpdated: result.paymentMethodUpdate.paystackUpdated,
                transactionId: result.transactionId
            });
            
            // Return success response (no sensitive data)
            return res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    paymentMethodUpdate: {
                        type: result.paymentMethodUpdate.type,
                        last4: result.paymentMethodUpdate.last4,
                        updatedAt: result.paymentMethodUpdate.updatedAt,
                        paystackUpdated: result.paymentMethodUpdate.paystackUpdated
                    },
                    transactionId: result.transactionId,
                    warnings: result.warnings
                }
            });
        } else {
            console.error(`❌ Payment method update failed for ${userEmail}:`, result.error);
            
            // Determine appropriate status code
            let statusCode = 400;
            if (result.errorCode === 'SYSTEM_ERROR') {
                statusCode = 500;
            }
            
            // Log the failure
            await logSubscriptionEvent(userId, 'payment_method_update_controller_error', {
                error: result.error,
                errorCode: result.errorCode,
                paymentMethodType: paymentMethodData.type
            });
            
            return res.status(statusCode).json({
                success: false,
                error: result.error,
                errorCode: result.errorCode,
                ...(result.errors && { errors: result.errors }),
                ...(result.paystackUpdated && { 
                    paystackUpdated: true,
                    message: 'Paystack update succeeded but database update failed. Please contact support.'
                })
            });
        }
        
    } catch (error) {
        console.error('❌ Payment method update controller error:', error.message);
        
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'payment_method_update_controller_system_error', {
                error: error.message,
                stack: error.stack,
                requestBody: req.body
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to update payment method. Please try again later.'
        });
    }
};

/**
 * GET /subscription/payment-method
 * Get current payment method details
 */
const getPaymentMethodController = async (req, res) => {
    try {
        console.log('🔍 Payment method retrieval request received');
        
        // Validate authentication
        if (!req.user || !req.user.uid) {
            console.error('❌ Unauthorized payment method retrieval request');
            
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to view your payment method'
            });
        }
        
        const userId = req.user.uid;
        const userEmail = req.user.email;
        
        console.log(`🔍 Payment method retrieval for ${userEmail}`);
        
        // Get current payment method
        const result = await getCurrentPaymentMethod(userId);
        
        if (result.success) {
            console.log(`✅ Payment method retrieved for ${userEmail}:`, {
                hasPaymentMethod: result.hasPaymentMethod,
                type: result.paymentMethod?.type
            });
            
            // Log retrieval
            await logSubscriptionEvent(userId, 'payment_method_retrieved', {
                hasPaymentMethod: result.hasPaymentMethod,
                paymentMethodType: result.paymentMethod?.type
            });
            
            return res.status(200).json({
                success: true,
                message: result.message || 'Payment method retrieved',
                data: {
                    paymentMethod: result.paymentMethod,
                    hasPaymentMethod: result.hasPaymentMethod
                }
            });
        } else {
            console.error(`❌ Payment method retrieval failed for ${userEmail}:`, result.error);
            
            let statusCode = 400;
            if (result.errorCode === 'NO_SUBSCRIPTION') {
                statusCode = 404;
            } else if (result.errorCode === 'FETCH_ERROR') {
                statusCode = 500;
            }
            
            return res.status(statusCode).json({
                success: false,
                error: result.error,
                errorCode: result.errorCode
            });
        }
        
    } catch (error) {
        console.error('❌ Payment method retrieval controller error:', error.message);
        
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'payment_method_retrieval_error', {
                error: error.message
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to retrieve payment method. Please try again later.'
        });
    }
};

/**
 * POST /subscription/payment-method/update-token
 * Generate secure token for payment method updates
 */
const generateUpdateTokenController = async (req, res) => {
    try {
        console.log('🔐 Payment method update token request received');
        
        // Validate authentication
        if (!req.user || !req.user.uid) {
            console.error('❌ Unauthorized update token request');
            
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to generate update tokens'
            });
        }
        
        const userId = req.user.uid;
        const userEmail = req.user.email;
        
        // Get subscription code from database
        const { db } = require('../firebase');
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        
        if (!subscriptionDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'No subscription found',
                message: 'You must have an active subscription to update payment methods'
            });
        }
        
        const subscriptionData = subscriptionDoc.data();
        const subscriptionCode = subscriptionData.subscriptionCode;
        
        console.log(`🔐 Generating update token for ${userEmail}`);
        
        // Generate secure token
        const tokenResult = generatePaymentMethodUpdateToken(userId, subscriptionCode);
        
        if (tokenResult.success) {
            console.log(`✅ Update token generated for ${userEmail}`);
            
            // Log token generation
            await logSubscriptionEvent(userId, 'payment_method_update_token_generated', {
                expiresAt: tokenResult.expiresAt
            });
            
            return res.status(200).json({
                success: true,
                message: 'Update token generated successfully',
                data: {
                    token: tokenResult.token,
                    expiresAt: tokenResult.expiresAt
                }
            });
        } else {
            console.error(`❌ Update token generation failed for ${userEmail}:`, tokenResult.error);
            
            return res.status(500).json({
                success: false,
                error: tokenResult.error,
                errorCode: tokenResult.errorCode
            });
        }
        
    } catch (error) {
        console.error('❌ Update token generation controller error:', error.message);
        
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'payment_method_update_token_error', {
                error: error.message
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to generate update token. Please try again later.'
        });
    }
};

/**
 * POST /subscription/payment-method/verify-token
 * Verify payment method update token
 */
const verifyUpdateTokenController = async (req, res) => {
    try {
        console.log('🔍 Payment method update token verification request received');
        
        // Validate authentication
        if (!req.user || !req.user.uid) {
            console.error('❌ Unauthorized token verification request');
            
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'You must be logged in to verify tokens'
            });
        }
        
        const userId = req.user.uid;
        const userEmail = req.user.email;
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                message: 'Token is required for verification'
            });
        }
        
        console.log(`🔍 Verifying update token for ${userEmail}`);
        
        // Verify token
        const verificationResult = verifyPaymentMethodUpdateToken(token);
        
        if (verificationResult.isValid) {
            console.log(`✅ Update token verified for ${userEmail}`);
            
            // Verify token belongs to requesting user
            if (verificationResult.tokenData.userId !== userId) {
                console.error('❌ Token user mismatch');
                
                await logSubscriptionEvent(userId, 'payment_method_token_user_mismatch', {
                    tokenUserId: verificationResult.tokenData.userId
                });
                
                return res.status(403).json({
                    success: false,
                    error: 'Token verification failed',
                    message: 'Invalid token for this user'
                });
            }
            
            // Log successful verification
            await logSubscriptionEvent(userId, 'payment_method_update_token_verified', {
                tokenPurpose: verificationResult.tokenData.purpose
            });
            
            return res.status(200).json({
                success: true,
                message: 'Token verified successfully',
                data: {
                    valid: true,
                    purpose: verificationResult.tokenData.purpose,
                    expires: verificationResult.tokenData.expires
                }
            });
        } else {
            console.error(`❌ Update token verification failed for ${userEmail}:`, verificationResult.error);
            
            await logSubscriptionEvent(userId, 'payment_method_update_token_verification_failed', {
                error: verificationResult.error
            });
            
            return res.status(400).json({
                success: false,
                error: verificationResult.error,
                message: 'Token verification failed'
            });
        }
        
    } catch (error) {
        console.error('❌ Token verification controller error:', error.message);
        
        if (req.user && req.user.uid) {
            await logSubscriptionEvent(req.user.uid, 'payment_method_token_verification_error', {
                error: error.message
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Unable to verify token. Please try again later.'
        });
    }
};

module.exports = {
    updatePaymentMethodController,
    getPaymentMethodController,
    generateUpdateTokenController,
    verifyUpdateTokenController
};
