# Wallet Pass Setup Guide

This guide will help you set up Apple Wallet and Google Wallet pass generation for your XS Card application.

## Prerequisites

- Apple Developer Account ($99/year) - ✅ You have this
- Google Cloud Account (Free) - You need to create this
- Your XS Card backend server running

## Apple Wallet Setup

### 1. Create Pass Type ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers)
2. Click the "+" button to create a new identifier
3. Select "Pass Type IDs" and click "Continue"
4. Enter:
   - **Description**: XS Card Business Card
   - **Identifier**: `pass.com.xscard.businesscard` (or your domain)
5. Click "Continue" and "Register"

### 2. Generate Pass Signing Certificate

1. In your Pass Type ID, click "Create Certificate"
2. Follow the instructions to create a certificate
3. Download the certificate (.cer file)
4. Double-click to install it in Keychain Access
5. In Keychain Access, find your certificate and export it as .p12:
   - Right-click certificate → Export
   - Choose .p12 format
   - Set a password (remember this!)
   - Save as `Certificates.p12`

### 3. Convert Certificates

Run these commands in Terminal (replace paths as needed):

```bash
# Convert .p12 to .pem files
openssl pkcs12 -in Certificates.p12 -clcerts -nokeys -out passcert.pem
openssl pkcs12 -in Certificates.p12 -nocerts -out passkey.pem

# Remove passphrase from key (optional but recommended)
openssl rsa -in passkey.pem -out passkey.pem
```

### 4. Download Apple WWDR Certificate

1. Go to [Apple Certificate Authority](https://www.apple.com/certificateauthority/)
2. Download "Worldwide Developer Relations - G4" certificate
3. Convert to .pem:
   ```bash
   openssl x509 -inform DER -in wwdr.cer -out wwdr.pem
   ```

### 5. Get Your Team ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Your Team ID is shown in the top-right corner (format: `ABC123DEF4`)

## Google Wallet Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Enter project name: `XSCard-Wallet`
4. Click "Create"

### 2. Enable Google Wallet API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Wallet API"
3. Click on it and press "Enable"

### 3. Create Service Account

1. Go to "IAM & Admin" → "Service Accounts"
2. Click "Create Service Account"
3. Enter:
   - **Name**: `xscard-wallet-service`
   - **Description**: Service account for XS Card wallet pass generation
4. Click "Create and Continue"
5. Grant role: "Owner" (for full access)
6. Click "Continue" → "Done"

### 4. Create Service Account Key

1. Click on your service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose "JSON" format
5. Download the file and rename it to `google-wallet-service-account.json`

### 5. Create Issuer Account

1. Go to [Google Pay Business Console](https://pay.google.com/business/console)
2. Sign in with your Google account
3. Click "Get Started" or "Register as Issuer"
4. Follow the registration process
5. Note your **Issuer ID** (format: `3388000000012345678`)

## Environment Configuration

### 1. Update Your .env File

Add these variables to your `backend/.env` file:

```bash
# Apple Wallet Configuration
APPLE_PASS_TYPE_ID=pass.com.xscard.businesscard
APPLE_TEAM_ID=YOUR_TEAM_ID_HERE
APPLE_PASS_CERT_PATH=./certificates/passcert.pem
APPLE_PASS_KEY_PATH=./certificates/passkey.pem
APPLE_WWDR_CERT_PATH=./certificates/wwdr.pem

# Google Wallet Configuration
GOOGLE_WALLET_ISSUER_ID=YOUR_ISSUER_ID_HERE
GOOGLE_WALLET_SERVICE_ACCOUNT_PATH=./certificates/google-wallet-service-account.json
GOOGLE_WALLET_CLASS_ID=xscard_business_card_v1

# Wallet Public URLs
DEV_WALLET_PUBLIC_URL=http://localhost:8383
PROD_WALLET_PUBLIC_URL=https://your-domain.com
```

### 2. Place Certificate Files

Put these files in `backend/certificates/`:
- `passcert.pem` (Apple pass certificate)
- `passkey.pem` (Apple pass private key)
- `wwdr.pem` (Apple WWDR certificate)
- `google-wallet-service-account.json` (Google service account)

### 3. Install Dependencies

```bash
cd backend
npm install
```

## Testing

### 1. Test Configuration

Create a test file `backend/test-wallet-config.js`:

```javascript
const WalletPassService = require('./services/walletPassService');

async function testConfig() {
    const walletService = new WalletPassService();
    
    console.log('Testing wallet configuration...');
    
    const status = walletService.getServiceStatus();
    console.log('Service Status:', JSON.stringify(status, null, 2));
    
    const validation = walletService.validateConfiguration();
    console.log('Validation Results:', JSON.stringify(validation, null, 2));
    
    const connections = await walletService.testConnections();
    console.log('Connection Tests:', JSON.stringify(connections, null, 2));
}

testConfig().catch(console.error);
```

Run it:
```bash
node test-wallet-config.js
```

### 2. Test Wallet Pass Generation

1. Start your backend server
2. Open your XS Card app
3. Go to Cards screen
4. Tap "Add to Wallet"
5. Check if pass appears in your wallet app

## Troubleshooting

### Apple Wallet Issues

- **"Certificates not configured"**: Check file paths in .env
- **"Invalid certificate"**: Ensure certificates are in .pem format
- **"Team ID mismatch"**: Verify APPLE_TEAM_ID in .env

### Google Wallet Issues

- **"Service account not configured"**: Check JSON file path
- **"API not enabled"**: Ensure Google Wallet API is enabled
- **"Invalid issuer"**: Verify GOOGLE_WALLET_ISSUER_ID

### General Issues

- **Images not loading**: Check if image URLs are accessible
- **Pass not appearing**: Check browser/app logs for errors
- **Development environment**: Local IPs may not work with wallet services

## Security Notes

- Never commit certificate files to Git
- Keep your .env file secure
- Rotate certificates annually
- Monitor API usage in Google Cloud Console

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a simple pass first (no images)
4. Contact support with specific error messages
