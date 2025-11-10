/**
 * PHASE 1 - BASELINE CEMENT TEST
 * 
 * This script validates the current auth system stability before adding Google OAuth.
 * It must pass before and after each implementation phase.
 * 
 * Tests:
 * 1. Email/password sign-in returns valid Firebase token
 * 2. Token can access protected endpoint (/Users/:uid)
 * 3. Token refresh works
 * 4. Token validation works
 * 5. Logout/blacklist properly revokes tokens
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://192.168.68.105:8383';
const TEST_USER = {
    email: 'pule@xspark.co.za', // You'll need to create this test user
    password: 'Password.10'
};

let testToken = null;
let testUserId = null;

// Color output helpers
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

// Test 1: Email/Password Sign-In
async function testEmailPasswordSignIn() {
    info('Test 1: Email/Password Sign-In');
    
    try {
        const response = await axios.post(`${BASE_URL}/SignIn`, {
            email: TEST_USER.email,
            password: TEST_USER.password
        });

        if (response.status === 200 && response.data.token && response.data.user) {
            testToken = `Bearer ${response.data.token}`;
            testUserId = response.data.user.uid;
            success(`Sign-in successful. User ID: ${testUserId}`);
            return true;
        } else {
            error('Sign-in response missing token or user data');
            return false;
        }
    } catch (err) {
        error(`Sign-in failed: ${err.response?.data?.message || err.message}`);
        return false;
    }
}

// Test 2: Protected Endpoint Access
async function testProtectedEndpoint() {
    info('Test 2: Protected Endpoint Access');
    
    if (!testToken || !testUserId) {
        error('No token available from sign-in test');
        return false;
    }

    try {
        const response = await axios.get(`${BASE_URL}/Users/${testUserId}`, {
            headers: {
                'Authorization': testToken
            }
        });

        if (response.status === 200 && response.data.id === testUserId) {
            success('Protected endpoint access successful');
            return true;
        } else {
            error('Protected endpoint returned unexpected data');
            return false;
        }
    } catch (err) {
        error(`Protected endpoint access failed: ${err.response?.data?.message || err.message}`);
        return false;
    }
}

// Test 3: Token Validation
async function testTokenValidation() {
    info('Test 3: Token Validation');
    
    if (!testToken) {
        error('No token available');
        return false;
    }

    try {
        const response = await axios.post(`${BASE_URL}/validate-token`, {}, {
            headers: {
                'Authorization': testToken
            }
        });

        if (response.status === 200 && response.data.valid === true) {
            success('Token validation successful');
            return true;
        } else {
            error('Token validation returned invalid');
            return false;
        }
    } catch (err) {
        error(`Token validation failed: ${err.response?.data?.message || err.message}`);
        return false;
    }
}

// Test 4: Token Refresh
async function testTokenRefresh() {
    info('Test 4: Token Refresh');
    
    if (!testToken) {
        error('No token available');
        return false;
    }

    try {
        const response = await axios.post(`${BASE_URL}/refresh-token`, {}, {
            headers: {
                'Authorization': testToken
            }
        });

        if (response.status === 200 && response.data.success && response.data.token) {
            // Update token for subsequent tests
            testToken = `Bearer ${response.data.token}`;
            success('Token refresh successful');
            return true;
        } else {
            error('Token refresh response missing new token');
            return false;
        }
    } catch (err) {
        error(`Token refresh failed: ${err.response?.data?.message || err.message}`);
        return false;
    }
}

// Test 5: Logout (Token Blacklist)
async function testLogout() {
    info('Test 5: Logout (Token Blacklist)');
    
    if (!testToken) {
        error('No token available');
        return false;
    }

    try {
        // First, logout
        const logoutResponse = await axios.post(`${BASE_URL}/logout`, {}, {
            headers: {
                'Authorization': testToken
            }
        });

        if (logoutResponse.status !== 200 || !logoutResponse.data.success) {
            error('Logout failed');
            return false;
        }

        success('Logout successful');

        // Now try to use the blacklisted token - should fail
        info('Verifying token is blacklisted...');
        
        try {
            await axios.get(`${BASE_URL}/Users/${testUserId}`, {
                headers: {
                    'Authorization': testToken
                }
            });
            
            error('Blacklisted token still works! This should not happen.');
            return false;
        } catch (err) {
            if (err.response?.status === 401) {
                success('Blacklisted token properly rejected');
                return true;
            } else {
                error(`Unexpected error when testing blacklisted token: ${err.message}`);
                return false;
            }
        }
    } catch (err) {
        error(`Logout test failed: ${err.response?.data?.message || err.message}`);
        return false;
    }
}

// Main test runner
async function runBaselineTests() {
    log('\n========================================', 'blue');
    log('🏗️  PHASE 1: BASELINE CEMENT TEST', 'blue');
    log('========================================\n', 'blue');

    info(`Testing against: ${BASE_URL}`);
    info(`Test user: ${TEST_USER.email}\n`);

    const results = {
        signIn: false,
        protectedEndpoint: false,
        tokenValidation: false,
        tokenRefresh: false,
        logout: false
    };

    // Run tests sequentially
    results.signIn = await testEmailPasswordSignIn();
    if (!results.signIn) {
        error('\n❌ BASELINE CEMENT FAILED: Sign-in test failed');
        warning('Cannot proceed with remaining tests without successful sign-in');
        return false;
    }

    console.log(''); // spacing
    results.protectedEndpoint = await testProtectedEndpoint();
    
    console.log(''); // spacing
    results.tokenValidation = await testTokenValidation();
    
    console.log(''); // spacing
    results.tokenRefresh = await testTokenRefresh();
    
    console.log(''); // spacing
    results.logout = await testLogout();

    // Summary
    log('\n========================================', 'blue');
    log('📊 TEST RESULTS SUMMARY', 'blue');
    log('========================================\n', 'blue');

    const allPassed = Object.values(results).every(r => r === true);

    Object.entries(results).forEach(([test, passed]) => {
        if (passed) {
            success(`${test}: PASSED`);
        } else {
            error(`${test}: FAILED`);
        }
    });

    console.log('');

    if (allPassed) {
        log('========================================', 'green');
        log('✅ ALL BASELINE TESTS PASSED', 'green');
        log('🏗️  CEMENT IS SOLID - READY TO PROCEED', 'green');
        log('========================================\n', 'green');
        return true;
    } else {
        log('========================================', 'red');
        log('❌ BASELINE TESTS FAILED', 'red');
        log('💩 POOP DETECTED - DO NOT PROCEED', 'red');
        log('========================================\n', 'red');
        return false;
    }
}

// Run tests
runBaselineTests()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        error(`\nUnexpected error: ${err.message}`);
        console.error(err);
        process.exit(1);
    });

