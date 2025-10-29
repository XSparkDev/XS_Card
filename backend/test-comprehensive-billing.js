/**
 * Comprehensive Billing Test - Phase 4A
 * 
 * Following Golden Rules:
 * - ALWAYS test all billing endpoints individually
 * - ALWAYS verify data integrity across all endpoints
 * - ALWAYS test error scenarios and edge cases
 * - ALWAYS log all test results for audit trail
 */

const http = require('http');
const { db } = require('./firebase');

// Test configuration
const TEST_USER = {
    email: 'neney20213@anysilo.com',
    password: '123456'
};

let authToken = null;
let userId = null;

/**
 * Authenticate user
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
                            resolve(response);
                        } else {
                            reject(new Error('Authentication failed'));
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
 * Make authenticated request
 */
async function makeRequest(endpoint, method = 'GET', data = null) {
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
        
        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }
        
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        resolve({ 
                            statusCode: res.statusCode, 
                            data: response,
                            headers: res.headers
                        });
                    } catch (error) {
                        console.error(`❌ JSON parsing failed for ${endpoint}:`, error.message);
                        console.error('Raw response:', responseData.substring(0, 200));
                        reject(error);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error(`❌ Request failed for ${endpoint}:`, error.message);
                reject(error);
            });
            
            if (data) {
                req.write(data);
            }
            req.end();
        });
        
    } catch (error) {
        console.error(`❌ Request error for ${endpoint}:`, error.message);
        throw error;
    }
}

/**
 * Test individual billing endpoints
 */
async function testBillingEndpoints() {
    console.log('\n📊 Testing Individual Billing Endpoints');
    console.log('=' .repeat(50));
    
    const testResults = {};
    
    try {
        // Test 1: Payment History
        console.log('\n1️⃣ Testing Payment History...');
        try {
            const response = await makeRequest('/api/billing/payment-history');
            testResults.paymentHistory = {
                success: response.statusCode === 200,
                statusCode: response.statusCode,
                transactionCount: response.data.data?.transactions?.length || 0,
                totalPaid: response.data.data?.summary?.totalPaid || 0,
                successRate: response.data.data?.summary?.successRate || 0
            };
            console.log(`   Status: ${response.statusCode}`);
            console.log(`   Transactions: ${testResults.paymentHistory.transactionCount}`);
            console.log(`   Total Paid: R${testResults.paymentHistory.totalPaid}`);
            console.log(`   Success Rate: ${testResults.paymentHistory.successRate}%`);
        } catch (error) {
            testResults.paymentHistory = { success: false, error: error.message };
            console.error(`   ❌ Payment History failed: ${error.message}`);
        }
        
        // Test 2: Invoice History
        console.log('\n2️⃣ Testing Invoice History...');
        try {
            const response = await makeRequest('/api/billing/invoices');
            testResults.invoiceHistory = {
                success: response.statusCode === 200,
                statusCode: response.statusCode,
                invoiceCount: response.data.data?.invoices?.length || 0,
                totalAmount: response.data.data?.summary?.totalAmount || 0
            };
            console.log(`   Status: ${response.statusCode}`);
            console.log(`   Invoices: ${testResults.invoiceHistory.invoiceCount}`);
            console.log(`   Total Amount: R${testResults.invoiceHistory.totalAmount}`);
        } catch (error) {
            testResults.invoiceHistory = { success: false, error: error.message };
            console.error(`   ❌ Invoice History failed: ${error.message}`);
        }
        
        // Test 3: Subscription Status
        console.log('\n3️⃣ Testing Subscription Status...');
        try {
            const response = await makeRequest('/api/billing/status');
            testResults.subscriptionStatus = {
                success: response.statusCode === 200,
                statusCode: response.statusCode,
                status: response.data.data?.subscription?.status,
                plan: response.data.data?.subscription?.plan,
                isActive: response.data.data?.subscription?.isActive,
                alerts: response.data.data?.alerts?.length || 0
            };
            console.log(`   Status: ${response.statusCode}`);
            console.log(`   Subscription Status: ${testResults.subscriptionStatus.status}`);
            console.log(`   Plan: ${testResults.subscriptionStatus.plan}`);
            console.log(`   Is Active: ${testResults.subscriptionStatus.isActive}`);
            console.log(`   Alerts: ${testResults.subscriptionStatus.alerts}`);
        } catch (error) {
            testResults.subscriptionStatus = { success: false, error: error.message };
            console.error(`   ❌ Subscription Status failed: ${error.message}`);
        }
        
        // Test 4: Billing Notifications
        console.log('\n4️⃣ Testing Billing Notifications...');
        try {
            const response = await makeRequest('/api/billing/notifications?limit=10');
            testResults.billingNotifications = {
                success: response.statusCode === 200,
                statusCode: response.statusCode,
                notificationCount: response.data.data?.notifications?.length || 0,
                unreadCount: response.data.data?.summary?.unreadCount || 0
            };
            console.log(`   Status: ${response.statusCode}`);
            console.log(`   Notifications: ${testResults.billingNotifications.notificationCount}`);
            console.log(`   Unread: ${testResults.billingNotifications.unreadCount}`);
        } catch (error) {
            testResults.billingNotifications = { success: false, error: error.message };
            console.error(`   ❌ Billing Notifications failed: ${error.message}`);
        }
        
        // Test 5: Health Check
        console.log('\n5️⃣ Testing Health Check...');
        try {
            const response = await makeRequest('/api/billing/health');
            testResults.healthCheck = {
                success: response.statusCode === 200,
                statusCode: response.statusCode,
                service: response.data.data?.service || response.data.service,
                version: response.data.data?.version || response.data.version
            };
            console.log(`   Status: ${response.statusCode}`);
            console.log(`   Service: ${testResults.healthCheck.service}`);
            console.log(`   Version: ${testResults.healthCheck.version}`);
        } catch (error) {
            testResults.healthCheck = { success: false, error: error.message };
            console.error(`   ❌ Health Check failed: ${error.message}`);
        }
        
        // Test 6: Authentication Security
        console.log('\n6️⃣ Testing Authentication Security...');
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
            
            const securityResponse = await new Promise((resolve, reject) => {
                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            const response = JSON.parse(data);
                            resolve({ statusCode: res.statusCode, data: response });
                        } catch (error) {
                            reject(error);
                        }
                    });
                });
                req.on('error', reject);
                req.end();
            });
            
            testResults.authenticationSecurity = {
                success: securityResponse.statusCode === 401,
                statusCode: securityResponse.statusCode,
                message: securityResponse.data?.message
            };
            console.log(`   Status: ${securityResponse.statusCode}`);
            console.log(`   Message: ${testResults.authenticationSecurity.message}`);
        } catch (error) {
            testResults.authenticationSecurity = { success: false, error: error.message };
            console.error(`   ❌ Authentication Security failed: ${error.message}`);
        }
        
        return testResults;
        
    } catch (error) {
        console.error('❌ Billing endpoints test failed:', error.message);
        return { error: error.message };
    }
}

/**
 * Test data consistency
 */
async function testDataConsistency() {
    console.log('\n🔍 Testing Data Consistency...');
    
    try {
        const paymentResponse = await makeRequest('/api/billing/payment-history');
        const statusResponse = await makeRequest('/api/billing/status');
        
        const paymentTotal = paymentResponse.data.data?.summary?.totalPaid || 0;
        const statusTotal = statusResponse.data.data?.usage?.totalAmountPaid || 0;
        
        const isConsistent = Math.abs(paymentTotal - statusTotal) < 0.01;
        
        console.log(`   Payment History Total: R${paymentTotal}`);
        console.log(`   Status Dashboard Total: R${statusTotal}`);
        console.log(`   Data Consistent: ${isConsistent ? '✅ YES' : '❌ NO'}`);
        
        return {
            success: isConsistent,
            paymentTotal,
            statusTotal,
            difference: Math.abs(paymentTotal - statusTotal)
        };
        
    } catch (error) {
        console.error('❌ Data consistency test failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Run comprehensive billing tests
 */
async function runComprehensiveBillingTests() {
    console.log('🚀 Comprehensive Billing Test Suite - Phase 4A');
    console.log('=' .repeat(60));
    
    try {
        // Step 1: Authenticate
        console.log('\n🔐 STEP 1: Authentication');
        await authenticateUser();
        
        // Step 2: Test all endpoints
        console.log('\n📊 STEP 2: Individual Endpoint Testing');
        const endpointResults = await testBillingEndpoints();
        
        // Step 3: Test data consistency
        console.log('\n🔍 STEP 3: Data Consistency Testing');
        const consistencyResult = await testDataConsistency();
        
        // Step 4: Generate comprehensive report
        console.log('\n📋 STEP 4: Comprehensive Test Report');
        console.log('=' .repeat(60));
        
        const allTests = {
            ...endpointResults,
            dataConsistency: consistencyResult
        };
        
        const passedTests = Object.values(allTests).filter(test => test.success === true).length;
        const totalTests = Object.keys(allTests).length;
        const successRate = Math.round((passedTests / totalTests) * 100);
        
        console.log(`\n📊 COMPREHENSIVE TEST RESULTS:`);
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests}`);
        console.log(`   Failed: ${totalTests - passedTests}`);
        console.log(`   Success Rate: ${successRate}%`);
        
        console.log(`\n📋 DETAILED RESULTS:`);
        Object.entries(allTests).forEach(([test, result]) => {
            if (result.success === true) {
                console.log(`   ${test}: ✅ PASS`);
            } else if (result.success === false) {
                console.log(`   ${test}: ❌ FAIL - ${result.error || 'Unknown error'}`);
            } else {
                console.log(`   ${test}: ⚠️  UNKNOWN`);
            }
        });
        
        if (successRate === 100) {
            console.log('\n🎉 ALL COMPREHENSIVE TESTS PASSED!');
        } else if (successRate >= 80) {
            console.log('\n⚠️  Most tests passed, but some issues need attention.');
        } else {
            console.log('\n❌ Multiple tests failed. Critical issues need to be resolved.');
        }
        
        return { success: successRate === 100, results: allTests, successRate };
        
    } catch (error) {
        console.error('\n❌ COMPREHENSIVE TEST SUITE FAILED:', error.message);
        console.error('Stack trace:', error.stack);
        return { success: false, error: error.message };
    }
}

// Run the comprehensive tests
if (require.main === module) {
    runComprehensiveBillingTests()
        .then((result) => {
            if (result.success) {
                console.log('\n🎉 Comprehensive billing tests completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Comprehensive billing tests failed!');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('\n💥 Comprehensive billing tests crashed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    runComprehensiveBillingTests,
    testBillingEndpoints,
    testDataConsistency
};
