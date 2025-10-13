const express = require('express');
const router = express.Router();
const { 
    initializeTrialSubscription,
    initializeTrialWithBanking, // New endpoint
    handleTrialCallback,
    handleSubscriptionWebhook,
    getSubscriptionPlans,
    getSubscriptionStatus,
    getSubscriptionLogs,
    getUserBankingInfo // New endpoint
} = require('../controllers/subscriptionController');
const { authenticateUser } = require('../middleware/auth');

// Public routes - no authentication needed
router.get('/subscription/trial/callback', handleTrialCallback);
// TEMPORARILY DISABLED - Webhook route disabled due to suspected external money transfers
// router.post('/subscription/webhook', handleSubscriptionWebhook);

// Protected routes - authentication required
router.post('/subscription/trial/initialize', authenticateUser, initializeTrialSubscription);
router.post('/subscription/trial/initialize-with-banking', authenticateUser, initializeTrialWithBanking); // New route
router.get('/subscription/plans', authenticateUser, getSubscriptionPlans);
router.get('/subscription/status', authenticateUser, getSubscriptionStatus);
router.get('/subscription/logs', authenticateUser, getSubscriptionLogs);
router.get('/subscription/banking-info', authenticateUser, getUserBankingInfo); // New route

module.exports = router;
