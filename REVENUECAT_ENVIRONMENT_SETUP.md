# RevenueCat Environment Setup Guide

This guide explains all the environment variables you need to configure for RevenueCat integration.

## 🔑 Required Environment Variables

### Backend Configuration (`backend/.env`)

```bash
# ============================================
# REVENUECAT CONFIGURATION
# ============================================

# RevenueCat API Keys
# Get these from: https://app.revenuecat.com/settings/keys
REVENUECAT_SECRET_KEY=sk_xxxxxxxxxxxxxxxxxx          # Secret API Key (for backend verification)
REVENUECAT_IOS_PUBLIC_KEY=appl_xxxxxxxxxxxxxx        # iOS Public API Key
REVENUECAT_ANDROID_PUBLIC_KEY=goog_xxxxxxxxxxxxxx    # Android Public API Key

# Webhook Configuration
# Get this from: https://app.revenuecat.com/settings/integrations
REVENUECAT_WEBHOOK_AUTH_TOKEN=xxxxxxxxxxxxx          # Webhook Authorization Token

# Product Configuration
# These are your product IDs from App Store Connect / Google Play Console
REVENUECAT_IOS_MONTHLY_PRODUCT_ID=com.xscard.monthly
REVENUECAT_IOS_ANNUAL_PRODUCT_ID=com.xscard.annual
REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID=com.xscard.monthly
REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID=com.xscard.annual

# Entitlement Configuration
# This is the entitlement identifier you create in RevenueCat dashboard
REVENUECAT_ENTITLEMENT_ID=premium

# App Store Configuration (iOS only - for receipt validation)
APPSTORE_SHARED_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Frontend Configuration

The frontend will load API keys from your app configuration. You have two options:

#### Option 1: Environment Variables (if using EAS/Expo)
Add to `app.config.js`:

```javascript
export default {
  // ... existing config
  extra: {
    revenueCat: {
      iosPublicKey: process.env.REVENUECAT_IOS_PUBLIC_KEY,
      androidPublicKey: process.env.REVENUECAT_ANDROID_PUBLIC_KEY,
    }
  }
};
```

#### Option 2: Constants File (Recommended)
Create `src/config/revenueCat.ts`:

```typescript
export const REVENUECAT_CONFIG = {
  API_KEYS: {
    ios: 'appl_xxxxxxxxxxxxxx',      // Your iOS Public Key
    android: 'goog_xxxxxxxxxxxxxx',  // Your Android Public Key
  },
  ENTITLEMENT_ID: 'premium',
};
```

---

## 📋 How to Get These Values

### 1. RevenueCat API Keys

**Location**: https://app.revenuecat.com/settings/keys

**Steps**:
1. Log in to RevenueCat dashboard
2. Go to Settings → API Keys
3. You'll find:
   - **Secret API Key** (starts with `sk_`) - Use for backend
   - **Public API Keys**:
     - iOS key (starts with `appl_`)
     - Android key (starts with `goog_`)

**⚠️ CRITICAL**: 
- Keep Secret Key (`sk_`) secure - NEVER expose in frontend
- Public keys can be in frontend code

---

### 2. Webhook Authorization Token

**Location**: https://app.revenuecat.com/settings/integrations

**Steps**:
1. Go to Settings → Integrations
2. Find "Webhooks" section
3. Click "Add Webhook"
4. Set URL to: `https://yourdomain.com/api/revenuecat/webhook`
5. Generate and copy the Authorization Token
6. Select events to send (select all for now)

**Events to Enable**:
- ✅ Initial Purchase
- ✅ Renewal
- ✅ Cancellation
- ✅ Expiration
- ✅ Billing Issue
- ✅ Product Change

---

### 3. Product IDs

**For iOS (App Store Connect)**:

**Location**: https://appstoreconnect.apple.com

**Steps**:
1. Go to App Store Connect
2. Select your app → In-App Purchases
3. Create new subscriptions (if not already created):
   - Product ID: `com.xscard.monthly` (recommended format)
   - Product ID: `com.xscard.annual`
4. Copy the exact Product IDs

**For Android (Google Play Console)**:

**Location**: https://play.google.com/console

**Steps**:
1. Go to Google Play Console
2. Select your app → Monetize → Subscriptions
3. Create new subscriptions:
   - Product ID: `com.xscard.monthly`
   - Product ID: `com.xscard.annual`
4. Copy the exact Product IDs

**💡 TIP**: Use the same product IDs for both platforms if possible

---

### 4. Entitlement ID

**Location**: https://app.revenuecat.com/projects/[your-project]/entitlements

**Steps**:
1. Go to RevenueCat → Project Settings → Entitlements
2. Create a new entitlement:
   - Name: "Premium" (or your preferred name)
   - Identifier: `premium` (this goes in environment variable)
3. Attach your products (monthly & annual) to this entitlement

---

### 5. App Store Shared Secret (iOS only)

**Location**: https://appstoreconnect.apple.com

**Steps**:
1. Go to App Store Connect
2. Select your app → App-Specific Shared Secret
3. Generate if not exists
4. Copy the secret

---

## 🔍 Verification Checklist

Before testing, verify you have:

- [  ] RevenueCat Secret Key (`sk_...`) in backend `.env`
- [ ] iOS Public Key (`appl_...`) in backend `.env` and frontend config
- [ ] Android Public Key (`goog_...`) in backend `.env` and frontend config
- [ ] Webhook Auth Token in backend `.env`
- [ ] Webhook URL configured in RevenueCat dashboard
- [ ] Product IDs match exactly between:
  - App Store Connect / Google Play Console
  - RevenueCat dashboard
  - Environment variables
- [ ] Entitlement created in RevenueCat
- [ ] Products attached to entitlement
- [ ] App Store Shared Secret (iOS only)

---

## 🧪 Testing Configuration

### Backend Test:
```bash
# From backend directory
cd backend

# Check if environment variables are loaded
node -e "require('dotenv').config(); console.log(process.env.REVENUECAT_SECRET_KEY ? '✅ Secret Key loaded' : '❌ Secret Key missing')"
```

### Frontend Test:
Update `src/screens/Unlockpremium/UnlockPremium.tsx` initialization:

```typescript
// In initializeRevenueCat function
const apiKey = Platform.OS === 'ios' 
  ? 'YOUR_IOS_PUBLIC_KEY'  // Replace with actual key
  : 'YOUR_ANDROID_PUBLIC_KEY'; // Replace with actual key

const configured = await revenueCatService.configure({
  apiKey: apiKey,
  userId: userId
});
```

---

## 🚨 Security Best Practices

1. **NEVER** commit actual keys to Git
2. **NEVER** expose Secret Key (`sk_`) in frontend
3. **ALWAYS** use environment variables for sensitive data
4. **ALWAYS** verify webhook signatures (already implemented)
5. **ALWAYS** verify purchases server-side (already implemented)

---

## 📁 File Structure

Your environment files should be:

```
backend/
  ├── .env                    # Backend environment variables
  └── .env.example            # Template (no actual keys)

src/
  └── config/
      └── revenueCat.ts       # Frontend config (public keys only)
```

---

## 🔗 Useful Links

- **RevenueCat Dashboard**: https://app.revenuecat.com
- **RevenueCat Docs**: https://docs.revenuecat.com
- **App Store Connect**: https://appstoreconnect.apple.com
- **Google Play Console**: https://play.google.com/console

---

## ✅ Ready to Test?

Once you have all environment variables set:

1. Restart your backend server
2. Rebuild your mobile app
3. Test subscription flow in sandbox/test mode
4. Check backend logs for webhook events
5. Verify database updates

---

## 🆘 Troubleshooting

### "RevenueCat not configured" error
- Check that API keys are correctly set
- Verify you're using the correct key for your platform
- Check backend logs for configuration warnings

### Webhook not receiving events
- Verify webhook URL is accessible (use tools like webhook.site to test)
- Check authorization token matches
- Ensure webhook events are enabled in RevenueCat dashboard

### Purchase succeeds but not reflected in database
- Check backend logs for webhook processing
- Manually sync: Call `/api/revenuecat/sync` endpoint
- Verify user ID matches between app and RevenueCat

---

**Need Help?** Check the implementation files:
- Backend: `backend/controllers/revenueCatController.js`
- Frontend: `src/services/revenueCatService.ts`
- Verification: `backend/services/revenueCatVerification.js`




