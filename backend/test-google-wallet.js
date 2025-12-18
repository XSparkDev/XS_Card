/**
 * Test script for Google Wallet configuration and API access.
 * Runs a minimal auth + list classes call to validate credentials.
 *
 * Usage:
 *   cd backend
 *   node test-google-wallet.js
 *
 * Requirements:
 * - Environment variables set in backend/.env:
 *   GOOGLE_WALLET_ISSUER_ID
 *   GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_WALLET_PRIVATE_KEY  (keep \\n in the value)
 */

require('dotenv').config();
const { google } = require('googleapis');

async function testGoogleWallet() {
  try {
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
    const serviceAccountEmail = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
    const rawPrivateKey = process.env.GOOGLE_WALLET_PRIVATE_KEY;

    console.log('🔧 Configuration Check:');
    console.log('Issuer ID:', issuerId);
    console.log('Service Account:', serviceAccountEmail);
    console.log('Private Key:', rawPrivateKey ? '✅ Present' : '❌ Missing');

    if (!issuerId || !serviceAccountEmail || !rawPrivateKey) {
      throw new Error('Missing required Google Wallet environment variables');
    }

    const credentials = {
      type: 'service_account',
      client_email: serviceAccountEmail,
      private_key: rawPrivateKey.replace(/\\n/g, '\n'),
    };

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });

    const client = await auth.getClient();
    console.log('✅ Authentication successful!');

    const walletobjects = google.walletobjects({
      version: 'v1',
      auth: client,
    });

    // Try to list generic classes to verify API access
    const response = await walletobjects.genericclass.list({
      issuerId,
    });

    console.log('✅ API access verified!');
    console.log('Response status:', response.status);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testGoogleWallet();

