/**
 * Phase 4A Billing Features Test Suite
 * 
 * Following Golden Rules:
 * - ALWAYS authenticate users before testing billing features
 * - ALWAYS test all billing endpoints comprehensively
 * - ALWAYS verify data integrity and security
 * - ALWAYS log test results for audit trail
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');
let db = null;
try {
    const firebase = require('./firebase');
    db = firebase.db;
} catch (error) {
    console.warn('⚠️  Firebase initialization warning:', error.message);
    console.warn('   Test will continue but logging to database will be skipped');
    // Create a mock db object for logging
    db = {
        collection: (name) => ({
            add: async (data) => {
                console.warn(`[SKIP] Test logging skipped - Firebase not available (would log to ${name})`);
                return { id: 'mock-id' };
            }
        })
    };
}

// Test configuration
const BASE_URL = process.env.API_BASE || 'http://localhost:8383';
const TEST_USER = {
    email: process.env.TEST_USER_EMAIL || 'neney20213@anysilo.com',
    password: process.env.TEST_USER_PASSWORD || '123456'
};

// Log configuration (without password)
console.log('📋 Test Configuration:');
console.log(`   Base URL: ${BASE_URL}`);
console.log(`   Test User Email: ${TEST_USER.email}`);
console.log(`   Test User Password: ${TEST_USER.password ? '***' + TEST_USER.password.slice(-2) : 'NOT SET'}`);
if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
    console.log('\n⚠️  WARNING: Using default test user credentials.');
    console.log('   Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env for custom credentials.');
}

let authToken = null;
let userId = null;

/**
 * Test authentication and get token
 */
async function authenticateUser() {
    console.log('🔐 Testing user authentication...');
    
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
                            console.log(`   Email: ${response.user.email}`);
                            console.log(`   Plan: ${response.user.plan}`);
                            resolve(response);
                        } else {
                            console.error('❌ Authentication failed');
                            console.error('   Status Code:', res.statusCode);
                            console.error('   Response:', JSON.stringify(response, null, 2));
                            console.error('\n💡 TIP: Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env file');
                            console.error(`   Current email: ${TEST_USER.email}`);
                            reject(new Error(`Authentication failed: ${response.message || response.error?.message || 'Invalid credentials'}`));
                        }
                    } catch (error) {
                        console.error('❌ Authentication response parsing failed:', error.message);
                        console.error('   Raw response:', data);
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
 * Make authenticated request to billing endpoints
 */
async function makeBillingRequest(endpoint, method = 'GET') {
    console.log(`📡 Making ${method} request to ${endpoint}...`);
    
    try {
        const options = {
            hostname: 'localhost',
            port: 8383,
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        };
        
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        console.log(`✅ ${method} ${endpoint} - Status: ${res.statusCode}`);
                        resolve({ statusCode: res.statusCode, data: response });
                    } catch (error) {
                        console.error(`❌ ${method} ${endpoint} - Response parsing failed:`, error.message);
                        reject(error);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error(`❌ ${method} ${endpoint} - Request failed:`, error.message);
                reject(error);
            });
            
            req.end();
        });
        
    } catch (error) {
        console.error(`❌ ${method} ${endpoint} - Error:`, error.message);
        throw error;
    }
}

/**
 * Test Payment History Dashboard
 */
async function testPaymentHistory() {
    console.log('\n📊 Testing Payment History Dashboard...');
    
    try {
        const response = await makeBillingRequest('/api/billing/payment-history');
        
        if (response.statusCode === 200 && response.data.success) {
            console.log('✅ Payment History Test PASSED');
            console.log(`   Transactions found: ${response.data.data.transactions.length}`);
            console.log(`   Total paid: R${response.data.data.summary.totalPaid}`);
            console.log(`   Success rate: ${response.data.data.summary.successRate}%`);
            return true;
        } else {
            console.error('❌ Payment History Test FAILED');
            console.error('   Response:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Payment History Test ERROR:', error.message);
        return false;
    }
}

/**
 * Test Invoice History
 */
async function testInvoiceHistory() {
    console.log('\n🧾 Testing Invoice History...');
    
    try {
        const response = await makeBillingRequest('/api/billing/invoices');
        
        if (response.statusCode === 200 && response.data.success) {
            console.log('✅ Invoice History Test PASSED');
            console.log(`   Invoices found: ${response.data.data.invoices.length}`);
            console.log(`   Total amount: R${response.data.data.summary.totalAmount}`);
            return true;
        } else {
            console.error('❌ Invoice History Test FAILED');
            console.error('   Response:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Invoice History Test ERROR:', error.message);
        return false;
    }
}

/**
 * Test Subscription Status Dashboard
 */
async function testSubscriptionStatus() {
    console.log('\n📊 Testing Subscription Status Dashboard...');
    
    try {
        const response = await makeBillingRequest('/api/billing/status');
        
        if (response.statusCode === 200 && response.data.success) {
            console.log('✅ Subscription Status Test PASSED');
            console.log(`   Status: ${response.data.data.subscription.status}`);
            console.log(`   Plan: ${response.data.data.subscription.plan}`);
            console.log(`   Is Active: ${response.data.data.subscription.isActive}`);
            console.log(`   Alerts: ${response.data.data.alerts.length}`);
            return true;
        } else {
            console.error('❌ Subscription Status Test FAILED');
            console.error('   Response:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Subscription Status Test ERROR:', error.message);
        return false;
    }
}

/**
 * Test Billing Notifications
 */
async function testBillingNotifications() {
    console.log('\n🔔 Testing Billing Notifications...');
    
    try {
        const response = await makeBillingRequest('/api/billing/notifications?limit=10');
        
        if (response.statusCode === 200 && response.data.success) {
            console.log('✅ Billing Notifications Test PASSED');
            console.log(`   Notifications found: ${response.data.data.notifications.length}`);
            console.log(`   Unread count: ${response.data.data.summary.unreadCount}`);
            console.log(`   High priority: ${response.data.data.summary.highPriorityCount}`);
            return true;
        } else {
            console.error('❌ Billing Notifications Test FAILED');
            console.error('   Response:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Billing Notifications Test ERROR:', error.message);
        return false;
    }
}

/**
 * Test Health Check
 */
async function testHealthCheck() {
    console.log('\n🏥 Testing Health Check...');
    
    try {
        const response = await makeBillingRequest('/api/billing/health');
        
        if (response.statusCode === 200 && response.data.success) {
            console.log('✅ Health Check Test PASSED');
            console.log(`   Service: ${response.data.service}`);
            console.log(`   Version: ${response.data.version}`);
            return true;
        } else {
            console.error('❌ Health Check Test FAILED');
            console.error('   Response:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Health Check Test ERROR:', error.message);
        return false;
    }
}

/**
 * Test Authentication Security
 */
async function testAuthenticationSecurity() {
    console.log('\n🔒 Testing Authentication Security...');
    
    try {
        // Test without authentication
        const options = {
            hostname: 'localhost',
            port: 8383,
            path: '/api/billing/payment-history',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        return new Promise((resolve) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (res.statusCode === 401) {
                            console.log('✅ Authentication Security Test PASSED - Unauthorized request properly rejected');
                            resolve(true);
                        } else {
                            console.error('❌ Authentication Security Test FAILED - Unauthorized request was allowed');
                            console.error('   Response:', response);
                            resolve(false);
                        }
                    } catch (error) {
                        console.error('❌ Authentication Security Test ERROR:', error.message);
                        resolve(false);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('❌ Authentication Security Test ERROR:', error.message);
                resolve(false);
            });
            
            req.end();
        });
        
    } catch (error) {
        console.error('❌ Authentication Security Test ERROR:', error.message);
        return false;
    }
}

/**
 * Test Data Integrity
 */
async function testDataIntegrity() {
    console.log('\n🔍 Testing Data Integrity...');
    
    try {
        // Test payment history data structure
        const paymentResponse = await makeBillingRequest('/api/billing/payment-history');
        const statusResponse = await makeBillingRequest('/api/billing/status');
        
        if (paymentResponse.statusCode === 200 && statusResponse.statusCode === 200) {
            const paymentData = paymentResponse.data.data;
            const statusData = statusResponse.data.data;
            
            // Verify data consistency
            const paymentTotal = paymentData.summary.totalPaid;
            const statusTotal = statusData.usage.totalAmountPaid;
            
            if (Math.abs(paymentTotal - statusTotal) < 0.01) { // Allow for small rounding differences
                console.log('✅ Data Integrity Test PASSED - Payment totals match across endpoints');
                console.log(`   Payment History Total: R${paymentTotal}`);
                console.log(`   Status Dashboard Total: R${statusTotal}`);
                return true;
            } else {
                console.error('❌ Data Integrity Test FAILED - Payment totals do not match');
                console.error(`   Payment History Total: R${paymentTotal}`);
                console.error(`   Status Dashboard Total: R${statusTotal}`);
                return false;
            }
        } else {
            console.error('❌ Data Integrity Test FAILED - Could not fetch data for comparison');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Data Integrity Test ERROR:', error.message);
        return false;
    }
}

/**
 * Run comprehensive Phase 4A tests
 */
async function runPhase4ATests() {
    console.log('🚀 Starting Phase 4A Billing Features Test Suite');
    console.log('=' .repeat(60));
    
    const testResults = {
        authentication: false,
        paymentHistory: false,
        invoiceHistory: false,
        subscriptionStatus: false,
        billingNotifications: false,
        healthCheck: false,
        authenticationSecurity: false,
        dataIntegrity: false
    };
    
    try {
        // Step 1: Authenticate user
        console.log('\n🔐 STEP 1: User Authentication');
        await authenticateUser();
        testResults.authentication = true;
        
        // Step 2: Test all billing endpoints
        console.log('\n📊 STEP 2: Billing Endpoints Testing');
        testResults.paymentHistory = await testPaymentHistory();
        testResults.invoiceHistory = await testInvoiceHistory();
        testResults.subscriptionStatus = await testSubscriptionStatus();
        testResults.billingNotifications = await testBillingNotifications();
        testResults.healthCheck = await testHealthCheck();
        
        // Step 3: Test security
        console.log('\n🔒 STEP 3: Security Testing');
        testResults.authenticationSecurity = await testAuthenticationSecurity();
        
        // Step 4: Test data integrity
        console.log('\n🔍 STEP 4: Data Integrity Testing');
        testResults.dataIntegrity = await testDataIntegrity();
        
        // Step 5: Generate test report
        console.log('\n📋 STEP 5: Test Results Summary');
        console.log('=' .repeat(60));
        
        const passedTests = Object.values(testResults).filter(result => result === true).length;
        const totalTests = Object.keys(testResults).length;
        const successRate = Math.round((passedTests / totalTests) * 100);
        
        console.log(`\n📊 PHASE 4A TEST RESULTS:`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests}`);
        console.log(`   Failed: ${totalTests - passedTests}`);
        console.log(`   Success Rate: ${successRate}%`);
        
        console.log(`\n📋 DETAILED RESULTS:`);
        Object.entries(testResults).forEach(([test, result]) => {
            const status = result ? '✅ PASS' : '❌ FAIL';
            console.log(`   ${test}: ${status}`);
        });
        
        if (successRate === 100) {
            console.log('\n🎉 ALL PHASE 4A TESTS PASSED! Billing features are ready for production.');
        } else if (successRate >= 80) {
            console.log('\n⚠️  Most Phase 4A tests passed, but some issues need attention.');
        } else {
            console.log('\n❌ Multiple Phase 4A tests failed. Critical issues need to be resolved.');
        }
        
        // Log test results for audit trail (if Firebase is available)
        try {
            await logTestResults(testResults, successRate);
        } catch (logError) {
            console.warn('⚠️  Could not log test results to database:', logError.message);
        }
        
        return { success: successRate === 100, results: testResults, successRate };
        
    } catch (error) {
        console.error('\n❌ PHASE 4A TEST SUITE FAILED:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Log error for audit trail (if Firebase is available)
        try {
            await logTestError(error);
        } catch (logError) {
            console.warn('⚠️  Could not log test error to database:', logError.message);
        }
        
        return { success: false, error: error.message };
    }
}

/**
 * Log test results for audit trail
 */
async function logTestResults(testResults, successRate) {
    try {
        const testLog = {
            testSuite: 'Phase4A_Billing_Features',
            timestamp: new Date().toISOString(),
            userId: userId,
            userEmail: TEST_USER.email,
            successRate: successRate,
            results: testResults,
            environment: 'test',
            version: '1.0.0'
        };
        
        await db.collection('testLogs').add(testLog);
        console.log('📝 Test results logged to database for audit trail');
        
    } catch (error) {
        console.error('❌ Failed to log test results:', error.message);
    }
}

/**
 * Log test error for audit trail
 */
async function logTestError(error) {
    try {
        const errorLog = {
            testSuite: 'Phase4A_Billing_Features',
            timestamp: new Date().toISOString(),
            userId: userId,
            userEmail: TEST_USER.email,
            error: error.message,
            stack: error.stack,
            environment: 'test',
            version: '1.0.0'
        };
        
        await db.collection('testLogs').add(errorLog);
        console.log('📝 Test error logged to database for audit trail');
        
    } catch (logError) {
        console.error('❌ Failed to log test error:', logError.message);
    }
}

// Run the tests
if (require.main === module) {
    runPhase4ATests()
        .then((result) => {
            if (result.success) {
                console.log('\n🎉 Phase 4A Billing Features Test Suite completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Phase 4A Billing Features Test Suite failed!');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('\n💥 Phase 4A Test Suite crashed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    runPhase4ATests,
    testPaymentHistory,
    testInvoiceHistory,
    testSubscriptionStatus,
    testBillingNotifications,
    testHealthCheck,
    testAuthenticationSecurity,
    testDataIntegrity
};
