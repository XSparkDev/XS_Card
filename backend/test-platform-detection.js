/**
 * Simple test to verify platform detection logic
 */

// Simulate the platform detection logic
function testPlatformDetection(userAgent) {
    const isAndroid = userAgent.includes('Android');
    console.log(`User Agent: ${userAgent}`);
    console.log(`Detected Platform: ${isAndroid ? 'android' : 'ios'}`);
    
    const productIds = [];
    
    if (isAndroid) {
        console.log('Android path - adding Android products');
        if (process.env.REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID) {
            console.log(`Adding Android Monthly: ${process.env.REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID}`);
            productIds.push(process.env.REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID);
        }
        
        if (process.env.REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID) {
            console.log(`Adding Android Annual: ${process.env.REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID}`);
            productIds.push(process.env.REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID);
        }
    } else {
        console.log('iOS path - adding iOS products');
        if (process.env.REVENUECAT_IOS_MONTHLY_PRODUCT_ID) {
            console.log(`Adding iOS Monthly: ${process.env.REVENUECAT_IOS_MONTHLY_PRODUCT_ID}`);
            productIds.push(process.env.REVENUECAT_IOS_MONTHLY_PRODUCT_ID);
        }
        
        if (process.env.REVENUECAT_IOS_ANNUAL_PRODUCT_ID) {
            console.log(`Adding iOS Annual: ${process.env.REVENUECAT_IOS_ANNUAL_PRODUCT_ID}`);
            productIds.push(process.env.REVENUECAT_IOS_ANNUAL_PRODUCT_ID);
        }
    }
    
    console.log(`Final Product IDs: ${JSON.stringify(productIds)}`);
    console.log(`Count: ${productIds.length}`);
    console.log('---');
    
    return productIds;
}

// Load environment variables
require('dotenv').config();

console.log('🧪 Testing Platform Detection Logic');
console.log('====================================\n');

// Test different user agents
const userAgents = [
    'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    'Unknown Browser',
    ''
];

userAgents.forEach((userAgent, index) => {
    console.log(`Test ${index + 1}:`);
    testPlatformDetection(userAgent);
});

console.log('\n🎯 Expected Results:');
console.log('- Android should return 2 product IDs (Android only)');
console.log('- iOS should return 2 product IDs (iOS only)');
console.log('- Unknown/Empty should return 2 product IDs (iOS only)');
console.log('- No cross-platform contamination');
