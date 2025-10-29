/**
 * Isolated Test: RevenueCat Integration Test
 * 
 * Tests the complete RevenueCat integration flow:
 * 1. Backend product endpoint
 * 2. Webhook processing
 * 3. Database updates
 * 4. Error scenarios
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

async function testRevenueCatIntegration() {
    console.log('🧪 Testing RevenueCat Integration');
    console.log('=================================\n');

    const baseUrl = 'http://localhost:8383';
    const token = await getAuthToken();
    
    if (!token) {
        console.log('❌ Cannot proceed without auth token');
        return;
    }
    
    // Test 1: Complete Product Flow
    console.log('🔄 Test 1: Complete Product Flow');
    try {
        console.log('Step 1: Fetching product IDs from backend...');
        const productsResponse = await axios.get(`${baseUrl}/api/revenuecat/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36'
            }
        });
        
        console.log('✅ Products Response:', productsResponse.data);
        
        // Step 2: Simulate RevenueCat product fetch
        console.log('Step 2: Simulating RevenueCat product fetch...');
        const productIds = productsResponse.data.productIds;
        console.log(`   Would fetch products: ${JSON.stringify(productIds)}`);
        
        // Step 3: Simulate purchase
        console.log('Step 3: Simulating purchase...');
        const purchaseData = {
            productId: productIds[0],
            userId: 'test_user_123',
            timestamp: new Date().toISOString()
        };
        console.log(`   Purchase data: ${JSON.stringify(purchaseData)}`);
        
    } catch (error) {
        console.log('❌ Product Flow Failed:', error.response?.data || error.message);
    }

    console.log('\n🔄 Test 2: Webhook Processing Flow');
    try {
        console.log('Step 1: Simulating webhook event...');
        const webhookEvent = {
            "api_version": "1.0",
            "event": {
                "id": "integration_test_123",
                "type": "INITIAL_PURCHASE",
                "app_user_id": "test_user_123",
                "product_id": "premium_monthly:monthly-autorenewing",
                "purchased_at_ms": Date.now(),
                "expiration_at_ms": Date.now() + (30 * 24 * 60 * 60 * 1000),
                "environment": "SANDBOX",
                "entitlement_ids": ["premium"],
                "store": "PLAY_STORE",
                "transaction_id": "integration_transaction_123"
            }
        };

        console.log('Step 2: Sending webhook to backend...');
        const webhookResponse = await axios.post(`${baseUrl}/api/revenuecat/webhook`, webhookEvent, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your_secure_token_123' // Use your actual webhook auth token
            }
        });
        
        console.log('✅ Webhook Response:', webhookResponse.status, webhookResponse.data);
        
        // Step 3: Check if user was updated
        console.log('Step 3: Checking user status...');
        const statusResponse = await axios.get(`${baseUrl}/api/revenuecat/status`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Status Response:', statusResponse.data);
        
    } catch (error) {
        console.log('❌ Webhook Flow Failed:', error.response?.data || error.message);
    }

    console.log('\n🔄 Test 3: Error Scenarios');
    try {
        console.log('Step 1: Testing invalid webhook...');
        const invalidWebhook = {
            "invalid": "data"
        };

        const invalidResponse = await axios.post(`${baseUrl}/api/revenuecat/webhook`, invalidWebhook, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your_secure_token_123'
            }
        });
        
        console.log('✅ Invalid Webhook Response:', invalidResponse.status, invalidResponse.data);
        
    } catch (error) {
        console.log('❌ Invalid Webhook Failed (Expected):', error.response?.status, error.response?.data);
    }

    console.log('\n🔄 Test 4: Platform Detection');
    try {
        console.log('Step 1: Testing Android detection...');
        const androidResponse = await axios.get(`${baseUrl}/api/revenuecat/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36'
            }
        });
        
        console.log('✅ Android Detection:', androidResponse.data.platform);
        
        console.log('Step 2: Testing iOS detection...');
        const iosResponse = await axios.get(`${baseUrl}/api/revenuecat/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
            }
        });
        
        console.log('✅ iOS Detection:', iosResponse.data.platform);
        
    } catch (error) {
        console.log('❌ Platform Detection Failed:', error.response?.data || error.message);
    }

    console.log('\n=================================');
    console.log('🎯 Integration Test Summary:');
    console.log('- Product endpoint should return platform-specific IDs');
    console.log('- Webhook should process events correctly');
    console.log('- Error handling should work properly');
    console.log('- Platform detection should work correctly');
}

// Run the integration test
testRevenueCatIntegration().catch(console.error);
