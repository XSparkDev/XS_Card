/**
 * Apple Receipt Validation Service
 * 
 * Validates receipts directly with Apple's servers
 * Implements production-first with sandbox fallback (error 21007)
 */

const https = require('https');

// Apple receipt validation endpoints
const APPLE_ENDPOINTS = {
  production: 'https://buy.itunes.apple.com/verifyReceipt',
  sandbox: 'https://sandbox.itunes.apple.com/verifyReceipt'
};

/**
 * Validate receipt with Apple servers
 * @param {string} receiptData - Base64 encoded receipt data
 * @param {string} environment - 'production' or 'sandbox'
 * @returns {Promise<Object>} Validation result
 */
const validateWithApple = async (receiptData, environment) => {
  const url = APPLE_ENDPOINTS[environment];
  const sharedSecret = process.env.APPSTORE_SHARED_SECRET;

  if (!sharedSecret) {
    throw new Error('APPSTORE_SHARED_SECRET not configured');
  }

  const payload = {
    'receipt-data': receiptData,
    'password': sharedSecret,
    'exclude-old-transactions': true
  };

  console.log(`[Apple Receipt] Validating with ${environment} environment`);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(payload);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`[Apple Receipt] Response status: ${response.status}`);
          resolve(response);
        } catch (error) {
          reject(new Error('Failed to parse Apple response'));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`[Apple Receipt] Request error:`, error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
};

/**
 * Validate receipt with production-first, sandbox fallback strategy
 * @param {string} receiptData - Base64 encoded receipt data
 * @returns {Promise<Object>} Validation result
 */
const validateReceipt = async (receiptData) => {
  try {
    console.log('[Apple Receipt] Starting validation - trying production first');

    // Step 1: Try production environment first
    const productionResponse = await validateWithApple(receiptData, 'production');

    // Status codes:
    // 0 = valid receipt
    // 21007 = sandbox receipt sent to production (need to retry with sandbox)
    // Other codes = actual errors

    if (productionResponse.status === 0) {
      console.log('[Apple Receipt] ✅ Valid receipt (production)');
      return {
        success: true,
        environment: 'production',
        receipt: productionResponse.receipt,
        latest_receipt_info: productionResponse.latest_receipt_info
      };
    }

    // Step 2: If error 21007, retry with sandbox
    if (productionResponse.status === 21007) {
      console.log('[Apple Receipt] Error 21007 - retrying with sandbox');
      const sandboxResponse = await validateWithApple(receiptData, 'sandbox');

      if (sandboxResponse.status === 0) {
        console.log('[Apple Receipt] ✅ Valid receipt (sandbox)');
        return {
          success: true,
          environment: 'sandbox',
          receipt: sandboxResponse.receipt,
          latest_receipt_info: sandboxResponse.latest_receipt_info
        };
      }

      // Sandbox validation failed
      console.error(`[Apple Receipt] ❌ Sandbox validation failed: ${sandboxResponse.status}`);
      return {
        success: false,
        error: 'Receipt validation failed',
        status: sandboxResponse.status,
        environment: 'sandbox'
      };
    }

    // Other error codes
    console.error(`[Apple Receipt] ❌ Production validation failed: ${productionResponse.status}`);
    return {
      success: false,
      error: 'Receipt validation failed',
      status: productionResponse.status,
      environment: 'production'
    };

  } catch (error) {
    console.error('[Apple Receipt] ❌ Validation error:', error);
    return {
      success: false,
      error: error.message || 'Receipt validation failed'
    };
  }
};

module.exports = {
  validateReceipt,
  validateWithApple
};

