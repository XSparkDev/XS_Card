/**
 * Invoice & Receipt Generation Utilities (Phase 2)
 *
 * - extractPaymentMethodFromVerification(verificationResult)
 * - generateReceiptFromQuote(quoteData, verificationResult)
 *
 * These helpers are called after payment has been verified and the
 * enterprise account has been created successfully.
 */

const { db, admin } = require('../firebase');
const { getCompanyInfo } = require('./companyInfo');
const { generateInvoiceNumber, generateReceiptNumber } = require('./invoiceNumberUtils');
const { generateInvoicePDF } = require('./invoicePdfGenerator');
const { sendMailWithStatus } = require('../public/Utils/emailService');
const { logEnterpriseError } = require('./enterpriseErrorLogger');

/**
 * Extract a human-friendly payment method string from the Paystack
 * verification result returned by verifyEnterprisePayment().
 *
 * Expected structure:
 * {
 *   success: true,
 *   transaction: {
 *     authorization: {
 *       brand: 'visa',
 *       last4: '4043'
 *     },
 *     ...
 *   }
 * }
 *
 * @param {object} verificationResult
 * @returns {string|null} e.g. "Visa - 4043"
 */
function extractPaymentMethodFromVerification(verificationResult) {
  if (!verificationResult || !verificationResult.transaction || !verificationResult.transaction.authorization) {
    return null;
  }

  const auth = verificationResult.transaction.authorization;
  const brandRaw = auth.brand || '';
  const last4 = auth.last4 || '';

  if (!brandRaw || !last4) {
    return null;
  }

  const brand = brandRaw.charAt(0).toUpperCase() + brandRaw.slice(1);
  return `${brand} - ${last4}`;
}

/**
 * Safely convert a Firestore Timestamp or ISO/string date to a Firestore Timestamp.
 *
 * @param {any} value
 * @param {admin.firestore.Timestamp} fallback
 * @returns {admin.firestore.Timestamp}
 */
function toTimestampOrFallback(value, fallback) {
  if (value && typeof value.toDate === 'function') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return admin.firestore.Timestamp.fromDate(parsed);
    }
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    return admin.firestore.Timestamp.fromDate(value);
  }

  return fallback;
}

/**
 * Generate and store a receipt document in enterprise_invoices for the given quote,
 * then generate its PDF and attempt to email it to the customer.
 *
 * This function is designed to be idempotent at the collection level:
 * callers should ensure they do not generate multiple receipts for the
 * same quoteId (e.g. by checking existing docs first).
 *
 * @param {object} quoteData - Quote document data from enterprise_quotes
 * @param {object} verificationResult - Result from verifyEnterprisePayment()
 * @returns {Promise<{ invoiceId: string, invoiceNumber: string, receiptNumber: string }>}
 */
async function generateReceiptFromQuote(quoteData, verificationResult) {
  try {
    if (!db || typeof db.collection !== 'function') {
      throw new Error('Firestore is not initialized');
    }

    if (!quoteData || !quoteData.quoteId) {
      throw new Error('Valid quote data with quoteId is required to generate receipt');
    }

    const nowTs = admin.firestore.Timestamp.now();
    const companyInfo = getCompanyInfo();

    // Build Bill To object from quote
    const billTo = {
      companyName: quoteData.companyName || '',
      contactName: quoteData.contactName || '',
      contactEmail: quoteData.contactEmail || '',
      address: quoteData.billingAddress || null,
      vatNumber: quoteData.vatNumber || null
    };

    // Single line item for subscription
    const description = `XSCard Enterprise License for ${quoteData.numberOfEmployees} employees - ${quoteData.subscriptionType || 'yearly'} subscription`;
    const unitPrice = typeof quoteData.calculatedPrice === 'number' ? quoteData.calculatedPrice : 0;

    const lineItems = [
      {
        description,
        quantity: 1,
        unitPrice,
        amount: unitPrice
      }
    ];

    // Pricing summary
    const subtotal = unitPrice;
    const tax = 0;
    const total = unitPrice;
    const amountPaid = unitPrice;
    const currency = quoteData.currency || 'ZAR';

    // Dates & cycle
    const createdAtTs = toTimestampOrFallback(quoteData.createdAt, nowTs);
    const paidAtTs = toTimestampOrFallback(quoteData.paidAt, nowTs);

    const billingCycleStart = createdAtTs;
    const billingCycleEnd = null;

    // Payment info
    const paymentReference = quoteData.paymentReference || verificationResult?.transaction?.reference || null;
    const paymentMethod = extractPaymentMethodFromVerification(verificationResult);

    // Identifiers
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const invoiceNumber = await generateInvoiceNumber();
    const receiptNumber = generateReceiptNumber();

    // Build document according to ENTERPRISE_INVOICES_SCHEMA
    const invoiceDoc = {
      invoiceId,
      invoiceNumber,
      receiptNumber,
      quoteId: quoteData.quoteId,
      enterpriseId: `ent_${quoteData.quoteId}`, // matches handlePaymentCallback accountData.enterpriseId

      companyInfo,
      billTo,
      lineItems,

      subtotal,
      tax,
      total,
      amountPaid,
      currency,

      invoiceDate: createdAtTs,
      dueDate: null,
      datePaid: paidAtTs,

      paymentReference,
      paymentMethod: paymentMethod || null,

      invoiceStatus: 'paid',
      isReceipt: true,

      metadata: {
        subscriptionType: quoteData.subscriptionType || 'yearly',
        numberOfEmployees: quoteData.numberOfEmployees || null,
        billingCycleStart,
        billingCycleEnd
      },

      createdAt: nowTs,
      updatedAt: nowTs
    };

    // Persist receipt document
    await db.collection('enterprise_invoices').doc(invoiceId).set(invoiceDoc);

    // Generate PDF buffer
    const pdfBuffer = await generateInvoicePDF(invoiceDoc);

    // Send receipt email (awaited so it actually completes; failures are logged)
    if (billTo.contactEmail) {
      const subject = `Your XS Card Receipt ${receiptNumber}`;
      const humanAmount = (total / 100).toFixed(2);
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111827;">Payment Receipt</h2>
          <p>Dear ${billTo.contactName || billTo.companyName || 'Customer'},</p>
          <p>Thank you for your payment. Please find your receipt attached.</p>
          <p><strong>Receipt number:</strong> ${receiptNumber}<br/>
             <strong>Amount paid:</strong> ${currency} ${(humanAmount)}<br/>
             <strong>Date paid:</strong> ${paidAtTs.toDate().toLocaleDateString('en-GB')}</p>
          <p>If you have any questions, please reply to this email.</p>
          <p>Best regards,<br/>XS Card</p>
        </div>
      `;

      const mailOptions = {
        to: billTo.contactEmail,
        subject,
        html,
        text: `Receipt ${receiptNumber} - Amount paid: ${currency} ${humanAmount}`,
        attachments: [
          {
            filename: `XS_Card_Receipt_${receiptNumber}.pdf`,
            content: pdfBuffer
          }
        ]
      };

      try {
        const emailResult = await sendMailWithStatus(mailOptions);
        if (!emailResult || emailResult.success === false) {
          await logEnterpriseError('receipt_email_failure', {
            error: emailResult?.error || 'Unknown email failure',
            context: {
              quoteId: quoteData.quoteId,
              invoiceId,
              invoiceNumber,
              receiptNumber,
              to: billTo.contactEmail,
              provider: emailResult?.provider || null
            }
          });
        }
      } catch (emailError) {
        console.warn('Failed to send receipt email:', emailError.message);
        await logEnterpriseError('receipt_email_failure', {
          error: emailError.message,
          context: {
            quoteId: quoteData.quoteId,
            invoiceId,
            invoiceNumber,
            receiptNumber,
            to: billTo.contactEmail
          },
          stack: emailError.stack
        });
      }
    }

    return { invoiceId, invoiceNumber, receiptNumber };
  } catch (error) {
    // Log and rethrow for caller
    await logEnterpriseError('receipt_generation_failure', {
      error: error.message,
      context: {
        quoteId: quoteData?.quoteId || null
      },
      stack: error.stack
    });
    throw error;
  }
}

module.exports = {
  extractPaymentMethodFromVerification,
  generateReceiptFromQuote
};

