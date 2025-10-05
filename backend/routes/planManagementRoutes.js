/**
 * Plan Management Routes
 * 
 * HTTP routes for subscription plan management
 * Following Golden Rules: ALL financial operations MUST be authenticated
 */

const express = require('express');
const router = express.Router();

// Import middleware
const { authenticateUser } = require('../middleware/auth');
const { getWebhookRateLimit, logRateLimitInfo } = require('../middleware/webhookRateLimit');

// Import controllers
const {
    changePlanController,
    previewPlanChangeController,
    getAvailablePlansController
} = require('../controllers/planManagementController');

// Apply authentication middleware to all routes
router.use(authenticateUser);

/**
 * POST /api/subscription/change-plan
 * Change user's subscription plan with proration
 * 
 * Body: {
 *   currentPlanId: string,
 *   newPlanId: string
 * }
 * 
 * Response: {
 *   success: boolean,
 *   message: string,
 *   data: {
 *     planChange: { fromPlan, toPlan, changeType },
 *     proration: { type, netAmount, description },
 *     effectiveDate: string,
 *     transactionId: string
 *   }
 * }
 */
router.post('/change-plan',
    getWebhookRateLimit('subscription'), // Use subscription rate limiting
    logRateLimitInfo,
    changePlanController
);

/**
 * POST /api/subscription/preview-plan-change
 * Preview plan change with proration calculation (no actual change)
 * 
 * Body: {
 *   currentPlanId: string,
 *   newPlanId: string
 * }
 * 
 * Response: {
 *   success: boolean,
 *   message: string,
 *   data: {
 *     validation: { isValid, changeType },
 *     planChange: { fromPlan, toPlan },
 *     proration: { type, netAmount, description, calculation, period },
 *     effectiveDate: string
 *   }
 * }
 */
router.post('/preview-plan-change',
    getWebhookRateLimit('general'), // Use general rate limiting for previews
    logRateLimitInfo,
    previewPlanChangeController
);

/**
 * GET /api/subscription/available-plans
 * Get available plans for plan changes
 * 
 * Response: {
 *   success: boolean,
 *   message: string,
 *   data: {
 *     currentPlan: string,
 *     availablePlans: Array<{
 *       id: string,
 *       name: string,
 *       amount: number,
 *       currency: string,
 *       interval: string,
 *       description: string,
 *       features: Array<string>,
 *       isCurrent: boolean
 *     }>,
 *     planCount: number
 *   }
 * }
 */
router.get('/available-plans',
    getWebhookRateLimit('general'), // Use general rate limiting
    logRateLimitInfo,
    getAvailablePlansController
);

module.exports = router;
