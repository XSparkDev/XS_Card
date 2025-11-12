/**
 * Payment Method Routes
 * 
 * HTTP routes for payment method management
 * Following Golden Rules: ALL payment method operations MUST be authenticated
 */

const express = require('express');
const router = express.Router();

// Import middleware
const { authenticateUser } = require('../middleware/auth');
const { getWebhookRateLimit, logRateLimitInfo } = require('../middleware/webhookRateLimit');

// Import controllers
const {
    updatePaymentMethodController,
    getPaymentMethodController,
    generateUpdateTokenController,
    verifyUpdateTokenController
} = require('../controllers/paymentMethodController');

// Apply authentication middleware to all routes
router.use(authenticateUser);

/**
 * PUT /subscription/payment-method
 * Update user's payment method
 * 
 * Body: {
 *   type: 'card' | 'bank',
 *   authorization_code?: string,  // For card updates
 *   last4?: string,
 *   exp_month?: number,
 *   exp_year?: number,
 *   card_type?: string,
 *   account_name?: string,        // For bank updates
 *   account_number?: string,
 *   bank_code?: string,
 *   bank_name?: string
 * }
 * 
 * Response: {
 *   success: boolean,
 *   message: string,
 *   data: {
 *     paymentMethodUpdate: {
 *       type: string,
 *       last4: string,
 *       updatedAt: string,
 *       paystackUpdated: boolean
 *     },
 *     transactionId: string,
 *     warnings?: Array<string>
 *   }
 * }
 */
router.put('/payment-method',
    getWebhookRateLimit('subscription'), // Use subscription rate limiting for security
    logRateLimitInfo,
    updatePaymentMethodController
);

/**
 * GET /subscription/payment-method
 * Get current payment method details
 * 
 * Response: {
 *   success: boolean,
 *   message: string,
 *   data: {
 *     paymentMethod: {
 *       type: string,
 *       last4?: string,
 *       cardType?: string,
 *       expMonth?: number,
 *       expYear?: number,
 *       accountName?: string,
 *       bankName?: string,
 *       accountNumberMasked?: string,
 *       updatedAt: string
 *     } | null,
 *     hasPaymentMethod: boolean
 *   }
 * }
 */
router.get('/payment-method',
    getWebhookRateLimit('general'), // Use general rate limiting
    logRateLimitInfo,
    getPaymentMethodController
);

/**
 * POST /subscription/payment-method/update-token
 * Generate secure token for payment method updates
 * 
 * Response: {
 *   success: boolean,
 *   message: string,
 *   data: {
 *     token: {
 *       token: string,
 *       signature: string,
 *       expires: number
 *     },
 *     expiresAt: string
 *   }
 * }
 */
router.post('/payment-method/update-token',
    getWebhookRateLimit('general'), // Use general rate limiting
    logRateLimitInfo,
    generateUpdateTokenController
);

/**
 * POST /subscription/payment-method/verify-token
 * Verify payment method update token
 * 
 * Body: {
 *   token: {
 *     token: string,
 *     signature: string,
 *     expires: number
 *   }
 * }
 * 
 * Response: {
 *   success: boolean,
 *   message: string,
 *   data: {
 *     valid: boolean,
 *     purpose: string,
 *     expires: number
 *   }
 * }
 */
router.post('/payment-method/verify-token',
    getWebhookRateLimit('general'), // Use general rate limiting
    logRateLimitInfo,
    verifyUpdateTokenController
);

module.exports = router;
