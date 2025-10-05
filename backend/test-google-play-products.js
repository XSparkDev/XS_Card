const axios = require('axios');
require('dotenv').config();

const REVENUECAT_SECRET_KEY = process.env.REVENUECAT_SECRET_KEY;

async function testGooglePlayProducts() {
    console.log('\n🔍 Google Play Products Diagnostic Test\n');
    console.log('=====================================\n');

    // Test 1: Check if RevenueCat can see the products
    console.log('📱 Test 1: Checking RevenueCat Product Configuration\n');
    
    try {
        const response = await axios.get('https://api.revenuecat.com/v1/products', {
            headers: {
                'Authorization': `Bearer ${REVENUECAT_SECRET_KEY}`,
                'Content-Type': 'application/json',
            }
        });

        console.log('✅ RevenueCat API Response:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Check for Android products
        const androidProducts = response.data.products?.filter(p => 
            p.product_id?.includes('premium_monthly') || 
            p.product_id?.includes('premium_annual')
        );
        
        if (androidProducts && androidProducts.length > 0) {
            console.log('\n✅ Found Android products in RevenueCat:');
            androidProducts.forEach(p => {
                console.log(`   - ${p.product_id} (Store: ${p.store})`);
            });
        } else {
            console.log('\n❌ No Android products found in RevenueCat');
            console.log('   This means the products are NOT registered in RevenueCat dashboard');
        }

    } catch (error) {
        console.error('❌ Error fetching products from RevenueCat:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.error(`   ${error.message}`);
        }
    }

    console.log('\n=====================================\n');

    // Test 2: Check app configuration
    console.log('📱 Test 2: App Configuration Check\n');
    console.log('App Package Name: com.p.zzles.xscard');
    console.log('Product IDs:');
    console.log('   - premium_monthly:monthly-autorenewing');
    console.log('   - premium_annual:annual-autorenewing');
    console.log('Entitlement ID: entl52399c68fe');

    console.log('\n🎯 Next Steps:\n');
    console.log('1. Go to RevenueCat Dashboard → Products');
    console.log('2. Verify these products are listed');
    console.log('3. Verify they are linked to entitlement "entl52399c68fe"');
    console.log('4. Verify they have store: "play_store"');
    console.log('5. Go to Google Play Console → Monetize → Subscriptions');
    console.log('6. Verify products are in "Active" status (not Draft)');
    console.log('7. Verify products are for app: com.p.zzles.xscard');
    console.log('\n=====================================\n');
}

testGooglePlayProducts();

