/**
 * Test script to verify RevenueCat webhook endpoint
 */

const axios = require('axios');

async function testWebhookEndpoint() {
    try {
        console.log('🧪 Testing RevenueCat webhook endpoint...');
        
        const response = await axios.post('http://localhost:8383/api/revenuecat/webhook', {
            test: 'data'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Webhook endpoint is accessible');
        console.log('Response:', response.data);
        
    } catch (error) {
        if (error.response) {
            console.log('✅ Webhook endpoint is accessible (got expected error)');
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        } else if (error.code === 'ECONNREFUSED') {
            console.log('❌ Server is not running on port 8383');
        } else {
            console.log('❌ Error:', error.message);
        }
    }
}

testWebhookEndpoint();
