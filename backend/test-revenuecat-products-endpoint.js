/**
 * Isolated Test: RevenueCat Products Endpoint
 * 
 * Tests the /api/revenuecat/products endpoint to verify:
 * 1. Platform detection works
 * 2. Correct product IDs are returned
 * 3. No cross-platform contamination
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

async function testProductsEndpoint() {
    console.log('🧪 Testing RevenueCat Products Endpoint');
    console.log('=====================================\n');

    const baseUrl = 'http://localhost:8383';
    const token = await getAuthToken();
    
    if (!token) {
        console.log('❌ Cannot proceed without auth token');
        return;
    }
    
    // Test 1: Android User Agent
    console.log('📱 Test 1: Android User Agent');
    try {
        const androidResponse = await axios.get(`${baseUrl}/api/revenuecat/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36'
            }
        });
        
        console.log('✅ Android Response:', androidResponse.data);
        console.log(`   Platform: ${androidResponse.data.platform}`);
        console.log(`   Product IDs: ${androidResponse.data.productIds.length}`);
        console.log(`   IDs: ${JSON.stringify(androidResponse.data.productIds)}`);
        
    } catch (error) {
        console.log('❌ Android Test Failed:', error.response?.data || error.message);
    }

    console.log('\n📱 Test 2: iOS User Agent');
    try {
        const iosResponse = await axios.get(`${baseUrl}/api/revenuecat/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
            }
        });
        
        console.log('✅ iOS Response:', iosResponse.data);
        console.log(`   Platform: ${iosResponse.data.platform}`);
        console.log(`   Product IDs: ${iosResponse.data.productIds.length}`);
        console.log(`   IDs: ${JSON.stringify(iosResponse.data.productIds)}`);
        
    } catch (error) {
        console.log('❌ iOS Test Failed:', error.response?.data || error.message);
    }

    console.log('\n📱 Test 3: Unknown User Agent');
    try {
        const unknownResponse = await axios.get(`${baseUrl}/api/revenuecat/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'Unknown Browser'
            }
        });
        
        console.log('✅ Unknown Response:', unknownResponse.data);
        console.log(`   Platform: ${unknownResponse.data.platform}`);
        console.log(`   Product IDs: ${unknownResponse.data.productIds.length}`);
        console.log(`   IDs: ${JSON.stringify(unknownResponse.data.productIds)}`);
        
    } catch (error) {
        console.log('❌ Unknown Test Failed:', error.response?.data || error.message);
    }

    console.log('\n🔍 Test 4: No User Agent');
    try {
        const noUAResponse = await axios.get(`${baseUrl}/api/revenuecat/products`, {
            headers: {
                'Authorization': `Bearer ${token}`
                // No User-Agent header
            }
        });
        
        console.log('✅ No UA Response:', noUAResponse.data);
        console.log(`   Platform: ${noUAResponse.data.platform}`);
        console.log(`   Product IDs: ${noUAResponse.data.productIds.length}`);
        console.log(`   IDs: ${JSON.stringify(noUAResponse.data.productIds)}`);
        
    } catch (error) {
        console.log('❌ No UA Test Failed:', error.response?.data || error.message);
    }

    console.log('\n=====================================');
    console.log('🎯 Expected Results:');
    console.log('- Android should return only Android product IDs');
    console.log('- iOS should return only iOS product IDs');
    console.log('- Unknown/No UA should default to iOS');
    console.log('- No cross-platform contamination');
}

// Run the test
testProductsEndpoint().catch(console.error);
