/**
 * Enterprise Controller
 * 
 * Handles enterprise payment and subscription operations.
 */

const { db, admin } = require('../firebase');
const { calculateEnterprisePrice, formatPrice } = require('../config/enterprisePricing');
const { validateEnterpriseQuote } = require('../utils/enterpriseValidation');
const { logEnterpriseError, logPaymentInitializationFailure } = require('../utils/enterpriseErrorLogger');
const { findOrCreatePlan, initializeEnterpriseSubscription } = require('../utils/enterprisePaymentUtils');

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

