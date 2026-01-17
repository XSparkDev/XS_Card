/**
 * Check Enterprise Database Records
 * 
 * This script checks what records exist in the enterprise collections
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { db, admin } = require('./firebase');

async function checkEnterpriseCollections() {
  console.log('🔍 Checking Enterprise Database Records...\n');
  console.log('='.repeat(50));

  try {
    // Check enterprise_plans collection
    console.log('\n📦 Enterprise Plans Collection:');
    console.log('-'.repeat(50));
    try {
      const plansSnapshot = await db.collection('enterprise_plans').limit(10).get();
      if (plansSnapshot.empty) {
        console.log('   No plans found in database');
      } else {
        console.log(`   Found ${plansSnapshot.size} plan(s):`);
        plansSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`   - Plan Code: ${data.planCode}`);
          console.log(`     Employees: ${data.numberOfEmployees}`);
          console.log(`     Amount: ${data.amount} cents (${data.currency})`);
          console.log(`     Created: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'N/A'}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log(`   ❌ Error reading plans: ${error.message}`);
    }

    // Check enterprise_quotes collection
    console.log('\n📋 Enterprise Quotes Collection:');
    console.log('-'.repeat(50));
    try {
      const quotesSnapshot = await db.collection('enterprise_quotes').limit(10).get();
      if (quotesSnapshot.empty) {
        console.log('   No quotes found in database');
      } else {
        console.log(`   Found ${quotesSnapshot.size} quote(s):`);
        quotesSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`   - Quote ID: ${data.quoteId}`);
          console.log(`     Company: ${data.companyName}`);
          console.log(`     Employees: ${data.numberOfEmployees}`);
          console.log(`     Price: ${data.calculatedPrice} cents (${data.currency})`);
          console.log(`     Status: ${data.quoteStatus}`);
          console.log(`     Created: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'N/A'}`);
          console.log(`     Expires: ${data.expiresAt ? data.expiresAt.toDate().toISOString() : 'N/A'}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log(`   ❌ Error reading quotes: ${error.message}`);
    }

    // Check enterprise_accounts collection
    console.log('\n👥 Enterprise Accounts Collection:');
    console.log('-'.repeat(50));
    try {
      const accountsSnapshot = await db.collection('enterprise_accounts').limit(10).get();
      if (accountsSnapshot.empty) {
        console.log('   No accounts found in database');
      } else {
        console.log(`   Found ${accountsSnapshot.size} account(s):`);
        accountsSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`   - Account ID: ${doc.id}`);
          console.log(`     Company: ${data.companyName}`);
          console.log(`     Status: ${data.accountStatus}`);
          console.log(`     Created: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'N/A'}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log(`   ❌ Error reading accounts: ${error.message}`);
    }

    console.log('='.repeat(50));
    console.log('\n✅ Database check complete');

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

checkEnterpriseCollections();

