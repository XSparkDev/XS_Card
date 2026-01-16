/**
 * Enterprise Routes
 * 
 * API routes for enterprise payment and subscription management.
 * Routes will be added incrementally in subsequent phases.
 */

const express = require('express');
const router = express.Router();
const { generateQuote } = require('../controllers/enterpriseController');
const { quoteRateLimit } = require('../middleware/quoteRateLimit');

// Phase 2: Quote Generation
router.post('/api/enterprise/quote', quoteRateLimit, generateQuote);

// Routes to be added in subsequent phases:
// Phase 4: POST /api/enterprise/payment/initialize
// Phase 5: GET /api/enterprise/payment/callback
// Phase 6: POST /api/enterprise/payment/webhook
// Phase 7: GET /api/enterprise/subscription/:enterpriseId/status
// Phase 7: POST /api/enterprise/subscription/:enterpriseId/cancel
// Phase 7: POST /api/enterprise/subscription/:enterpriseId/update-employees

// Placeholder route for testing
router.get('/api/enterprise/health', (req, res) => {
  res.json({
    success: true,
    message: 'Enterprise routes module loaded successfully',
    phase: 2
  });
});

module.exports = router;

