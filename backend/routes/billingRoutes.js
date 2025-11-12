/**
 * Billing Routes - Phase 4A Critical Billing Features
 * 
 * This file defines API routes for billing features following Golden Rules:
 * - ALL billing endpoints MUST be authenticated
 * - ALL billing operations MUST be logged for audit trail
 * - ALL financial data MUST be properly validated
 */

const express = require('express');
const router = express.Router();

// Import authentication middleware
const { authenticateUser } = require('../middleware/auth');

// Import rate limiting middleware
const { getWebhookRateLimit, logRateLimitInfo } = require('../middleware/webhookRateLimit');

// Import billing controllers
const {
    getPaymentHistoryController,
    getInvoiceHistoryController,
    getInvoiceController,
    getSubscriptionStatusController,
    getBillingNotificationsController,
    markNotificationReadController
} = require('../controllers/billingController');

// Apply authentication to all billing routes
router.use(authenticateUser);

// Apply rate limiting to all billing routes
router.use(getWebhookRateLimit('general'));
router.use(logRateLimitInfo);

/**
 * Payment History Routes
 */

// GET /api/billing/payment-history
// Fetch comprehensive payment history for authenticated user
router.get('/payment-history', getPaymentHistoryController);

/**
 * Invoice Management Routes
 */

// GET /api/billing/invoices
// Fetch invoice history for authenticated user
router.get('/invoices', getInvoiceHistoryController);

// GET /api/billing/invoice/:invoiceId
// Generate and fetch specific invoice for authenticated user
router.get('/invoice/:invoiceId', getInvoiceController);

/**
 * Subscription Status Dashboard Routes
 */

// GET /billing/status
// Fetch comprehensive subscription status dashboard for authenticated user
router.get('/status', getSubscriptionStatusController);

/**
 * Billing Notifications Routes
 */

// GET /billing/notifications
// Fetch billing notifications for authenticated user
// Query parameters:
// - limit (optional): Number of notifications to fetch (default: 20, max: 100)
router.get('/notifications', getBillingNotificationsController);

// POST /billing/notifications/:notificationId/read
// Mark specific notification as read for authenticated user
router.post('/notifications/:notificationId/read', markNotificationReadController);

/**
 * Health Check Route (for monitoring)
 */
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            service: 'Billing API',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            message: 'Billing service is operational'
        }
    });
});

module.exports = router;
