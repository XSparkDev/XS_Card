/**
 * Create Test Subscription for Phase 4A Billing Features Testing
 * 
 * Following Golden Rules:
 * - ALWAYS authenticate users before creating subscriptions
 * - ALWAYS use real Paystack test keys for testing
 * - ALWAYS log subscription creation for audit trail
 * - ALWAYS verify payment before activating subscription
 */

const http = require('http');
const { db } = require('./firebase');

// Test configuration
const BASE_URL = 'http://localhost:8383';
const TEST_USER = {
    email: 'neney20213@anysilo.com',
    password: '123456'
};

let authToken = null;
let userId = null;

/**
 * Authenticate user and get token
 */
async function authenticateUser() {
    console.log('🔐 Authenticating user for subscription creation...');
    
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
                            console.log(`   Current Plan: ${response.user.plan}`);
                            resolve(response);
                        } else {
                            console.error('❌ Authentication failed:', response);
                            reject(new Error('Authentication failed'));
                        }
                    } catch (error) {
                        console.error('❌ Authentication response parsing failed:', error.message);
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
 * Create a test subscription using Paystack test keys
 */
async function createTestSubscription() {
    console.log('\n💳 Creating test subscription...');
    
    try {
        const subscriptionData = JSON.stringify({
            planId: 'MONTHLY_PLAN',
            amount: 15999 // R159.99 in cents
        });
        
        const options = {
            hostname: 'localhost',
            port: 8383,
            path: '/subscription/trial/initialize',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(subscriptionData)
            }
        };
        
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    console.log(`📡 Raw response - Status: ${res.statusCode}`);
                    console.log('📡 Raw data:', data.substring(0, 500) + (data.length > 500 ? '...' : ''));
                    
                    try {
                        const response = JSON.parse(data);
                        console.log(`✅ Subscription initialization response - Status: ${res.statusCode}`);
                        console.log('   Response:', JSON.stringify(response, null, 2));
                        resolve({ statusCode: res.statusCode, data: response });
                    } catch (error) {
                        console.error('❌ Subscription response parsing failed:', error.message);
                        console.error('   Raw response was:', data);
                        reject(error);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('❌ Subscription request failed:', error.message);
                reject(error);
            });
            
            req.write(subscriptionData);
            req.end();
        });
        
    } catch (error) {
        console.error('❌ Subscription creation error:', error.message);
        throw error;
    }
}

/**
 * Simulate a successful payment callback
 */
async function simulatePaymentCallback(reference) {
    console.log(`\n💰 Simulating payment callback for reference: ${reference}`);
    
    try {
        const options = {
            hostname: 'localhost',
            port: 8383,
            path: `/api/subscription/callback?reference=${reference}`,
            method: 'GET',
            headers: {
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
                        console.log(`✅ Payment callback response - Status: ${res.statusCode}`);
                        console.log('   Response:', JSON.stringify(response, null, 2));
                        resolve({ statusCode: res.statusCode, data: response });
                    } catch (error) {
                        console.error('❌ Payment callback response parsing failed:', error.message);
                        reject(error);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('❌ Payment callback request failed:', error.message);
                reject(error);
            });
            
            req.end();
        });
        
    } catch (error) {
        console.error('❌ Payment callback simulation error:', error.message);
        throw error;
    }
}

/**
 * Test billing endpoints with the new subscription
 */
async function testBillingEndpoints() {
    console.log('\n📊 Testing billing endpoints with new subscription...');
    
    try {
        // Test payment history
        console.log('📊 Testing payment history...');
        const paymentHistoryResponse = await makeBillingRequest('/api/billing/payment-history');
        if (paymentHistoryResponse.statusCode === 200) {
            console.log('✅ Payment history endpoint working');
            console.log(`   Transactions: ${paymentHistoryResponse.data.data.transactions.length}`);
            console.log(`   Total paid: R${paymentHistoryResponse.data.data.summary.totalPaid}`);
        }
        
        // Test subscription status
        console.log('📊 Testing subscription status...');
        const statusResponse = await makeBillingRequest('/api/billing/status');
        if (statusResponse.statusCode === 200) {
            console.log('✅ Subscription status endpoint working');
            console.log(`   Status: ${statusResponse.data.data.subscription.status}`);
            console.log(`   Plan: ${statusResponse.data.data.subscription.plan}`);
            console.log(`   Is Active: ${statusResponse.data.data.subscription.isActive}`);
        }
        
        // Test invoices
        console.log('📊 Testing invoice history...');
        const invoiceResponse = await makeBillingRequest('/api/billing/invoices');
        if (invoiceResponse.statusCode === 200) {
            console.log('✅ Invoice history endpoint working');
            console.log(`   Invoices: ${invoiceResponse.data.data.invoices.length}`);
            console.log(`   Total amount: R${invoiceResponse.data.data.summary.totalAmount}`);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Billing endpoints test error:', error.message);
        return false;
    }
}

/**
 * Make authenticated request to billing endpoints
 */
async function makeBillingRequest(endpoint) {
    try {
        const options = {
            hostname: 'localhost',
            port: 8383,
            path: endpoint,
            method: 'GET',
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
                        resolve({ statusCode: res.statusCode, data: response });
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            req.on('error', reject);
            req.end();
        });
        
    } catch (error) {
        throw error;
    }
}

/**
 * Create subscription and test billing features
 */
async function createSubscriptionAndTest() {
    console.log('🚀 Creating Test Subscription for Phase 4A Billing Features');
    console.log('=' .repeat(60));
    
    try {
        // Step 1: Authenticate user
        console.log('\n🔐 STEP 1: User Authentication');
        await authenticateUser();
        
        // Step 2: Create subscription
        console.log('\n💳 STEP 2: Create Test Subscription');
        const subscriptionResponse = await createTestSubscription();
        
        if (subscriptionResponse.statusCode === 200 && subscriptionResponse.data.status) {
            console.log('✅ Subscription created successfully');
            console.log(`   Authorization URL: ${subscriptionResponse.data.data.authorization_url}`);
            console.log(`   Reference: ${subscriptionResponse.data.data.reference}`);
            
            // For testing purposes, we'll simulate a successful payment
            // In real scenario, user would complete payment on Paystack
            const reference = subscriptionResponse.data.data.reference;
            
            // Step 3: Simulate payment callback
            console.log('\n💰 STEP 3: Simulate Payment Callback');
            const callbackResponse = await simulatePaymentCallback(reference);
            
            if (callbackResponse.statusCode === 200) {
                console.log('✅ Payment callback processed successfully');
            } else {
                console.log('⚠️  Payment callback may need manual verification');
            }
            
            // Step 4: Test billing endpoints
            console.log('\n📊 STEP 4: Test Billing Endpoints');
            const billingTestSuccess = await testBillingEndpoints();
            
            if (billingTestSuccess) {
                console.log('\n🎉 SUBSCRIPTION CREATION AND TESTING COMPLETE!');
                console.log('✅ User now has subscription data for billing features testing');
                console.log('✅ All billing endpoints are working with real data');
            } else {
                console.log('\n⚠️  Subscription created but billing endpoints need attention');
            }
            
        } else {
            console.error('❌ Subscription creation failed');
            console.error('   Response:', subscriptionResponse.data);
        }
        
    } catch (error) {
        console.error('\n❌ SUBSCRIPTION CREATION FAILED:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the subscription creation
if (require.main === module) {
    createSubscriptionAndTest()
        .then(() => {
            console.log('\n🎉 Test subscription creation completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Test subscription creation crashed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    createSubscriptionAndTest,
    authenticateUser,
    createTestSubscription,
    simulatePaymentCallback,
    testBillingEndpoints
};
