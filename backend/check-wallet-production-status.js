/**
 * Check Google Wallet Pass Class Production Status
 * 
 * Run this script to check if your pass class is approved for production use.
 * 
 * Usage: node backend/check-wallet-production-status.js
 */

require('dotenv').config();
const GoogleWalletService = require('./services/googleWalletService');

async function checkProductionStatus() {
  const service = new GoogleWalletService();
  
  try {
    console.log('\n🔍 Checking Google Wallet Class Status...\n');
    
    await service.initializeAuth();
    const status = await service.checkClassStatus();
    
    console.log('📊 Google Wallet Class Status:');
    console.log(`   Class ID: ${process.env.GOOGLE_WALLET_ISSUER_ID}.${process.env.GOOGLE_WALLET_CLASS_ID || 'xscard_business_card_v1'}`);
    console.log(`   Status: ${status.status}`);
    console.log(`   Production Ready: ${status.isProduction ? '✅ YES' : '❌ NO'}`);
    console.log(`   Message: ${status.message}\n`);
    
    if (!status.isProduction) {
      console.log('📝 Next Steps:');
      console.log('   1. Go to https://pay.google.com/business/console');
      console.log('   2. Find your pass class and submit for production review');
      console.log('   3. Wait for Google approval (typically 1-3 business days)');
      console.log('   4. Run this script again to check status\n');
    } else {
      console.log('🎉 Your pass class is approved for production!');
      console.log('   Passes will no longer show "test mode" label.\n');
    }
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    console.log('\n💡 Make sure your environment variables are set correctly in backend/.env\n');
  }
}

checkProductionStatus();

