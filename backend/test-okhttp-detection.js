/**
 * Test okhttp user agent detection
 */

const axios = require('axios');

async function getAuthToken() {
    try {
        const signInResponse = await axios.post('http://localhost:8383/SignIn', {
            email: 'dirax26227@bitmens.com',
            password: '123456'
        });
        return signInResponse.data.token;
    } catch (error) {
        console.log('❌ Sign-in failed:', error.response?.data || error.message);
        return null;
    }
}

async function testOkHttpDetection() {
    console.log('🧪 Testing okhttp User Agent Detection');
    console.log('=====================================\n');

    const token = await getAuthToken();
    if (!token) {
        console.log('❌ Cannot proceed without auth token');
        return;
    }

    try {
        // Test with okhttp user agent (like Android app)
        const response = await axios.get('http://localhost:8383/api/revenuecat/products', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'okhttp/4.9.2' // This is what Android apps send
            }
        });
        
        console.log('✅ okhttp Response:');
        console.log(`   Platform: ${response.data.platform}`);
        console.log(`   Product IDs: ${response.data.productIds.length}`);
        console.log(`   IDs: ${JSON.stringify(response.data.productIds)}`);
        
        if (response.data.platform === 'android' && response.data.productIds.includes('premium_monthly:monthly-autorenewing')) {
            console.log('✅ SUCCESS: Android platform detected correctly!');
        } else {
            console.log('❌ FAILED: Platform detection not working');
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.response?.data || error.message);
    }
}

testOkHttpDetection().catch(console.error);
