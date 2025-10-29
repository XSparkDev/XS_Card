/**
 * Wallet Configuration Test Script
 * 
 * Tests the wallet pass service configuration and connections
 */

const WalletPassService = require('./services/walletPassService');

async function testWalletConfiguration() {
    console.log('🔍 Testing Wallet Pass Configuration...\n');
    
    try {
        const walletService = new WalletPassService();
        
        // Test 1: Service Status
        console.log('📊 Service Status:');
        console.log('==================');
        const status = walletService.getServiceStatus();
        console.log(JSON.stringify(status, null, 2));
        console.log('');
        
        // Test 2: Configuration Validation
        console.log('✅ Configuration Validation:');
        console.log('=============================');
        const validation = walletService.validateConfiguration();
        console.log(JSON.stringify(validation, null, 2));
        console.log('');
        
        // Test 3: Connection Tests
        console.log('🔗 Connection Tests:');
        console.log('====================');
        const connections = await walletService.testConnections();
        console.log(JSON.stringify(connections, null, 2));
        console.log('');
        
        // Test 4: Available Templates
        console.log('🎨 Available Templates:');
        console.log('======================');
        const freeTemplates = walletService.getAvailableTemplates('free');
        const premiumTemplates = walletService.getAvailableTemplates('premium');
        console.log('Free user templates:', freeTemplates.map(t => t.id));
        console.log('Premium user templates:', premiumTemplates.map(t => t.id));
        console.log('');
        
        // Summary
        console.log('📋 Summary:');
        console.log('===========');
        console.log(`Apple Wallet: ${validation.apple.configured ? '✅ Configured' : '❌ Not configured'}`);
        console.log(`Google Wallet: ${validation.google.configured ? '✅ Configured' : '❌ Not configured'}`);
        
        if (validation.apple.configured && validation.google.configured) {
            console.log('\n🎉 All wallet services are properly configured!');
            console.log('You can now generate wallet passes.');
        } else {
            console.log('\n⚠️  Some wallet services are not configured.');
            console.log('Please check the setup guide and configure missing services.');
        }
        
    } catch (error) {
        console.error('❌ Error testing wallet configuration:', error);
        console.log('\nPlease check your configuration and try again.');
    }
}

// Run the test
testWalletConfiguration();
