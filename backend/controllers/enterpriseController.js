/**
 * Enterprise Controller
 * 
 * Handles enterprise payment and subscription operations.
 */

// Get maximum employees from environment variable (default: 10000)
const MAX_EMPLOYEES = parseInt(process.env.ENTERPRISE_MAX_EMPLOYEES || '10000', 10);

const { db, admin } = require('../firebase');
const { calculateEnterprisePrice, formatPrice } = require('../config/enterprisePricing');
const { validateEnterpriseQuote } = require('../utils/enterpriseValidation');
const { logEnterpriseError, logPaymentInitializationFailure, logAccountCreationFailure, logWebhookProcessingFailure } = require('../utils/enterpriseErrorLogger');
const { logSubscriptionCreated } = require('../utils/enterpriseAuditLog');
const { sendSubscriptionEmail } = require('../utils/enterpriseEmailService');
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
const { generateReceiptFromQuote } = require('../utils/invoiceReceiptUtils');
const { generateInvoiceFromAccount } = require('../utils/invoiceFromAccountUtils');
const { sendMailWithStatus } = require('../public/Utils/emailService');
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

    // 2. Calculate price (supports exact number or range string)
    let priceResult;
    try {
      priceResult = calculateEnterprisePrice(numberOfEmployees, currency);
    } catch (priceError) {
      return res.status(400).json({
        success: false,
        error: 'Price calculation failed',
        message: priceError.message
      });
    }

    let calculatedPrice;
    let priceRange = null;

    if (typeof priceResult === 'number') {
      // Backwards compatible: exact employee count, single price in cents
      calculatedPrice = priceResult;
    } else {
      // Range result from calculateEnterprisePrice
      calculatedPrice = priceResult.midPrice;
      priceRange = {
        minEmployees: priceResult.minEmployees,
        maxEmployees: priceResult.maxEmployees,
        minPrice: priceResult.minPrice,
        maxPrice: priceResult.maxPrice,
        midEmployees: priceResult.midEmployees,
        midPrice: priceResult.midPrice
      };
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
      // Optional range metadata when a range was provided
      ...(priceRange ? { priceRange } : {}),
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
        // When a range is used, expose additional pricing info to the client
        ...(priceRange ? {
          priceRange: {
            ...priceRange,
            formattedMinPrice: formatPrice(priceRange.minPrice, currency),
            formattedMaxPrice: formatPrice(priceRange.maxPrice, currency)
          }
        } : {}),
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
 * Generate and download quote PDF
 * 
 * GET /api/enterprise/quotes/:quoteId/pdf
 * 
 * Generates a PDF matching the frontend implementation exactly.
 */
exports.getQuotePDF = async (req, res) => {
  try {
    const { quoteId } = req.params;

    if (!quoteId || typeof quoteId !== 'string' || quoteId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'quoteId is required'
      });
    }

    // Fetch quote from database
    let quoteDoc;
    try {
      quoteDoc = await db.collection('enterprise_quotes').doc(quoteId).get();
    } catch (dbError) {
      console.error('Error fetching quote:', dbError);
      await logEnterpriseError('quote_pdf_fetch_failure', {
        error: dbError.message,
        context: { quoteId }
      });
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
        message: 'The requested quote does not exist or has expired.'
      });
    }

    const quoteData = quoteDoc.data();

    // Convert Firestore Timestamps to ISO strings for PDF generator
    const quoteForPdf = {
      ...quoteData,
      createdAt: quoteData.createdAt?.toDate?.()?.toISOString() || quoteData.createdAt || new Date().toISOString(),
      expiresAt: quoteData.expiresAt?.toDate?.()?.toISOString() || quoteData.expiresAt || new Date().toISOString()
    };

    // Get base URL for payment links
    const protocol = req.protocol || 'https';
    const host = req.get('host') || 'localhost:8383';
    const baseUrl = `${protocol}://${host}`;

    // Generate PDF
    const { generateQuotePDF } = require('../utils/quotePdfGenerator');
    let pdfBuffer;
    try {
      pdfBuffer = await generateQuotePDF(quoteForPdf, baseUrl);
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      await logEnterpriseError('quote_pdf_generation_failure', {
        error: pdfError.message,
        stack: pdfError.stack,
        context: { quoteId }
      });
      return res.status(500).json({
        success: false,
        error: 'PDF generation failed',
        message: 'Unable to generate PDF. Please try again later.'
      });
    }

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `XS_Card_Quote_${quoteId}_${date}.pdf`;

    // Set headers and send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error in getQuotePDF:', error);
    await logEnterpriseError('quote_pdf_error', {
      error: error.message,
      stack: error.stack,
      context: {
        quoteId: req.params.quoteId,
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while generating the PDF. Please try again later.'
    });
  }
};

/**
 * Find active (non-expired) quotes by contact email
 * 
 * GET /api/enterprise/quotes/by-email?email={contactEmail}
 * 
 * A "non-expired" quote is defined as: now < expiresAt.
 */
exports.getActiveQuotesByEmail = async (req, res) => {
  try {
    const rawEmail = (req.query.email || '').toString().trim();
    const email = rawEmail.toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'email query parameter is required'
      });
    }

    // Basic email shape check (backend still trusts stored data)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'email must be a valid email address'
      });
    }

    const now = admin.firestore.Timestamp.now();

    let snapshot;
    try {
      snapshot = await db.collection('enterprise_quotes')
        .where('contactEmail', '==', email)
        .get();
    } catch (dbError) {
      console.error('Error querying quotes by email:', dbError);
      await logEnterpriseError('quote_lookup_by_email_failure', {
        error: dbError.message,
        context: { email }
      });
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to look up quotes. Please try again later.'
      });
    }

    if (snapshot.empty) {
      return res.json({
        success: true,
        quotes: []
      });
    }

    // Filter non-expired in memory: expiresAt > now
    const activeQuotes = snapshot.docs
      .map(doc => doc.data())
      .filter(data => {
        if (!data.expiresAt || typeof data.expiresAt.toMillis !== 'function') {
          return false;
        }
        return data.expiresAt.toMillis() > now.toMillis();
      })
      // Sort by createdAt descending (most recent first)
      .sort((a, b) => {
        const aTime = a.createdAt && typeof a.createdAt.toMillis === 'function'
          ? a.createdAt.toMillis()
          : 0;
        const bTime = b.createdAt && typeof b.createdAt.toMillis === 'function'
          ? b.createdAt.toMillis()
          : 0;
        return bTime - aTime;
      });

    if (activeQuotes.length === 0) {
      return res.json({
        success: true,
        quotes: []
      });
    }

    const responseQuotes = activeQuotes.map(data => {
      const createdAtIso = data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : null;
      const expiresAtIso = data.expiresAt && typeof data.expiresAt.toDate === 'function'
        ? data.expiresAt.toDate().toISOString()
        : null;

      const formattedPrice = typeof data.calculatedPrice === 'number'
        ? formatPrice(data.calculatedPrice, data.currency || 'ZAR')
        : null;

      let priceRange = null;
      if (data.priceRange && typeof data.priceRange === 'object') {
        const pr = data.priceRange;
        if (typeof pr.minPrice === 'number' && typeof pr.maxPrice === 'number') {
          priceRange = {
            minEmployees: pr.minEmployees,
            maxEmployees: pr.maxEmployees,
            formattedMinPrice: formatPrice(pr.minPrice, data.currency || 'ZAR'),
            formattedMaxPrice: formatPrice(pr.maxPrice, data.currency || 'ZAR')
          };
        }
      }

      return {
        quoteId: data.quoteId,
        companyName: data.companyName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        numberOfEmployees: data.numberOfEmployees,
        currency: data.currency,
        formattedPrice,
        ...(priceRange ? { priceRange } : {}),
        quoteStatus: data.quoteStatus,
        createdAt: createdAtIso,
        expiresAt: expiresAtIso,
        paymentUrl: data.paymentUrl || null
      };
    });

    return res.json({
      success: true,
      quotes: responseQuotes
    });
  } catch (error) {
    console.error('Unexpected error in getActiveQuotesByEmail:', error);
    await logEnterpriseError('quote_lookup_by_email_unexpected_error', {
      error: error.message,
      stack: error.stack,
      context: {
        email: req.query.email || null
      }
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while looking up quotes. Please try again later.'
    });
  }
};

/**
 * Public payment entry URL for a quote
 * 
 * GET /pay/quote/:quoteId
 * 
 * This endpoint is designed to be used by:
 * - QR codes in the quote PDF
 * - Payment links in the quote PDF
 * - “Proceed to Payment” buttons in the frontend
 * 
 * Behaviour:
 * 1. Lookup quote by quoteId
 * 2. Validate:
 *    - If not found → show simple HTML “Quote not found”
 *    - If expired → show simple HTML “Quote expired”
 * 3. If quoteStatus === 'paid' → show simple HTML “Payment already completed”
 * 4. If quote has paymentUrl and status is pending/accepted → redirect to paymentUrl
 * 5. If quote is pending and has no paymentUrl → initialize payment server-side, then redirect
 */
exports.handleQuotePaymentEntry = async (req, res) => {
  const { quoteId } = req.params;

  const sendHtml = (statusCode, title, message) => {
    res.status(statusCode).send(
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#f5f5f5; padding:40px; color:#222; }
      .card { max-width:600px; margin:40px auto; background:#fff; border-radius:12px; padding:32px; box-shadow:0 10px 30px rgba(0,0,0,0.08); }
      h1 { font-size:24px; margin-bottom:12px; }
      p { font-size:15px; line-height:1.5; margin:4px 0; }
      .muted { color:#666; font-size:13px; margin-top:16px; }
      .status { font-size:13px; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:8px; color:#888; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="status">XS Card Enterprise Quote</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <p class="muted">If you believe this is an error, please contact the XS Card team with your quote ID: <strong>${quoteId || 'N/A'}</strong>.</p>
    </div>
  </body>
</html>`
    );
  };

  try {
    if (!quoteId || typeof quoteId !== 'string' || quoteId.trim() === '') {
      return sendHtml(
        400,
        'Invalid Quote Link',
        'The quote link is missing a valid quote ID.'
      );
    }

    // 1. Lookup quote
    let quoteDoc;
    try {
      quoteDoc = await db.collection('enterprise_quotes').doc(quoteId).get();
    } catch (dbError) {
      console.error('Error looking up quote for payment entry:', dbError);
      await logEnterpriseError('quote_payment_entry_lookup_failure', {
        error: dbError.message,
        context: { quoteId }
      });
      return sendHtml(
        500,
        'Unable to Load Quote',
        'We could not load this quote at the moment. Please try again in a few minutes.'
      );
    }

    if (!quoteDoc.exists) {
      return sendHtml(
        404,
        'Quote Not Found',
        'We could not find a quote matching this link. It may have been removed or never existed.'
      );
    }

    const quoteData = quoteDoc.data();
    const now = admin.firestore.Timestamp.now();

    // 2. Check expiry
    if (quoteData.expiresAt && typeof quoteData.expiresAt.toMillis === 'function') {
      if (quoteData.expiresAt.toMillis() <= now.toMillis()) {
        return sendHtml(
          410,
          'Quote Expired',
          'This quote has expired and is no longer available for payment. Please request a new quote from the XS Card team.'
        );
      }
    }

    // 3. If already paid, show info (do not send user back to Paystack)
    if (quoteData.quoteStatus === 'paid') {
      return sendHtml(
        200,
        'Payment Already Completed',
        'Payment for this quote has already been completed. Your enterprise account should be active. You can safely close this page.'
      );
    }

    // 4. If we already have a paymentUrl for this quote and it is in a payable state, reuse it
    if (quoteData.paymentUrl && typeof quoteData.paymentUrl === 'string') {
      // For now, treat 'pending' and 'accepted' as payable
      if (quoteData.quoteStatus === 'pending' || quoteData.quoteStatus === 'accepted') {
        return res.redirect(302, quoteData.paymentUrl);
      }
    }

    // 5. Initialize payment server-side if quote is pending and not yet initialized
    if (quoteData.quoteStatus !== 'pending') {
      // Not in a state we can initialize from
      return sendHtml(
        400,
        'Quote Not Payable',
        'This quote is not in a payable state. Please request a new quote or contact support.'
      );
    }

    // Reuse the Phase 4 logic (find/create plan + initialize subscription)
    let planCode;
    try {
      planCode = await findOrCreatePlan(
        quoteData.numberOfEmployees,
        quoteData.calculatedPrice,
        quoteData.currency
      );
    } catch (planError) {
      console.error('Plan creation failed in payment entry:', planError);
      await logPaymentInitializationFailure(quoteId, `Plan creation failed (entry): ${planError.message}`);
      return sendHtml(
        500,
        'Unable to Start Payment',
        'We could not prepare this quote for payment. Please try again later or request a new quote.'
      );
    }

    let paymentResult;
    let attempts = 0;
    const maxRetries = 3;
    let currentPlanCode = planCode;

    while (attempts < maxRetries) {
      try {
        paymentResult = await initializeEnterpriseSubscription(quoteData, currentPlanCode);
        break; // Success
      } catch (error) {
        attempts++;
        console.error(
          `Payment initialization (entry) attempt ${attempts}/${maxRetries} failed:`,
          error.message
        );

        // Detect "plan not found" to recover by creating a new plan and retrying
        const isPlanNotFound = error.message && (
          error.message.toLowerCase().includes('plan not found') ||
          error.message.toLowerCase().includes('plan does not exist') ||
          error.message.toLowerCase().includes('no such plan')
        );

        if (isPlanNotFound && attempts < maxRetries) {
          console.warn(`Plan ${currentPlanCode} not found in Paystack (entry). Creating new plan and retrying...`);

          // Delete stale plan from database if present
          try {
            const stalePlanQuery = await db.collection('enterprise_plans')
              .where('planCode', '==', currentPlanCode)
              .limit(1)
              .get();

            if (!stalePlanQuery.empty) {
              await stalePlanQuery.docs[0].ref.delete();
              console.log(`Removed stale plan from database (entry): ${currentPlanCode}`);
            }
          } catch (deleteError) {
            console.warn(`Failed to delete stale plan (entry): ${deleteError.message}`);
          }

          try {
            currentPlanCode = await findOrCreatePlan(
              quoteData.numberOfEmployees,
              quoteData.calculatedPrice,
              quoteData.currency
            );
            console.log(`Created new plan (entry): ${currentPlanCode}. Retrying payment initialization...`);
            continue; // Retry immediately with new plan
          } catch (planError) {
            console.error(`Plan recovery failed (entry): ${planError.message}`);
            await logPaymentInitializationFailure(quoteId, `Plan recovery failed (entry): ${planError.message}`);
            // Fall through to normal retry logic
          }
        }

        await logPaymentInitializationFailure(
          quoteId,
          `Entry attempt ${attempts}/${maxRetries}: ${error.message}`
        );

        if (attempts === maxRetries) {
          return sendHtml(
            500,
            'Unable to Start Payment',
            'We could not start payment for this quote. Please try again later or request a new quote.'
          );
        }

        // Exponential backoff: 1s, 2s, 4s
        const backoffDelay = 1000 * Math.pow(2, attempts - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    // Update quote with new payment reference, URL, and plan code
    try {
      await db.collection('enterprise_quotes').doc(quoteId).update({
        paymentReference: paymentResult.reference,
        paymentUrl: paymentResult.authorization_url,
        planCode: currentPlanCode,
        quoteStatus: 'accepted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      console.error('Failed to update quote with payment info (entry):', updateError);
      await logEnterpriseError('quote_update_failure_entry', {
        error: updateError.message,
        context: {
          quoteId,
          paymentReference: paymentResult.reference,
          planCode: currentPlanCode
        }
      });
      // Continue anyway – payment session exists and can still be used
    }

    console.log(`Payment initialized via entry URL: ${paymentResult.reference} for quote ${quoteId}`);

    // Redirect to Paystack payment page
    return res.redirect(302, paymentResult.authorization_url);
  } catch (error) {
    console.error('Unexpected error in handleQuotePaymentEntry:', error);
    await logEnterpriseError('quote_payment_entry_unexpected_error', {
      error: error.message,
      stack: error.stack,
      context: {
        quoteId,
        params: req.params,
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      }
    });

    return sendHtml(
      500,
      'Unexpected Error',
      'An unexpected error occurred while processing this quote. Please try again later or contact support.'
    );
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

    // 6. Initialize Paystack subscription (with retry logic and plan recovery)
    let paymentResult;
    let attempts = 0;
    const maxRetries = 3;
    let currentPlanCode = planCode;

    while (attempts < maxRetries) {
      try {
        paymentResult = await initializeEnterpriseSubscription(quoteData, currentPlanCode);
        break; // Success
      } catch (error) {
        attempts++;
        console.error(`Payment initialization attempt ${attempts}/${maxRetries} failed:`, error.message);

        // Check if error is "Plan not found" - this means plan was deleted from Paystack
        const isPlanNotFound = error.message && (
          error.message.toLowerCase().includes('plan not found') ||
          error.message.toLowerCase().includes('plan does not exist') ||
          error.message.toLowerCase().includes('no such plan')
        );

        if (isPlanNotFound && attempts < maxRetries) {
          console.warn(`⚠️  Plan ${currentPlanCode} not found in Paystack. Creating new plan and retrying...`);
          
          // Delete stale plan from database if it exists
          try {
            const stalePlanQuery = await db.collection('enterprise_plans')
              .where('planCode', '==', currentPlanCode)
              .limit(1)
              .get();
            
            if (!stalePlanQuery.empty) {
              await stalePlanQuery.docs[0].ref.delete();
              console.log(`🗑️  Removed stale plan from database: ${currentPlanCode}`);
            }
          } catch (deleteError) {
            console.warn(`Failed to delete stale plan: ${deleteError.message}`);
          }

          // Create a new plan
          try {
            currentPlanCode = await findOrCreatePlan(
              quoteData.numberOfEmployees,
              quoteData.calculatedPrice,
              quoteData.currency
            );
            console.log(`✅ Created new plan: ${currentPlanCode}. Retrying payment initialization...`);
            
            // Retry immediately with new plan (don't wait for backoff)
            continue;
          } catch (planError) {
            console.error(`Failed to create new plan: ${planError.message}`);
            await logPaymentInitializationFailure(quoteId, `Plan recovery failed: ${planError.message}`);
            // Fall through to normal retry logic
          }
        }

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
        planCode: currentPlanCode, // Use currentPlanCode (may have been updated during retry)
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
      quoteId: quoteId,
      amount: quoteData.calculatedPrice,
      currency: quoteData.currency,
      planCode: currentPlanCode, // Include plan code in response
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
      await createEnterpriseAccountWithRetry(accountData, quoteRef, quoteData);
      
      console.log(`✅ Enterprise account created successfully: ${enterpriseId} for quote ${quoteData.quoteId}`);
      
      // Log audit event (non-blocking - don't fail if this errors)
      try {
        await logSubscriptionCreated(enterpriseId, accountData);
      } catch (auditError) {
        console.warn('⚠️  Audit logging failed (non-critical):', auditError.message);
        // Log to error logs but don't fail the operation
        await logEnterpriseError('audit_logging_failure', {
          error: auditError.message,
          context: {
            enterpriseId,
            quoteId: quoteData.quoteId,
            paymentReference
          }
        });
      }
      
      // Send welcome email (non-blocking)
      sendSubscriptionEmail('welcome', accountData).catch(error => {
        console.warn('Failed to send welcome email:', error.message);
      });

      // Generate receipt from quote (non-blocking for user)
      try {
        const enrichedQuoteData = {
          ...quoteData,
          paidAt: quoteData.paidAt || now
        };
        await generateReceiptFromQuote(enrichedQuoteData, verificationResult);
      } catch (receiptError) {
        console.warn('Failed to generate or email receipt:', receiptError.message);
        // Detailed logging is handled inside generateReceiptFromQuote via logEnterpriseError
      }
      
      // 7. Redirect to success page
      return res.redirect(`/enterprise-payment-success.html?quoteId=${encodeURIComponent(quoteData.quoteId)}&enterpriseId=${encodeURIComponent(enterpriseId)}`);
    } catch (accountError) {
      // ONLY catch actual account creation errors here
      // This should only happen if createEnterpriseAccountWithRetry() throws
      console.error('❌ CRITICAL: Account creation failed:', accountError.message);
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
        newNumberOfEmployees < 1 || newNumberOfEmployees > MAX_EMPLOYEES) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: `newNumberOfEmployees must be a number between 1 and ${MAX_EMPLOYEES.toLocaleString()}`
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
    let securityValidation;
    try {
      securityValidation = await validateWebhookSecurity(req);
    } catch (validationError) {
      // If validation function throws, treat as security failure
      console.error('Webhook security validation threw error:', validationError.message);
      return res.status(401).json({ 
        error: 'Invalid webhook signature',
        errors: ['Security validation failed: ' + validationError.message]
      });
    }
    
    if (!securityValidation || !securityValidation.isValid) {
      console.error('Webhook security validation failed:', securityValidation?.errors || ['Unknown validation error']);
      return res.status(401).json({ 
        error: 'Invalid webhook signature',
        errors: securityValidation?.errors || ['Security validation failed']
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
    console.error('Error stack:', error.stack);
    // If we haven't responded yet, check if it's a security validation error
    if (!res.headersSent) {
      // If error is related to security validation, return 401
      const errorMessage = error.message || error.toString() || '';
      if (errorMessage.includes('signature') || 
          errorMessage.includes('security') ||
          errorMessage.includes('validation') ||
          errorMessage.includes('Missing webhook') ||
          errorMessage.includes('Invalid webhook')) {
        console.log('Returning 401 for security error:', errorMessage);
        return res.status(401).json({ 
          error: 'Invalid webhook signature',
          errors: [errorMessage]
        });
      }
      // Otherwise return 500 for unexpected errors
      console.log('Returning 500 for unexpected error:', errorMessage);
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

    await createEnterpriseAccountWithRetry(accountData, quoteRef, quoteData);
    console.log(`✅ Enterprise account created from webhook: ${enterpriseId}`);

    // Log audit event (non-blocking - don't fail if this errors)
    try {
      await logSubscriptionCreated(enterpriseId, accountData);
    } catch (auditError) {
      console.warn('⚠️  Audit logging failed (non-critical):', auditError.message);
      // Log to error logs but don't fail the operation
      await logEnterpriseError('audit_logging_failure', {
        error: auditError.message,
        context: {
          enterpriseId,
          quoteId: quoteData.quoteId,
          subscriptionCode
        }
      });
    }
    
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

// ============================================================================
// Phase 1: Enterprise CRUD Operations (from other server)
// ============================================================================

const { logActivity, ACTIONS, RESOURCES } = require('../utils/logger');

/**
 * Get all enterprises
 * GET /api/enterprise
 * Note: Should be filtered by user's enterprise or admin-only
 */
exports.getAllEnterprises = async (req, res) => {
  try {
    const userId = req.user?.uid;
    
    // Get user document to check enterprise access
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;
    
    // If user has an enterprise, filter by their enterprise
    // Otherwise, return empty (or implement admin check)
    let query = db.collection('enterprise');
    if (userEnterpriseId) {
      // Filter by user's enterprise
      const snapshot = await db.collection('enterprise').doc(userEnterpriseId).get();
      if (snapshot.exists) {
        const enterprises = [{
          id: snapshot.id,
          ...snapshot.data()
        }];
        
        // Log activity
        await logActivity({
          action: ACTIONS.VIEW,
          resource: RESOURCES.ENTERPRISE,
          userId: userId,
          enterpriseId: userEnterpriseId,
          details: {
            operation: 'get_all_enterprises',
            count: enterprises.length
          }
        });
        
        return res.status(200).json({ 
          success: true,
          data: enterprises
        });
      }
    }
    
    // If no enterprise, return empty array
    // TODO: Add admin check if needed for viewing all enterprises
    await logActivity({
      action: ACTIONS.VIEW,
      resource: RESOURCES.ENTERPRISE,
      userId: userId,
      details: {
        operation: 'get_all_enterprises',
        count: 0,
        note: 'No enterprise access'
      }
    });
    
    return res.status(200).json({ 
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Error getting enterprises:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get enterprises', 
      error: error.message 
    });
  }
};

/**
 * Get enterprise by ID
 * GET /api/enterprise/:enterpriseId
 */
exports.getEnterpriseById = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const userId = req.user?.uid;
    
    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;
    
    // Authorization check: user must have access to this enterprise
    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied to enterprise' 
      });
    }
    
    const doc = await db.collection('enterprise').doc(enterpriseId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Enterprise not found' 
      });
    }

    const enterprise = {
      id: doc.id,
      ...doc.data()
    };

    // Log activity
    await logActivity({
      action: ACTIONS.VIEW,
      resource: RESOURCES.ENTERPRISE,
      userId: userId,
      resourceId: enterpriseId,
      enterpriseId: enterpriseId,
      details: {
        operation: 'get_enterprise_by_id'
      }
    });

    res.status(200).json({ 
      success: true,
      data: {
        enterprise
      }
    });
  } catch (error) {
    console.error('Error getting enterprise:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get enterprise', 
      error: error.message 
    });
  }
};

/**
 * Update an enterprise
 * PUT /api/enterprise/:enterpriseId
 */
exports.updateEnterprise = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const userId = req.user?.uid;
    const { 
      name, description, industry, website, logoUrl, 
      colorScheme, companySize, address 
    } = req.body;

    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;
    
    // Authorization check: user must have access to this enterprise
    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied to enterprise' 
      });
    }
    
    // Check if user is enterprise admin
    if (userData.role !== 'admin' && userData.plan !== 'enterprise') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only enterprise admins can update enterprise details' 
      });
    }

    const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
    const doc = await enterpriseRef.get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Enterprise not found' 
      });
    }

    const updates = {};
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (industry !== undefined) updates.industry = industry;
    if (website !== undefined) updates.website = website;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (colorScheme !== undefined) updates.colorScheme = colorScheme;
    if (companySize !== undefined) updates.companySize = companySize;
    if (address !== undefined) updates.address = address;
    
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await enterpriseRef.update(updates);

    const updatedDoc = await enterpriseRef.get();
    const updatedEnterprise = {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };

    // Log activity
    await logActivity({
      action: ACTIONS.UPDATE,
      resource: RESOURCES.ENTERPRISE,
      userId: userId,
      resourceId: enterpriseId,
      enterpriseId: enterpriseId,
      details: {
        operation: 'update_enterprise',
        updatedFields: Object.keys(updates)
      }
    });

    res.status(200).json({
      success: true,
      message: 'Enterprise updated successfully',
      data: {
        enterprise: updatedEnterprise
      }
    });
  } catch (error) {
    console.error('Error updating enterprise:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update enterprise', 
      error: error.message 
    });
  }
};

/**
 * Delete an enterprise
 * DELETE /api/enterprise/:enterpriseId
 */
exports.deleteEnterprise = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const userId = req.user?.uid;
    
    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;
    
    // Authorization check: user must have access to this enterprise
    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied to enterprise' 
      });
    }
    
    // Check if user is enterprise admin
    if (userData.role !== 'admin' && userData.plan !== 'enterprise') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only enterprise admins can delete enterprise' 
      });
    }
    
    const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
    const doc = await enterpriseRef.get();

    if (!doc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Enterprise not found' 
      });
    }

    // TODO: Add validation checks (active subscription, departments, employees, etc.)
    // For now, allow deletion but log it

    await enterpriseRef.delete();

    // Log activity
    await logActivity({
      action: ACTIONS.DELETE,
      resource: RESOURCES.ENTERPRISE,
      userId: userId,
      resourceId: enterpriseId,
      enterpriseId: enterpriseId,
      details: {
        operation: 'delete_enterprise'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Enterprise deleted successfully',
      data: {
        id: enterpriseId
      }
    });
  } catch (error) {
    console.error('Error deleting enterprise:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete enterprise', 
      error: error.message 
    });
  }
};

/**
 * Get enterprise statistics
 * GET /api/enterprise/:enterpriseId/stats
 */
exports.getEnterpriseStats = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const userId = req.user?.uid;
    
    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;
    
    // Authorization check: user must have access to this enterprise
    if (!userEnterpriseId || userEnterpriseId !== enterpriseId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied to enterprise' 
      });
    }
    
    const doc = await db.collection('enterprise').doc(enterpriseId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Enterprise not found' 
      });
    }

    // Get actual stats
    // Count users in enterprise
    const usersSnapshot = await db.collection('users')
      .where('enterpriseRef', '==', db.collection('enterprise').doc(enterpriseId))
      .get();
    
    const totalUsers = usersSnapshot.size;
    const activeUsers = usersSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.status === 'active' || !data.status;
    }).length;

    // TODO: Add departments count when departments feature is integrated
    const stats = {
      totalUsers,
      activeUsers,
      departments: 0, // Placeholder until departments feature is integrated
      lastActivity: new Date().toISOString()
    };

    // Log activity
    await logActivity({
      action: ACTIONS.VIEW,
      resource: RESOURCES.ENTERPRISE,
      userId: userId,
      resourceId: enterpriseId,
      enterpriseId: enterpriseId,
      details: {
        operation: 'get_enterprise_stats'
      }
    });

    res.status(200).json({ 
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    console.error('Error getting enterprise stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get enterprise stats', 
      error: error.message 
    });
  }
};

/**
 * Get a single invoice/receipt by ID
 *
 * GET /api/enterprise/invoices/:invoiceId
 */
exports.getInvoiceById = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user?.uid;

    if (!invoiceId || typeof invoiceId !== 'string' || invoiceId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'invoiceId is required'
      });
    }

    // Load invoice
    const invoiceDoc = await db.collection('enterprise_invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        message: 'The requested invoice/receipt does not exist.'
      });
    }

    const invoiceData = invoiceDoc.data();

    // Authorization: user must belong to this enterprise
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;

    if (!userEnterpriseId || userEnterpriseId !== invoiceData.enterpriseId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have access to this invoice/receipt.'
      });
    }

    return res.status(200).json({
      success: true,
      invoice: {
        id: invoiceDoc.id,
        ...invoiceData
      }
    });
  } catch (error) {
    console.error('Error getting invoice by ID:', error);
    await logEnterpriseError('invoice_get_error', {
      error: error.message,
      stack: error.stack,
      context: {
        invoiceId: req.params.invoiceId,
        userId: req.user?.uid || null
      }
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to load invoice. Please try again later.'
    });
  }
};

/**
 * Download invoice/receipt PDF
 *
 * GET /api/enterprise/invoices/:invoiceId/pdf
 */
exports.getInvoicePDF = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user?.uid;

    if (!invoiceId || typeof invoiceId !== 'string' || invoiceId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'invoiceId is required'
      });
    }

    // Load invoice
    const invoiceDoc = await db.collection('enterprise_invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        message: 'The requested invoice/receipt does not exist.'
      });
    }

    const invoiceData = invoiceDoc.data();

    // Authorization: user must belong to this enterprise
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;

    if (!userEnterpriseId || userEnterpriseId !== invoiceData.enterpriseId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have access to this invoice/receipt.'
      });
    }

    // Generate PDF
    const { generateInvoicePDF } = require('../utils/invoicePdfGenerator');
    let pdfBuffer;
    try {
      pdfBuffer = await generateInvoicePDF(invoiceData);
    } catch (pdfError) {
      console.error('Error generating invoice PDF:', pdfError);
      await logEnterpriseError('invoice_pdf_generation_failure', {
        error: pdfError.message,
        stack: pdfError.stack,
        context: { invoiceId }
      });
      return res.status(500).json({
        success: false,
        error: 'PDF generation failed',
        message: 'Unable to generate PDF. Please try again later.'
      });
    }

    // Filename: Invoice vs Receipt
    const date = new Date().toISOString().split('T')[0];
    const isReceipt = !!invoiceData.isReceipt;
    const label = isReceipt ? 'Receipt' : 'Invoice';
    const numberPart = invoiceData.invoiceNumber || invoiceData.receiptNumber || invoiceId;
    const filename = `XS_Card_${label}_${numberPart}_${date}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error in getInvoicePDF:', error);
    await logEnterpriseError('invoice_pdf_error', {
      error: error.message,
      stack: error.stack,
      context: {
        invoiceId: req.params.invoiceId,
        userId: req.user?.uid || null
      }
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while generating the PDF. Please try again later.'
    });
  }
};

/**
 * Email an invoice/receipt PDF on demand
 *
 * POST /api/enterprise/invoices/:invoiceId/email
 * Body (optional): { toEmail?: string }
 */
exports.emailInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user?.uid;
    const { toEmail } = req.body || {};

    if (!invoiceId || typeof invoiceId !== 'string' || invoiceId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'invoiceId is required'
      });
    }

    // Load invoice
    const invoiceDoc = await db.collection('enterprise_invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        message: 'The requested invoice/receipt does not exist.'
      });
    }

    const invoiceData = invoiceDoc.data();

    // Authorization: user must belong to this enterprise
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userData = userDoc.data();
    const userEnterpriseId = userData.enterpriseRef?.id;

    if (!userEnterpriseId || userEnterpriseId !== invoiceData.enterpriseId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have access to this invoice/receipt.'
      });
    }

    // Determine recipient
    const targetEmail = (toEmail || invoiceData.billTo?.contactEmail || userData.email || '').trim();
    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        error: 'No recipient',
        message: 'No email address available to send this invoice.'
      });
    }

    // Generate PDF buffer
    const { generateInvoicePDF } = require('../utils/invoicePdfGenerator');
    const pdfBuffer = await generateInvoicePDF(invoiceData);

    const isReceipt = !!invoiceData.isReceipt;
    const label = isReceipt ? 'Receipt' : 'Invoice';
    const numberPart = invoiceData.invoiceNumber || invoiceData.receiptNumber || invoiceId;
    const filename = `XS_Card_${label}_${numberPart}.pdf`;

    const subject = isReceipt
      ? `Your XS Card Receipt ${numberPart}`
      : `Your XS Card Invoice ${numberPart}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #111827;">${label}</h2>
        <p>Dear ${invoiceData.billTo?.contactName || invoiceData.billTo?.companyName || 'Customer'},</p>
        <p>Please find your ${label.toLowerCase()} attached.</p>
        <p><strong>${label} number:</strong> ${numberPart}<br/>
           <strong>Amount ${isReceipt ? 'paid' : 'due'}:</strong> ${invoiceData.currency || 'ZAR'} ${(invoiceData.total / 100).toFixed(2)}</p>
        <p>If you have any questions, please reply to this email.</p>
        <p>Best regards,<br/>XS Card</p>
      </div>
    `;

    const mailOptions = {
      to: targetEmail,
      subject,
      html,
      text: `${label} ${numberPart} - Amount ${isReceipt ? 'paid' : 'due'}: ${(invoiceData.total / 100).toFixed(2)}`,
      attachments: [
        {
          filename,
          content: pdfBuffer
        }
      ]
    };

    const emailResult = await sendMailWithStatus(mailOptions);

    if (!emailResult || emailResult.success === false) {
      await logEnterpriseError('invoice_email_failure', {
        error: emailResult?.error || 'Unknown email failure',
        context: {
          invoiceId,
          invoiceNumber: invoiceData.invoiceNumber || null,
          receiptNumber: invoiceData.receiptNumber || null,
          to: targetEmail,
          provider: emailResult?.provider || null
        }
      });

      return res.status(500).json({
        success: false,
        error: 'Email failed',
        message: 'Failed to send invoice email. Please try again later.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `${label} emailed successfully`,
      to: targetEmail,
      provider: emailResult.provider || null
    });
  } catch (error) {
    console.error('Error emailing invoice:', error);
    await logEnterpriseError('invoice_email_unexpected_error', {
      error: error.message,
      stack: error.stack,
      context: {
        invoiceId: req.params.invoiceId,
        userId: req.user?.uid || null
      }
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while emailing the invoice. Please try again later.'
    });
  }
};
