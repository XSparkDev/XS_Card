/**
 * RevenueCat Tests with Real Authentication
 * 
 * Uses the sign-in endpoint to get real tokens for testing
 */

const axios = require('axios');

async function getAuthToken() {
    console.log('🔐 Getting authentication token...');
    
    try {
        const signInResponse = await axios.post('http://localhost:8383/SignIn', {
            email: 'dirax26227@bitmens.com',
            password: '123456'
        });
        
        console.log('✅ Sign-in successful');
        console.log('   User ID:', signInResponse.data.userId);
        console.log('   Token:', signInResponse.data.token ? 'Present' : 'Missing');
        
        return signInResponse.data.token;
    } catch (error) {
        console.log('❌ Sign-in failed:', error.response?.data || error.message);
        return null;
    }
}

async function testProductsEndpointWithAuth() {
    console.log('\n🧪 Testing Products Endpoint with Real Auth');
    console.log('===========================================');
    
    const token = await getAuthToken();
    if (!token) {
        console.log('❌ Cannot proceed without auth token');
        return;
    }
    
    const baseUrl = 'http://localhost:8383';
    
    // Test 1: Android User Agent
    console.log('\n📱 Test 1: Android User Agent');
    try {
        const androidResponse = await axios.get(`${baseUrl}/api/revenuecat/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36'
            }
        });
        
        console.log('✅ Android Response:');
        console.log(`   Platform: ${androidResponse.data.platform}`);
        console.log(`   Product IDs: ${androidResponse.data.productIds.length}`);
        console.log(`   IDs: ${JSON.stringify(androidResponse.data.productIds)}`);
        
    } catch (error) {
        console.log('❌ Android Test Failed:', error.response?.data || error.message);
    }

    // Test 2: iOS User Agent
    console.log('\n📱 Test 2: iOS User Agent');
    try {
        const iosResponse = await axios.get(`${baseUrl}/api/revenuecat/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
            }
        });
        
        console.log('✅ iOS Response:');
        console.log(`   Platform: ${iosResponse.data.platform}`);
        console.log(`   Product IDs: ${iosResponse.data.productIds.length}`);
        console.log(`   IDs: ${JSON.stringify(iosResponse.data.productIds)}`);
        
    } catch (error) {
        console.log('❌ iOS Test Failed:', error.response?.data || error.message);
    }

    // Test 3: Unknown User Agent
    console.log('\n📱 Test 3: Unknown User Agent');
    try {
        const unknownResponse = await axios.get(`${baseUrl}/api/revenuecat/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Unknown Browser'
            }
        });
        
        console.log('✅ Unknown Response:');
        console.log(`   Platform: ${unknownResponse.data.platform}`);
        console.log(`   Product IDs: ${unknownResponse.data.productIds.length}`);
        console.log(`   IDs: ${JSON.stringify(unknownResponse.data.productIds)}`);
        
    } catch (error) {
        console.log('❌ Unknown Test Failed:', error.response?.data || error.message);
    }
}

async function testWebhookWithAuth() {
    console.log('\n🧪 Testing Webhook with Real Auth');
    console.log('=================================');
    
    const baseUrl = 'http://localhost:8383';
    
    // Test 1: Valid Webhook (with auth token)
    console.log('\n🔐 Test 1: Valid Webhook with Auth Token');
    try {
        const validWebhook = {
            "api_version": "1.0",
            "event": {
                "id": "test_webhook_123",
                "type": "INITIAL_PURCHASE",
                "app_user_id": "test_user_123",
                "original_app_user_id": "test_user_123",
                "product_id": "premium_monthly:monthly-autorenewing",
                "period_type": "NORMAL",
                "purchased_at_ms": Date.now(),
                "expiration_at_ms": Date.now() + (30 * 24 * 60 * 60 * 1000),
                "environment": "SANDBOX",
                "entitlement_ids": ["premium"],
                "entitlements": {
                    "premium": {
                        "expires_date": new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
                        "product_identifier": "premium_monthly:monthly-autorenewing",
                        "purchase_date": new Date().toISOString()
                    }
                },
                "store": "PLAY_STORE",
                "transaction_id": "test_transaction_123",
                "original_transaction_id": "test_transaction_123",
                "is_family_share": false,
                "country_code": "US",
                "app_id": "your_app_id"
            }
        };

        const response = await axios.post(`${baseUrl}/api/revenuecat/webhook`, validWebhook, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your_secure_token_123' // Use your actual webhook auth token
            }
        });
        
        console.log('✅ Valid Webhook Response:', response.status, response.data);
        
    } catch (error) {
        console.log('❌ Valid Webhook Failed:', error.response?.data || error.message);
    }

    // Test 2: Invalid Webhook (no auth token)
    console.log('\n🔐 Test 2: Invalid Webhook (no auth token)');
    try {
        const invalidWebhook = {
            "api_version": "1.0",
            "event": {
                "id": "test_webhook_456",
                "type": "INITIAL_PURCHASE",
                "app_user_id": "test_user_456"
            }
        };

        const response = await axios.post(`${baseUrl}/api/revenuecat/webhook`, invalidWebhook, {
            headers: {
                'Content-Type': 'application/json'
                // No Authorization header
            }
        });
        
        console.log('✅ Invalid Webhook Response:', response.status, response.data);
        
    } catch (error) {
        console.log('❌ Invalid Webhook Failed (Expected):', error.response?.status, error.response?.data);
    }
}

async function testStatusEndpointWithAuth() {
    console.log('\n🧪 Testing Status Endpoint with Real Auth');
    console.log('=========================================');
    
    const token = await getAuthToken();
    if (!token) {
        console.log('❌ Cannot proceed without auth token');
        return;
    }
    
    const baseUrl = 'http://localhost:8383';
    
    try {
        const statusResponse = await axios.get(`${baseUrl}/api/revenuecat/status`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Status Response:');
        console.log(`   Status: ${statusResponse.status}`);
        console.log(`   Data:`, JSON.stringify(statusResponse.data, null, 2));
        
    } catch (error) {
        console.log('❌ Status Test Failed:', error.response?.data || error.message);
    }
}

async function runAllTestsWithAuth() {
    console.log('🚀 Starting RevenueCat Tests with Real Authentication');
    console.log('====================================================');
    
    await testProductsEndpointWithAuth();
    await testWebhookWithAuth();
    await testStatusEndpointWithAuth();
    
    console.log('\n📊 Test Summary');
    console.log('===============');
    console.log('✅ Products endpoint tested with real auth');
    console.log('✅ Webhook endpoint tested');
    console.log('✅ Status endpoint tested with real auth');
    console.log('\n🎯 These tests should now work with real authentication!');
}

// Run the tests
runAllTestsWithAuth().catch(console.error);
