/**
 * Create a Test Quote
 * 
 * This script creates a test quote in the database to verify everything is working
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { db, admin } = require('./firebase');
const { calculateEnterprisePrice, formatPrice } = require('./config/enterprisePricing');

async function createTestQuote() {
  console.log('📝 Creating Test Quote...\n');
  console.log('='.repeat(50));

  try {
    const testQuoteData = {
      companyName: 'Test Company Inc',
      contactName: 'John Doe',
      contactEmail: 'test@example.com',
      numberOfEmployees: 50,
      currency: 'ZAR'
    };

    // Calculate price
    const calculatedPrice = calculateEnterprisePrice(testQuoteData.numberOfEmployees, testQuoteData.currency);
    
    // Generate quote ID
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Set expiration (30 days from now)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const newQuote = {
      quoteId,
      companyName: testQuoteData.companyName.trim(),
      contactName: testQuoteData.contactName.trim(),
      contactEmail: testQuoteData.contactEmail.toLowerCase(),
      numberOfEmployees: testQuoteData.numberOfEmployees,
      calculatedPrice,
      currency: testQuoteData.currency.toUpperCase(),
      quoteStatus: 'pending',
      subscriptionType: 'yearly',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      paymentReference: null,
      paymentUrl: null,
      paidAt: null
    };

    // Write to database
    await db.collection('enterprise_quotes').doc(quoteId).set(newQuote);

    console.log('✅ Quote created successfully!');
    console.log('\n📋 Quote Details:');
    console.log(`   Quote ID: ${quoteId}`);
    console.log(`   Company: ${newQuote.companyName}`);
    console.log(`   Contact: ${newQuote.contactName} (${newQuote.contactEmail})`);
    console.log(`   Employees: ${newQuote.numberOfEmployees}`);
    console.log(`   Price: ${formatPrice(calculatedPrice, newQuote.currency)}`);
    console.log(`   Status: ${newQuote.quoteStatus}`);
    console.log(`   Expires: ${expiresAt.toISOString()}`);
    console.log('\n💡 Run `node backend/check-enterprise-db.js` to verify it\'s in the database');

  } catch (error) {
    console.error('❌ Error creating quote:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

createTestQuote();

