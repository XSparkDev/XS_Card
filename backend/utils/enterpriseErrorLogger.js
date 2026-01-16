/**
 * Enterprise Error Logger
 * 
 * Centralized error logging for enterprise payment system.
 * Logs all errors to Firestore 'error_logs' collection for tracking and debugging.
 */

const { db, admin } = require('../firebase');

/**
 * Log error to error_logs collection
 * 
 * @param {string} type - Error type (e.g., 'account_creation_failure', 'plan_creation_failure')
 * @param {Object} errorData - Error data object
 * @param {string} errorData.error - Error message
 * @param {Object} [errorData.context] - Additional context data
 * @param {number} [errorData.attempt] - Retry attempt number (if applicable)
 * @param {number} [errorData.maxRetries] - Maximum retries (if applicable)
 * @returns {Promise<string>} - Document ID of logged error
 */
async function logEnterpriseError(type, errorData) {
  try {
    const errorLog = {
      type: type,
      error: errorData.error || 'Unknown error',
      context: errorData.context || {},
      attempt: errorData.attempt || null,
      maxRetries: errorData.maxRetries || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString()
    };

    // Add stack trace if available
    if (errorData.stack) {
      errorLog.stack = errorData.stack;
    }

    // Add additional metadata if provided
    if (errorData.metadata) {
      errorLog.metadata = errorData.metadata;
    }

    const docRef = await db.collection('error_logs').add(errorLog);
    
    console.error(`❌ Enterprise Error Logged [${type}]:`, {
      id: docRef.id,
      error: errorLog.error,
      timestamp: errorLog.createdAt
    });

    return docRef.id;
  } catch (loggingError) {
    // Fallback to console if Firestore logging fails
    console.error('❌ Failed to log error to Firestore:', loggingError);
    console.error('Original error:', {
      type,
      errorData
    });
    return null;
  }
}

/**
 * Log account creation failure
 * 
 * @param {Object} accountData - Account data that failed to create
 * @param {string} error - Error message
 * @param {number} [attempt] - Retry attempt number
 * @param {number} [maxRetries] - Maximum retries
 * @returns {Promise<string>} - Document ID of logged error
 */
async function logAccountCreationFailure(accountData, error, attempt = null, maxRetries = null) {
  return logEnterpriseError('account_creation_failure', {
    error,
    context: {
      accountData: accountData
    },
    attempt,
    maxRetries
  });
}

/**
 * Log plan creation failure
 * 
 * @param {number} numberOfEmployees - Number of employees
 * @param {number} amount - Price amount
 * @param {string} currency - Currency code
 * @param {string} error - Error message
 * @param {number} [attempt] - Retry attempt number
 * @param {number} [maxRetries] - Maximum retries
 * @returns {Promise<string>} - Document ID of logged error
 */
async function logPlanCreationFailure(numberOfEmployees, amount, currency, error, attempt = null, maxRetries = null) {
  return logEnterpriseError('plan_creation_failure', {
    error,
    context: {
      numberOfEmployees,
      amount,
      currency
    },
    attempt,
    maxRetries
  });
}

/**
 * Log webhook processing failure
 * 
 * @param {string} eventType - Webhook event type
 * @param {Object} webhookData - Webhook data
 * @param {string} error - Error message
 * @returns {Promise<string>} - Document ID of logged error
 */
async function logWebhookProcessingFailure(eventType, webhookData, error) {
  return logEnterpriseError('webhook_processing_failure', {
    error,
    context: {
      eventType,
      webhookData: webhookData
    }
  });
}

/**
 * Log payment initialization failure
 * 
 * @param {string} quoteId - Quote ID
 * @param {string} error - Error message
 * @returns {Promise<string>} - Document ID of logged error
 */
async function logPaymentInitializationFailure(quoteId, error) {
  return logEnterpriseError('payment_initialization_failure', {
    error,
    context: {
      quoteId
    }
  });
}

module.exports = {
  logEnterpriseError,
  logAccountCreationFailure,
  logPlanCreationFailure,
  logWebhookProcessingFailure,
  logPaymentInitializationFailure
};

