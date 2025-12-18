# Google Wallet Production Setup Guide

## Current Status: ✅ TEST MODE WORKING

Your Google Wallet pass is working in TEST mode. The pass shows "test mode" because the pass class hasn't been submitted for production review yet.

---

## 🎯 What's Needed to Complete This Feature

### **1. Google Wallet Console - Production Submission (REQUIRED)**

**Action Required:** Submit your pass class for production review in Google Wallet Console.

#### Steps:

1. **Go to Google Wallet Console**
   - Navigate to: https://pay.google.com/business/console
   - Sign in with your Google account that has access to the project

2. **Find Your Pass Class**
   - Look for: `3388000000023032672.xscard_business_card_v1`
   - Or search for "xscard_business_card_v1"

3. **Submit for Production Review**
   - Click on the pass class
   - Look for a "Submit for Review" or "Request Production Access" button
   - Fill out any required information:
     - **App/Website URL**: Your app's store listing or website
     - **Description**: Brief description of what the pass is used for
     - **Support Contact**: Your support email
   - Submit the request

4. **Wait for Approval**
   - Google typically reviews within **1-3 business days**
   - You'll receive an email when approved/rejected
   - Once approved, the "test mode" label will disappear automatically

#### What Happens After Approval:
- ✅ Passes will no longer show "test mode" label
- ✅ Any user can add passes (no test user restrictions)
- ✅ No code changes needed - it works automatically

---

### **2. Code Side - Optional Enhancements**

The code is **already production-ready**. No changes are required, but here are optional improvements:

#### Optional: Add Class Status Check Method

You could add a method to check if the class is in production:

```javascript
/**
 * Check if the pass class is approved for production use
 * @returns {Promise<{isProduction: boolean, status: string, message: string}>}
 */
async checkClassStatus() {
  await this.initializeAuth();
  const classId = `${this.issuerId}.${this.classId}`;

  try {
    const classData = await this.walletObjects.genericclass.get({ resourceId: classId });
    const reviewStatus = classData.data.reviewStatus || 'UNKNOWN';
    
    const isProduction = reviewStatus === 'APPROVED';
    
    return {
      isProduction,
      status: reviewStatus,
      message: isProduction 
        ? 'Class is approved for production use'
        : `Class is in ${reviewStatus} status. Passes may only work for test users until approved for production.`,
    };
  } catch (error) {
    return {
      isProduction: false,
      status: 'NOT_FOUND',
      message: 'Class not found. It will be created in test mode on first use.',
    };
  }
}
```

#### Optional: Add Production Readiness Check Script

Create `backend/check-wallet-production-status.js`:

```javascript
require('dotenv').config();
const GoogleWalletService = require('./services/googleWalletService');

async function checkProductionStatus() {
  const service = new GoogleWalletService();
  
  try {
    await service.initializeAuth();
    const status = await service.checkClassStatus();
    
    console.log('\n📊 Google Wallet Class Status:');
    console.log(`Status: ${status.status}`);
    console.log(`Production Ready: ${status.isProduction ? '✅ YES' : '❌ NO'}`);
    console.log(`Message: ${status.message}\n`);
    
    if (!status.isProduction) {
      console.log('📝 Next Steps:');
      console.log('1. Go to https://pay.google.com/business/console');
      console.log('2. Find your pass class and submit for production review');
      console.log('3. Wait for Google approval (typically 1-3 business days)\n');
    }
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
  }
}

checkProductionStatus();
```

---

### **3. Environment Variables (Already Configured ✅)**

Your current `.env` setup is correct:

```env
# Google Wallet Configuration
GOOGLE_WALLET_ISSUER_ID=3388000000023032672
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=your-service-account@...
GOOGLE_WALLET_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_WALLET_CLASS_ID=xscard_business_card_v1

# Optional: Test users (only needed in TEST mode)
GOOGLE_WALLET_TEST_USERS=tshehlap@gmail.com
```

**Note:** Once in production, `GOOGLE_WALLET_TEST_USERS` is no longer needed (but keeping it won't hurt).

---

## 📋 Production Readiness Checklist

- [x] ✅ Google Wallet API enabled
- [x] ✅ Service account created and configured
- [x] ✅ Environment variables set
- [x] ✅ Pass generation working in TEST mode
- [x] ✅ Test user added and verified
- [ ] ⏳ **Submit pass class for production review** ← **YOU ARE HERE**
- [ ] ⏳ Wait for Google approval
- [ ] ⏳ Verify production passes work (no "test mode" label)

---

## 🔍 How to Verify Production Status

### Method 1: Google Wallet Console
1. Go to https://pay.google.com/business/console
2. Find your pass class
3. Check the status badge/indicator
4. Look for "Approved" or "In Review" status

### Method 2: API Check (if you add the optional method)
```bash
node backend/check-wallet-production-status.js
```

### Method 3: Test Pass
- Create a new pass
- Add it to Google Wallet
- Check if "test mode" label appears
  - ✅ No label = Production mode
  - ⚠️ Has label = Still in TEST mode

---

## 🚨 Important Notes

1. **No Code Changes Needed**: Once Google approves your class, production mode activates automatically. Your existing code will work as-is.

2. **Test Users**: In TEST mode, only explicitly added test users can add passes. In production, anyone can add passes.

3. **Review Time**: Google typically takes 1-3 business days to review. You'll get an email notification.

4. **Rejection**: If rejected, Google will provide feedback. Address the issues and resubmit.

5. **Multiple Classes**: If you create new pass classes in the future, each needs to be submitted separately for production review.

---

## 🎉 Summary

**What You Need to Do:**
1. ✅ Code is done - no changes needed
2. ✅ Config is done - environment variables are set
3. ⏳ **Submit pass class for production review in Google Wallet Console** ← Only remaining step
4. ⏳ Wait for approval (1-3 business days)

**After Approval:**
- Passes will automatically work in production mode
- No "test mode" label
- No code changes needed
- Feature is complete! 🎊

---

## 📞 Support

If you encounter issues during the review process:
- Check Google Wallet Console for status updates
- Review any rejection feedback from Google
- Ensure your app/website is publicly accessible (if required)
- Verify all required information is provided in the submission

