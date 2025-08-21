/**
 * Email Configuration Test Script
 * Run this script to test your email configuration in production
 * 
 * Usage: node test-email-config.js
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

// Test different port configurations
const testConfigurations = [
  {
    name: 'Port 587 with STARTTLS (Recommended for Render)',
    port: 587,
    secure: false,
    requireTLS: true
  },
  {
    name: 'Port 465 with SSL',
    port: 465,
    secure: true,
    requireTLS: false
  },
  {
    name: 'Port 25 (Basic SMTP)',
    port: 25,
    secure: false,
    requireTLS: false
  }
];

async function testEmailConfiguration() {
  console.log('🧪 Testing Email Configuration...\n');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Email Host:', process.env.EMAIL_HOST);
  console.log('Email User:', process.env.EMAIL_USER);
  console.log('Has Password:', process.env.EMAIL_PASSWORD ? '✅ Yes' : '❌ No');
  console.log('SendGrid API Key:', process.env.SENDGRID_API_KEY ? '✅ Configured' : '❌ Not configured');
  console.log('\n' + '='.repeat(60) + '\n');

  for (const config of testConfigurations) {
    console.log(`Testing: ${config.name}`);
    console.log(`Port: ${config.port}, Secure: ${config.secure}`);
    
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: config.port,
      secure: config.secure,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      },
      requireTLS: config.requireTLS,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });

    try {
      console.log('⏳ Verifying connection...');
      
      // Add timeout to prevent hanging
      const verifyPromise = new Promise((resolve, reject) => {
        transporter.verify((error, success) => {
          if (error) {
            reject(error);
          } else {
            resolve(success);
          }
        });
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000);
      });

      await Promise.race([verifyPromise, timeoutPromise]);
      
      console.log('✅ Connection successful!\n');
      
      // If verification succeeds, try sending a test email
      if (process.argv.includes('--send-test')) {
        console.log('📧 Sending test email...');
        const testEmail = {
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER, // Send to self
          subject: 'Email Configuration Test',
          text: `Test email sent successfully using ${config.name} at ${new Date().toISOString()}`
        };

        const result = await transporter.sendMail(testEmail);
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', result.messageId);
      }
      
      break; // Stop testing once we find a working configuration
      
    } catch (error) {
      console.log('❌ Connection failed:', error.message);
      console.log('Error code:', error.code || 'Unknown');
      console.log('');
    }
  }

  console.log('🏁 Email configuration test completed.');
  
  // Recommendations
  console.log('\n📋 RECOMMENDATIONS FOR RENDER.COM:');
  console.log('1. Set NODE_ENV=production in your environment variables');
  console.log('2. Use port 587 with STARTTLS (most compatible with hosting platforms)');
  console.log('3. Consider using SendGrid as a backup email service');
  console.log('4. Add EMAIL_SERVICE=smtp to your environment variables');
  
  if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY === 'YOUR_SENDGRID_API_KEY') {
    console.log('\n🔧 SENDGRID SETUP (Recommended fallback):');
    console.log('1. Sign up for SendGrid (free tier available)');
    console.log('2. Get your API key from SendGrid dashboard');
    console.log('3. Add SENDGRID_API_KEY to your environment variables');
    console.log('4. Add EMAIL_SERVICE=sendgrid to use SendGrid as primary');
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run the test
testEmailConfiguration().catch(console.error);