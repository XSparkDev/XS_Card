/**
 * Test script for device detection utility
 * Tests the detectOS function with various User-Agent strings
 */

const { detectOS, getStoreLink, getBothStoreLinks } = require('./utils/deviceDetection');

console.log('🧪 Testing Device Detection Utility\n');
console.log('='.repeat(60));

// Test cases based on real User-Agent strings
const testCases = [
    {
        name: 'iPhone (iOS)',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        expectedOS: 'ios'
    },
    {
        name: 'iPad (iOS)',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        expectedOS: 'ios'
    },
    {
        name: 'Android Phone',
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        expectedOS: 'android'
    },
    {
        name: 'Android Tablet',
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-T970) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        expectedOS: 'android'
    },
    {
        name: 'Huawei Phone',
        userAgent: 'Mozilla/5.0 (Linux; Android 10; LIO-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.93 Mobile Safari/537.36',
        expectedOS: 'huawei'
    },
    {
        name: 'Windows Desktop',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        expectedOS: 'windows'
    },
    {
        name: 'Mac Desktop',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        expectedOS: 'mac'
    },
    {
        name: 'Linux Desktop',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        expectedOS: 'linux'
    },
    {
        name: 'Unknown/Empty',
        userAgent: '',
        expectedOS: 'unknown'
    },
    {
        name: 'React Native (Android)',
        userAgent: 'okhttp/4.9.1',
        expectedOS: 'unknown' // Note: This would need special handling if we want to detect React Native
    }
];

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    const result = detectOS(testCase.userAgent);
    const storeLink = getStoreLink(testCase.userAgent);
    const match = result.os === testCase.expectedOS;
    
    if (match) {
        passed++;
        console.log(`✅ Test ${index + 1}: ${testCase.name}`);
    } else {
        failed++;
        console.log(`❌ Test ${index + 1}: ${testCase.name}`);
        console.log(`   Expected: ${testCase.expectedOS}, Got: ${result.os}`);
    }
    
    console.log(`   User-Agent: ${testCase.userAgent.substring(0, 60)}${testCase.userAgent.length > 60 ? '...' : ''}`);
    console.log(`   Detected OS: ${result.os}`);
    console.log(`   Store Link: ${storeLink || 'Both (unknown OS)'}`);
    console.log('');
});

console.log('='.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

// Test getBothStoreLinks
console.log('\n🔗 Testing getBothStoreLinks():');
const bothLinks = getBothStoreLinks();
console.log(`   iOS: ${bothLinks.ios}`);
console.log(`   Android: ${bothLinks.android}`);

// Test edge cases
console.log('\n🔍 Testing Edge Cases:');
console.log(`   null User-Agent: ${detectOS(null).os}`);
console.log(`   undefined User-Agent: ${detectOS(undefined).os}`);
console.log(`   non-string User-Agent: ${detectOS(123).os}`);

console.log('\n✨ Test complete!\n');

