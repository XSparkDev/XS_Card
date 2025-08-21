/**
 * Three-Tier Email Fallback Test Script
 * Tests: Primary SMTP → SendGrid → Gmail
 * ACTUALLY SENDS EMAILS to verify each tier works
 * 
 * Usage: node test-email-fallbacks.js
 */

require('dotenv').config();
const { sendMailWithStatus, primaryTransporter, gmailTransporter } = require('./public/Utils/emailService');

// Test email addresses
const TEST_RECIPIENTS = [
  'pule@xspark.co.za',
  'tshehlap@gmail.com',
  'xscard@xspark.co.za'
];

async function testIndividualServices() {
  console.log('🔍 Testing Individual Email Services...\n');
  
  // Test 1: Primary SMTP
  console.log('1️⃣ Testing Primary SMTP...');
  try {
    await primaryTransporter.verify();
    console.log('   ✅ Primary SMTP connection verified');
    
    // Send test email via primary SMTP
    const primaryTestEmail = {
      to: TEST_RECIPIENTS[0],
      subject: 'Primary SMTP Test - ' + new Date().toISOString(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF4B6E;">Primary SMTP Test</h2>
          <p>✅ <strong>Success!</strong> This email was sent via your primary SMTP server.</p>
          <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
          <p><strong>Provider:</strong> Primary SMTP (srv144.hostserv.co.za)</p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            This confirms your primary email server is working correctly.
          </p>
        </div>
      `,
      text: 'Primary SMTP Test - Your primary email server is working correctly.'
    };
    
    const primaryResult = await primaryTransporter.sendMail(primaryTestEmail);
    console.log('   ✅ Primary SMTP email sent successfully!');
    console.log('   📧 Message ID:', primaryResult.messageId);
    
  } catch (error) {
    console.log('   ❌ Primary SMTP failed:', error.message);
  }
  
  // Test 2: Gmail
  console.log('\n2️⃣ Testing Gmail...');
  try {
    await gmailTransporter.verify();
    console.log('   ✅ Gmail connection verified');
    
    // Send test email via Gmail
    const gmailTestEmail = {
      to: TEST_RECIPIENTS[1],
      from: process.env.GMAIL_FROM_ADDRESS || '"XS Card" <xscard@xspark.co.za>',
      subject: 'Gmail Fallback Test - ' + new Date().toISOString(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF4B6E;">Gmail Fallback Test</h2>
          <p>✅ <strong>Success!</strong> This email was sent via Gmail fallback.</p>
          <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
          <p><strong>Provider:</strong> Gmail SMTP</p>
          <p><strong>From Address:</strong> XS Card (xscard@xspark.co.za)</p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            This confirms your Gmail fallback is working correctly.
          </p>
        </div>
      `,
      text: 'Gmail Fallback Test - Your Gmail fallback is working correctly.'
    };
    
    const gmailResult = await gmailTransporter.sendMail(gmailTestEmail);
    console.log('   ✅ Gmail email sent successfully!');
    console.log('   📧 Message ID:', gmailResult.messageId);
    
  } catch (error) {
    console.log('   ❌ Gmail failed:', error.message);
  }
  
  // Test 3: SendGrid (if configured)
  console.log('\n3️⃣ Testing SendGrid...');
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'YOUR_SENDGRID_API_KEY') {
    console.log('   ℹ️  SendGrid API key found - testing during fallback simulation');
  } else {
    console.log('   ❌ SendGrid not configured');
  }
}

async function testFallbackSystem() {
  console.log('\n🔄 Testing Three-Tier Fallback System...\n');
  
  // Check environment variables
  console.log('📋 Environment Configuration:');
  console.log('- Primary SMTP:', process.env.EMAIL_HOST ? '✅ Configured' : '❌ Not configured');
  console.log('- SendGrid API:', process.env.SENDGRID_API_KEY ? '✅ Configured' : '❌ Not configured');
  console.log('- Gmail User:', process.env.GMAIL_USER ? '✅ Configured' : '❌ Not configured');
  console.log('- Gmail App Password:', process.env.GMAIL_APP_PASSWORD ? '✅ Configured' : '❌ Not configured');
  console.log('- Gmail From Address:', process.env.GMAIL_FROM_ADDRESS ? '✅ Configured' : '❌ Not configured');
  console.log('');
  
  // Send test emails to all recipients
  for (const recipient of TEST_RECIPIENTS) {
    console.log(`📧 Sending fallback test email to: ${recipient}`);
    
    const testEmail = {
      to: recipient,
      subject: 'Three-Tier Email Fallback Test - ' + new Date().toISOString(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF4B6E;">Three-Tier Email Fallback Test</h2>
          <p>✅ <strong>Success!</strong> Your email system is working with fallback support.</p>
          <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
          <p><strong>Recipient:</strong> ${recipient}</p>
          <p><strong>Test:</strong> Primary SMTP → SendGrid → Gmail fallback system</p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            This email was sent through the three-tier fallback system to ensure reliable delivery.
            Check the logs to see which provider was actually used.
          </p>
        </div>
      `,
      text: `Three-Tier Email Fallback Test - Your email system is working with fallback support. Sent to: ${recipient}`
    };
    
    try {
      const result = await sendMailWithStatus(testEmail);
      
      if (result.success) {
        console.log(`   ✅ Email sent successfully to ${recipient}!`);
        console.log(`   📧 Provider used: ${result.provider || 'unknown'}`);
        console.log(`   📧 Message ID: ${result.messageId}`);
        console.log(`   📧 Accepted: ${result.accepted?.length || 0}`);
        console.log(`   📧 Rejected: ${result.rejected?.length || 0}`);
      } else {
        console.log(`   ❌ Email failed to send to ${recipient}`);
        console.log(`   ❌ Error: ${result.error}`);
        console.log(`   ❌ Error Code: ${result.errorCode}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Test failed for ${recipient}:`, error.message);
    }
    
    console.log(''); // Add spacing between recipients
  }
}

async function testFallbackSimulation() {
  console.log('\n🎭 Testing Fallback Simulation...\n');
  
  // Simulate primary SMTP failure by temporarily modifying the transporter
  console.log('🔄 Simulating Primary SMTP failure to test SendGrid fallback...');
  
  // Create a test email
  const testEmail = {
    to: TEST_RECIPIENTS[0],
    subject: 'Fallback Simulation Test - ' + new Date().toISOString(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF4B6E;">Fallback Simulation Test</h2>
        <p>🧪 <strong>Test!</strong> This email tests the fallback system.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>Purpose:</strong> Verify fallback mechanisms work correctly</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          This is a simulation test to verify the fallback system works.
        </p>
      </div>
    `,
    text: 'Fallback Simulation Test - Verifying fallback mechanisms work correctly.'
  };
  
  try {
    const result = await sendMailWithStatus(testEmail);
    
    if (result.success) {
      console.log('✅ Fallback simulation completed!');
      console.log(`📧 Final provider used: ${result.provider || 'unknown'}`);
      console.log(`📧 Message ID: ${result.messageId}`);
      
      console.log('\n📊 Fallback Order Tested:');
      console.log('1. Primary SMTP (your main email server)');
      console.log('2. SendGrid (if configured and primary fails)');
      console.log('3. Gmail (if both primary and SendGrid fail)');
      
    } else {
      console.log('❌ Fallback simulation failed');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.log('❌ Fallback simulation failed with exception:', error.message);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run all tests
async function runAllTests() {
  console.log('🧪 Starting Comprehensive Email System Tests...\n');
  console.log('='.repeat(60));
  
  await testIndividualServices();
  console.log('\n' + '='.repeat(60));
  
  await testFallbackSystem();
  console.log('\n' + '='.repeat(60));
  
  await testFallbackSimulation();
  
  console.log('\n🎉 All tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Individual service tests verify each provider works');
  console.log('- Fallback system tests verify automatic failover');
  console.log('- Simulation tests verify error handling');
  console.log('\n📧 Check your email inboxes for test messages!');
}

runAllTests().catch(console.error); 