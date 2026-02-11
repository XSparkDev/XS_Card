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
  getQuotePDF,
  getActiveQuotesByEmail,
  handleQuotePaymentEntry,
  initializeSubscription, 
  handlePaymentCallback, 
  handleSubscriptionWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  updateEmployeeCount
} = require('../controllers/enterpriseController');
const { quoteRateLimit } = require('../middleware/quoteRateLimit');
const { paymentInitRateLimit } = require('../middleware/paymentInitRateLimit');
const { authenticateUser } = require('../middleware/auth');
const activityLogController = require('../controllers/activityLogController');

// Phase 2: Quote Generation
router.post('/api/enterprise/quote', quoteRateLimit, generateQuote);

// Phase 2: Get quote PDF
router.get('/api/enterprise/quotes/:quoteId/pdf', getQuotePDF);

// Phase 2: Find active quotes by contact email
router.get('/api/enterprise/quotes/by-email', getActiveQuotesByEmail);

// Public payment entry URL for quotes (used by QR codes / PDF links / buttons)
router.get('/pay/quote/:quoteId', handleQuotePaymentEntry);

// Phase 4: Payment Initialization
router.post('/api/enterprise/payment/initialize', paymentInitRateLimit, initializeSubscription);

// Phase 5: Payment Callback
router.get('/api/enterprise/payment/callback', handlePaymentCallback);

// Phase 6: Subscription Webhook
router.post('/api/enterprise/payment/webhook', handleSubscriptionWebhook);

// Phase 7: Subscription Management
// Handle missing enterpriseId cases - must come before parameterized routes
// Express normalizes double slashes, so we need to handle both patterns
router.get('/api/enterprise/subscription/status', (req, res) => {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    message: 'enterpriseId is required'
  });
});
router.get('/api/enterprise/subscription//status', (req, res) => {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    message: 'enterpriseId is required'
  });
});
router.post('/api/enterprise/subscription/cancel', (req, res) => {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    message: 'enterpriseId is required'
  });
});
router.post('/api/enterprise/subscription//cancel', (req, res) => {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    message: 'enterpriseId is required'
  });
});

// Normal parameterized routes
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

// Phase 1: Activity Log routes
router.get('/api/activity-logs/action/:action', authenticateUser, activityLogController.getByAction);
router.get('/api/activity-logs/resource/:resource', authenticateUser, activityLogController.getByResource);
router.get('/api/activity-logs/user/:userId', authenticateUser, activityLogController.getByUser);
router.get('/api/activity-logs/enterprise/:enterpriseId', authenticateUser, activityLogController.getByEnterprise);
router.get('/api/activity-logs/time-range', authenticateUser, activityLogController.getByTimeRange);
router.get('/api/activity-logs/export', authenticateUser, activityLogController.exportActivities);

// Phase 1: Enterprise CRUD operations
const { 
  getAllEnterprises,
  getEnterpriseById,
  updateEnterprise,
  deleteEnterprise,
  getEnterpriseStats,
  getInvoiceById,
  getInvoicePDF,
  emailInvoice
} = require('../controllers/enterpriseController');

router.get('/api/enterprise', authenticateUser, getAllEnterprises);
router.get('/api/enterprise/:enterpriseId', authenticateUser, getEnterpriseById);
router.put('/api/enterprise/:enterpriseId', authenticateUser, updateEnterprise);
router.delete('/api/enterprise/:enterpriseId', authenticateUser, deleteEnterprise);
router.get('/api/enterprise/:enterpriseId/stats', authenticateUser, getEnterpriseStats);

// Phase 4: Invoice & Receipt APIs
router.get('/api/enterprise/invoices/:invoiceId', authenticateUser, getInvoiceById);
router.get('/api/enterprise/invoices/:invoiceId/pdf', authenticateUser, getInvoicePDF);
router.post('/api/enterprise/invoices/:invoiceId/email', authenticateUser, emailInvoice);

module.exports = router;

