const axios = require('axios');

async function testRevenueCatProducts() {
  console.log('🔍 Testing RevenueCat Products Debug');
  console.log('=====================================');
  
  try {
    // Test the products endpoint
    const response = await axios.get('http://localhost:8383/api/revenuecat/products', {
      headers: {
        'User-Agent': 'okhttp/4.9.2' // Android user agent
      }
    });
    
    console.log('✅ Backend Response:');
    console.log('   Platform:', response.data.platform);
    console.log('   Product IDs:', response.data.productIds);
    console.log('   Count:', response.data.productIds.length);
    
    // Test each product ID individually
    console.log('\n🧪 Testing Individual Product IDs:');
    for (const productId of response.data.productIds) {
      console.log(`   - ${productId}`);
    }
    
    console.log('\n📱 Expected RevenueCat Behavior:');
    console.log('   - These product IDs should be found in Google Play Store');
    console.log('   - RevenueCat SDK should return product details');
    console.log('   - If empty array returned, products not found in store');
    
    console.log('\n🔧 Possible Issues:');
    console.log('   1. Products not published in Google Play Console');
    console.log('   2. App not properly linked to Google Play Console');
    console.log('   3. Product IDs don\'t match exactly');
    console.log('   4. RevenueCat API key not configured for this app');
    console.log('   5. App not signed with correct certificate');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRevenueCatProducts();
