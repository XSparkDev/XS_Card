/**
 * Individual Tier Testing Script
 * Forces each tier to test them one by one
 * 
 * Usage: 
 * - node test-individual-tiers.js primary
 * - node test-individual-tiers.js sendgrid  
 * - node test-individual-tiers.js gmail
 */

require('dotenv').config();
const { sendMailWithStatus, primaryTransporter, gmailTransporter } = require('./public/Utils/emailService');

const TEST_RECIPIENT = 'pule@xspark.co.za';

async function testPrimarySMTP() {
  console.log('🧪 Testing Primary SMTP Only...\n');
  
  const testEmail = {
    to: TEST_RECIPIENT,
    subject: 'Primary SMTP Test - ' + new Date().toISOString(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF4B6E;">Primary SMTP Test</h2>
        <p>✅ <strong>Success!</strong> This email was sent via your primary SMTP server.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>Provider:</strong> Primary SMTP (srv144.hostserv.co.za)</p>
        <p><strong>From:</strong> XS Card (xscard@xspark.co.za)</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          This confirms your primary email server is working correctly.
        </p>
      </div>
    `,
    text: 'Primary SMTP Test - Your primary email server is working correctly.'
  };
  
  try {
    const result = await primaryTransporter.sendMail(testEmail);
    console.log('✅ Primary SMTP email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📧 Accepted:', result.accepted);
    console.log('📧 Rejected:', result.rejected);
  } catch (error) {
    console.log('❌ Primary SMTP failed:', error.message);
  }
}

async function testSendGrid() {
  console.log('🧪 Testing SendGrid Only...\n');
  
  if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY === 'YOUR_SENDGRID_API_KEY') {
    console.log('❌ SendGrid not configured. Set SENDGRID_API_KEY environment variable.');
    return;
  }
  
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  
  const testEmail = {
    to: TEST_RECIPIENT,
    from: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER,
    subject: 'SendGrid Test - ' + new Date().toISOString(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF4B6E;">SendGrid Test</h2>
        <p>✅ <strong>Success!</strong> This email was sent via SendGrid.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>Provider:</strong> SendGrid API</p>
        <p><strong>From:</strong> XS Card (xscard@xspark.co.za)</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          This confirms your SendGrid integration is working correctly.
        </p>
      </div>
    `,
    text: 'SendGrid Test - Your SendGrid integration is working correctly.'
  };
  
  try {
    const result = await sgMail.send(testEmail);
    console.log('✅ SendGrid email sent successfully!');
    console.log('📧 Response:', result[0].statusCode);
    console.log('📧 Headers:', result[0].headers);
  } catch (error) {
    console.log('❌ SendGrid failed:', error.message);
    if (error.response) {
      console.log('📧 Error details:', error.response.body);
    }
  }
}

async function testGmail() {
  console.log('🧪 Testing Gmail Only...\n');
  
  const testEmail = {
    to: TEST_RECIPIENT,
    from: process.env.GMAIL_FROM_ADDRESS || '"XS Card" <xscard@xspark.co.za>',
    subject: 'Gmail Test - ' + new Date().toISOString(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF4B6E;">Gmail Test</h2>
        <p>✅ <strong>Success!</strong> This email was sent via Gmail.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>Provider:</strong> Gmail SMTP</p>
        <p><strong>From:</strong> XS Card (xscard@xspark.co.za)</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          This confirms your Gmail fallback is working correctly.
        </p>
      </div>
    `,
    text: 'Gmail Test - Your Gmail fallback is working correctly.'
  };
  
  try {
    const result = await gmailTransporter.sendMail(testEmail);
    console.log('✅ Gmail email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📧 Accepted:', result.accepted);
    console.log('📧 Rejected:', result.rejected);
  } catch (error) {
    console.log('❌ Gmail failed:', error.message);
  }
}

async function testAllTiers() {
  console.log('🧪 Testing All Tiers...\n');
  
  console.log('1️⃣ Testing Primary SMTP...');
  await testPrimarySMTP();
  
  console.log('\n2️⃣ Testing SendGrid...');
  await testSendGrid();
  
  console.log('\n3️⃣ Testing Gmail...');
  await testGmail();
  
  console.log('\n🎉 All individual tier tests completed!');
  console.log('📧 Check your email inbox for test messages from each provider.');
}

// Get command line argument
const tier = process.argv[2]?.toLowerCase();

// Run appropriate test
switch (tier) {
  case 'primary':
    testPrimarySMTP();
    break;
  case 'sendgrid':
    testSendGrid();
    break;
  case 'gmail':
    testGmail();
    break;
  case 'all':
    testAllTiers();
    break;
  default:
    console.log('Usage:');
    console.log('  node test-individual-tiers.js primary   - Test Primary SMTP only');
    console.log('  node test-individual-tiers.js sendgrid  - Test SendGrid only');
    console.log('  node test-individual-tiers.js gmail     - Test Gmail only');
    console.log('  node test-individual-tiers.js all       - Test all tiers');
    break;
} 