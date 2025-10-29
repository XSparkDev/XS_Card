# 🚀 RevenueCat Quick Start - Configuration Checklist

## ⚡ What You Need to Do NOW

### Step 1: Get These from RevenueCat Dashboard
Visit: https://app.revenuecat.com

```bash
# Go to Settings → API Keys
REVENUECAT_SECRET_KEY=sk_________________
REVENUECAT_IOS_PUBLIC_KEY=appl_________________
REVENUECAT_ANDROID_PUBLIC_KEY=goog_________________

# Go to Settings → Integrations → Webhooks
REVENUECAT_WEBHOOK_AUTH_TOKEN=________________
```

### Step 2: Get Product IDs

**iOS** (App Store Connect): https://appstoreconnect.apple.com
```bash
REVENUECAT_IOS_MONTHLY_PRODUCT_ID=com.xscard.monthly
REVENUECAT_IOS_ANNUAL_PRODUCT_ID=com.xscard.annual
```

**Android** (Google Play Console): https://play.google.com/console
```bash
REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID=com.xscard.monthly
REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID=com.xscard.annual
```

### Step 3: Create Entitlement
In RevenueCat Dashboard → Entitlements:
```bash
REVENUECAT_ENTITLEMENT_ID=premium
```

### Step 4: Add to Backend `.env`
File location: `backend/.env`

```bash
# Paste all the values you got above:
REVENUECAT_SECRET_KEY=sk_your_actual_key_here
REVENUECAT_IOS_PUBLIC_KEY=appl_your_actual_key_here
REVENUECAT_ANDROID_PUBLIC_KEY=goog_your_actual_key_here
REVENUECAT_WEBHOOK_AUTH_TOKEN=your_actual_token_here
REVENUECAT_IOS_MONTHLY_PRODUCT_ID=com.xscard.monthly
REVENUECAT_IOS_ANNUAL_PRODUCT_ID=com.xscard.annual
REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID=com.xscard.monthly
REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID=com.xscard.annual
REVENUECAT_ENTITLEMENT_ID=premium
```

### Step 5: Add to Frontend
File: `src/screens/Unlockpremium/UnlockPremium.tsx`

Find line ~98 and replace the hardcoded key:
```typescript
const apiKey = Platform.OS === 'ios' 
  ? 'appl_your_ios_public_key'  // <-- Paste your iOS key
  : 'goog_your_android_public_key'; // <-- Paste your Android key
```

### Step 6: Configure Webhook in RevenueCat
In RevenueCat Dashboard → Integrations → Webhooks:
- **URL**: `https://your-domain.com/api/revenuecat/webhook`
- **Authorization**: Paste the token from REVENUECAT_WEBHOOK_AUTH_TOKEN
- **Events**: Select ALL

---

## ✅ Verification

### Check Backend:
```bash
cd backend
npm start

# Look for in logs:
✅ "RevenueCat configuration loaded"
```

### Check Frontend:
```bash
npm run android  # or npm run ios

# In app, check console logs:
✅ "RevenueCat: Successfully configured for android"
```

---

## 🧪 Quick Test

### Test Backend Webhook:
```bash
curl -X POST http://localhost:8383/api/revenuecat/webhook \
  -H "Authorization: Bearer YOUR_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":{"type":"TEST","app_user_id":"test"}}'

# Expected: HTTP 200 OK
```

### Test Mobile Purchase:
1. Open app on Android device/emulator
2. Go to UnlockPremium screen
3. Select a plan
4. Complete test purchase
5. Check backend logs for webhook
6. Check Firestore for updated user

---

## 📋 Configuration Locations

| What | Where to Get | Where to Put (Backend) | Where to Put (Frontend) |
|------|--------------|------------------------|--------------------------|
| Secret Key | RevenueCat Settings → API Keys | `backend/.env` | ❌ DON'T |
| iOS Public Key | RevenueCat Settings → API Keys | `backend/.env` | `UnlockPremium.tsx:98` |
| Android Public Key | RevenueCat Settings → API Keys | `backend/.env` | `UnlockPremium.tsx:98` |
| Webhook Token | RevenueCat Settings → Integrations | `backend/.env` | ❌ DON'T |
| Product IDs | App Store / Play Console | `backend/.env` | ✅ Auto-loaded |
| Entitlement ID | RevenueCat → Entitlements | `backend/.env` | ✅ Auto-loaded |

---

## 🚨 Security Reminders

- ✅ Secret Key (`sk_`) = Backend ONLY
- ✅ Public Keys (`appl_`, `goog_`) = Frontend OK
- ✅ Webhook Token = Backend ONLY
- ❌ NEVER commit actual keys to Git
- ❌ NEVER expose Secret Key in frontend

---

## 📞 Need Help?

1. **Detailed Setup**: See `REVENUECAT_ENVIRONMENT_SETUP.md`
2. **Implementation Details**: See `REVENUECAT_IMPLEMENTATION_SUMMARY.md`
3. **Code Reference**: Check comments in:
   - `backend/controllers/revenueCatController.js`
   - `src/services/revenueCatService.ts`

---

## 🎯 After Configuration

Once you've added all values:

1. Restart backend: `cd backend && npm start`
2. Rebuild app: `npm run android`
3. **We meet in the middle** - Ready to test! 🚀

---

**Current Status**: ✅ Code Complete - Waiting for Your Configuration
**Next Step**: Add environment variables and we can start testing!




