/**
 * Fallback Scenario Testing
 * Tests different failure scenarios to ensure fallbacks work
 * 
 * Usage: node test-fallback-scenario
 */

require('dotenv').config();
const { sendMailWithStatus } = require('./public/Utils/emailService');

async function testFallbackScenarios() {
  console.log('🧪 Testing Fallback Scenarios...\n');
  
  const testEmail = {
    to: 'pule@xspark.co.za',
    subject: 'Fallback Test - ' + new Date().toISOString(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF4B6E;">Fallback System Test</h2>
        <p>This email tests the three-tier fallback system.</p>
        <p><strong>Test:</strong> Primary SMTP → SendGrid → Gmail</p>
        <p><strong>Expected:</strong> Should succeed via one of the tiers</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          This tests that the fallback system continues through all tiers.
        </p>
      </div>
    `,
    text: 'Fallback System Test - Testing three-tier fallback system.'
  };
  
  console.log('📧 Sending test email with fallback system...');
  console.log('To:', testEmail.to);
  console.log('Subject:', testEmail.subject);
  console.log('');
  
  try {
    const result = await sendMailWithStatus(testEmail);
    
    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('📧 Provider used:', result.provider || 'unknown');
      console.log('📧 Message ID:', result.messageId);
      console.log('📧 Accepted:', result.accepted);
      console.log('📧 Rejected:', result.rejected);
      
      console.log('\n🎉 Fallback system is working correctly!');
      console.log('\n📊 Fallback Order:');
      console.log('1. Primary SMTP (srv144.hostserv.co.za)');
      console.log('2. SendGrid (if configured and primary fails)');
      console.log('3. Gmail (if both primary and SendGrid fail)');
      
    } else {
      console.log('❌ Email failed to send');
      console.log('Error:', result.error);
      console.log('Error Code:', result.errorCode);
      
      console.log('\n🔧 Troubleshooting:');
      console.log('- Check all email service configurations');
      console.log('- Verify environment variables are set correctly');
      console.log('- Check network connectivity to email servers');
    }
    
  } catch (error) {
    console.log('❌ Test failed with exception:', error.message);
  }
}

async function testNegativeScenarios() {
  console.log('\n🎭 Testing Negative Scenarios...\n');
  
  // Test with invalid credentials to force fallbacks
  console.log('1️⃣ Testing with invalid primary SMTP credentials...');
  
  // Temporarily modify environment to test fallbacks
  const originalEmailPassword = process.env.EMAIL_PASSWORD;
  const originalSendGridKey = process.env.SENDGRID_API_KEY;
  
  try {
    // Set invalid credentials to force fallbacks
    process.env.EMAIL_PASSWORD = 'invalid_password';
    process.env.SENDGRID_API_KEY = 'invalid_key';
    
    const testEmail = {
      to: 'pule@xspark.co.za',
      subject: 'Negative Test - ' + new Date().toISOString(),
      html: '<p>This tests the fallback system with invalid credentials.</p>',
      text: 'Negative test with invalid credentials.'
    };
    
    const result = await sendMailWithStatus(testEmail);
    
    if (result.success) {
      console.log('✅ Fallback system worked! Email sent via:', result.provider);
    } else {
      console.log('❌ All fallbacks failed:', result.error);
    }
    
  } catch (error) {
    console.log('❌ Negative test failed:', error.message);
  } finally {
    // Restore original credentials
    process.env.EMAIL_PASSWORD = originalEmailPassword;
    process.env.SENDGRID_API_KEY = originalSendGridKey;
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run tests
async function runTests() {
  console.log('🧪 Starting Fallback Scenario Tests...\n');
  console.log('='.repeat(60));
  
  await testFallbackScenarios();
  console.log('\n' + '='.repeat(60));
  
  await testNegativeScenarios();
  
  console.log('\n🎉 All fallback tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Positive tests verify normal operation');
  console.log('- Negative tests verify fallback behavior');
  console.log('- System should continue through all tiers');
}

runTests().catch(console.error); 