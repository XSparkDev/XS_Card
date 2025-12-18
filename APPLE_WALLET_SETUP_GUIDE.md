# Apple Wallet Setup Guide

## Overview

Apple Wallet pass generation is now fully implemented and ready for testing when you have access to:
- Mac computer
- Xcode
- iPhone/iPad for testing
- Apple Developer account with Wallet Pass Type ID

---

## 📋 **Prerequisites**

### **1. Apple Developer Account**
- Active Apple Developer Program membership ($99/year)
- Access to Certificates, Identifiers & Profiles

### **2. Wallet Pass Type ID**
- Create a Pass Type ID in Apple Developer Portal
- Format: `pass.com.xscard.businesscard` (or your domain)
- Download and install the certificate

### **3. Certificates Required**

You need three certificate files in `.pem` format:

1. **Pass Certificate** (`passcert.pem`)
   - From Apple Developer Portal → Certificates
   - Export as `.pem` format

2. **Pass Private Key** (`passkey.pem`)
   - Private key corresponding to the pass certificate
   - Export as `.pem` format

3. **WWDR Certificate** (`wwdr.pem`)
   - Apple Worldwide Developer Relations Certificate
   - Download from: https://www.apple.com/certificateauthority/
   - Convert to `.pem` format

---

## 🔧 **Environment Variables Setup**

Add these to your `backend/.env` file:

```env
# Apple Wallet Configuration
APPLE_PASS_TYPE_ID=pass.com.xscard.businesscard
APPLE_TEAM_ID=YOUR_TEAM_ID_HERE
APPLE_PASS_CERT_PATH=./certificates/passcert.pem
APPLE_PASS_KEY_PATH=./certificates/passkey.pem
APPLE_WWDR_CERT_PATH=./certificates/wwdr.pem
```

### **Certificate Paths**

Create a `backend/certificates/` directory and place your `.pem` files there:

```
backend/
  certificates/
    passcert.pem
    passkey.pem
    wwdr.pem
```

**Important:** 
- Add `certificates/` to `.gitignore` (never commit certificates!)
- Use absolute paths if certificates are stored elsewhere

---

## 📝 **Step-by-Step Certificate Setup**

### **Step 1: Create Pass Type ID**

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** (Add)
4. Select **Pass Type IDs**
5. Enter description: "XS Card Business Card"
6. Enter identifier: `pass.com.xscard.businesscard` (or your domain)
7. Click **Continue** → **Register**

### **Step 2: Create Pass Certificate**

1. In **Certificates** section, click **+** (Add)
2. Select **Pass Type ID Certificate**
3. Select your Pass Type ID
4. Follow instructions to create Certificate Signing Request (CSR)
5. Upload CSR and download certificate
6. Double-click to install in Keychain

### **Step 3: Export Certificates as .pem**

#### **Export Pass Certificate:**

```bash
# Find certificate in Keychain, export as .p12 first
# Then convert to .pem:
openssl pkcs12 -in certificate.p12 -clcerts -nokeys -out passcert.pem
```

#### **Export Private Key:**

```bash
# Export private key from Keychain:
openssl pkcs12 -in certificate.p12 -nocerts -nodes -out passkey.pem
```

#### **Download WWDR Certificate:**

```bash
# Download from Apple:
curl -O https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer

# Convert to .pem:
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

### **Step 4: Place Certificates**

Copy all three `.pem` files to `backend/certificates/`:

```
backend/
  certificates/
    passcert.pem    ✅
    passkey.pem     ✅
    wwdr.pem        ✅
```

---

## ✅ **Verification**

### **Test Certificate Setup**

The service will automatically validate certificates when generating a pass. You can also check manually:

```javascript
const AppleWalletService = require('./services/appleWalletService');
const service = new AppleWalletService();
const isValid = service.validateCertificates();
console.log('Certificates valid:', isValid);
```

### **Expected Behavior**

- ✅ **Valid certificates**: Pass generates successfully
- ❌ **Missing certificates**: Clear error message with missing file paths
- ❌ **Invalid certificates**: Error during pass generation

---

## 🧪 **Testing (When Devices Available)**

### **Test Flow:**

1. **Start backend server** with certificates configured
2. **Enable native wallet**: Set `USE_NATIVE_WALLET=true` in `.env`
3. **Test on iOS device**:
   - Open app
   - Tap "Add to Wallet"
   - Should download `.pkpass` file
   - Should open in Apple Wallet automatically
   - Pass should appear in Wallet app

### **Expected Results:**

- ✅ `.pkpass` file downloads
- ✅ Apple Wallet opens automatically
- ✅ Pass appears in Wallet with correct information
- ✅ QR code scans correctly
- ✅ Images display properly

---

## 🚨 **Troubleshooting**

### **Error: "certificates not properly configured"**

**Check:**
- [ ] All environment variables set in `.env`
- [ ] Certificate files exist at specified paths
- [ ] Files are in `.pem` format (not `.p12` or `.cer`)
- [ ] File permissions allow reading

### **Error: "Failed to load Apple Wallet certificates"**

**Check:**
- [ ] Certificate files are valid `.pem` format
- [ ] Private key matches the certificate
- [ ] WWDR certificate is current (download latest if needed)
- [ ] File paths are correct (absolute or relative to backend/)

### **Error: "Invalid pass" when opening in Wallet**

**Check:**
- [ ] Pass Type ID matches certificate
- [ ] Team ID is correct
- [ ] Certificates are not expired
- [ ] Pass structure is valid (check logs for errors)

### **Images Not Showing**

**Check:**
- [ ] Image URLs are accessible (not localhost)
- [ ] Images are in supported formats (PNG, JPEG)
- [ ] Image sizes are reasonable (not too large)
- [ ] Network timeout not exceeded

---

## 📊 **Implementation Details**

### **Pass Structure**

The implementation creates a simple business card pass with:

- **Primary Field**: Full name (name + surname)
- **Secondary Fields**: Company, Occupation
- **Auxiliary Fields**: Email, Phone
- **Barcode**: QR code with save contact URL
- **Images**: Logo (company), Icon, Thumbnail (profile)

### **Colors**

- Background: `#1B2B5B` (XS Card brand color)
- Foreground: White text
- Label: White text

### **File Format**

- Returns `.pkpass` file (ZIP archive with pass.json and assets)
- Content-Type: `application/vnd.apple.pkpass`
- Automatically opens in Apple Wallet when downloaded on iOS

---

## 🔐 **Security Notes**

1. **Never commit certificates to git**
   - Add `certificates/` to `.gitignore`
   - Use environment variables for paths
   - Store certificates securely (encrypted storage, secrets manager)

2. **Certificate Expiration**
   - Pass certificates expire after 1 year
   - Set reminders to renew before expiration
   - Update certificates in production before they expire

3. **Private Key Security**
   - Keep private key secure
   - Use file permissions: `chmod 600 passkey.pem`
   - Don't share private keys

---

## 📚 **Resources**

- [Apple Wallet Developer Guide](https://developer.apple.com/documentation/walletpasses)
- [Passkit Generator Documentation](https://github.com/alexandercerutti/passkit-generator)
- [Apple WWDR Certificates](https://www.apple.com/certificateauthority/)
- [Pass Type ID Setup](https://developer.apple.com/documentation/walletpasses/creating_a_pass_type_id)

---

## ✅ **Checklist for Production**

- [ ] Pass Type ID created in Apple Developer Portal
- [ ] Pass certificate created and exported as `.pem`
- [ ] Private key exported as `.pem`
- [ ] WWDR certificate downloaded and converted to `.pem`
- [ ] All certificates placed in `backend/certificates/`
- [ ] Environment variables configured in `.env`
- [ ] Certificates validated (test script passes)
- [ ] Test pass generated successfully
- [ ] Test pass opens in Apple Wallet on device
- [ ] Images display correctly
- [ ] QR code scans correctly
- [ ] `.gitignore` updated to exclude certificates
- [ ] Production certificates secured (not in git)

---

## 🎉 **Ready to Test!**

Once you have:
- ✅ Mac computer
- ✅ Xcode installed
- ✅ iPhone/iPad for testing
- ✅ Certificates configured

The iOS wallet pass generation is **fully implemented and ready to test**!

No code changes needed - just configure certificates and test on device.

