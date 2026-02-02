/**
 * Verify Payment Status - Check if account was actually created
 * 
 * Run: node backend/verify-payment-status.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { db } = require('./firebase');

async function verifyPayment() {
  const quoteId = 'quote_1769552524151_nu4braw5y';
  const enterpriseId = 'ent_quote_1769552524151_nu4braw5y';
  const paymentReference = 'ent_quote_quote_1769552524151_nu4braw5y_1769552529263_3g8duvkts';
  
  console.log('🔍 Verifying Payment Status...\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Check Quote Status
    console.log('\n📋 Checking Quote...');
    console.log('-'.repeat(60));
    const quoteDoc = await db.collection('enterprise_quotes').doc(quoteId).get();
    
    if (quoteDoc.exists) {
      const quoteData = quoteDoc.data();
      console.log(`✅ Quote Found: ${quoteId}`);
      console.log(`   Company: ${quoteData.companyName}`);
      console.log(`   Status: ${quoteData.quoteStatus}`);
      console.log(`   Employees: ${quoteData.numberOfEmployees}`);
      console.log(`   Price: ${quoteData.calculatedPrice} ${quoteData.currency}`);
      console.log(`   Payment Reference: ${quoteData.paymentReference || 'N/A'}`);
      console.log(`   Paid At: ${quoteData.paidAt ? quoteData.paidAt.toDate().toISOString() : 'N/A'}`);
      console.log(`   Created At: ${quoteData.createdAt ? quoteData.createdAt.toDate().toISOString() : 'N/A'}`);
      
      if (quoteData.quoteStatus === 'paid') {
        console.log('   ✅ Quote status is "paid" - Payment was processed');
      } else {
        console.log(`   ⚠️  Quote status is "${quoteData.quoteStatus}" - Expected "paid"`);
      }
    } else {
      console.log(`❌ Quote NOT FOUND: ${quoteId}`);
    }
    
    // 2. Check Account Existence
    console.log('\n👥 Checking Enterprise Account...');
    console.log('-'.repeat(60));
    const accountDoc = await db.collection('enterprise_accounts').doc(enterpriseId).get();
    
    if (accountDoc.exists) {
      const accountData = accountDoc.data();
      console.log(`✅ ACCOUNT EXISTS: ${enterpriseId}`);
      console.log(`   Company: ${accountData.companyName}`);
      console.log(`   Contact: ${accountData.contactName} (${accountData.contactEmail})`);
      console.log(`   Account Status: ${accountData.accountStatus}`);
      console.log(`   Subscription Status: ${accountData.subscriptionStatus || 'N/A'}`);
      console.log(`   Employees: ${accountData.numberOfEmployees}`);
      console.log(`   Plan Code: ${accountData.planCode || 'N/A'}`);
      console.log(`   Subscription Code: ${accountData.subscriptionCode || 'N/A'}`);
      console.log(`   Created At: ${accountData.createdAt ? accountData.createdAt.toDate().toISOString() : 'N/A'}`);
      console.log(`   Activated At: ${accountData.activatedAt ? accountData.activatedAt.toDate().toISOString() : 'N/A'}`);
      
      if (accountData.accountStatus === 'active') {
        console.log('   ✅ Account is ACTIVE');
      } else {
        console.log(`   ⚠️  Account status is "${accountData.accountStatus}"`);
      }
    } else {
      console.log(`❌ ACCOUNT NOT FOUND: ${enterpriseId}`);
      console.log('   This means account creation actually failed');
    }
    
    // 3. Check by Payment Reference
    console.log('\n🔗 Checking by Payment Reference...');
    console.log('-'.repeat(60));
    const quoteByRefQuery = await db.collection('enterprise_quotes')
      .where('paymentReference', '==', paymentReference)
      .limit(1)
      .get();
    
    if (!quoteByRefQuery.empty) {
      const quoteByRef = quoteByRefQuery.docs[0].data();
      console.log(`✅ Quote found by payment reference`);
      console.log(`   Quote ID: ${quoteByRef.quoteId}`);
      console.log(`   Status: ${quoteByRef.quoteStatus}`);
    } else {
      console.log(`⚠️  No quote found with payment reference: ${paymentReference}`);
    }
    
    // 4. Summary
    console.log('\n📊 Summary:');
    console.log('='.repeat(60));
    const accountExists = accountDoc.exists;
    const quoteExists = quoteDoc.exists;
    const quoteIsPaid = quoteDoc.exists && quoteDoc.data().quoteStatus === 'paid';
    
    if (accountExists && quoteIsPaid) {
      console.log('✅ VERIFICATION RESULT: Account was created successfully!');
      console.log('   - Account exists in database');
      console.log('   - Quote status is "paid"');
      console.log('   - The error was ONLY in audit logging, not account creation');
      console.log('   - User was incorrectly redirected to failure page');
    } else if (accountExists && !quoteIsPaid) {
      console.log('⚠️  VERIFICATION RESULT: Account exists but quote not marked as paid');
      console.log('   - Account was created');
      console.log('   - Quote status update may have failed');
    } else if (!accountExists && quoteIsPaid) {
      console.log('⚠️  VERIFICATION RESULT: Quote marked paid but account not found');
      console.log('   - This would indicate a serious issue');
    } else {
      console.log('❌ VERIFICATION RESULT: Neither account nor paid quote found');
      console.log('   - Account creation actually failed');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

verifyPayment();