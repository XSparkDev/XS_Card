/**
 * Enterprise Controller
 * 
 * Handles enterprise payment and subscription operations.
 */

const { db, admin } = require('../firebase');
const { calculateEnterprisePrice, formatPrice } = require('../config/enterprisePricing');
const { validateEnterpriseQuote } = require('../utils/enterpriseValidation');
const { logEnterpriseError, logPaymentInitializationFailure, logAccountCreationFailure, logWebhookProcessingFailure } = require('../utils/enterpriseErrorLogger');
const { 
  findOrCreatePlan, 
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
} = require('../utils/enterprisePaymentUtils');
const { validateWebhookSecurity } = require('../utils/webhookSecurity');

/**
 * Generate enterprise quote
 * 
 * POST /api/enterprise/quote
 * 
 * Request body:
 * {
 *   companyName: string,
 *   contactName: string,
 *   contactEmail: string,
 *   numberOfEmployees: number,
 *   currency?: 'ZAR' | 'USD' (optional, defaults to 'ZAR')
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   quote: {
 *     quoteId: string,
 *     companyName: string,
 *     contactName: string,
 *     contactEmail: string,
 *     numberOfEmployees: number,
 *     calculatedPrice: number, // in cents
 *     formattedPrice: string,  // e.g., "R 600.00"
 *     currency: 'ZAR' | 'USD',
 *     quoteStatus: 'pending',
 *     subscriptionType: 'yearly',
 *     createdAt: string, // ISO timestamp
 *     expiresAt: string  // ISO timestamp (30 days from now)
 *   }
 * }
 */
exports.generateQuote = async (req, res) => {
  try {
    // 1. Validate input
    const validationResult = validateEnterpriseQuote(req.body);
    
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: validationResult.errors
      });
    }

    const {
      companyName,
      contactName,
      contactEmail,
      numberOfEmployees,
      currency = 'ZAR' // Default to ZAR if not provided
    } = req.body;

    // 2. Calculate price
    let calculatedPrice;
    try {
      calculatedPrice = calculateEnterprisePrice(numberOfEmployees, currency);
    } catch (priceError) {
      return res.status(400).json({
        success: false,
        error: 'Price calculation failed',
        message: priceError.message
      });
    }

    // 3. Generate unique quote ID
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // 4. Calculate expiration date (30 days from now)
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(now.toDate().getTime() + (30 * 24 * 60 * 60 * 1000)) // 30 days in milliseconds
    );

    // 5. Create quote document
    const quoteData = {
      quoteId,
      companyName: companyName.trim(),
      contactEmail: contactEmail.trim().toLowerCase(),
      contactName: contactName.trim(),
      numberOfEmployees,
      calculatedPrice,
      currency: currency.toUpperCase(),
      quoteStatus: 'pending',
      subscriptionType: 'yearly',
      createdAt: now,
      expiresAt,
      metadata: {
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
      }
    };

    // 6. Write to database
    try {
      await db.collection('enterprise_quotes').doc(quoteId).set(quoteData);
      
      console.log(`✅ Quote generated: ${quoteId} for ${companyName} (${numberOfEmployees} employees, ${currency})`);
    } catch (dbError) {
      // Log database error
      await logEnterpriseError('quote_creation_failure', {
        error: dbError.message,
        context: {
          quoteId,
          companyName,
          numberOfEmployees,
          currency
        }
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to create quote',
        message: 'An error occurred while saving the quote. Please try again.'
      });
    }

    // 7. Return formatted response
    const formattedPrice = formatPrice(calculatedPrice, currency);

    res.status(201).json({
      success: true,
      quote: {
        quoteId,
        companyName: quoteData.companyName,
        contactName: quoteData.contactName,
        contactEmail: quoteData.contactEmail,
        numberOfEmployees,
        calculatedPrice,
        formattedPrice,
        currency: quoteData.currency,
        quoteStatus: quoteData.quoteStatus,
        subscriptionType: quoteData.subscriptionType,
        createdAt: now.toDate().toISOString(),
        expiresAt: expiresAt.toDate().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating quote:', error);
    
    // Log unexpected errors
    await logEnterpriseError('quote_generation_error', {
      error: error.message,
      stack: error.stack,
      context: {
        body: req.body,
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while generating the quote. Please try again later.'
    });
  }
};

/**
 * Initialize enterprise subscription payment
 * 
 * POST /api/enterprise/payment/initialize
 * 
 * Request body:
 * {
 *   quoteId: string
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   paymentUrl: string,
 *   paymentReference: string,
 *   amount: number,
 *   currency: 'ZAR' | 'USD',
 *   subscriptionType: 'yearly'
 * }
 */
exports.initializeSubscription = async (req, res) => {
  try {
    // 1. Validate input
    const { quoteId } = req.body;

    if (!quoteId || typeof quoteId !== 'string' || quoteId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'quoteId is required'
      });
    }

    // 2. Fetch quote from database
    let quoteDoc;
    try {
      quoteDoc = await db.collection('enterprise_quotes').doc(quoteId).get();
    } catch (dbError) {
      await logPaymentInitializationFailure(quoteId, `Database error: ${dbError.message}`);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch quote. Please try again.'
      });
    }

    if (!quoteDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found',
        message: 'The specified quote does not exist.'
      });
    }

    const quoteData = quoteDoc.data();

    // 3. Validate quote status (not already paid)
    if (quoteData.quoteStatus === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Quote already paid',
        message: 'This quote has already been paid.'
      });
    }

    // 4. Check if quote is expired
    const now = admin.firestore.Timestamp.now();
    const expiresAt = quoteData.expiresAt;

    if (expiresAt && expiresAt.toMillis() < now.toMillis()) {
      // Update quote status to expired
      try {
        await db.collection('enterprise_quotes').doc(quoteId).update({
          quoteStatus: 'expired'
        });
      } catch (updateError) {
        // Log but don't fail
        console.error('Failed to update quote status to expired:', updateError);
      }

      return res.status(400).json({
        success: false,
        error: 'Quote expired',
        message: 'This quote has expired. Please generate a new quote.'
      });
    }

    // 5. Find or create Paystack plan (with retry logic)
    let planCode;
    try {
      planCode = await findOrCreatePlan(
        quoteData.numberOfEmployees,
        quoteData.calculatedPrice,
        quoteData.currency
      );
    } catch (planError) {
      await logPaymentInitializationFailure(quoteId, `Plan creation failed: ${planError.message}`);
      return res.status(500).json({
        success: false,
        error: 'Plan creation failed',
        message: 'Failed to create payment plan. Please try again later.'
      });
    }

    // 6. Initialize Paystack subscription (with retry logic)
    let paymentResult;
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      try {
        paymentResult = await initializeEnterpriseSubscription(quoteData, planCode);
        break; // Success
      } catch (error) {
        attempts++;
        console.error(`Payment initialization attempt ${attempts}/${maxRetries} failed:`, error.message);

        // Log error
        await logPaymentInitializationFailure(quoteId, `Attempt ${attempts}/${maxRetries}: ${error.message}`);

        if (attempts === maxRetries) {
          return res.status(500).json({
            success: false,
            error: 'Payment initialization failed',
            message: 'Failed to initialize payment. Please try again later.'
          });
        }

        // Exponential backoff: 1s, 2s, 4s
        const backoffDelay = 1000 * Math.pow(2, attempts - 1);
        console.log(`Retrying payment initialization in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    // 7. Update quote with payment reference, URL, and plan code
    try {
      await db.collection('enterprise_quotes').doc(quoteId).update({
        paymentReference: paymentResult.reference,
        paymentUrl: paymentResult.authorization_url,
        planCode: planCode,
        quoteStatus: 'accepted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      // Log error but don't fail - payment was initialized successfully
      console.error('Failed to update quote with payment info:', updateError);
      await logEnterpriseError('quote_update_failure', {
        error: updateError.message,
        context: {
          quoteId,
          paymentReference: paymentResult.reference,
          planCode
        }
      });
    }

    console.log(`✅ Payment initialized: ${paymentResult.reference} for quote ${quoteId}`);

    // 8. Return payment URL
    res.status(200).json({
      success: true,
      paymentUrl: paymentResult.authorization_url,
      paymentReference: paymentResult.reference,
      amount: quoteData.calculatedPrice,
      currency: quoteData.currency,
      subscriptionType: 'yearly'
    });

  } catch (error) {
    console.error('Error initializing subscription:', error);

    // Log unexpected errors
    const quoteId = req.body?.quoteId || 'unknown';
    await logEnterpriseError('subscription_initialization_error', {
      error: error.message,
      stack: error.stack,
      context: {
        quoteId,
        body: req.body,
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while initializing payment. Please try again later.'
    });
  }
};

/**
 * Handle payment callback from Paystack
 * 
 * GET /api/enterprise/payment/callback?ref={paymentReference}
 * 
 * Handles Paystack redirect after payment and creates enterprise account.
 */
exports.handlePaymentCallback = async (req, res) => {
  try {
    // 1. Extract payment reference from query
    const paymentReference = req.query.ref || req.query.reference;

    if (!paymentReference || typeof paymentReference !== 'string' || paymentReference.trim() === '') {
      return res.redirect('/enterprise-payment-failure.html?error=missing_reference');
    }

    // 2. Verify payment with Paystack
    let verificationResult;
    try {
      verificationResult = await verifyEnterprisePayment(paymentReference);
    } catch (verifyError) {
      console.error('Payment verification failed:', verifyError.message);
      await logEnterpriseError('payment_verification_failure', {
        error: verifyError.message,
        context: {
          paymentReference
        }
      });
      return res.redirect(`/enterprise-payment-failure.html?error=verification_failed&ref=${encodeURIComponent(paymentReference)}`);
    }

    // 3. Find quote by paymentReference
    let quoteQuery;
    try {
      quoteQuery = await db.collection('enterprise_quotes')
        .where('paymentReference', '==', paymentReference)
        .limit(1)
        .get();
    } catch (dbError) {
      console.error('Database error finding quote:', dbError.message);
      await logEnterpriseError('quote_lookup_failure', {
        error: dbError.message,
        context: {
          paymentReference
        }
      });
      return res.redirect(`/enterprise-payment-failure.html?error=database_error&ref=${encodeURIComponent(paymentReference)}`);
    }

    if (quoteQuery.empty) {
      console.error(`Quote not found for payment reference: ${paymentReference}`);
      return res.redirect(`/enterprise-payment-failure.html?error=quote_not_found&ref=${encodeURIComponent(paymentReference)}`);
    }

    const quoteDoc = quoteQuery.docs[0];
    const quoteData = quoteDoc.data();
    const quoteRef = quoteDoc.ref;

    // 4. Check idempotency (already processed?)
    if (quoteData.quoteStatus === 'paid') {
      console.log(`✅ Payment already processed for quote: ${quoteData.quoteId}`);
      // Already processed, redirect to success
      return res.redirect(`/enterprise-payment-success.html?quoteId=${encodeURIComponent(quoteData.quoteId)}`);
    }

    // 5. Get subscription details from Paystack (if available)
    let subscriptionDetails = null;
    if (verificationResult.subscription) {
      try {
        subscriptionDetails = await getPaystackSubscriptionStatus(verificationResult.subscription);
      } catch (subError) {
        console.warn('Failed to fetch subscription details:', subError.message);
        // Continue without subscription details - webhook will handle it
      }
    }

    // 6. Create enterprise account (atomic transaction with retry)
    const enterpriseId = `ent_${quoteData.quoteId}`;
    const now = admin.firestore.Timestamp.now();

    // Calculate dates
    let subscriptionStartDate = now;
    let subscriptionEndDate = null;
    let nextBillingDate = null;

    if (subscriptionDetails) {
      subscriptionStartDate = subscriptionDetails.startDate 
        ? admin.firestore.Timestamp.fromDate(new Date(subscriptionDetails.startDate))
        : now;
      
      if (subscriptionDetails.nextPaymentDate) {
        nextBillingDate = admin.firestore.Timestamp.fromDate(new Date(subscriptionDetails.nextPaymentDate));
        // For annual subscriptions, end date is 1 year from start
        const endDate = new Date(subscriptionStartDate.toDate());
        endDate.setFullYear(endDate.getFullYear() + 1);
        subscriptionEndDate = admin.firestore.Timestamp.fromDate(endDate);
      }
    } else {
      // Fallback: calculate dates from current time (annual subscription)
      const endDate = new Date(now.toDate());
      endDate.setFullYear(endDate.getFullYear() + 1);
      subscriptionEndDate = admin.firestore.Timestamp.fromDate(endDate);
      nextBillingDate = subscriptionEndDate;
    }

    const accountData = {
      enterpriseId,
      companyName: quoteData.companyName,
      contactEmail: quoteData.contactEmail,
      contactName: quoteData.contactName,
      numberOfEmployees: quoteData.numberOfEmployees,
      plan: 'enterprise',
      accountStatus: 'active',
      
      // Paystack Subscription Fields
      subscriptionCode: subscriptionDetails?.subscriptionCode || verificationResult.subscription || null,
      subscriptionStatus: subscriptionDetails?.status || 'active',
      planCode: subscriptionDetails?.planCode || quoteData.planCode || null,
      customerCode: subscriptionDetails?.customerCode || verificationResult.transaction.customer?.customer_code || null,
      
      // Dates
      subscriptionStartDate,
      subscriptionEndDate,
      nextBillingDate,
      lastBillingDate: now,
      
      // Grace Period (not applicable for initial payment, but set defaults)
      gracePeriodDays: 7,
      
      // Warning Banner (not needed for active account)
      warningBanner: {
        show: false,
        message: '',
        severity: 'info',
        actionRequired: false,
        actionUrl: ''
      },
      
      // Tracking
      quoteId: quoteData.quoteId,
      activatedAt: now,
      createdAt: now,
      updatedAt: now
    };

    try {
      await createEnterpriseAccountWithRetry(accountData, quoteRef, 3);
      
      console.log(`✅ Enterprise account created successfully: ${enterpriseId} for quote ${quoteData.quoteId}`);
      
      // Log audit event
      await logSubscriptionCreated(enterpriseId, accountData);
      
      // Send welcome email (non-blocking)
      sendSubscriptionEmail('welcome', accountData).catch(error => {
        console.warn('Failed to send welcome email:', error.message);
      });
      
      // 7. Redirect to success page
      return res.redirect(`/enterprise-payment-success.html?quoteId=${encodeURIComponent(quoteData.quoteId)}&enterpriseId=${encodeURIComponent(enterpriseId)}`);
    } catch (accountError) {
      console.error('Failed to create enterprise account:', accountError.message);
      await logAccountCreationFailure(accountData, accountError.message, 3, 3);
      
      // Payment was successful but account creation failed - redirect to failure with special error
      return res.redirect(`/enterprise-payment-failure.html?error=account_creation_failed&ref=${encodeURIComponent(paymentReference)}&quoteId=${encodeURIComponent(quoteData.quoteId)}`);
    }

  } catch (error) {
    console.error('Error handling payment callback:', error);

    // Log unexpected errors
    const paymentReference = req.query.ref || req.query.reference || 'unknown';
    await logEnterpriseError('payment_callback_error', {
      error: error.message,
      stack: error.stack,
      context: {
        paymentReference,
        query: req.query,
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      }
    });

    return res.redirect(`/enterprise-payment-failure.html?error=unexpected_error&ref=${encodeURIComponent(paymentReference)}`);
  }
};

/**
 * Get enterprise subscription status
 * 
 * GET /api/enterprise/subscription/:enterpriseId/status
 * 
 * Fetches latest status from Paystack, syncs database, checks grace period.
 */
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const { enterpriseId } = req.params;

    if (!enterpriseId || typeof enterpriseId !== 'string' || enterpriseId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'enterpriseId is required'
      });
    }

    // 1. Find enterprise account
    let accountDoc;
    try {
      accountDoc = await db.collection('enterprise_accounts').doc(enterpriseId).get();
    } catch (dbError) {
      await logEnterpriseError('account_lookup_failure', {
        error: dbError.message,
        context: { enterpriseId }
      });
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch account. Please try again.'
      });
    }

    if (!accountDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
        message: 'The specified enterprise account does not exist.'
      });
    }

    const accountData = accountDoc.data();
    const accountRef = accountDoc.ref;

    // 2. Fetch latest status from Paystack (sync)
    let paystackSubscription = null;
    if (accountData.subscriptionCode) {
      try {
        paystackSubscription = await getPaystackSubscriptionStatus(accountData.subscriptionCode);
        
        // 3. Update database with latest Paystack data (sync)
        const updateData = {
          subscriptionStatus: paystackSubscription.status,
          nextBillingDate: paystackSubscription.nextPaymentDate 
            ? admin.firestore.Timestamp.fromDate(new Date(paystackSubscription.nextPaymentDate))
            : accountData.nextBillingDate,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Update end date if available
        if (paystackSubscription.endDate) {
          updateData.subscriptionEndDate = admin.firestore.Timestamp.fromDate(paystackSubscription.endDate);
        }

        await accountRef.update(updateData);
        
        // Update accountData for response
        accountData.subscriptionStatus = paystackSubscription.status;
        if (paystackSubscription.nextPaymentDate) {
          accountData.nextBillingDate = admin.firestore.Timestamp.fromDate(new Date(paystackSubscription.nextPaymentDate));
        }
      } catch (syncError) {
        console.warn('Failed to sync from Paystack:', syncError.message);
        // Continue with database data if Paystack sync fails
      }
    }

    // 3. Check grace period expiration (on-demand check)
    const gracePeriodCheck = await checkGracePeriodExpiration(accountData);
    
    let accountStatus = accountData.accountStatus || 'active';
    let warningBanner = gracePeriodCheck.warningBanner;

    // If grace period expired, suspend account
    if (gracePeriodCheck.isExpired && gracePeriodCheck.isSuspended) {
      try {
        await suspendEnterpriseAccount(enterpriseId);
        accountStatus = 'suspended';
        // Refresh account data after suspension
        const updatedAccountDoc = await db.collection('enterprise_accounts').doc(enterpriseId).get();
        if (updatedAccountDoc.exists) {
          const updatedAccount = updatedAccountDoc.data();
          accountStatus = updatedAccount.accountStatus || accountStatus;
          warningBanner = updatedAccount.warningBanner || warningBanner;
        }
      } catch (suspendError) {
        console.error('Failed to suspend account:', suspendError.message);
        // Continue with warning banner even if suspension fails
        accountStatus = 'suspended';
      }
    } else if (gracePeriodCheck.warningBanner.show) {
      // Still in grace period - use warning banner from check
      accountStatus = 'active'; // Still active during grace period
    } else {
      // No grace period issues
      accountStatus = accountData.accountStatus || 'active';
      warningBanner = accountData.warningBanner || { show: false };
    }

    // 4. Return subscription status
    const isActive = accountStatus === 'active' && 
                     ['active', 'non-renewing'].includes(accountData.subscriptionStatus);

    res.status(200).json({
      success: true,
      subscription: {
        status: accountData.subscriptionStatus || 'unknown',
        accountStatus: accountStatus,
        nextBillingDate: accountData.nextBillingDate?.toDate().toISOString() || null,
        lastBillingDate: accountData.lastBillingDate?.toDate().toISOString() || null,
        subscriptionEndDate: accountData.subscriptionEndDate?.toDate().toISOString() || null,
        amount: accountData.calculatedPrice || null, // Would need to calculate from plan
        currency: accountData.currency || 'ZAR',
        numberOfEmployees: accountData.numberOfEmployees || 0,
        isActive: isActive,
        warningBanner: warningBanner
      }
    });

  } catch (error) {
    console.error('Error getting subscription status:', error);

    await logEnterpriseError('subscription_status_error', {
      error: error.message,
      stack: error.stack,
      context: {
        enterpriseId: req.params.enterpriseId,
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching subscription status. Please try again later.'
    });
  }
};

/**
 * Cancel enterprise subscription
 * 
 * POST /api/enterprise/subscription/:enterpriseId/cancel
 * 
 * Cancels subscription with Paystack and updates database.
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { enterpriseId } = req.params;

    if (!enterpriseId || typeof enterpriseId !== 'string' || enterpriseId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'enterpriseId is required'
      });
    }

    // 1. Find enterprise account
    let accountDoc;
    try {
      accountDoc = await db.collection('enterprise_accounts').doc(enterpriseId).get();
    } catch (dbError) {
      await logEnterpriseError('account_lookup_failure', {
        error: dbError.message,
        context: { enterpriseId }
      });
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch account. Please try again.'
      });
    }

    if (!accountDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
        message: 'The specified enterprise account does not exist.'
      });
    }

    const accountData = accountDoc.data();
    const accountRef = accountDoc.ref;

    // Check if already cancelled
    if (accountData.subscriptionStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Already cancelled',
        message: 'This subscription is already cancelled.'
      });
    }

    // 2. Call Paystack API to disable subscription
    if (!accountData.subscriptionCode) {
      return res.status(400).json({
        success: false,
        error: 'No subscription code',
        message: 'Subscription code not found. Cannot cancel subscription.'
      });
    }

    try {
      await disablePaystackSubscription(accountData.subscriptionCode);
    } catch (paystackError) {
      console.error('Paystack cancellation failed:', paystackError.message);
      await logEnterpriseError('subscription_cancellation_failure', {
        error: paystackError.message,
        context: {
          enterpriseId,
          subscriptionCode: accountData.subscriptionCode
        }
      });
      return res.status(500).json({
        success: false,
        error: 'Cancellation failed',
        message: 'Failed to cancel subscription with Paystack. Please try again later.'
      });
    }

    // 3. Update database
    try {
      await accountRef.update({
        subscriptionStatus: 'cancelled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      console.error('Database update failed:', updateError.message);
      // Log but don't fail - Paystack cancellation succeeded
      await logEnterpriseError('subscription_cancellation_db_update_failure', {
        error: updateError.message,
        context: { enterpriseId }
      });
    }

    console.log(`✅ Subscription cancelled: ${enterpriseId}`);

    // Log audit event
    await logSubscriptionCancelled(enterpriseId, {
      subscriptionCode: accountData.subscriptionCode,
      subscriptionEndDate: accountData.subscriptionEndDate
    });

    // Send cancellation email (non-blocking)
    sendSubscriptionEmail('cancelled', accountData).catch(error => {
      console.warn('Failed to send cancellation email:', error.message);
    });

    // 4. Return response
    const subscriptionEndDate = accountData.subscriptionEndDate?.toDate().toISOString() || null;

    res.status(200).json({
      success: true,
      message: subscriptionEndDate 
        ? `Subscription cancelled. Account active until ${new Date(subscriptionEndDate).toLocaleDateString()}.`
        : 'Subscription cancelled successfully.',
      subscriptionEndDate: subscriptionEndDate
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);

    await logEnterpriseError('subscription_cancellation_error', {
      error: error.message,
      stack: error.stack,
      context: {
        enterpriseId: req.params.enterpriseId,
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while cancelling subscription. Please try again later.'
    });
  }
};

/**
 * Update employee count for enterprise subscription
 * 
 * POST /api/enterprise/subscription/:enterpriseId/update-employees
 * 
 * Updates employee count (creates new plan, updates Paystack subscription).
 * Change takes effect on next renewal (no prorating).
 */
exports.updateEmployeeCount = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { newNumberOfEmployees } = req.body;

    // 1. Validate input
    if (!enterpriseId || typeof enterpriseId !== 'string' || enterpriseId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'enterpriseId is required'
      });
    }

    if (!newNumberOfEmployees || typeof newNumberOfEmployees !== 'number' || 
        newNumberOfEmployees < 1 || newNumberOfEmployees > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'newNumberOfEmployees must be a number between 1 and 10,000'
      });
    }

    // 2. Find enterprise account
    let accountDoc;
    try {
      accountDoc = await db.collection('enterprise_accounts').doc(enterpriseId).get();
    } catch (dbError) {
      await logEnterpriseError('account_lookup_failure', {
        error: dbError.message,
        context: { enterpriseId }
      });
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to fetch account. Please try again.'
      });
    }

    if (!accountDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
        message: 'The specified enterprise account does not exist.'
      });
    }

    const accountData = accountDoc.data();
    const accountRef = accountDoc.ref;

    // Check if employee count is the same
    if (accountData.numberOfEmployees === newNumberOfEmployees) {
      return res.status(400).json({
        success: false,
        error: 'No change',
        message: 'Employee count is already set to this value.'
      });
    }

    // 3. Calculate new price
    const currency = accountData.currency || 'ZAR';
    let newPrice;
    try {
      newPrice = calculateEnterprisePrice(newNumberOfEmployees, currency);
    } catch (priceError) {
      return res.status(400).json({
        success: false,
        error: 'Price calculation failed',
        message: priceError.message
      });
    }

    // 4. Create or find new plan
    let newPlanCode;
    try {
      newPlanCode = await findOrCreatePlan(newNumberOfEmployees, newPrice, currency);
    } catch (planError) {
      await logEnterpriseError('plan_creation_failure', {
        error: planError.message,
        context: {
          enterpriseId,
          newNumberOfEmployees,
          newPrice,
          currency
        }
      });
      return res.status(500).json({
        success: false,
        error: 'Plan creation failed',
        message: 'Failed to create payment plan. Please try again later.'
      });
    }

    // 5. Update Paystack subscription with new plan
    if (!accountData.subscriptionCode) {
      return res.status(400).json({
        success: false,
        error: 'No subscription code',
        message: 'Subscription code not found. Cannot update subscription.'
      });
    }

    try {
      await updatePaystackSubscriptionPlan(accountData.subscriptionCode, newPlanCode);
    } catch (paystackError) {
      console.error('Paystack subscription update failed:', paystackError.message);
      await logEnterpriseError('subscription_update_failure', {
        error: paystackError.message,
        context: {
          enterpriseId,
          subscriptionCode: accountData.subscriptionCode,
          newPlanCode
        }
      });
      return res.status(500).json({
        success: false,
        error: 'Subscription update failed',
        message: 'Failed to update subscription with Paystack. Please try again later.'
      });
    }

    // 6. Update database
    try {
      await accountRef.update({
        numberOfEmployees: newNumberOfEmployees,
        planCode: newPlanCode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      console.error('Database update failed:', updateError.message);
      // Log but don't fail - Paystack update succeeded
      await logEnterpriseError('employee_count_update_db_failure', {
        error: updateError.message,
        context: { enterpriseId }
      });
    }

    console.log(`✅ Employee count updated: ${enterpriseId} -> ${newNumberOfEmployees} employees`);

    // Log audit event
    await logEmployeeCountUpdated(enterpriseId, {
      oldNumberOfEmployees: accountData.numberOfEmployees,
      newNumberOfEmployees: newNumberOfEmployees,
      oldPlanCode: accountData.planCode,
      newPlanCode: newPlanCode,
      newPrice: newPrice
    });

    // 7. Return response
    const nextRenewalDate = accountData.nextBillingDate?.toDate().toISOString() || null;

    res.status(200).json({
      success: true,
      message: 'Employee count updated. New price will take effect on next renewal.',
      nextRenewalDate: nextRenewalDate,
      newPrice: newPrice,
      newNumberOfEmployees: newNumberOfEmployees
    });

  } catch (error) {
    console.error('Error updating employee count:', error);

    await logEnterpriseError('employee_count_update_error', {
      error: error.message,
      stack: error.stack,
      context: {
        enterpriseId: req.params.enterpriseId,
        body: req.body,
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while updating employee count. Please try again later.'
    });
  }
};

/**
 * Handle Paystack subscription webhook
 * 
 * POST /api/enterprise/payment/webhook
 * 
 * Handles all subscription lifecycle events from Paystack.
 * Acknowledges immediately and processes asynchronously.
 */
exports.handleSubscriptionWebhook = async (req, res) => {
  try {
    // 1. Verify webhook signature
    const securityValidation = await validateWebhookSecurity(req);
    if (!securityValidation.isValid) {
      console.error('Webhook security validation failed:', securityValidation.errors);
      return res.status(401).json({ 
        error: 'Invalid webhook signature',
        errors: securityValidation.errors
      });
    }

    // 2. Acknowledge webhook immediately (Paystack best practice)
    res.status(200).json({ received: true });

    // 3. Process asynchronously (don't block response)
    setImmediate(async () => {
      try {
        const webhookData = req.body;
        const event = webhookData.event;

        console.log(`📥 Processing webhook event: ${event}`);

        // 4. Always fetch current state from Paystack before processing (handles out-of-order webhooks)
        const subscriptionCode = webhookData.data?.subscription?.subscription_code || 
                                 webhookData.data?.subscription_code;
        
        if (subscriptionCode) {
          try {
            const currentSubscription = await getPaystackSubscriptionStatus(subscriptionCode);
            // Merge current state with webhook data (current state takes precedence)
            webhookData.data = {
              ...webhookData.data,
              subscription: {
                ...webhookData.data?.subscription,
                ...currentSubscription
              },
              ...currentSubscription
            };
            console.log(`✅ Fetched current subscription state: ${subscriptionCode}`);
          } catch (subError) {
            console.warn('Failed to fetch current subscription state:', subError.message);
            // Continue with webhook data only
          }
        }

        // 5. Route to appropriate handler
        await routeWebhookEvent(webhookData);

      } catch (error) {
        console.error('Error processing webhook:', error);
        const event = req.body?.event || 'unknown';
        await logWebhookProcessingFailure(event, req.body, error.message);
        // Don't throw - already acknowledged
      }
    });

  } catch (error) {
    console.error('Error handling webhook:', error);
    // If we haven't responded yet, send error
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
};

/**
 * Route webhook event to appropriate handler
 */
async function routeWebhookEvent(webhookData) {
  const event = webhookData.event;

  switch (event) {
    case 'subscription.create':
      await handleSubscriptionCreated(webhookData);
      break;
    
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(webhookData);
      break;
    
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(webhookData);
      break;
    
    case 'subscription.disable':
      await handleSubscriptionCancelled(webhookData);
      break;
    
    case 'subscription.not_renewing':
      await handleSubscriptionNotRenewing(webhookData);
      break;
    
    default:
      console.log(`⚠️  Unhandled webhook event: ${event}`);
  }
}

/**
 * Handle subscription.create event
 * Creates enterprise account when subscription is first created
 */
async function handleSubscriptionCreated(webhookData) {
  try {
    const subscriptionCode = webhookData.data?.subscription?.subscription_code || 
                             webhookData.data?.subscription_code;
    
    if (!subscriptionCode) {
      throw new Error('Subscription code missing from webhook data');
    }

    // Check idempotency - find account by subscription code
    const accountQuery = await db.collection('enterprise_accounts')
      .where('subscriptionCode', '==', subscriptionCode)
      .limit(1)
      .get();

    if (!accountQuery.empty) {
      const account = accountQuery.docs[0].data();
      if (account.subscriptionStatus === 'active' && account.accountStatus === 'active') {
        console.log(`✅ Subscription already processed - skipping: ${subscriptionCode}`);
        return { alreadyProcessed: true };
      }
    }

    // Find quote by metadata.quoteId or subscriptionCode
    let quoteDoc = null;
    const quoteId = webhookData.data?.metadata?.quoteId;
    
    if (quoteId) {
      quoteDoc = await db.collection('enterprise_quotes').doc(quoteId).get();
    }

    // If quote not found, try to find by subscription code (fallback)
    if (!quoteDoc || !quoteDoc.exists) {
      const quoteQuery = await db.collection('enterprise_quotes')
        .where('planCode', '==', webhookData.data?.plan?.plan_code || webhookData.data?.planCode)
        .where('quoteStatus', '==', 'accepted')
        .limit(1)
        .get();
      
      if (!quoteQuery.empty) {
        quoteDoc = quoteQuery.docs[0];
      }
    }

    if (!quoteDoc || !quoteDoc.exists) {
      console.warn(`⚠️  Quote not found for subscription: ${subscriptionCode}`);
      // Account might have been created via callback - that's okay
      return { skipped: true, reason: 'Quote not found' };
    }

    const quoteData = quoteDoc.data();
    const quoteRef = quoteDoc.ref;

    // Check if already paid (idempotency)
    if (quoteData.quoteStatus === 'paid') {
      console.log(`✅ Quote already paid - skipping: ${quoteData.quoteId}`);
      return { alreadyProcessed: true };
    }

    // Create enterprise account
    const enterpriseId = `ent_${quoteData.quoteId}`;
    const now = admin.firestore.Timestamp.now();

    // Calculate dates from subscription data
    let subscriptionStartDate = now;
    let subscriptionEndDate = null;
    let nextBillingDate = null;

    if (webhookData.data?.subscription) {
      const sub = webhookData.data.subscription;
      if (sub.startDate) {
        subscriptionStartDate = admin.firestore.Timestamp.fromDate(new Date(sub.startDate));
      }
      if (sub.nextPaymentDate) {
        nextBillingDate = admin.firestore.Timestamp.fromDate(new Date(sub.nextPaymentDate));
        const endDate = new Date(subscriptionStartDate.toDate());
        endDate.setFullYear(endDate.getFullYear() + 1);
        subscriptionEndDate = admin.firestore.Timestamp.fromDate(endDate);
      }
    } else {
      // Fallback: calculate from current time
      const endDate = new Date(now.toDate());
      endDate.setFullYear(endDate.getFullYear() + 1);
      subscriptionEndDate = admin.firestore.Timestamp.fromDate(endDate);
      nextBillingDate = subscriptionEndDate;
    }

    const accountData = {
      enterpriseId,
      companyName: quoteData.companyName,
      contactEmail: quoteData.contactEmail,
      contactName: quoteData.contactName,
      numberOfEmployees: quoteData.numberOfEmployees,
      plan: 'enterprise',
      accountStatus: 'active',
      
      // Paystack Subscription Fields
      subscriptionCode,
      subscriptionStatus: 'active',
      planCode: webhookData.data?.plan?.plan_code || quoteData.planCode || null,
      customerCode: webhookData.data?.customer?.customer_code || null,
      
      // Dates
      subscriptionStartDate,
      subscriptionEndDate,
      nextBillingDate,
      lastBillingDate: now,
      
      // Grace Period
      gracePeriodDays: 7,
      
      // Warning Banner
      warningBanner: {
        show: false,
        message: '',
        severity: 'info',
        actionRequired: false,
        actionUrl: ''
      },
      
      // Tracking
      quoteId: quoteData.quoteId,
      activatedAt: now,
      createdAt: now,
      updatedAt: now
    };

    await createEnterpriseAccountWithRetry(accountData, quoteRef, 3);
    console.log(`✅ Enterprise account created from webhook: ${enterpriseId}`);

    // Log audit event
    await logSubscriptionCreated(enterpriseId, accountData);
    
    // Send welcome email (non-blocking)
    sendSubscriptionEmail('welcome', accountData).catch(error => {
      console.warn('Failed to send welcome email:', error.message);
    });

  } catch (error) {
    console.error('Error handling subscription.create webhook:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_succeeded event
 * Updates dates for renewals and reactivates suspended accounts
 */
async function handleInvoicePaymentSucceeded(webhookData) {
  try {
    const subscriptionCode = webhookData.data?.subscription?.subscription_code || 
                             webhookData.data?.subscription_code;
    
    if (!subscriptionCode) {
      throw new Error('Subscription code missing from webhook data');
    }

    // Find account by subscription code
    const accountQuery = await db.collection('enterprise_accounts')
      .where('subscriptionCode', '==', subscriptionCode)
      .limit(1)
      .get();

    if (accountQuery.empty) {
      console.warn(`⚠️  Account not found for subscription: ${subscriptionCode}`);
      return { skipped: true, reason: 'Account not found' };
    }

    const accountDoc = accountQuery.docs[0];
    const account = accountDoc.data();

    // Check idempotency - compare payment dates
    const paidAt = webhookData.data?.paid_at || webhookData.data?.paidAt;
    if (paidAt && account.lastBillingDate) {
      const lastBillingDate = account.lastBillingDate.toDate();
      const webhookPaymentDate = new Date(paidAt);
      if (lastBillingDate.getTime() === webhookPaymentDate.getTime()) {
        console.log(`✅ Payment already processed - skipping: ${subscriptionCode}`);
        return { alreadyProcessed: true };
      }
    }

    const updateData = {
      subscriptionStatus: 'active',
      lastBillingDate: admin.firestore.Timestamp.fromDate(new Date(paidAt || Date.now())),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Check if account is suspended or has grace period (reactivation scenario)
    if (account.accountStatus === 'suspended' || account.gracePeriodEndDate) {
      console.log(`🔄 Reactivating account: ${account.enterpriseId}`);
      
      // Clear grace period if it exists
      if (account.gracePeriodEndDate) {
        await clearGracePeriodOnPaymentSuccess(account.enterpriseId);
      }
      
      const nextPaymentDate = webhookData.data?.next_payment_date || webhookData.data?.nextPaymentDate;
      if (nextPaymentDate) {
        const nextBilling = admin.firestore.Timestamp.fromDate(new Date(nextPaymentDate));
        const endDate = new Date(nextBilling.toDate());
        endDate.setFullYear(endDate.getFullYear() + 1);
        
        updateData.accountStatus = 'active';
        updateData.nextBillingDate = nextBilling;
        updateData.subscriptionEndDate = admin.firestore.Timestamp.fromDate(endDate);
        updateData.reactivatedAt = admin.firestore.FieldValue.serverTimestamp();
        updateData.warningBanner = {
          show: false,
          message: '',
          severity: 'info',
          actionRequired: false,
          actionUrl: ''
        };
      }
    } else {
      // Normal renewal - just update dates
      const nextPaymentDate = webhookData.data?.next_payment_date || webhookData.data?.nextPaymentDate;
      if (nextPaymentDate) {
        const nextBilling = admin.firestore.Timestamp.fromDate(new Date(nextPaymentDate));
        const endDate = new Date(nextBilling.toDate());
        endDate.setFullYear(endDate.getFullYear() + 1);
        
        updateData.nextBillingDate = nextBilling;
        updateData.subscriptionEndDate = admin.firestore.Timestamp.fromDate(endDate);
      }
    }

    await accountDoc.ref.update(updateData);
    console.log(`✅ Invoice payment succeeded processed: ${subscriptionCode}`);

    // Get updated account data for email/audit
    const updatedAccountDoc = await db.collection('enterprise_accounts').doc(account.enterpriseId).get();
    const updatedAccount = updatedAccountDoc.exists ? updatedAccountDoc.data() : account;

    // Log audit event
    await logPaymentSucceeded(account.enterpriseId, {
      subscriptionCode,
      amount: updatedAccount.calculatedPrice || account.calculatedPrice,
      currency: updatedAccount.currency || account.currency,
      nextBillingDate: updatedAccount.nextBillingDate
    });

    // Send payment succeeded email (non-blocking)
    sendSubscriptionEmail('payment_succeeded', updatedAccount, {
      amount: updatedAccount.calculatedPrice || account.calculatedPrice
    }).catch(error => {
      console.warn('Failed to send payment succeeded email:', error.message);
    });

    // If reactivated, send reactivation email
    if (account.accountStatus === 'suspended' || account.gracePeriodEndDate) {
      sendSubscriptionEmail('reactivated', updatedAccount).catch(error => {
        console.warn('Failed to send reactivation email:', error.message);
      });
      
      await logAccountReactivated(account.enterpriseId, {
        subscriptionCode,
        nextBillingDate: updatedAccount.nextBillingDate
      });
    }

  } catch (error) {
    console.error('Error handling invoice.payment_succeeded webhook:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_failed event
 * Sets grace period and tracks payment failure
 */
async function handleInvoicePaymentFailed(webhookData) {
  try {
    const subscriptionCode = webhookData.data?.subscription?.subscription_code || 
                             webhookData.data?.subscription_code;
    
    if (!subscriptionCode) {
      throw new Error('Subscription code missing from webhook data');
    }

    // Find account by subscription code
    const accountQuery = await db.collection('enterprise_accounts')
      .where('subscriptionCode', '==', subscriptionCode)
      .limit(1)
      .get();

    if (accountQuery.empty) {
      console.warn(`⚠️  Account not found for subscription: ${subscriptionCode}`);
      return { skipped: true, reason: 'Account not found' };
    }

    const accountDoc = accountQuery.docs[0];
    const account = accountDoc.data();
    const enterpriseId = account.enterpriseId;

    // Set grace period using utility function
    const gracePeriodDays = account.gracePeriodDays || 7;
    const gracePeriodResult = await setGracePeriodOnPaymentFailure(enterpriseId, gracePeriodDays);

    console.log(`⚠️  Invoice payment failed processed: ${subscriptionCode} (grace period: ${gracePeriodDays} days)`);

    // Get updated account data
    const updatedAccountDoc = await db.collection('enterprise_accounts').doc(enterpriseId).get();
    const updatedAccount = updatedAccountDoc.exists ? updatedAccountDoc.data() : account;

    // Log audit event
    await logPaymentFailed(enterpriseId, {
      subscriptionCode,
      gracePeriodEndDate: updatedAccount.gracePeriodEndDate,
      gracePeriodDays: gracePeriodDays
    });

    // Send payment failed email (non-blocking)
    sendSubscriptionEmail('payment_failed', updatedAccount).catch(error => {
      console.warn('Failed to send payment failed email:', error.message);
    });

  } catch (error) {
    console.error('Error handling invoice.payment_failed webhook:', error);
    throw error;
  }
}

/**
 * Handle subscription.disable event
 * Updates status when subscription is cancelled
 */
async function handleSubscriptionCancelled(webhookData) {
  try {
    const subscriptionCode = webhookData.data?.subscription?.subscription_code || 
                             webhookData.data?.subscription_code;
    
    if (!subscriptionCode) {
      throw new Error('Subscription code missing from webhook data');
    }

    // Find account by subscription code
    const accountQuery = await db.collection('enterprise_accounts')
      .where('subscriptionCode', '==', subscriptionCode)
      .limit(1)
      .get();

    if (accountQuery.empty) {
      console.warn(`⚠️  Account not found for subscription: ${subscriptionCode}`);
      return { skipped: true, reason: 'Account not found' };
    }

    const accountDoc = accountQuery.docs[0];

    await accountDoc.ref.update({
      subscriptionStatus: 'cancelled',
      // Account remains active until subscriptionEndDate
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Subscription cancelled processed: ${subscriptionCode}`);

  } catch (error) {
    console.error('Error handling subscription.disable webhook:', error);
    throw error;
  }
}

/**
 * Handle subscription.not_renewing event
 * Updates status when subscription is not renewing
 */
async function handleSubscriptionNotRenewing(webhookData) {
  // Same as subscription.disable
  await handleSubscriptionCancelled(webhookData);
}

