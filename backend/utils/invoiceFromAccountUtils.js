/**
 * Invoice Generation from Enterprise Account (Phase 3)
 *
 * - generateInvoiceFromAccount(account)
 *
 * This creates an UNPAID invoice (isReceipt: false) in enterprise_invoices
 * for a given enterprise account, and generates its PDF buffer.
 *
 * It DOES NOT send any emails – invoices are surfaced via API endpoints.
 */

const { db, admin } = require('../firebase');
const { calculateEnterprisePrice } = require('../config/enterprisePricing');
const { generateInvoiceNumber } = require('./invoiceNumberUtils');
const { generateInvoicePDF } = require('./invoicePdfGenerator');
const { getCompanyInfo } = require('./companyInfo');
const { logEnterpriseError } = require('./enterpriseErrorLogger');

/**
 * Generate an invoice from an enterprise account.
 *
 * @param {object} account - enterprise_accounts document data
 * @returns {Promise<{ invoiceId: string, invoiceNumber: string, pdfBuffer: Buffer }>}
 */
async function generateInvoiceFromAccount(account) {
  if (!db || typeof db.collection !== 'function') {
    throw new Error('Firestore is not initialized');
  }

  if (!account || !account.enterpriseId) {
    throw new Error('Valid enterprise account (with enterpriseId) is required');
  }

  try {
    const nowTs = admin.firestore.Timestamp.now();
    const companyInfo = getCompanyInfo();

    const enterpriseId = account.enterpriseId;
    const currency = (account.currency || 'ZAR').toUpperCase();
    const numberOfEmployees = account.numberOfEmployees;

    // 1. Build Bill To information
    const billTo = {
      companyName: account.companyName || '',
      contactName: account.contactName || '',
      contactEmail: account.contactEmail || '',
      address: account.billingAddress || null,
      vatNumber: account.vatNumber || null
    };

    // 2. Calculate price using existing enterprise pricing logic
    const priceResult = calculateEnterprisePrice(numberOfEmployees, currency);
    const priceInCents =
      typeof priceResult === 'number'
        ? priceResult
        : priceResult.midPrice;

    // 3. Line item
    const description = `XSCard Enterprise License for ${numberOfEmployees} employees - Renewal`;
    const lineItems = [
      {
        description,
        quantity: 1,
        unitPrice: priceInCents,
        amount: priceInCents
      }
    ];

    // 4. Pricing
    const subtotal = priceInCents;
    const tax = 0;
    const total = priceInCents;
    const amountPaid = 0; // Unpaid invoice

    // 5. Dates
    const invoiceDate = nowTs;
    const dueDate = admin.firestore.Timestamp.fromDate(
      new Date(nowTs.toDate().getTime() + 30 * 24 * 60 * 60 * 1000)
    );

    // 6. Identifiers & status
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const invoiceNumber = await generateInvoiceNumber();

    const invoiceDoc = {
      invoiceId,
      invoiceNumber,
      quoteId: account.quoteId || null,
      enterpriseId,

      companyInfo,
      billTo,
      lineItems,

      subtotal,
      tax,
      total,
      amountPaid,
      currency,

      invoiceDate,
      dueDate,
      datePaid: null,

      paymentReference: null,
      paymentMethod: null,

      invoiceStatus: 'sent',
      isReceipt: false,

      metadata: {
        subscriptionType: account.plan || 'enterprise',
        numberOfEmployees: numberOfEmployees || null,
        billingCycleStart: account.subscriptionStartDate || null,
        billingCycleEnd: account.subscriptionEndDate || null
      },

      createdAt: nowTs,
      updatedAt: nowTs
    };

    // 7. Persist document
    await db.collection('enterprise_invoices').doc(invoiceId).set(invoiceDoc);

    // 8. Generate PDF buffer
    const pdfBuffer = await generateInvoicePDF(invoiceDoc);

    return { invoiceId, invoiceNumber, pdfBuffer };
  } catch (error) {
    await logEnterpriseError('invoice_generation_from_account_failure', {
      error: error.message,
      context: {
        enterpriseId: account?.enterpriseId || null
      },
      stack: error.stack
    });
    throw error;
  }
}

module.exports = {
  generateInvoiceFromAccount
};

