# ✅ RevenueCat Configuration Checklist

Print this and check off as you go!

---

## 📋 Step 1: Get RevenueCat API Keys

**Where**: https://app.revenuecat.com/settings/keys

| Key Type                | Example Prefix | Where to put it?         |
|-------------------------|---------------|--------------------------|
| Secret Key              | `sk_`         | **backend** `.env`       |
| iOS Public Key          | `appl_`       | **frontend** `.env`      |
| Android Public Key      | `goog_`       | **frontend** `.env`      |

- [x] Secret Key (starts with `sk_`) — **backend** `.env`
- [x] iOS Public Key (starts with `appl_`) — **frontend** `.env`
- [x] Android Public Key (starts with `goog_`) — **frontend** `.env`

> **Note:**  
> - The **Secret Key** is sensitive and must only be used on the backend.  
> - The **Public Keys** are safe for the frontend and required for app initialization.

---

## 📋 Step 2: Configure Webhook

**Where**: https://app.revenuecat.com/settings/integrations

- [ ] Clicked "Add Webhook"
- [ ] URL set to: `https://yourdomain.com/api/revenuecat/webhook`
- [ ] Authorization token generated and copied
- [ ] All events selected (Initial Purchase, Renewal, Cancellation, etc.)
- [ ] Webhook saved

---

## 📋 Step 3: Create Products

### iOS Products
**Where**: https://appstoreconnect.apple.com → Your App → In-App Purchases

- [ ] Monthly subscription created
- [ ] Monthly Product ID copied (e.g., `com.xscard.monthly`)
- [ ] Annual subscription created
- [ ] Annual Product ID copied (e.g., `com.xscard.annual`)
- [ ] Both products published

### Android Products
**Where**: https://play.google.com/console → Your App → Monetize → Subscriptions

- [ ] Monthly subscription created
- [ ] Monthly Product ID copied (e.g., `com.xscard.monthly`)
- [ ] Annual subscription created
- [ ] Annual Product ID copied (e.g., `com.xscard.annual`)
- [ ] Both products published

---

## 📋 Step 4: Create Entitlement

**Where**: https://app.revenuecat.com → Your Project → Entitlements

- [ ] New entitlement created (name: "Premium")
- [ ] Entitlement identifier copied (e.g., `premium`)
- [ ] iOS Monthly product attached to entitlement
- [ ] iOS Annual product attached to entitlement
- [ ] Android Monthly product attached to entitlement
- [ ] Android Annual product attached to entitlement
- [ ] Entitlement saved

---

## 📋 Step 5: Get App Store Shared Secret (iOS only)

**Where**: https://appstoreconnect.apple.com → Your App → App-Specific Shared Secret

- [ ] Shared secret generated/copied

---

## 📋 Step 6: Update Backend Configuration

**File**: `backend/.env`

Add these lines (replace `your_value` with actual values):

- [ ] `REVENUECAT_SECRET_KEY=sk_your_value`
- [ ] `REVENUECAT_IOS_PUBLIC_KEY=appl_your_value`
- [ ] `REVENUECAT_ANDROID_PUBLIC_KEY=goog_your_value`
- [ ] `REVENUECAT_WEBHOOK_AUTH_TOKEN=your_value`
- [ ] `REVENUECAT_IOS_MONTHLY_PRODUCT_ID=com.xscard.monthly`
- [ ] `REVENUECAT_IOS_ANNUAL_PRODUCT_ID=com.xscard.annual`
- [ ] `REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID=com.xscard.monthly`
- [ ] `REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID=com.xscard.annual`
- [ ] `REVENUECAT_ENTITLEMENT_ID=premium`
- [ ] `APPSTORE_SHARED_SECRET=your_value` (iOS only)
- [ ] File saved

---

## 📋 Step 7: Update Frontend Configuration

**File**: `src/screens/Unlockpremium/UnlockPremium.tsx`

Find line ~98 and update:

```typescript
const apiKey = Platform.OS === 'ios' 
  ? 'appl_YOUR_IOS_KEY'      // ← Replace with your iOS key
  : 'goog_YOUR_ANDROID_KEY'; // ← Replace with your Android key
```

- [ ] iOS Public Key added
- [ ] Android Public Key added
- [ ] File saved

---

## 📋 Step 8: Test Configuration

### Backend Test

```bash
cd backend
node test-revenuecat-config.js
```

- [ ] Command runs without errors
- [ ] All required items show ✅ green checks
- [ ] No ❌ red X marks on required items
- [ ] At least one platform fully configured

### Restart Backend

```bash
cd backend
npm start
```

- [ ] Server starts without errors
- [ ] See: "RevenueCat configuration loaded"
- [ ] No configuration warnings

---

## 📋 Step 9: Rebuild Mobile App

### Android

```bash
npm run android
```

- [ ] Build completes successfully
- [ ] App opens without crashes
- [ ] Check logs for: "RevenueCat: Successfully configured for android"

### iOS (when ready)

```bash
npm run ios
```

- [ ] Build completes successfully
- [ ] App opens without crashes
- [ ] Check logs for: "RevenueCat: Successfully configured for ios"

---

## 📋 Step 10: Test Purchase Flow

### Sandbox Purchase Test

- [ ] Opened app on device/emulator
- [ ] Navigated to UnlockPremium screen
- [ ] See monthly and annual plan options
- [ ] Selected a plan
- [ ] Tapped subscribe button
- [ ] Completed purchase with test account
- [ ] Saw success message
- [ ] Backend logs show webhook received
- [ ] Backend logs show "✅ Atomic update completed"
- [ ] Firestore `users` collection updated
- [ ] Firestore `subscriptions` collection has entry
- [ ] Firestore `subscriptionLogs` has event log

---

## 📋 Step 11: Verify Database

**Check Firestore Console**

### users/{userId} document

- [ ] `plan: "premium"` ✅
- [ ] `subscriptionStatus: "active"` ✅
- [ ] `subscriptionPlatform: "revenuecat"` ✅
- [ ] `revenueCat` object present ✅
- [ ] `subscriptionStart` timestamp present ✅
- [ ] `subscriptionEnd` timestamp present ✅

### subscriptions/{userId} document

- [ ] Document exists ✅
- [ ] `platform: "revenuecat"` ✅
- [ ] `status: "active"` ✅
- [ ] `productId` present ✅
- [ ] `revenueCatData` object present ✅

### subscriptionLogs collection

- [ ] Log entry exists ✅
- [ ] `eventType` present ✅
- [ ] `platform: "revenuecat"` ✅
- [ ] `verificationStatus: "verified"` ✅

---

## 📋 Step 12: Test Restore Purchases

- [ ] Uninstalled app
- [ ] Reinstalled app
- [ ] Logged in with same account
- [ ] Tapped "Restore Purchases" button
- [ ] Subscription restored successfully
- [ ] Premium features accessible

---

## 📋 Step 13: Test Subscription Status

### Via API

```bash
curl -X GET https://your-domain.com/api/revenuecat/status \
  -H "Authorization: Bearer USER_TOKEN"
```

- [ ] Returns status successfully
- [ ] Shows `isActive: true`
- [ ] Shows `plan: "premium"`
- [ ] Expiration date present

### In App

- [ ] Subscription status displayed correctly
- [ ] Premium features unlocked
- [ ] UI shows active subscription
- [ ] Expiration date shown (if applicable)

---

## 📋 Step 14: Test Manual Sync

### Via API

```bash
curl -X POST https://your-domain.com/api/revenuecat/sync \
  -H "Authorization: Bearer USER_TOKEN"
```

- [ ] Sync completes successfully
- [ ] Database updated
- [ ] Status reflects latest from RevenueCat

---

## 🎉 Final Checklist

- [ ] Backend configuration complete
- [ ] Frontend configuration complete
- [ ] Test script passes
- [ ] Webhook configured
- [ ] Products created and attached
- [ ] Sandbox purchase successful
- [ ] Database updates correctly
- [ ] Restore purchases works
- [ ] Status endpoint works
- [ ] Manual sync works
- [ ] Logs show no errors
- [ ] Ready for production testing

---

## 📊 Success Criteria

### All Must Be True:

✅ Configuration test shows all green  
✅ Backend starts without warnings  
✅ Sandbox purchase completes  
✅ Webhook received and processed  
✅ Database updated atomically  
✅ Subscription logs created  
✅ User shows as premium  
✅ Restore purchases works  

---

## 🚀 Ready for Production?

Before going live:

- [ ] Tested with real test purchases
- [ ] Verified refunds work
- [ ] Tested subscription cancellation
- [ ] Tested subscription renewal
- [ ] Tested expired subscription
- [ ] Monitored webhook reliability
- [ ] Set up production keys
- [ ] Updated webhook URL to production
- [ ] Tested production webhook
- [ ] Set up monitoring/alerts

---

## 📞 Need Help?

- **Configuration**: See `REVENUECAT_ENVIRONMENT_SETUP.md`
- **Quick Start**: See `QUICK_START_REVENUECAT.md`
- **Implementation**: See `REVENUECAT_IMPLEMENTATION_SUMMARY.md`
- **Test Script**: Run `node backend/test-revenuecat-config.js`

---

**Date Completed**: ____________

**Tested By**: ____________

**Production Ready**: [ ] YES  [ ] NO

**Notes**:
_______________________________________________
_______________________________________________
_______________________________________________





