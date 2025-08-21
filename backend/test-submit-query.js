/**
 * Test script to simulate the submit-query endpoint
 * This will help debug why fallbacks aren't working
 */

require('dotenv').config();
const { sendMailWithStatus } = require('./public/Utils/emailService');

async function testSubmitQuery() {
  console.log('🧪 Testing submit-query endpoint simulation...\n');
  
  // Simulate the exact mailOptions from the submit-query endpoint
  const mailOptions = {
    from: process.env.EMAIL_USER, // Use system email as from address
    replyTo: 'test@example.com', // Set reply-to as the user's email address
    to: 'xscard@xspark.co.za', // Use provided destination or default
    subject: `New Contact Query from Test User`,
    html: `
      <h2>New Query from XS Card Website</h2>
      <p><strong>From:</strong> Test User (test@example.com)</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
        <p><strong>Message:</strong></p>
        <p>This is a test message to debug the fallback system.</p>
      </div>
      <p style="color: #666; font-size: 12px;">This message was sent from the XS Card contact form.</p>
    `
  };

  console.log('📧 Mail Options:');
  console.log('- From:', mailOptions.from);
  console.log('- To:', mailOptions.to);
  console.log('- Reply-To:', mailOptions.replyTo);
  console.log('- Subject:', mailOptions.subject);
  console.log('');

  console.log('🔧 Environment Variables:');
  console.log('- EMAIL_HOST:', process.env.EMAIL_HOST);
  console.log('- EMAIL_USER:', process.env.EMAIL_USER);
  console.log('- EMAIL_SMTP_PORT:', process.env.EMAIL_SMTP_PORT);
  console.log('- SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'Configured' : 'Not configured');
  console.log('- GMAIL_USER:', process.env.GMAIL_USER);
  console.log('- GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'Configured' : 'Not configured');
  console.log('');

  console.log('📧 Sending email via sendMailWithStatus...');
  console.log('');

  try {
    const result = await sendMailWithStatus(mailOptions);
    console.log('📧 Result from sendMailWithStatus:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ SUCCESS: Email sent successfully!');
      console.log('Provider used:', result.provider);
      console.log('Message ID:', result.messageId);
    } else {
      console.log('\n❌ FAILURE: Email failed to send');
      console.log('Error:', result.error);
      console.log('Error Code:', result.errorCode);
      console.log('Provider:', result.provider);
    }
    
  } catch (error) {
    console.log('\n❌ EXCEPTION: sendMailWithStatus threw an error');
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run the test
testSubmitQuery().catch(console.error); 