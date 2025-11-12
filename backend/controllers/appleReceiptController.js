/**
 * Apple Receipt Validation Controller
 * 
 * Handles receipt validation requests
 */

const { validateReceipt } = require('../services/appleReceiptValidation');

/**
 * Validate receipt endpoint
 * POST /api/apple-receipt/validate
 */
const validateReceiptController = async (req, res) => {
  try {
    console.log('[Apple Receipt Controller] Received validation request');

    const { receiptData } = req.body;

    // Validate request
    if (!receiptData) {
      console.error('[Apple Receipt Controller] Missing receipt data');
      return res.status(400).json({
        success: false,
        error: 'Missing receipt data'
      });
    }

    // Validate receipt with Apple
    const result = await validateReceipt(receiptData);

    // Return result
    if (result.success) {
      console.log(`[Apple Receipt Controller] ✅ Receipt validated (${result.environment})`);
      return res.status(200).json(result);
    } else {
      console.error(`[Apple Receipt Controller] ❌ Receipt validation failed`);
      return res.status(400).json(result);
    }

  } catch (error) {
    console.error('[Apple Receipt Controller] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  validateReceiptController
};

