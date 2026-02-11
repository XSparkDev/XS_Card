// One-off test script for Phase 2A: generateReceiptFromQuote in isolation
// Usage (from backend directory):
//   node test-generate-receipt.js quote_XXXXXXXX

const { db } = require('./firebase');
const { verifyEnterprisePayment } = require('./utils/enterprisePaymentUtils');
const { generateReceiptFromQuote } = require('./utils/invoiceReceiptUtils');

async function main() {
  try {''
    const quoteId = 'quote_1770811524189_rdvrdks2z';

    if (!quoteId) {
      throw new Error('Usage: node test-generate-receipt.js <quoteId>');
    }

    console.log(`🔍 Loading quote ${quoteId}...`);
    const quoteRef = db.collection('enterprise_quotes').doc(quoteId);
    const snap = await quoteRef.get();

    if (!snap.exists) {
      throw new Error(`Quote not found: ${quoteId}`);
    }

    const quoteData = snap.data();
    quoteData.quoteId = quoteData.quoteId || quoteId;

    if (!quoteData.paymentReference) {
      throw new Error('Quote has no paymentReference. Use a paid quote or add a test reference.');
    }

    console.log(`🔍 Verifying payment with Paystack for reference ${quoteData.paymentReference}...`);
    const verificationResult = await verifyEnterprisePayment(quoteData.paymentReference);

    const now = new Date();
    const enrichedQuoteData = {
      ...quoteData,
      paidAt: quoteData.paidAt || now
    };

    console.log('🧾 Calling generateReceiptFromQuote...');
    const result = await generateReceiptFromQuote(enrichedQuoteData, verificationResult);

    console.log('✅ Receipt generation complete:', result);
    console.log('➡ Check Firestore collection "enterprise_invoices" and your email inbox for the PDF.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error in test-generate-receipt:', err.message);
    console.error(err);
    process.exit(1);
  }
}

main();

