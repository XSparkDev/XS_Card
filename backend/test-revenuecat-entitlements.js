const axios = require('axios');

async function testRevenueCatEntitlements() {
  console.log('🔍 Testing RevenueCat Entitlements');
  console.log('=====================================');
  
  try {
    // Test the products endpoint to see what's configured
    const response = await axios.get('http://localhost:8383/api/revenuecat/products', {
      headers: {
        'User-Agent': 'okhttp/4.9.2' // Android user agent
      }
    });
    
    console.log('✅ Backend Response:');
    console.log('   Platform:', response.data.platform);
    console.log('   Product IDs:', response.data.productIds);
    console.log('   Count:', response.data.productIds.length);
    
    console.log('\n🔧 Possible Issues:');
    console.log('   1. Entitlement "premium" doesn\'t exist in RevenueCat dashboard');
    console.log('   2. Products aren\'t linked to the entitlement');
    console.log('   3. Entitlement ID is case-sensitive (Premium vs premium)');
    console.log('   4. RevenueCat API key not configured for this app');
    
    console.log('\n📱 Next Steps:');
    console.log('   1. Check RevenueCat dashboard: https://app.revenuecat.com');
    console.log('   2. Go to Entitlements section');
    console.log('   3. Verify "premium" entitlement exists');
    console.log('   4. Check if products are linked to entitlement');
    console.log('   5. Try different entitlement ID if needed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRevenueCatEntitlements();
