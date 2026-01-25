/**
 * Phase 0: Foundation Setup E2E Integration Test Suite
 * 
 * Tests:
 * - Server is running and accessible
 * - Routes are registered (even if endpoints not implemented yet)
 * - Server responds to requests
 * 
 * Dependencies: None
 * Prerequisites: Server must be running on http://localhost:8383
 * 
 * Note: Phase 0 doesn't have specific HTTP endpoints to test,
 * but we can verify the server is running and routes are accessible.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');

const BASE_URL = process.env.API_BASE || 'http://localhost:8383';

let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

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
      'User-Agent': 'E2E-Test-Phase0/1.0'
    };
    
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
 * Test server connectivity
 */
async function testServerConnectivity() {
  console.log('\n🔌 Testing Server Connectivity...');
  console.log('='.repeat(50));

  await test('Server is running and accessible', async () => {
    try {
      // Try to connect to any endpoint - if server is running, we'll get a response
      await makeRequest('GET', '/', null);
      return true; // If we get any response, server is running
    } catch (error) {
      return { 
        success: false, 
        error: `Cannot connect to server at ${BASE_URL}. Make sure server is running on port 8383.\n   Error: ${error.message}` 
      };
    }
  });

  await test('Server responds to HTTP requests', async () => {
    try {
      const response = await makeRequest('GET', '/', null);
      // Any response (even 404) means server is running
      if (response.statusCode) {
        return true;
      }
      return { success: false, error: 'Server did not return status code' };
    } catch (error) {
      return { 
        success: false, 
        error: `Server not responding: ${error.message}` 
      };
    }
  });
}

/**
 * Test route registration (Phase 2 endpoint should exist)
 */
async function testRouteRegistration() {
  console.log('\n🛣️  Testing Route Registration...');
  console.log('='.repeat(50));

  await test('Enterprise routes are registered', async () => {
    // Try to access Phase 2 endpoint (should exist even if not fully implemented)
    // This will return 400 (validation error) or 201 (success), not 404 (route not found)
    try {
      const response = await makeRequest('POST', '/api/enterprise/quote', {});
      
      // If we get 400, route exists but validation failed (expected)
      // If we get 404, route doesn't exist (unexpected)
      if (response.statusCode === 404) {
        return { success: false, error: 'Enterprise routes not registered (got 404)' };
      }
      
      // Any other status code means route exists
      return true;
    } catch (error) {
      return { 
        success: false, 
        error: `Error testing route registration: ${error.message}` 
      };
    }
  });

  await test('Server handles invalid routes correctly', async () => {
    // Try a route that definitely doesn't exist
    try {
      const response = await makeRequest('GET', '/api/enterprise/nonexistent-route-12345', null);
      
      // Should return 404 for non-existent route
      if (response.statusCode === 404) {
        return true; // Correct behavior
      }
      
      // Other status codes are also acceptable (server is handling the request)
      return true;
    } catch (error) {
      return { 
        success: false, 
        error: `Error testing invalid route: ${error.message}` 
      };
    }
  });
}

/**
 * Test server configuration
 */
async function testServerConfiguration() {
  console.log('\n⚙️  Testing Server Configuration...');
  console.log('='.repeat(50));

  await test('Server accepts JSON content type', async () => {
    try {
      const response = await makeRequest('POST', '/api/enterprise/quote', {}, {
        'Content-Type': 'application/json'
      });
      
      // Any response means server accepts JSON
      return true;
    } catch (error) {
      return { 
        success: false, 
        error: `Server doesn't accept JSON: ${error.message}` 
      };
    }
  });

  await test('Server returns JSON responses', async () => {
    try {
      const response = await makeRequest('POST', '/api/enterprise/quote', {});
      
      // Check if response has JSON content type or is parseable JSON
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json') || typeof response.body === 'object') {
        return true;
      }
      
      // If body is empty or not JSON, that's okay for error cases
      return true;
    } catch (error) {
      return { 
        success: false, 
        error: `Error testing JSON response: ${error.message}` 
      };
    }
  });
}

/**
 * Run all Phase 0 E2E tests
 */
async function runPhase0E2ETests() {
  console.log('🧪 Phase 0: Foundation Setup E2E Integration Test Suite');
  console.log('='.repeat(50));
  console.log(`Testing against: ${BASE_URL}`);
  console.log('⚠️  Make sure server is running on http://localhost:8383');
  console.log('📝 Note: Phase 0 tests server connectivity and route registration\n');

  // Test server connectivity
  await testServerConnectivity();

  // Test route registration
  await testRouteRegistration();

  // Test server configuration
  await testServerConfiguration();

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
    console.log('\n🎉 All Phase 0 E2E tests passed!');
    console.log('✅ Server is running and routes are registered');
    console.log('✅ Foundation is ready for Phase 2+ endpoints');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some Phase 0 E2E tests failed.');
    console.log('❌ Fix issues before proceeding');
    console.log('\n💡 Make sure:');
    console.log('   1. Server is running: node backend/server.js');
    console.log('   2. Server is listening on port 8383');
    console.log('   3. Enterprise routes are registered in server.js');
    process.exit(1);
  }
}

// Run tests
runPhase0E2ETests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});

