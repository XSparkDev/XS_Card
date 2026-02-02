/**
 * Enterprise Routes
 * 
 * API routes for enterprise payment and subscription management.
 * Routes will be added incrementally in subsequent phases.
 */

const express = require('express');
const router = express.Router();
const { 
  generateQuote, 
  initializeSubscription, 
  handlePaymentCallback, 
  handleSubscriptionWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  updateEmployeeCount
} = require('../controllers/enterpriseController');
const { quoteRateLimit } = require('../middleware/quoteRateLimit');
const { paymentInitRateLimit } = require('../middleware/paymentInitRateLimit');

// Phase 2: Quote Generation
router.post('/api/enterprise/quote', quoteRateLimit, generateQuote);

// Phase 4: Payment Initialization
router.post('/api/enterprise/payment/initialize', paymentInitRateLimit, initializeSubscription);

// Phase 5: Payment Callback
router.get('/api/enterprise/payment/callback', handlePaymentCallback);

// Phase 6: Subscription Webhook
router.post('/api/enterprise/payment/webhook', handleSubscriptionWebhook);

// Phase 7: Subscription Management
router.get('/api/enterprise/subscription/:enterpriseId/status', getSubscriptionStatus);
router.post('/api/enterprise/subscription/:enterpriseId/cancel', cancelSubscription);
router.post('/api/enterprise/subscription/:enterpriseId/update-employees', updateEmployeeCount);

// Placeholder route for testing
router.get('/api/enterprise/health', (req, res) => {
  res.json({
    success: true,
    message: 'Enterprise routes module loaded successfully',
    phase: 7
  });
});

module.exports = router;

