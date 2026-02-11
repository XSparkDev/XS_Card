/**
 * Phase 1: Enterprise CRUD & Activity Logging E2E Integration Test Suite
 * 
 * Tests:
 * - Activity Log endpoints (getByAction, getByResource, getByUser, getByEnterprise, getByTimeRange, export)
 * - Enterprise CRUD operations (getAllEnterprises, getEnterpriseById, updateEnterprise, deleteEnterprise, getEnterpriseStats)
 * 
 * Prerequisites: 
 * - Server must be running on http://localhost:8383
 * - Valid enterprise user with enterpriseId in user document
 * - TEST_USER_EMAIL and TEST_USER_PASSWORD in .env (or defaults to pule@xspark.co.za)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');
const { db } = require('./firebase');

const BASE_URL = process.env.API_BASE || 'http://localhost:8383';

// Test configuration
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'pule@xspark.co.za',
  password: process.env.TEST_USER_PASSWORD || '123456'
};

let testsPassed = 0;
let testsFailed = 0;
const testResults = [];
let authToken = null;
let userId = null;
let enterpriseId = null;

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
    
    return new Promise(async (resolve, reject) => {
      const req = http.request(options, async (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', async () => {
          try {
            const response = JSON.parse(data);
            if (response.token && response.user) {
              authToken = response.token;
              userId = response.user.uid;
              // Try to get enterpriseId from response first
              enterpriseId = response.user.enterpriseRef?.id || response.user.enterpriseId;
              
              // If not in response, fetch from database
              if (!enterpriseId && userId) {
                try {
                  const userDoc = await db.collection('users').doc(userId).get();
                  if (userDoc.exists) {
                    const userData = userDoc.data();
                    enterpriseId = userData.enterpriseRef?.id || userData.enterpriseId || 
                                  (typeof userData.enterpriseRef === 'object' && userData.enterpriseRef.path ? 
                                   userData.enterpriseRef.path.split('/')[1] : null);
                  }
                } catch (dbError) {
                  console.warn('Could not fetch enterpriseId from database:', dbError.message);
                }
              }
              
              console.log('✅ Authentication successful');
              console.log(`   User ID: ${userId}`);
              console.log(`   Enterprise ID: ${enterpriseId || 'None'}`);
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
      'User-Agent': 'E2E-Test-Phase1/1.0'
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
 * Test helper function
 */
async function test(name, testFn) {
  try {
    const result = await testFn();
    if (result === true || (result && result.success === true)) {
      testsPassed++;
      testResults.push({ name, status: 'PASSED' });
      console.log(`✅ ${name}`);
      return true;
    } else {
      testsFailed++;
      testResults.push({ name, status: 'FAILED', error: result.error || result });
      console.log(`❌ ${name}`);
      if (result.error) console.log(`   Error: ${result.error}`);
      if (result.body) console.log(`   Response: ${JSON.stringify(result.body, null, 2)}`);
      return false;
    }
  } catch (error) {
    testsFailed++;
    testResults.push({ name, status: 'FAILED', error: error.message });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Main test suite
 */
async function runTests() {
  console.log('\n🧪 Phase 1: Enterprise CRUD & Activity Logging E2E Tests\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test User: ${TEST_USER.email}\n`);

  // Authenticate first
  try {
    await authenticateUser();
    if (!authToken) {
      console.error('❌ Authentication failed - cannot proceed with tests');
      process.exit(1);
    }
    
    if (!enterpriseId) {
      console.warn('⚠️  Warning: User does not have an enterpriseId. Some tests will be skipped.');
    }
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    process.exit(1);
  }

  // ============================================================================
  // Activity Log Tests
  // ============================================================================
  console.log('\n📋 Activity Log Tests\n');

  await test('Get activities by action (view)', async () => {
    const response = await makeRequest('GET', '/api/activity-logs/action/view?limit=10');
    if (response.statusCode === 200 && response.body.success === true) {
      return true;
    }
    return { error: `Expected 200, got ${response.statusCode}`, body: response.body };
  });

  await test('Get activities by resource (enterprise)', async () => {
    const response = await makeRequest('GET', '/api/activity-logs/resource/enterprise?limit=10');
    if (response.statusCode === 200 && response.body.success === true) {
      return true;
    }
    return { error: `Expected 200, got ${response.statusCode}`, body: response.body };
  });

  await test('Get activities by user', async () => {
    if (!userId) return { error: 'No userId available' };
    const response = await makeRequest('GET', `/api/activity-logs/user/${userId}?limit=10`);
    if (response.statusCode === 200 && response.body.success === true) {
      return true;
    }
    return { error: `Expected 200, got ${response.statusCode}`, body: response.body };
  });

  if (enterpriseId) {
    await test('Get activities by enterprise', async () => {
      const response = await makeRequest('GET', `/api/activity-logs/enterprise/${enterpriseId}?limit=10`);
      if (response.statusCode === 200 && response.body.success === true) {
        return true;
      }
      return { error: `Expected 200, got ${response.statusCode}`, body: response.body };
    });
  } else {
    console.log('⏭️  Skipping enterprise activity log test (no enterpriseId)');
  }

  await test('Get activities by time range', async () => {
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
    const response = await makeRequest('GET', `/api/activity-logs/time-range?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&limit=10`);
    if (response.statusCode === 200 && response.body.success === true) {
      return true;
    }
    return { error: `Expected 200, got ${response.statusCode}`, body: response.body };
  });

  await test('Export activities (CSV)', async () => {
    const response = await makeRequest('GET', '/api/activity-logs/export?limit=10');
    if (response.statusCode === 200 && response.headers['content-type']?.includes('text/csv')) {
      return true;
    }
    return { error: `Expected 200 with CSV, got ${response.statusCode}`, body: response.body };
  });

  // ============================================================================
  // Enterprise CRUD Tests
  // ============================================================================
  console.log('\n🏢 Enterprise CRUD Tests\n');

  await test('Get all enterprises', async () => {
    const response = await makeRequest('GET', '/api/enterprise');
    if (response.statusCode === 200 && response.body.success === true) {
      return true;
    }
    return { error: `Expected 200, got ${response.statusCode}`, body: response.body };
  });

  if (enterpriseId) {
    await test('Get enterprise by ID', async () => {
      const response = await makeRequest('GET', `/api/enterprise/${enterpriseId}`);
      if (response.statusCode === 200 && response.body.success === true && response.body.data?.enterprise) {
        return true;
      }
      return { error: `Expected 200 with enterprise data, got ${response.statusCode}`, body: response.body };
    });

    await test('Get enterprise stats', async () => {
      const response = await makeRequest('GET', `/api/enterprise/${enterpriseId}/stats`);
      if (response.statusCode === 200 && response.body.success === true && response.body.data?.stats) {
        return true;
      }
      return { error: `Expected 200 with stats, got ${response.statusCode}`, body: response.body };
    });

    await test('Update enterprise (description)', async () => {
      const updateData = {
        description: `Test update - ${new Date().toISOString()}`
      };
      const response = await makeRequest('PUT', `/api/enterprise/${enterpriseId}`, updateData);
      if (response.statusCode === 200 && response.body.success === true) {
        return true;
      }
      return { error: `Expected 200, got ${response.statusCode}`, body: response.body };
    });

    // Note: We don't test delete as it's destructive
    console.log('⏭️  Skipping delete enterprise test (destructive operation)');
  } else {
    console.log('⏭️  Skipping enterprise-specific tests (no enterpriseId)');
  }

  // ============================================================================
  // Authorization Tests
  // ============================================================================
  console.log('\n🔒 Authorization Tests\n');

  await test('Unauthorized access to activity logs (no token)', async () => {
    const response = await makeRequest('GET', '/api/activity-logs/action/view', null, { 'Authorization': '' });
    if (response.statusCode === 401 || response.statusCode === 403) {
      return true;
    }
    return { error: `Expected 401/403, got ${response.statusCode}`, body: response.body };
  });

  await test('Unauthorized access to enterprise (no token)', async () => {
    if (!enterpriseId) return { error: 'No enterpriseId available' };
    const response = await makeRequest('GET', `/api/enterprise/${enterpriseId}`, null, { 'Authorization': '' });
    if (response.statusCode === 401 || response.statusCode === 403) {
      return true;
    }
    return { error: `Expected 401/403, got ${response.statusCode}`, body: response.body };
  });

  // ============================================================================
  // Test Summary
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Total:  ${testsPassed + testsFailed}`);
  console.log('='.repeat(60));

  if (testsFailed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults
      .filter(r => r.status === 'FAILED')
      .forEach(r => {
        console.log(`   - ${r.name}`);
        if (r.error) console.log(`     Error: ${r.error}`);
      });
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});
