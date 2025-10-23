#!/usr/bin/env node

/**
 * Test script for environment-aware captcha verification
 * Tests the new /submit-query endpoint with different captcha tokens
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8383';

async function testSubmitQuery(payload, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await axios.post(`${BASE_URL}/submit-query`, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success:', response.status, response.data);
    return true;
  } catch (error) {
    if (error.response) {
      console.log('❌ Error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Network Error:', error.message);
    }
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Environment-Aware Captcha Verification\n');
  
  const basePayload = {
    name: 'Test User',
    email: 'test@example.com',
    message: 'This is a test message',
    to: 'support@xscard.co.za',
    type: 'contact'
  };

  // Test 1: Development bypass token
  await testSubmitQuery({
    ...basePayload,
    captchaToken: 'BYPASSED_FOR_DEV'
  }, 'Development Bypass Token');

  // Test 2: Dummy hCaptcha token
  await testSubmitQuery({
    ...basePayload,
    captchaToken: '10000000-aaaa-bbbb-cccc-000000000001'
  }, 'Dummy hCaptcha Token');

  // Test 3: Enterprise inquiry with bypass
  await testSubmitQuery({
    name: 'Company',
    email: 'enterprise@example.com',
    message: 'Enterprise Sales Inquiry from Test Company\n\nContact Information:\n- Name: Company\n- Job Title: CTO\n- Business Email: enterprise@example.com\n- Company Name: Test Company\n\nBusiness Details:\n- Company Size: 51-200\n- Implementation Timeline: quarter\n- Annual Budget Range: 50k-100k\n\nSpecific Requirements:\nTest requirements',
    to: 'support@xscard.co.za',
    type: 'inquiry',
    captchaToken: 'BYPASSED_FOR_DEV'
  }, 'Enterprise Inquiry with Bypass');

  // Test 4: Missing required fields
  await testSubmitQuery({
    name: 'Test User',
    email: 'test@example.com',
    // Missing message and to
    captchaToken: 'BYPASSED_FOR_DEV'
  }, 'Missing Required Fields (should fail)');

  // Test 5: Invalid captcha token
  await testSubmitQuery({
    ...basePayload,
    captchaToken: 'invalid-token'
  }, 'Invalid Captcha Token (should fail)');

  console.log('\n✨ Test suite completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testSubmitQuery, runTests };
