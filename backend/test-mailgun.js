/**
 * Mailgun API Test Script
 * Run this to test your Mailgun API key before adding it to production
 * 
 * Usage: 
 * 1. Set your API key: MAILGUN_API_KEY=your-key MAILGUN_DOMAIN=your-domain node test-mailgun.js
 * 2. Or add to .env file and run: node test-mailgun.js
 */

require('dotenv').config();
const axios = require('axios');

async function testMailgun() {
  console.log('🧪 Testing Mailgun Configuration...\n');
  
  // Check if API key and domain are provided
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  
  if (!apiKey) {
    console.log('❌ No Mailgun API key found!');
    console.log('Please set MAILGUN_API_KEY environment variable\n');
    return;
  }
  
  if (!domain) {
    console.log('❌ No Mailgun domain found!');
    console.log('Please set MAILGUN_DOMAIN environment variable\n');
    return;
  }
  
  console.log('✅ API Key found:', apiKey.substring(0, 15) + '...');
  console.log('✅ Domain found:', domain);
  
  try {
    // Test email configuration
    const testEmail = {
      from: `XSCard Test <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || 'test@' + domain}>`,
      to: process.env.EMAIL_USER || 'tshehlap@gmail.com',
      subject: 'Mailgun Test Email - ' + new Date().toISOString(),
      text: 'This is a test email sent via Mailgun API to verify the configuration is working.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF4B6E;">Mailgun Test Email</h2>
          <p>✅ <strong>Success!</strong> Your Mailgun API key is working correctly.</p>
          <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
          <p><strong>From:</strong> XSCard Email Service</p>
          <p><strong>Domain:</strong> ${domain}</p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            This is a test email. You can now use Mailgun for your production email delivery.
          </p>
        </div>
      `
    };
    
    console.log('\n📧 Sending test email...');
    console.log('To:', testEmail.to);
    console.log('From:', testEmail.from);
    console.log('Subject:', testEmail.subject);
    console.log('Domain:', domain);
    
    // Send the test email using Mailgun API
    const response = await axios.post(
      `https://api.mailgun.net/v3/${domain}/messages`,
      new URLSearchParams(testEmail),
      {
        auth: {
          username: 'api',
          password: apiKey
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('\n✅ Test email sent successfully!');
    console.log('Response status:', response.status);
    console.log('Message ID:', response.data.id);
    console.log('Message:', response.data.message);
    
    console.log('\n🎉 Mailgun is ready for production!');
    console.log('\n📋 Next steps:');
    console.log('1. Add MAILGUN_API_KEY and MAILGUN_DOMAIN to your Render.com environment variables');
    console.log('2. Set EMAIL_SERVICE=mailgun in Render.com');
    console.log('3. Deploy your updated code');
    
  } catch (error) {
    console.log('\n❌ Mailgun test failed!');
    
    if (error.response) {
      console.error('Error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      // Common error solutions
      console.log('\n🔧 Common solutions:');
      if (error.response.status === 401) {
        console.log('- Check your API key is correct');
        console.log('- Ensure you\'re using the correct Mailgun region (US vs EU)');
      }
      if (error.response.status === 400) {
        console.log('- Verify your domain is properly configured in Mailgun');
        console.log('- Check if the "from" email address is authorized');
        console.log('- Make sure domain DNS records are set up correctly');
      }
      if (error.response.status === 402) {
        console.log('- Your Mailgun account may need payment method or verification');
        console.log('- Check your account status in Mailgun dashboard');
      }
    } else {
      console.error('Network error:', error.message);
    }
  }
}

// Test domain validation
async function testDomainStatus(domain, apiKey) {
  try {
    console.log('\n🔍 Checking domain status...');
    const response = await axios.get(
      `https://api.mailgun.net/v3/domains/${domain}`,
      {
        auth: {
          username: 'api',
          password: apiKey
        }
      }
    );
    
    const domainInfo = response.data.domain;
    console.log('Domain status:', domainInfo.state);
    console.log('Domain type:', domainInfo.type);
    
    if (domainInfo.state !== 'active') {
      console.log('⚠️  Domain is not active. You may need to verify DNS records.');
    }
  } catch (error) {
    console.log('Could not fetch domain status:', error.response?.data?.message || error.message);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run the test
testMailgun().catch(console.error);