/**
 * Phase 1 Quick Test - Using specific enterprise ID
 * 
 * Tests Phase 1 features with enterprise ID: x-spark-test
 * 
 * Usage:
 *   node test-phase1-quick.js
 * 
 * Prerequisites:
 *   - Server running on http://localhost:8383
 *   - User with enterpriseId = "x-spark-test" in user document
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD in .env
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');

const BASE_URL = process.env.API_BASE || 'http://localhost:8383';
const TEST_ENTERPRISE_ID = 'x-spark-test';

// Test configuration
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'pule@xspark.co.za',
  password: process.env.TEST_USER_PASSWORD || '123456'
};

let authToken = null;
let userId = null;

/**
 * Authenticate user and get token
 */
async function authenticateUser() {
  console.log('🔐 Authenticating user...');
  
  try {
    const loginData = JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    const options = {
      hostname: 'localhost',
      port: 8383,
      path: '/SignIn',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };
    
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.token && response.user) {
              authToken = response.token;
              userId = response.user.uid;
              console.log('✅ Authentication successful');
              console.log(`   User ID: ${userId}`);
              console.log(`   User Enterprise ID: ${response.user.enterpriseRef?.id || response.user.enterpriseId || 'None'}`);
              resolve(response);
            } else {
              reject(new Error('Authentication failed: No token or user in response'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', reject);
      req.write(loginData);
      req.end();
    });
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    throw error;
  }
}

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + path;
    const urlObj = new URL(url);
    
    const postData = data ? JSON.stringify(data) : null;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Phase1-Quick-Test/1.0'
    };
    
    if (authToken) {
      defaultHeaders['Authorization'] = `Bearer ${authToken}`;
    }
    
    if (postData) {
      defaultHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: { ...defaultHeaders, ...headers }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        let parsedData;
        try {
          parsedData = responseData ? JSON.parse(responseData) : null;
        } catch (e) {
          parsedData = responseData;
        }
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedData,
          rawBody: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

/**
 * Test helper
 */
async function test(name, testFn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    const result = await testFn();
    if (result.success !== false && result.statusCode < 400) {
      console.log(`✅ ${name} - PASSED`);
      if (result.body) {
        console.log(`   Response: ${JSON.stringify(result.body, null, 2).substring(0, 200)}...`);
      }
      return true;
    } else {
      console.log(`❌ ${name} - FAILED`);
      console.log(`   Status: ${result.statusCode}`);
      console.log(`   Response: ${JSON.stringify(result.body, null, 2)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name} - ERROR`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Main test
 */
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Phase 1 Quick Test - Enterprise: x-spark-test');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Enterprise ID: ${TEST_ENTERPRISE_ID}`);
  console.log(`Test User: ${TEST_USER.email}\n`);

  // Authenticate
  try {
    await authenticateUser();
    if (!authToken) {
      console.error('❌ Authentication failed - cannot proceed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  // Test 1: Get Enterprise by ID
  const test1 = await test('Get Enterprise by ID', async () => {
    return await makeRequest('GET', `/api/enterprise/${TEST_ENTERPRISE_ID}`);
  });
  if (test1) passed++; else failed++;

  // Test 2: Get Enterprise Stats
  const test2 = await test('Get Enterprise Stats', async () => {
    return await makeRequest('GET', `/api/enterprise/${TEST_ENTERPRISE_ID}/stats`);
  });
  if (test2) passed++; else failed++;

  // Test 3: Get Activities by Enterprise
  const test3 = await test('Get Activities by Enterprise', async () => {
    return await makeRequest('GET', `/api/activity-logs/enterprise/${TEST_ENTERPRISE_ID}?limit=10`);
  });
  if (test3) passed++; else failed++;

  // Test 4: Update Enterprise
  const test4 = await test('Update Enterprise', async () => {
    const updateData = {
      description: `Quick test update - ${new Date().toISOString()}`
    };
    return await makeRequest('PUT', `/api/enterprise/${TEST_ENTERPRISE_ID}`, updateData);
  });
  if (test4) passed++; else failed++;

  // Test 5: Verify update persisted
  const test5 = await test('Verify Update Persisted', async () => {
    const response = await makeRequest('GET', `/api/enterprise/${TEST_ENTERPRISE_ID}`);
    if (response.body?.data?.enterprise?.description?.includes('Quick test update')) {
      return { statusCode: 200, body: response.body };
    }
    return { statusCode: 500, body: { error: 'Update not found in response' } };
  });
  if (test5) passed++; else failed++;

  // Test 6: Get All Enterprises (should return this one)
  const test6 = await test('Get All Enterprises', async () => {
    return await makeRequest('GET', '/api/enterprise');
  });
  if (test6) passed++; else failed++;

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${passed + failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});
