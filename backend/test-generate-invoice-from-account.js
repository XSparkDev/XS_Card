// One-off test script for Phase 3:
// Generate an UNPAID invoice from a TEST enterprise account and log its ID.
//
// Usage (from backend directory):
//   node test-generate-invoice-from-account.js
//
// This does NOT depend on an existing enterprise_accounts doc – it builds a
// minimal fake account object for testing invoices end-to-end.

const { admin } = require('./firebase');
const { generateInvoiceFromAccount } = require('./utils/invoiceFromAccountUtils');

async function main() {
  try {
    const now = admin.firestore.Timestamp.now();

    const accountData = {
      enterpriseId: 'x-spark-test',
      companyName: 'X Spark Test Enterprise',
      contactName: 'Pule',
      contactEmail: 'pule@xspark.co.za',
      // Minimal fields required by pricing & invoice generator
      numberOfEmployees: 25,
      currency: 'ZAR',
      plan: 'enterprise',
      subscriptionStartDate: now,
      subscriptionEndDate: null,
      billingAddress: null,
      vatNumber: null,
      quoteId: null
    };

    console.log('🧾 Generating TEST invoice from synthetic account x-spark-test ...');
    const { invoiceId, invoiceNumber } = await generateInvoiceFromAccount(accountData);

    console.log('✅ Invoice generation complete:');
    console.log(`   invoiceId: ${invoiceId}`);
    console.log(`   invoiceNumber: ${invoiceNumber}`);
    console.log('');
    console.log('➡ You can now test with auth:');
    console.log(`   GET  /api/enterprise/invoices/${invoiceId}`);
    console.log(`   GET  /api/enterprise/invoices/${invoiceId}/pdf`);
    console.log(`   POST /api/enterprise/invoices/${invoiceId}/email`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error in test-generate-invoice-from-account:', err.message);
    console.error(err);
    process.exit(1);
  }
}

main();

