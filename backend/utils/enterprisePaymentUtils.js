/**
 * Enterprise Payment Utilities
 * 
 * Utilities for enterprise payment and subscription operations.
 * Handles Paystack plan creation and reuse logic.
 */

const https = require('https');
const { db, admin } = require('../firebase');
const { getRequestOptions } = require('../config/paystack');
const { logPlanCreationFailure, logEnterpriseError } = require('./enterpriseErrorLogger');

/**
 * Create a Paystack plan
 * 
 * @param {number} numberOfEmployees - Number of employees
 * @param {number} amount - Price in cents (kobo)
 * @param {string} currency - Currency code ('ZAR' or 'USD')
 * @returns {Promise<string>} - Paystack plan code (e.g., "PLN_abc123")
 * @throws {Error} - If plan creation fails
 */
async function createPaystackPlan(numberOfEmployees, amount, currency) {
  // Validate inputs
  if (typeof numberOfEmployees !== 'number' || numberOfEmployees < 1 || numberOfEmployees > 10000) {
    throw new Error('Invalid number of employees');
  }
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Invalid amount');
  }
  if (!['ZAR', 'USD'].includes(currency)) {
    throw new Error('Invalid currency. Must be ZAR or USD');
  }

  // Generate plan name
  const planName = `Enterprise Plan - ${numberOfEmployees} employees (${currency})`;
  const planDescription = `Annual enterprise subscription for ${numberOfEmployees} employees`;

  // Prepare Paystack request
  // Paystack plan API only accepts: name, interval, amount, currency, description (optional), send_invoices (optional)
  const params = JSON.stringify({
    name: planName,
    description: planDescription,
    amount: amount, // Already in cents
    interval: 'annually', // Yearly subscription
    currency: currency,
    send_invoices: true
  });

  const options = getRequestOptions('/plan', 'POST');
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (!response.status) {
            reject(new Error(response.message || 'Failed to create Paystack plan'));
            return;
          }

          if (!response.data || !response.data.plan_code) {
            reject(new Error('Paystack plan creation succeeded but plan_code is missing'));
            return;
          }

          // Verify plan code format (should start with "PLN_")
          const planCode = response.data.plan_code;
          if (!planCode.startsWith('PLN_')) {
            reject(new Error(`Invalid plan code format: ${planCode}. Expected format: PLN_*`));
            return;
          }

          console.log(`✅ Paystack plan created: ${planCode} for ${numberOfEmployees} employees (${currency})`);
          resolve(planCode);
        } catch (error) {
          reject(new Error(`Failed to parse Paystack response: ${error.message}`));
        }
      });
    });

    req.on('error', error => {
      reject(new Error(`Paystack API request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Paystack API request timeout'));
    });

    req.write(params);
    req.end();
  });
}

/**
 * Find or create a Paystack plan
 * 
 * Checks database first for existing plan (fast lookup).
 * If not found, creates new plan in Paystack and stores in database.
 * 
 * @param {number} numberOfEmployees - Number of employees
 * @param {number} amount - Price in cents (kobo)
 * @param {string} currency - Currency code ('ZAR' or 'USD')
 * @returns {Promise<string>} - Paystack plan code
 * @throws {Error} - If plan creation fails after retries
 */
async function findOrCreatePlan(numberOfEmployees, amount, currency) {
  // Normalize currency to uppercase
  const upperCaseCurrency = currency ? currency.toUpperCase() : 'ZAR';

  // 1. Check our database first (fast lookup)
  try {
    const existingPlanQuery = await db.collection('enterprise_plans')
      .where('numberOfEmployees', '==', numberOfEmployees)
      .where('amount', '==', amount)
      .where('currency', '==', upperCaseCurrency)
      .limit(1)
      .get();

    if (!existingPlanQuery.empty) {
      const existingPlan = existingPlanQuery.docs[0].data();
      console.log(`♻️  Reusing existing plan: ${existingPlan.planCode} for ${numberOfEmployees} employees (${upperCaseCurrency})`);
      return existingPlan.planCode;
    }
  } catch (error) {
    console.warn('Error checking database for existing plan:', error.message);
    // Continue to create new plan if database lookup fails
  }

  // 2. Create new plan in Paystack (with retry logic)
  let planCode;
  let attempts = 0;
  const maxRetries = 3;

  while (attempts < maxRetries) {
    try {
      planCode = await createPaystackPlan(numberOfEmployees, amount, upperCaseCurrency);
      break; // Success
    } catch (error) {
      attempts++;
      console.error(`Plan creation attempt ${attempts}/${maxRetries} failed:`, error.message);

      // Log error
      await logPlanCreationFailure(
        numberOfEmployees,
        amount,
        upperCaseCurrency,
        error.message,
        attempts,
        maxRetries
      );

      if (attempts === maxRetries) {
        throw new Error(`Failed to create plan after ${maxRetries} attempts: ${error.message}`);
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffDelay = 1000 * Math.pow(2, attempts - 1);
      console.log(`Retrying plan creation in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  // 3. Store in our database for future reuse
  try {
    await db.collection('enterprise_plans').add({
      planCode,
      numberOfEmployees,
      amount,
      currency: upperCaseCurrency,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`💾 Plan stored in database: ${planCode}`);
  } catch (error) {
    // Log error but don't fail - plan was created in Paystack
    console.error('Failed to store plan in database:', error.message);
    await logEnterpriseError('plan_storage_failure', {
      error: error.message,
      context: {
        planCode,
        numberOfEmployees,
        amount,
        currency: upperCaseCurrency
      }
    });
  }

  return planCode;
}

/**
 * Generate payment reference for enterprise subscription
 * 
 * Format: `ent_quote_{quoteId}_{timestamp}_{random}`
 * 
 * @param {string} quoteId - Quote ID
 * @returns {string} - Payment reference
 */
function generatePaymentReference(quoteId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `ent_quote_${quoteId}_${timestamp}_${random}`;
}

/**
 * Initialize enterprise subscription with Paystack
 * 
 * Creates a subscription initialization request to Paystack.
 * 
 * @param {object} quoteData - Quote data from database
 * @param {string} planCode - Paystack plan code
 * @returns {Promise<object>} - Paystack response with authorization_url and reference
 * @throws {Error} - If subscription initialization fails
 */
async function initializeEnterpriseSubscription(quoteData, planCode) {
  // Validate inputs
  if (!quoteData || !quoteData.quoteId) {
    throw new Error('Invalid quote data');
  }
  if (!planCode || typeof planCode !== 'string') {
    throw new Error('Invalid plan code');
  }
  if (!quoteData.contactEmail) {
    throw new Error('Contact email is required');
  }

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const paymentReference = generatePaymentReference(quoteData.quoteId);

  // Prepare Paystack request parameters
  const params = JSON.stringify({
    email: quoteData.contactEmail,
    amount: quoteData.calculatedPrice, // Already in cents
    plan: planCode,
    callback_url: `${baseUrl}/api/enterprise/payment/callback`,
    reference: paymentReference,
    metadata: {
      quoteId: quoteData.quoteId,
      companyName: quoteData.companyName,
      numberOfEmployees: quoteData.numberOfEmployees,
      currency: quoteData.currency,
      subscriptionType: 'enterprise_yearly',
      cancel_action: `${baseUrl}/enterprise-payment-cancel.html`
    }
  });

  const options = getRequestOptions('/transaction/initialize', 'POST');

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (!response.status) {
            reject(new Error(response.message || 'Failed to initialize Paystack subscription'));
            return;
          }

          if (!response.data || !response.data.authorization_url) {
            reject(new Error('Paystack subscription initialization succeeded but authorization_url is missing'));
            return;
          }

          if (!response.data.reference) {
            reject(new Error('Paystack subscription initialization succeeded but reference is missing'));
            return;
          }

          console.log(`✅ Paystack subscription initialized: ${response.data.reference} for quote ${quoteData.quoteId}`);
          resolve({
            authorization_url: response.data.authorization_url,
            reference: response.data.reference,
            access_code: response.data.access_code
          });
        } catch (error) {
          reject(new Error(`Failed to parse Paystack response: ${error.message}`));
        }
      });
    });

    req.on('error', error => {
      reject(new Error(`Paystack API request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Paystack API request timeout'));
    });

    req.write(params);
    req.end();
  });
}

/**
 * Verify enterprise payment with Paystack
 * 
 * @param {string} paymentReference - Payment reference from Paystack
 * @returns {Promise<object>} - Payment verification result with transaction and subscription data
 * @throws {Error} - If verification fails
 */
async function verifyEnterprisePayment(paymentReference) {
  if (!paymentReference || typeof paymentReference !== 'string') {
    throw new Error('Payment reference is required');
  }

  const options = getRequestOptions(`/transaction/verify/${encodeURIComponent(paymentReference)}`, 'GET');

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (!response.status) {
            reject(new Error(response.message || 'Payment verification failed'));
            return;
          }

          if (!response.data) {
            reject(new Error('No transaction data found'));
            return;
          }

          const transaction = response.data;

          // Check if payment was successful
          if (transaction.status !== 'success') {
            reject(new Error(`Payment not successful. Status: ${transaction.status}`));
            return;
          }

          console.log(`✅ Payment verified: ${paymentReference} - Amount: ${transaction.amount} ${transaction.currency}`);

          resolve({
            success: true,
            transaction: {
              reference: transaction.reference,
              amount: transaction.amount,
              currency: transaction.currency,
              status: transaction.status,
              paidAt: transaction.paid_at,
              customer: transaction.customer,
              authorization: transaction.authorization
            },
            subscription: transaction.subscription || null,
            customer: transaction.customer || null
          });
        } catch (error) {
          reject(new Error(`Failed to parse Paystack response: ${error.message}`));
        }
      });
    });

    req.on('error', error => {
      reject(new Error(`Paystack API request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Paystack API request timeout'));
    });

    req.end();
  });
}

/**
 * Get Paystack subscription status and details
 * 
 * @param {string} subscriptionCode - Paystack subscription code (e.g., "SUB_xyz789")
 * @returns {Promise<object>} - Subscription details from Paystack
 * @throws {Error} - If subscription fetch fails
 */
async function getPaystackSubscriptionStatus(subscriptionCode) {
  if (!subscriptionCode || typeof subscriptionCode !== 'string') {
    throw new Error('Subscription code is required');
  }

  const options = getRequestOptions(`/subscription/${encodeURIComponent(subscriptionCode)}`, 'GET');

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (!response.status) {
            reject(new Error(response.message || 'Failed to fetch subscription from Paystack'));
            return;
          }

          if (!response.data) {
            reject(new Error('No subscription data found'));
            return;
          }

          const subscription = response.data;

          console.log(`✅ Subscription fetched: ${subscriptionCode} - Status: ${subscription.status}`);

          resolve({
            subscriptionCode: subscription.subscription_code || subscriptionCode,
            status: subscription.status,
            planCode: subscription.plan?.plan_code || null,
            customerCode: subscription.customer?.customer_code || null,
            email: subscription.customer?.email || null,
            amount: subscription.amount,
            interval: subscription.plan?.interval || subscription.interval || 'annually',
            nextPaymentDate: subscription.next_payment_date,
            createdAt: subscription.created_at,
            startDate: subscription.created_at,
            // Calculate end date (1 year from start for annual subscriptions)
            endDate: subscription.next_payment_date ? new Date(subscription.next_payment_date) : null
          });
        } catch (error) {
          reject(new Error(`Failed to parse Paystack response: ${error.message}`));
        }
      });
    });

    req.on('error', error => {
      reject(new Error(`Paystack API request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Paystack API request timeout'));
    });

    req.end();
  });
}

/**
 * Create enterprise account with retry logic (atomic transaction)
 * 
 * Creates account and updates quote status in a single atomic transaction.
 * Retries on failure with exponential backoff.
 * 
 * @param {object} accountData - Account data to create
 * @param {object} quoteRef - Firestore reference to quote document
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<string>} - Enterprise ID
 * @throws {Error} - If account creation fails after retries
 */
async function createEnterpriseAccountWithRetry(accountData, quoteRef, maxRetries = 3) {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const batch = db.batch();
      const accountRef = db.collection('enterprise_accounts').doc(accountData.enterpriseId);

      // Set account data
      batch.set(accountRef, accountData);

      // Update quote status to 'paid'
      batch.update(quoteRef, {
        quoteStatus: 'paid',
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Commit atomic transaction
      await batch.commit();

      console.log(`✅ Enterprise account created: ${accountData.enterpriseId}`);
      return accountData.enterpriseId;
    } catch (error) {
      attempts++;
      console.error(`Account creation attempt ${attempts}/${maxRetries} failed:`, error.message);

      // Log error
      await logEnterpriseError('account_creation_failure', {
        error: error.message,
        context: {
          enterpriseId: accountData.enterpriseId,
          quoteId: accountData.quoteId,
          attempt: attempts,
          maxRetries
        },
        stack: error.stack
      });

      if (attempts === maxRetries) {
        throw new Error(`Failed to create enterprise account after ${maxRetries} attempts: ${error.message}`);
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffDelay = 1000 * Math.pow(2, attempts - 1);
      console.log(`Retrying account creation in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

/**
 * Disable Paystack subscription
 * 
 * @param {string} subscriptionCode - Paystack subscription code
 * @returns {Promise<object>} - Paystack response
 * @throws {Error} - If subscription disable fails
 */
async function disablePaystackSubscription(subscriptionCode) {
  if (!subscriptionCode || typeof subscriptionCode !== 'string') {
    throw new Error('Subscription code is required');
  }

  const options = getRequestOptions(`/subscription/${encodeURIComponent(subscriptionCode)}/disable`, 'POST');

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (!response.status) {
            reject(new Error(response.message || 'Failed to disable subscription'));
            return;
          }

          console.log(`✅ Subscription disabled: ${subscriptionCode}`);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse Paystack response: ${error.message}`));
        }
      });
    });

    req.on('error', error => {
      reject(new Error(`Paystack API request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Paystack API request timeout'));
    });

    req.end();
  });
}

/**
 * Update Paystack subscription plan
 * 
 * @param {string} subscriptionCode - Paystack subscription code
 * @param {string} newPlanCode - New Paystack plan code
 * @returns {Promise<object>} - Paystack response
 * @throws {Error} - If subscription update fails
 */
async function updatePaystackSubscriptionPlan(subscriptionCode, newPlanCode) {
  if (!subscriptionCode || typeof subscriptionCode !== 'string') {
    throw new Error('Subscription code is required');
  }
  if (!newPlanCode || typeof newPlanCode !== 'string') {
    throw new Error('Plan code is required');
  }

  const params = JSON.stringify({
    plan: newPlanCode
  });

  const options = getRequestOptions(`/subscription/${encodeURIComponent(subscriptionCode)}`, 'PUT');
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (!response.status) {
            reject(new Error(response.message || 'Failed to update subscription plan'));
            return;
          }

          console.log(`✅ Subscription plan updated: ${subscriptionCode} -> ${newPlanCode}`);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse Paystack response: ${error.message}`));
        }
      });
    });

    req.on('error', error => {
      reject(new Error(`Paystack API request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Paystack API request timeout'));
    });

    req.write(params);
    req.end();
  });
}

/**
 * Check grace period expiration and suspend account if expired
 * 
 * @param {object} enterpriseAccount - Enterprise account data
 * @returns {Promise<object>} - Result with suspended flag and warning banner
 */
async function checkGracePeriodExpiration(enterpriseAccount) {
  const now = admin.firestore.Timestamp.now();
  const result = {
    isExpired: false,
    isSuspended: false,
    warningBanner: {
      show: false,
      message: '',
      severity: 'info',
      actionRequired: false,
      actionUrl: ''
    }
  };

  // Check if payment failed and grace period exists
  if (enterpriseAccount.subscriptionStatus === 'payment_failed' && 
      enterpriseAccount.gracePeriodEndDate) {
    
    const gracePeriodEnd = enterpriseAccount.gracePeriodEndDate;
    
    if (gracePeriodEnd.toMillis() < now.toMillis()) {
      // Grace period expired - account should be suspended
      result.isExpired = true;
      result.isSuspended = true;
      result.warningBanner = {
        show: true,
        message: 'Your subscription payment failed. Please update your payment method to reactivate your account.',
        severity: 'error',
        actionRequired: true,
        actionUrl: '/enterprise-payment-update'
      };
    } else {
      // Still in grace period
      const daysRemaining = Math.ceil((gracePeriodEnd.toMillis() - now.toMillis()) / (24 * 60 * 60 * 1000));
      result.isExpired = false;
      result.isSuspended = false;
      result.warningBanner = {
        show: true,
        message: `Your payment failed. Please update your payment method before ${gracePeriodEnd.toDate().toLocaleDateString()} to avoid account suspension. (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining)`,
        severity: 'warning',
        actionRequired: true,
        actionUrl: '/enterprise-payment-update'
      };
    }
  }

  return result;
}

/**
 * Suspend enterprise account
 * 
 * Sets account status to 'suspended' and updates warning banner.
 * Account remains accessible but with restricted features.
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @returns {Promise<boolean>} - Success status
 * @throws {Error} - If suspension fails
 */
async function suspendEnterpriseAccount(enterpriseId) {
  if (!enterpriseId || typeof enterpriseId !== 'string') {
    throw new Error('Enterprise ID is required');
  }

  try {
    const accountRef = db.collection('enterprise_accounts').doc(enterpriseId);
    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      throw new Error(`Enterprise account not found: ${enterpriseId}`);
    }

    const accountData = accountDoc.data();

    // Only suspend if not already suspended
    if (accountData.accountStatus === 'suspended') {
      console.log(`Account already suspended: ${enterpriseId}`);
      return true;
    }

    // Update account status to suspended
    await accountRef.update({
      accountStatus: 'suspended',
      warningBanner: {
        show: true,
        message: 'Your subscription payment failed. Please update your payment method to reactivate your account.',
        severity: 'error',
        actionRequired: true,
        actionUrl: '/enterprise-payment-update'
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Enterprise account suspended: ${enterpriseId}`);

    // Log suspension
    await logEnterpriseError('account_suspended', {
      error: 'Grace period expired',
      context: {
        enterpriseId,
        subscriptionStatus: accountData.subscriptionStatus,
        gracePeriodEndDate: accountData.gracePeriodEndDate?.toDate().toISOString() || null
      }
    });

    return true;
  } catch (error) {
    console.error(`Failed to suspend enterprise account ${enterpriseId}:`, error.message);
    throw error;
  }
}

/**
 * Set grace period on payment failure
 * 
 * Sets grace period end date and updates warning banner.
 * Called by webhook handlers when payment fails.
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @param {number} gracePeriodDays - Grace period in days (default: 7)
 * @returns {Promise<object>} - Grace period data
 */
async function setGracePeriodOnPaymentFailure(enterpriseId, gracePeriodDays = 7) {
  if (!enterpriseId || typeof enterpriseId !== 'string') {
    throw new Error('Enterprise ID is required');
  }

  try {
    const accountRef = db.collection('enterprise_accounts').doc(enterpriseId);
    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      throw new Error(`Enterprise account not found: ${enterpriseId}`);
    }

    const accountData = accountDoc.data();
    const now = admin.firestore.Timestamp.now();
    
    // Calculate grace period end date
    const gracePeriodEndDate = admin.firestore.Timestamp.fromDate(
      new Date(now.toDate().getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)
    );

    // Update account with grace period
    await accountRef.update({
      subscriptionStatus: 'payment_failed',
      accountStatus: 'active', // Still active during grace period
      paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      gracePeriodEndDate,
      gracePeriodDays,
      warningBanner: {
        show: true,
        message: `Payment failed. Please update your payment method. Grace period ends in ${gracePeriodDays} days.`,
        severity: 'warning',
        actionRequired: true,
        actionUrl: '/enterprise-payment-update'
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`⚠️  Grace period set for ${enterpriseId}: ${gracePeriodDays} days (ends ${gracePeriodEndDate.toDate().toLocaleDateString()})`);

    return {
      gracePeriodEndDate: gracePeriodEndDate.toDate().toISOString(),
      gracePeriodDays,
      daysRemaining: gracePeriodDays
    };
  } catch (error) {
    console.error(`Failed to set grace period for ${enterpriseId}:`, error.message);
    throw error;
  }
}

/**
 * Clear grace period on successful payment
 * 
 * Clears grace period data and reactivates account.
 * Called by webhook handlers when payment succeeds after failure.
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @returns {Promise<boolean>} - Success status
 */
async function clearGracePeriodOnPaymentSuccess(enterpriseId) {
  if (!enterpriseId || typeof enterpriseId !== 'string') {
    throw new Error('Enterprise ID is required');
  }

  try {
    const accountRef = db.collection('enterprise_accounts').doc(enterpriseId);
    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      throw new Error(`Enterprise account not found: ${enterpriseId}`);
    }

    const accountData = accountDoc.data();

    // Only clear if grace period exists
    if (!accountData.gracePeriodEndDate) {
      console.log(`No grace period to clear for ${enterpriseId}`);
      return true;
    }

    // Clear grace period and reactivate account
    await accountRef.update({
      accountStatus: 'active',
      paymentFailedAt: admin.firestore.FieldValue.delete(),
      gracePeriodEndDate: admin.firestore.FieldValue.delete(),
      warningBanner: {
        show: false,
        message: '',
        severity: 'info',
        actionRequired: false,
        actionUrl: ''
      },
      reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Grace period cleared and account reactivated: ${enterpriseId}`);

    return true;
  } catch (error) {
    console.error(`Failed to clear grace period for ${enterpriseId}:`, error.message);
    throw error;
  }
}

module.exports = {
  findOrCreatePlan,
  createPaystackPlan,
  generatePaymentReference,
  initializeEnterpriseSubscription,
  verifyEnterprisePayment,
  getPaystackSubscriptionStatus,
  createEnterpriseAccountWithRetry,
  disablePaystackSubscription,
  updatePaystackSubscriptionPlan,
  checkGracePeriodExpiration,
  suspendEnterpriseAccount,
  setGracePeriodOnPaymentFailure,
  clearGracePeriodOnPaymentSuccess
};

