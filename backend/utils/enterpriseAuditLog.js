/**
 * Enterprise Audit Log
 * 
 * Logs all subscription lifecycle events for audit and tracking purposes.
 * Stores audit logs in Firestore 'audit_logs' collection.
 */

const { db, admin } = require('../firebase');

/**
 * Log subscription lifecycle event
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @param {string} eventType - Event type (e.g., 'subscription_created', 'payment_succeeded', 'payment_failed', 'subscription_cancelled')
 * @param {object} data - Event data (optional)
 * @returns {Promise<string>} - Document ID of logged event
 */
async function logSubscriptionEvent(enterpriseId, eventType, data = {}) {
  try {
    const auditLog = {
      enterpriseId,
      eventType,
      data: data,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('audit_logs').add(auditLog);
    
    console.log(`📝 Audit log created: [${eventType}] for ${enterpriseId} (${docRef.id})`);

    return docRef.id;
  } catch (error) {
    // Fallback to console if Firestore logging fails
    console.error('❌ Failed to log audit event to Firestore:', error);
    console.error('Event data:', {
      enterpriseId,
      eventType,
      data
    });
    return null;
  }
}

/**
 * Log subscription created event
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @param {object} accountData - Account data
 * @returns {Promise<string>} - Document ID
 */
async function logSubscriptionCreated(enterpriseId, accountData) {
  return logSubscriptionEvent(enterpriseId, 'subscription_created', {
    subscriptionCode: accountData.subscriptionCode,
    planCode: accountData.planCode,
    numberOfEmployees: accountData.numberOfEmployees,
    amount: accountData.calculatedPrice || null,
    currency: accountData.currency
  });
}

/**
 * Log payment succeeded event
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @param {object} paymentData - Payment data
 * @returns {Promise<string>} - Document ID
 */
async function logPaymentSucceeded(enterpriseId, paymentData) {
  return logSubscriptionEvent(enterpriseId, 'payment_succeeded', {
    subscriptionCode: paymentData.subscriptionCode,
    amount: paymentData.amount,
    currency: paymentData.currency,
    nextBillingDate: paymentData.nextBillingDate
  });
}

/**
 * Log payment failed event
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @param {object} failureData - Failure data
 * @returns {Promise<string>} - Document ID
 */
async function logPaymentFailed(enterpriseId, failureData) {
  return logSubscriptionEvent(enterpriseId, 'payment_failed', {
    subscriptionCode: failureData.subscriptionCode,
    gracePeriodEndDate: failureData.gracePeriodEndDate,
    gracePeriodDays: failureData.gracePeriodDays
  });
}

/**
 * Log account suspended event
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @param {object} suspensionData - Suspension data
 * @returns {Promise<string>} - Document ID
 */
async function logAccountSuspended(enterpriseId, suspensionData) {
  return logSubscriptionEvent(enterpriseId, 'account_suspended', {
    reason: 'grace_period_expired',
    gracePeriodEndDate: suspensionData.gracePeriodEndDate,
    previousStatus: suspensionData.previousStatus
  });
}

/**
 * Log account reactivated event
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @param {object} reactivationData - Reactivation data
 * @returns {Promise<string>} - Document ID
 */
async function logAccountReactivated(enterpriseId, reactivationData) {
  return logSubscriptionEvent(enterpriseId, 'account_reactivated', {
    subscriptionCode: reactivationData.subscriptionCode,
    nextBillingDate: reactivationData.nextBillingDate
  });
}

/**
 * Log subscription cancelled event
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @param {object} cancellationData - Cancellation data
 * @returns {Promise<string>} - Document ID
 */
async function logSubscriptionCancelled(enterpriseId, cancellationData) {
  return logSubscriptionEvent(enterpriseId, 'subscription_cancelled', {
    subscriptionCode: cancellationData.subscriptionCode,
    subscriptionEndDate: cancellationData.subscriptionEndDate
  });
}

/**
 * Log employee count updated event
 * 
 * @param {string} enterpriseId - Enterprise account ID
 * @param {object} updateData - Update data
 * @returns {Promise<string>} - Document ID
 */
async function logEmployeeCountUpdated(enterpriseId, updateData) {
  return logSubscriptionEvent(enterpriseId, 'employee_count_updated', {
    oldNumberOfEmployees: updateData.oldNumberOfEmployees,
    newNumberOfEmployees: updateData.newNumberOfEmployees,
    oldPlanCode: updateData.oldPlanCode,
    newPlanCode: updateData.newPlanCode,
    newPrice: updateData.newPrice
  });
}

module.exports = {
  logSubscriptionEvent,
  logSubscriptionCreated,
  logPaymentSucceeded,
  logPaymentFailed,
  logAccountSuspended,
  logAccountReactivated,
  logSubscriptionCancelled,
  logEmployeeCountUpdated
};

