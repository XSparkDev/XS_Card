/**
 * Cleanup Test Data
 * 
 * This script cleans up test data from enterprise collections.
 * Run this after inspecting test results in the database.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { db, admin } = require('./firebase');

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...\n');
  console.log('='.repeat(50));

  let plansDeleted = 0;
  let quotesDeleted = 0;

  try {
    // Clean up enterprise_plans (test plans)
    console.log('\n📦 Cleaning enterprise_plans...');
    try {
      const plansSnapshot = await db.collection('enterprise_plans').get();
      if (plansSnapshot.empty) {
        console.log('   No plans to clean up');
      } else {
        const batch = db.batch();
        plansSnapshot.forEach(doc => {
          batch.delete(doc.ref);
          plansDeleted++;
        });
        await batch.commit();
        console.log(`   ✅ Deleted ${plansDeleted} plan(s)`);
      }
    } catch (error) {
      console.log(`   ❌ Error cleaning plans: ${error.message}`);
    }

    // Clean up enterprise_quotes (test quotes)
    console.log('\n📋 Cleaning enterprise_quotes...');
    try {
      const quotesSnapshot = await db.collection('enterprise_quotes')
        .where('quoteStatus', '==', 'pending')
        .get();
      
      if (quotesSnapshot.empty) {
        console.log('   No pending quotes to clean up');
      } else {
        const batch = db.batch();
        quotesSnapshot.forEach(doc => {
          const data = doc.data();
          // Only delete test quotes (check for test email or test company name)
          if (data.contactEmail.includes('test') || 
              data.companyName.toLowerCase().includes('test') ||
              data.contactEmail === 'test@example.com') {
            batch.delete(doc.ref);
            quotesDeleted++;
          }
        });
        if (quotesDeleted > 0) {
          await batch.commit();
          console.log(`   ✅ Deleted ${quotesDeleted} test quote(s)`);
        } else {
          console.log('   No test quotes found to delete');
        }
      }
    } catch (error) {
      console.log(`   ❌ Error cleaning quotes: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Cleanup complete!`);
    console.log(`   Plans deleted: ${plansDeleted}`);
    console.log(`   Quotes deleted: ${quotesDeleted}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

// Ask for confirmation
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\n⚠️  This will delete test data from the database. Continue? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    rl.close();
    cleanupTestData();
  } else {
    console.log('❌ Cleanup cancelled');
    rl.close();
    process.exit(0);
  }
});

