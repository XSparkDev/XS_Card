/**
 * Enterprise Controller
 * 
 * Handles enterprise payment and subscription operations.
 */

const { db, admin } = require('../firebase');
const { calculateEnterprisePrice, formatPrice } = require('../config/enterprisePricing');
const { validateEnterpriseQuote } = require('../utils/enterpriseValidation');
const { logEnterpriseError, logPaymentInitializationFailure } = require('../utils/enterpriseErrorLogger');

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

