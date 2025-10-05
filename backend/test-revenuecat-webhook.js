/**
 * Isolated Test: RevenueCat Webhook Endpoint
 * 
 * Tests the /api/revenuecat/webhook endpoint to verify:
 * 1. Webhook signature verification
 * 2. Event processing
 * 3. Error handling
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
        return signInResponse.data.token;
    } catch (error) {
        console.log('❌ Sign-in failed:', error.response?.data || error.message);
        return null;
    }
}

async function testWebhookEndpoint() {
    console.log('🧪 Testing RevenueCat Webhook Endpoint');
    console.log('=====================================\n');

    const baseUrl = 'http://localhost:8383';
    const token = await getAuthToken();
    
    if (!token) {
        console.log('❌ Cannot proceed without auth token');
        return;
    }
    
    // Test 1: Valid Webhook (with auth token)
    console.log('🔐 Test 1: Valid Webhook with Auth Token');
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

    console.log('\n🔐 Test 3: Invalid Webhook (wrong auth token)');
    try {
        const wrongAuthWebhook = {
            "api_version": "1.0",
            "event": {
                "id": "test_webhook_789",
                "type": "INITIAL_PURCHASE",
                "app_user_id": "test_user_789"
            }
        };

        const response = await axios.post(`${baseUrl}/api/revenuecat/webhook`, wrongAuthWebhook, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer wrong_token'
            }
        });
        
        console.log('✅ Wrong Auth Response:', response.status, response.data);
        
    } catch (error) {
        console.log('❌ Wrong Auth Failed (Expected):', error.response?.status, error.response?.data);
    }

    console.log('\n🔐 Test 4: Malformed Webhook');
    try {
        const malformedWebhook = {
            "invalid": "data"
        };

        const response = await axios.post(`${baseUrl}/api/revenuecat/webhook`, malformedWebhook, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your_secure_token_123'
            }
        });
        
        console.log('✅ Malformed Response:', response.status, response.data);
        
    } catch (error) {
        console.log('❌ Malformed Failed (Expected):', error.response?.status, error.response?.data);
    }

    console.log('\n=====================================');
    console.log('🎯 Expected Results:');
    console.log('- Valid webhook with correct auth: 200 OK');
    console.log('- Invalid webhook without auth: 401 Unauthorized');
    console.log('- Wrong auth token: 401 Unauthorized');
    console.log('- Malformed webhook: 400 Bad Request');
}

// Run the test
testWebhookEndpoint().catch(console.error);