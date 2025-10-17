/**
 * Apple Receipt Validation Routes
 * 
 * Routes for validating Apple receipts directly
 */

const express = require('express');
const router = express.Router();
const { validateReceiptController } = require('../controllers/appleReceiptController');
const { authenticateUser } = require('../middleware/auth');

/**
 * PROTECTED ROUTE: Validate Apple receipt
 * POST /api/apple-receipt/validate
 * 
 * Validates receipt with Apple servers (production-first, sandbox fallback)
 * Requires user authentication
 */
router.post('/validate', authenticateUser, validateReceiptController);

module.exports = router;

