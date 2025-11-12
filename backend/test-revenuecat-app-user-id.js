const axios = require('axios');
require('dotenv').config();

const REVENUECAT_SECRET_KEY = process.env.REVENUECAT_SECRET_KEY;

async function testRevenueCatAppUserId() {
    console.log('\n🔍 RevenueCat App User ID Test\n');
    console.log('=====================================\n');

    // Test with a sample user ID
    const testUserId = 'n6xw6ilwxSTrZ0GbLPtUZRmIqLf2'; // From your logs

    console.log(`Testing with User ID: ${testUserId}\n`);

    try {
        const response = await axios.get(
            `https://api.revenuecat.com/v1/subscribers/${testUserId}`,
            {
                headers: {
                    'Authorization': `Bearer ${REVENUECAT_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                    'X-Platform': 'play_store',
                }
            }
        );

        console.log('✅ RevenueCat Subscriber Info:\n');
        console.log(JSON.stringify(response.data, null, 2));

        // Check entitlements
        if (response.data.subscriber?.entitlements) {
            console.log('\n📦 Entitlements:');
            Object.keys(response.data.subscriber.entitlements).forEach(key => {
                const ent = response.data.subscriber.entitlements[key];
                console.log(`   ${key}: ${ent.expires_date || 'No expiration'}`);
            });
        }

        // Check subscriptions
        if (response.data.subscriber?.subscriptions) {
            console.log('\n💳 Active Subscriptions:');
            Object.keys(response.data.subscriber.subscriptions).forEach(key => {
                const sub = response.data.subscriber.subscriptions[key];
                console.log(`   ${key}: ${sub.expires_date || 'No expiration'}`);
            });
        }

    } catch (error) {
        console.error('❌ Error fetching subscriber info:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`   ${error.message}`);
        }
    }

    console.log('\n=====================================\n');

    // Now test fetching offerings
    console.log('📱 Testing Offerings API\n');

    try {
        const response = await axios.get(
            `https://api.revenuecat.com/v1/subscribers/${testUserId}/offerings`,
            {
                headers: {
                    'Authorization': `Bearer ${REVENUECAT_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                    'X-Platform': 'play_store',
                }
            }
        );

        console.log('✅ Offerings Response:\n');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ Error fetching offerings:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`   ${error.message}`);
        }
    }

    console.log('\n=====================================\n');
    console.log('🎯 Key Things to Check:\n');
    console.log('1. RevenueCat Dashboard → Apps → XS Card (Play Store)');
    console.log('2. Click "App Settings"');
    console.log('3. Verify "Google Play Package Name" = com.p.zzles.xscard');
    console.log('4. Verify "Google Play API Key" is configured');
    console.log('5. Check "Offerings" tab - create an offering if none exists');
    console.log('\n=====================================\n');
}

testRevenueCatAppUserId();

