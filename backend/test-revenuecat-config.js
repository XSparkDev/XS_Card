/**
 * RevenueCat Configuration Test Script
 * 
 * Run this to verify your RevenueCat configuration is correct
 * Usage: node test-revenuecat-config.js
 */

require('dotenv').config();
const { REVENUECAT_CONFIG, validateConfig } = require('./config/revenueCatConfig');

console.log('\n🔍 RevenueCat Configuration Test\n');
console.log('=====================================\n');

// Test 1: Check if environment variables are loaded
console.log('📋 Environment Variables Check:');
console.log('-------------------------------');

const checks = [
    {
        name: 'Secret Key',
        value: REVENUECAT_CONFIG.API_KEYS.secret,
        required: true,
        shouldStartWith: 'sk_'
    },
    {
        name: 'iOS Public Key',
        value: REVENUECAT_CONFIG.API_KEYS.ios,
        required: false,
        shouldStartWith: 'appl_'
    },
    {
        name: 'Android Public Key',
        value: REVENUECAT_CONFIG.API_KEYS.android,
        required: false,
        shouldStartWith: 'goog_'
    },
    {
        name: 'Webhook Auth Token',
        value: REVENUECAT_CONFIG.WEBHOOK.authToken,
        required: true,
        shouldStartWith: null
    },
    {
        name: 'iOS Monthly Product ID',
        value: REVENUECAT_CONFIG.PRODUCTS.monthly.ios,
        required: false,
        shouldStartWith: null
    },
    {
        name: 'iOS Annual Product ID',
        value: REVENUECAT_CONFIG.PRODUCTS.annual.ios,
        required: false,
        shouldStartWith: null
    },
    {
        name: 'Android Monthly Product ID',
        value: REVENUECAT_CONFIG.PRODUCTS.monthly.android,
        required: false,
        shouldStartWith: null
    },
    {
        name: 'Android Annual Product ID',
        value: REVENUECAT_CONFIG.PRODUCTS.annual.android,
        required: false,
        shouldStartWith: null
    },
    {
        name: 'Entitlement ID',
        value: REVENUECAT_CONFIG.ENTITLEMENT_ID,
        required: true,
        shouldStartWith: null
    }
];

let passedCount = 0;
let failedCount = 0;
let warningCount = 0;

checks.forEach(check => {
    const hasValue = check.value && check.value !== null && check.value !== 'null';
    const startsCorrectly = !check.shouldStartWith || (hasValue && check.value.startsWith(check.shouldStartWith));
    
    if (hasValue && startsCorrectly) {
        console.log(`✅ ${check.name}: ${maskSensitiveValue(check.value)}`);
        passedCount++;
    } else if (check.required) {
        console.log(`❌ ${check.name}: MISSING (REQUIRED)`);
        failedCount++;
    } else {
        console.log(`⚠️  ${check.name}: Not set (optional for your platform)`);
        warningCount++;
    }
});

console.log('\n-------------------------------');
console.log(`✅ Passed: ${passedCount}`);
console.log(`❌ Failed: ${failedCount}`);
console.log(`⚠️  Warnings: ${warningCount}`);
console.log('-------------------------------\n');

// Test 2: Validate configuration
console.log('🔧 Configuration Validation:');
console.log('-------------------------------');
const isValid = validateConfig();
if (isValid) {
    console.log('✅ Configuration is valid\n');
} else {
    console.log('⚠️  Configuration has warnings (see above)\n');
}

// Test 3: Check if at least one platform is configured
console.log('📱 Platform Configuration:');
console.log('-------------------------------');
const iosConfigured = REVENUECAT_CONFIG.API_KEYS.ios && REVENUECAT_CONFIG.PRODUCTS.monthly.ios;
const androidConfigured = REVENUECAT_CONFIG.API_KEYS.android && REVENUECAT_CONFIG.PRODUCTS.monthly.android;

if (iosConfigured) {
    console.log('✅ iOS configuration complete');
}
if (androidConfigured) {
    console.log('✅ Android configuration complete');
}
if (!iosConfigured && !androidConfigured) {
    console.log('❌ No platform configured (need iOS or Android)');
}
console.log('\n');

// Test 4: API configuration check
console.log('🌐 API Configuration:');
console.log('-------------------------------');
console.log(`Base URL: ${REVENUECAT_CONFIG.API.baseURL}`);
console.log(`Version: ${REVENUECAT_CONFIG.API.version}`);
console.log(`Timeout: ${REVENUECAT_CONFIG.API.timeout}ms`);
console.log('\n');

// Summary
console.log('📊 Summary:');
console.log('=====================================');
if (failedCount === 0 && (iosConfigured || androidConfigured)) {
    console.log('✅ Configuration is ready for testing!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server');
    console.log('2. Update frontend configuration');
    console.log('3. Rebuild your mobile app');
    console.log('4. Start testing subscription flow');
} else {
    console.log('❌ Configuration incomplete. Please fix the issues above.');
    console.log('\nRequired:');
    console.log('- Secret Key (sk_...)');
    console.log('- At least one platform fully configured (iOS or Android)');
    console.log('- Webhook Auth Token');
    console.log('- Entitlement ID');
    console.log('\nSee REVENUECAT_ENVIRONMENT_SETUP.md for detailed instructions.');
}
console.log('=====================================\n');

// Helper function to mask sensitive values
function maskSensitiveValue(value) {
    if (!value || value.length < 8) return '****';
    const prefix = value.substring(0, 4);
    const suffix = value.substring(value.length - 4);
    return `${prefix}...${suffix}`;
}





