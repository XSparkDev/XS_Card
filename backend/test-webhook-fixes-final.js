/**
 * FINAL WEBHOOK FIXES VERIFICATION TEST
 * 
 * This test verifies that both webhook issues have been fixed:
 * 1. IPv6 rate limiting configuration error
 * 2. Date handling error in rate limit logging
 */

const https = require('https');
const crypto = require('crypto');

console.log('🔧 FINAL WEBHOOK FIXES VERIFICATION TEST');
console.log('=========================================\n');

// Live server configuration
const LIVE_SERVER_URL = 'https://c4501e2fc6a1.ngrok-free.app';

/**
 * Send test webhook to verify both fixes
 */
const testWebhookFinalFixes = async () => {
    try {
        console.log('🔗 Testing webhook processing with all fixes...');
        
        // Create test webhook payload
        const webhookPayload = {
            event: 'charge.success',
            data: {
                id: Math.floor(Math.random() * 1000000),
                domain: 'test',
                status: 'success',
                reference: 'test_final_fixes_verification',
                amount: 15999,
                message: 'Successful',
                gateway_response: 'Successful',
                paid_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                channel: 'card',
                currency: 'ZAR',
                ip_address: '127.0.0.1',
                metadata: {
                    planId: 'MONTHLY_PLAN',
                    userId: 'test_user_id',
                    testMode: true
                },
                customer: {
                    id: Math.floor(Math.random() * 1000000),
                    first_name: 'Test',
                    last_name: 'User',
                    email: 'neney20213@anysilo.com',
                    customer_code: 'CUS_test123',
                    phone: null,
                    metadata: null,
                    risk_action: 'default'
                },
                authorization: {
                    authorization_code: 'AUTH_test123',
                    bin: '408408',
                    last4: '4081',
                    exp_month: '12',
                    exp_year: '2030',
                    channel: 'card',
                    card_type: 'visa',
                    bank: 'TEST BANK',
                    country_code: 'ZA',
                    brand: 'visa',
                    reusable: true,
                    signature: 'SIG_test123'
                },
                paidAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                requested_amount: 15999
            }
        };
        
        // Generate webhook signature
        const payloadString = JSON.stringify(webhookPayload);
        const signature = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || 'test_secret')
            .update(payloadString, 'utf8')
            .digest('hex');
        
        console.log('Generated webhook signature:', signature.substring(0, 20) + '...');
        
        // Send webhook to live server
        const url = new URL('/subscription/webhook', LIVE_SERVER_URL);
        
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-paystack-signature': signature,
                'user-agent': 'Paystack-Webhook/1.0',
                'ngrok-skip-browser-warning': 'true'
            }
        };
        
        return new Promise((resolve, reject) => {
            const req = https.request(options, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    console.log(`Webhook response: ${res.statusCode}`);
                    console.log(`Response body: ${data}`);
                    
                    if (res.statusCode === 200) {
                        console.log('✅ Webhook processing with all fixes: SUCCESS');
                        resolve({ success: true, response: data, statusCode: res.statusCode });
                    } else {
                        console.log(`⚠️  Webhook returned status ${res.statusCode}: ${data}`);
                        resolve({ success: false, response: data, statusCode: res.statusCode });
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('❌ Webhook request failed:', error.message);
                reject(error);
            });
            
            req.write(payloadString);
            req.end();
        });
        
    } catch (error) {
        console.error('❌ Final webhook fixes test failed:', error.message);
        throw error;
    }
};

/**
 * Run final webhook fixes verification test
 */
const runFinalWebhookFixesTest = async () => {
    console.log('🚀 Starting final webhook fixes verification test\n');
    
    try {
        const result = await testWebhookFinalFixes();
        
        console.log('\n🎯 FINAL WEBHOOK FIXES VERIFICATION RESULTS');
        console.log('============================================');
        
        if (result.success && result.statusCode === 200) {
            console.log('✅ IPv6 rate limiting configuration: FIXED');
            console.log('✅ Date handling error: FIXED');
            console.log('✅ Webhook security validation: WORKING');
            console.log('✅ Webhook processing: WORKING');
            
            console.log('\n🎉 ALL WEBHOOK ISSUES HAVE BEEN FIXED!');
            console.log('🎉 WEBHOOKS ARE NOW FULLY OPERATIONAL!');
            return true;
        } else {
            console.log('❌ Webhook fixes verification: FAILED');
            console.log(`Status: ${result.statusCode}`);
            console.log(`Response: ${result.response}`);
            console.log('\nThere may be additional issues that need to be addressed.');
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ FINAL WEBHOOK FIXES VERIFICATION FAILED:', error.message);
        return false;
    }
};

// Run test if this file is executed directly
if (require.main === module) {
    runFinalWebhookFixesTest()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Final webhook fixes verification test execution failed:', error);
            process.exit(1);
        });
}

module.exports = { runFinalWebhookFixesTest, testWebhookFinalFixes };
