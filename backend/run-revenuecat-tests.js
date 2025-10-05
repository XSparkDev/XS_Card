/**
 * Test Runner: RevenueCat Tests
 * 
 * Runs all RevenueCat tests in sequence and provides a summary
 */

const { spawn } = require('child_process');
const path = require('path');

async function runTest(testFile, testName) {
    return new Promise((resolve, reject) => {
        console.log(`\n🧪 Running ${testName}...`);
        console.log('='.repeat(50));
        
        const testProcess = spawn('node', [testFile], {
            cwd: __dirname,
            stdio: 'inherit'
        });
        
        testProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ ${testName} completed successfully`);
                resolve(true);
            } else {
                console.log(`❌ ${testName} failed with code ${code}`);
                resolve(false);
            }
        });
        
        testProcess.on('error', (error) => {
            console.log(`❌ ${testName} error:`, error.message);
            resolve(false);
        });
    });
}

async function runAllTests() {
    console.log('🚀 Starting RevenueCat Test Suite');
    console.log('==================================');
    
    const tests = [
        {
            file: 'test-revenuecat-products-endpoint.js',
            name: 'Products Endpoint Test'
        },
        {
            file: 'test-revenuecat-webhook.js',
            name: 'Webhook Endpoint Test'
        },
        {
            file: 'test-revenuecat-integration.js',
            name: 'Integration Test'
        }
    ];
    
    const results = [];
    
    for (const test of tests) {
        const success = await runTest(test.file, test.name);
        results.push({ name: test.name, success });
    }
    
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    
    let passed = 0;
    let failed = 0;
    
    results.forEach(result => {
        if (result.success) {
            console.log(`✅ ${result.name}: PASSED`);
            passed++;
        } else {
            console.log(`❌ ${result.name}: FAILED`);
            failed++;
        }
    });
    
    console.log(`\n🎯 Total: ${passed + failed} tests`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed! RevenueCat integration is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Check the logs above for details.');
    }
    
    console.log('\n📋 Next Steps:');
    console.log('1. Fix any failing tests');
    console.log('2. Run tests again to verify fixes');
    console.log('3. Test with real RevenueCat configuration');
    console.log('4. Test with real Google Play Store products');
}

// Run all tests
runAllTests().catch(console.error);
