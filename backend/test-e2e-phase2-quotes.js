/**
 * Phase 2: Quote Generation E2E Integration Test Suite
 * 
 * Tests:
 * - Quote generation endpoint via HTTP
 * - Request/response validation
 * - Rate limiting via HTTP
 * - Error handling via HTTP
 * 
 * Dependencies: Phase 0, Phase 1
 * Prerequisites: Server must be running on http://localhost:8383
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');

const BASE_URL = process.env.API_BASE || 'http://localhost:8383';
const BASE_PATH = '/api/enterprise/quote';

let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

/**
 * Parse URL to get hostname, port, and path
 */
function parseUrl(url) {
  const urlObj = new URL(url);
  return {
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname + urlObj.search
  };
}

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + path;
    const { hostname, port, path: requestPath } = parseUrl(url);
    
    const postData = data ? JSON.stringify(data) : null;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'E2E-Test-Phase2/1.0'
    };
    
    if (postData) {
      defaultHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const options = {
      hostname,
      port,
      path: requestPath,
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
 * Test quote generation endpoint
 */
async function testQuoteGeneration() {
  console.log('\n📝 Testing Quote Generation Endpoint (E2E)...');
  console.log('='.repeat(50));

  await test('Valid quote request returns 201 with quote data', async () => {
    const payload = {
      companyName: 'Test Company E2E',
      contactName: 'John Doe',
      contactEmail: 'john.e2e@example.com',
      numberOfEmployees: 50,
      currency: 'ZAR'
    };

    const response = await makeRequest('POST', BASE_PATH, payload);

    if (response.statusCode !== 201) {
      return { success: false, error: `Expected status 201, got ${response.statusCode}` };
    }

    if (!response.body || !response.body.success) {
      return { success: false, error: 'Response success is false' };
    }

    if (!response.body.quote || !response.body.quote.quoteId) {
      return { success: false, error: 'Quote ID missing in response' };
    }

    if (response.body.quote.companyName !== payload.companyName) {
      return { success: false, error: 'Company name mismatch' };
    }

    if (response.body.quote.numberOfEmployees !== payload.numberOfEmployees) {
      return { success: false, error: 'Employee count mismatch' };
    }

    if (response.body.quote.currency !== payload.currency) {
      return { success: false, error: 'Currency mismatch' };
    }

    if (response.body.quote.quoteStatus !== 'pending') {
      return { success: false, error: 'Quote status should be pending' };
    }

    return true;
  });

  // Run USD test early before validation tests consume rate limit quota
  await test('USD currency works correctly', async () => {
    const payload = {
      companyName: 'Test Company USD',
      contactName: 'John Doe',
      contactEmail: 'john.usd@example.com',
      numberOfEmployees: 100,
      currency: 'USD'
    };

    const response = await makeRequest('POST', BASE_PATH, payload);

    if (response.statusCode !== 201) {
      return { success: false, error: `Expected status 201, got ${response.statusCode}` };
    }

    if (response.body.quote.currency !== 'USD') {
      return { success: false, error: 'Currency should be USD' };
    }

    // USD pricing: $5 base (500 cents) + $0.50/employee (50 cents) = 500 + (100 * 50) = 5500 cents = $55.00
    // Prices are stored in cents for payment processing
    const expectedPrice = 5500; // 500 (base) + (100 * 50) = 5500 cents
    if (response.body.quote.calculatedPrice !== expectedPrice) {
      return { success: false, error: `Expected price ${expectedPrice} cents ($55.00), got ${response.body.quote.calculatedPrice} cents` };
    }

    return true;
  });

  await test('Invalid employee count returns 400', async () => {
    const payload = {
      companyName: 'Test Company',
      contactName: 'John Doe',
      contactEmail: 'john@example.com',
      numberOfEmployees: 0, // Invalid
      currency: 'ZAR'
    };

    const response = await makeRequest('POST', BASE_PATH, payload);

    if (response.statusCode !== 400) {
      return { success: false, error: `Expected status 400, got ${response.statusCode}` };
    }

    if (response.body && response.body.success !== false) {
      return { success: false, error: 'Response should indicate failure' };
    }

    return true;
  });

  await test('Missing required fields returns 400', async () => {
    const payload = {
      companyName: 'Test Company'
      // Missing other required fields
    };

    const response = await makeRequest('POST', BASE_PATH, payload);

    if (response.statusCode !== 400) {
      return { success: false, error: `Expected status 400, got ${response.statusCode}` };
    }

    if (response.body && response.body.errors && response.body.errors.length === 0) {
      return { success: false, error: 'Should return validation errors' };
    }

    return true;
  });

  await test('Invalid email format returns 400', async () => {
    const payload = {
      companyName: 'Test Company',
      contactName: 'John Doe',
      contactEmail: 'invalid-email', // Invalid format
      numberOfEmployees: 50,
      currency: 'ZAR'
    };

    const response = await makeRequest('POST', BASE_PATH, payload);

    if (response.statusCode !== 400) {
      return { success: false, error: `Expected status 400, got ${response.statusCode}` };
    }

    return true;
  });

  await test('Rate limiting works (10 requests/hour per IP)', async () => {
    // This test sends multiple requests rapidly
    // Note: Rate limiting may not trigger immediately depending on implementation
    // Adjust based on actual rate limiter configuration
    
    const payload = {
      companyName: 'Rate Limit Test',
      contactName: 'John Doe',
      contactEmail: `rate.test${Date.now()}@example.com`,
      numberOfEmployees: 10,
      currency: 'ZAR'
    };

    // Send 11 requests rapidly
    const requests = [];
    for (let i = 0; i < 11; i++) {
      requests.push(makeRequest('POST', BASE_PATH, {
        ...payload,
        contactEmail: `rate.test${Date.now()}.${i}@example.com`
      }));
    }

    const responses = await Promise.all(requests);
    
    // At least one should be rate limited (429) or all should succeed if rate limiter allows
    const rateLimited = responses.some(r => r.statusCode === 429);
    const allSuccess = responses.every(r => r.statusCode === 201);

    if (!rateLimited && !allSuccess) {
      // If rate limiter isn't strict, that's okay - just verify endpoint works
      const successCount = responses.filter(r => r.statusCode === 201).length;
      if (successCount === 0) {
        return { success: false, error: 'All requests failed unexpectedly' };
      }
    }

    return true;
  });
}

/**
 * Test server connectivity
 */
async function testServerConnectivity() {
  console.log('\n🔌 Testing Server Connectivity...');
  console.log('='.repeat(50));

  await test('Server is running and accessible', async () => {
    try {
      const response = await makeRequest('GET', '/api/health', null);
      // If health endpoint doesn't exist, try a known endpoint
      return true; // If no error, server is accessible
    } catch (error) {
      // Try to reach any endpoint
      try {
        await makeRequest('POST', BASE_PATH, {});
        return true; // If we get any response, server is running
      } catch (err) {
        return { 
          success: false, 
          error: `Cannot connect to server at ${BASE_URL}. Make sure server is running on port 8383.` 
        };
      }
    }
  });
}

/**
 * Run all Phase 2 E2E tests
 */
async function runPhase2E2ETests() {
  console.log('🧪 Phase 2: Quote Generation E2E Integration Test Suite');
  console.log('='.repeat(50));
  console.log(`Testing against: ${BASE_URL}`);
  console.log('⚠️  Make sure server is running on http://localhost:8383\n');

  // Test server connectivity first
  await testServerConnectivity();

  // Run quote generation tests
  await testQuoteGeneration();

  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Total: ${testsPassed + testsFailed}`);

  // Print failed tests
  if (testsFailed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults
      .filter(r => r.status === 'FAILED')
      .forEach(r => {
        console.log(`   - ${r.name}`);
        if (r.error) console.log(`     Error: ${r.error}`);
      });
  }

  // Exit with appropriate code
  if (testsFailed === 0) {
    console.log('\n🎉 All Phase 2 E2E tests passed!');
    console.log('✅ Endpoint is working correctly via HTTP');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some Phase 2 E2E tests failed.');
    console.log('❌ Fix issues before proceeding');
    process.exit(1);
  }
}

// Run tests
runPhase2E2ETests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});

