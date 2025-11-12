/**
 * Test script for Apple Receipt Validation
 * 
 * Usage: node test-apple-receipt-validation.js
 */

// Load environment variables
require('dotenv').config();

const { validateReceipt } = require('./services/appleReceiptValidation');

// Sample receipt data (base64 encoded)
// This is a mock receipt for testing - in production, you'll receive real receipt data from the app
const SAMPLE_RECEIPT_DATA = 'sample_base64_encoded_receipt_data';

console.log('='.repeat(60));
console.log('Apple Receipt Validation Test');
console.log('='.repeat(60));
console.log('');

// Test the validation service
async function testValidation() {
  try {
    console.log('Testing receipt validation...\n');
    
    // Check if APPSTORE_SHARED_SECRET is set
    if (!process.env.APPSTORE_SHARED_SECRET) {
      console.error('❌ APPSTORE_SHARED_SECRET environment variable is not set');
      console.log('');
      console.log('To fix this:');
      console.log('1. Get your shared secret from App Store Connect');
      console.log('2. Add it to your .env file:');
      console.log('   APPSTORE_SHARED_SECRET=your_shared_secret_here');
      process.exit(1);
    }
    
    console.log('✅ APPSTORE_SHARED_SECRET is configured');
    console.log('');
    
    // Test with sample receipt data
    console.log('Testing with sample receipt data...');
    const result = await validateReceipt(SAMPLE_RECEIPT_DATA);
    
    console.log('');
    console.log('Validation Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    
    if (result.success) {
      console.log('✅ Receipt validation successful!');
      console.log(`Environment: ${result.environment}`);
    } else {
      console.log('ℹ️  Sample receipt validation failed (expected with mock data)');
      console.log('This is normal - use real receipt data from your app for actual testing');
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
testValidation();

