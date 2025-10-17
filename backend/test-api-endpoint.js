/**
 * Test Apple Receipt Validation via API Endpoint
 * 
 * Usage: node test-api-endpoint.js
 */

// Load environment variables
require('dotenv').config();

const https = require('https');

console.log('='.repeat(60));
console.log('Apple Receipt Validation - API Endpoint Test');
console.log('='.repeat(60));
console.log('');

// INSTRUCTIONS
console.log('📋 INSTRUCTIONS:');
console.log('');
console.log('1. Make a test purchase in your app');
console.log('2. Get your authentication token (from app login)');
console.log('3. Get the receipt data from the purchase');
console.log('4. Replace the values below:');
console.log('   - YOUR_AUTH_TOKEN: Your authentication token');
console.log('   - YOUR_RECEIPT_DATA: The base64 receipt data');
console.log('5. Run this script');
console.log('');

// PLACEHOLDERS - Replace with your actual values
const YOUR_AUTH_TOKEN = 'REPLACE_WITH_YOUR_AUTH_TOKEN';
const YOUR_RECEIPT_DATA = 'REPLACE_WITH_YOUR_RECEIPT_DATA';
const API_URL = 'https://baseurl.xscard.co.za/api/apple-receipt/validate';

// Check if user has replaced placeholders
if (YOUR_AUTH_TOKEN === 'REPLACE_WITH_YOUR_AUTH_TOKEN' || 
    YOUR_RECEIPT_DATA === 'REPLACE_WITH_YOUR_RECEIPT_DATA') {
  console.log('⚠️  Please replace the placeholder values:');
  console.log('');
  console.log('   YOUR_AUTH_TOKEN: Your authentication token from app login');
  console.log('   YOUR_RECEIPT_DATA: Base64 encoded receipt from purchase');
  console.log('');
  console.log('Example:');
  console.log('const YOUR_AUTH_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...";');
  console.log('const YOUR_RECEIPT_DATA = "MIIBWAYJKoZIhvcNAQcCoIIBSTCCAUUCAQExCzAJBgUrDgMCGgUAMAsGCSqGSIb3DQEHAaCCATswggE3...";');
  console.log('');
  process.exit(0);
}

// Test the API endpoint
async function testAPIEndpoint() {
  try {
    console.log('🧪 Testing API endpoint...');
    console.log(`📡 URL: ${API_URL}`);
    console.log('');
    
    const postData = JSON.stringify({
      receiptData: YOUR_RECEIPT_DATA
    });
    
    const url = new URL(API_URL);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${YOUR_AUTH_TOKEN}`
      }
    };
    
    console.log('📤 Sending request...');
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('');
        console.log(`📊 Response Status: ${res.statusCode}`);
        console.log('');
        
        try {
          const result = JSON.parse(data);
          console.log('📋 Response Body:');
          console.log(JSON.stringify(result, null, 2));
          console.log('');
          
          if (result.success) {
            console.log('🎉 SUCCESS! Receipt validation worked via API!');
            console.log(`✅ Environment: ${result.environment}`);
          } else {
            console.log('❌ Receipt validation failed');
            console.log(`   Status: ${result.status}`);
            console.log(`   Error: ${result.error}`);
          }
        } catch (parseError) {
          console.log('📋 Raw Response:');
          console.log(data);
        }
        
        console.log('');
        console.log('='.repeat(60));
        console.log('API Test Complete');
        console.log('='.repeat(60));
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
    });
    
    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run the test
testAPIEndpoint();

