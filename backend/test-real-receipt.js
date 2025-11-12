/**
 * Test script for Apple Receipt Validation with Real Receipt
 * 
 * Usage: node test-real-receipt.js
 */

// Load environment variables
require('dotenv').config();

const { validateReceipt } = require('./services/appleReceiptValidation');

console.log('='.repeat(60));
console.log('Apple Receipt Validation - Real Receipt Test');
console.log('='.repeat(60));
console.log('');

// INSTRUCTIONS FOR USER
console.log('📋 INSTRUCTIONS:');
console.log('');
console.log('1. Make a test purchase in your app');
console.log('2. Get the receipt data from one of these sources:');
console.log('');
console.log('   Option A - From App Logs:');
console.log('   - Check your app console logs');
console.log('   - Look for "Receipt data:" or similar');
console.log('   - Copy the base64 string');
console.log('');
console.log('   Option B - From RevenueCat Dashboard:');
console.log('   - Go to RevenueCat dashboard');
console.log('   - Find your test purchase');
console.log('   - Look for receipt data in purchase details');
console.log('');
console.log('   Option C - From Backend Logs:');
console.log('   - Check server logs after purchase');
console.log('   - Look for receipt validation attempts');
console.log('');
console.log('3. Replace the RECEIPT_DATA_PLACEHOLDER below with your actual receipt');
console.log('4. Run this script again');
console.log('');

// PLACEHOLDER - Replace with your actual receipt data
const RECEIPT_DATA_PLACEHOLDER = 'REPLACE_WITH_YOUR_ACTUAL_RECEIPT_DATA_HERE';

// Check if user has replaced the placeholder
if (RECEIPT_DATA_PLACEHOLDER === 'REPLACE_WITH_YOUR_ACTUAL_RECEIPT_DATA_HERE') {
  console.log('⚠️  Please replace RECEIPT_DATA_PLACEHOLDER with your actual receipt data');
  console.log('');
  console.log('Example:');
  console.log('const RECEIPT_DATA_PLACEHOLDER = "MIIBWAYJKoZIhvcNAQcCoIIBSTCCAUUCAQExCzAJBgUrDgMCGgUAMAsGCSqGSIb3DQEHAaCCATswggE3...";');
  console.log('');
  process.exit(0);
}

// Test the validation
async function testRealReceipt() {
  try {
    console.log('🧪 Testing with real receipt data...');
    console.log('');
    
    const result = await validateReceipt(RECEIPT_DATA_PLACEHOLDER);
    
    console.log('');
    console.log('📊 Validation Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    
    if (result.success) {
      console.log('🎉 SUCCESS! Receipt validation worked!');
      console.log(`✅ Environment: ${result.environment}`);
      console.log(`✅ Receipt validated successfully`);
      
      if (result.latest_receipt_info && result.latest_receipt_info.length > 0) {
        console.log('');
        console.log('📱 Subscription Info:');
        const sub = result.latest_receipt_info[0];
        console.log(`   Product ID: ${sub.product_id}`);
        console.log(`   Purchase Date: ${sub.purchase_date}`);
        console.log(`   Expires Date: ${sub.expires_date}`);
        console.log(`   Is Trial: ${sub.is_trial_period === 'true' ? 'Yes' : 'No'}`);
      }
    } else {
      console.log('❌ Receipt validation failed');
      console.log(`   Status: ${result.status}`);
      console.log(`   Environment: ${result.environment}`);
      console.log(`   Error: ${result.error}`);
      
      if (result.status === 21007) {
        console.log('');
        console.log('ℹ️  Status 21007 means this is a sandbox receipt sent to production');
        console.log('   The system should automatically retry with sandbox');
        console.log('   Check the logs above for sandbox retry attempt');
      }
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('Test Complete');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
}

// Run the test
testRealReceipt();

