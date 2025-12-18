# Native Wallet Selective Implementation Plan
## Using Minimal Essential Approach (Poop/Cement Principles)

**Branch**: `native-wallet-integration`  
**Base**: `qa` branch  
**Source**: `nativewallet` branch  
**Principle**: Only implement essential functions, keep it simple and maintainable

---

## 🎯 **Core Principle: Minimal Viable Implementation**

**What we're doing**: Selectively extracting ONLY the essential functions from `nativewallet` branch to replace Passcreator dependency while maintaining simplicity.

**What we're NOT doing**: 
- ❌ Complex template system (keep it simple - one template)
- ❌ RBAC for templates (not needed initially)
- ❌ Preview feature (nice-to-have, skip for now)
- ❌ Mock mode complexity (simplify)
- ❌ Multiple service layers (consolidate)

---

## 📋 **Phase 1: Essential Backend Services (Core Only)**

### **1.1 Create Unified Wallet Service** ⭐ **ESSENTIAL**

**File**: `backend/services/walletPassService.js` (NEW)

**What to extract from nativewallet**:
- ✅ Platform detection logic
- ✅ Basic pass generation routing (iOS/Android)
- ✅ Simple error handling
- ✅ Certificate validation (basic)

**What to SKIP**:
- ❌ Template system complexity
- ❌ RBAC logic
- ❌ Mock mode complexity
- ❌ Multiple template support

**Simplified Structure**:
```javascript
class WalletPassService {
  // Simple platform routing
  async generatePass(platform, cardData, userId, cardIndex, saveContactUrl) {
    if (platform === 'ios') {
      return await this.generateApplePass(cardData, userId, cardIndex, saveContactUrl);
    } else {
      return await this.generateGooglePass(cardData, userId, cardIndex, saveContactUrl);
    }
  }
  
  // Simple validation
  validateConfiguration() { /* basic checks */ }
}
```

**Dependencies to add**:
- `passkit-generator@^3.1.8` (for Apple Wallet)

---

### **1.2 Create Apple Wallet Service** ⭐ **ESSENTIAL**

**File**: `backend/services/appleWalletService.js` (NEW)

**What to extract from nativewallet**:
- ✅ PKPass generation using `passkit-generator`
- ✅ Certificate loading
- ✅ Image downloading and embedding
- ✅ Basic pass.json structure (hardcoded simple template)
- ✅ QR code generation

**What to SKIP**:
- ❌ Template system
- ❌ Complex field mapping
- ❌ Multiple template support

**Simplified Structure**:
```javascript
class AppleWalletService {
  async generatePass(cardData, userId, cardIndex, saveContactUrl) {
    const pass = new PKPass();
    
    // Simple hardcoded structure
    pass.passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID;
    pass.teamIdentifier = process.env.APPLE_TEAM_ID;
    pass.organizationName = 'XS Card';
    pass.description = 'Digital Business Card';
    
    // Simple fields
    pass.addPrimaryField('name', `${cardData.name} ${cardData.surname}`);
    pass.addSecondaryField('company', cardData.company);
    pass.addSecondaryField('email', cardData.email);
    
    // Barcode
    pass.addBarcode({ message: saveContactUrl, format: 'PKBarcodeFormatQR' });
    
    // Images
    await this.addImages(pass, cardData);
    
    // Certificates
    await this.loadCertificates(pass);
    
    return await pass.generate();
  }
}
```

---

### **1.3 Create Google Wallet Service** ⭐ **ESSENTIAL**

**File**: `backend/services/googleWalletService.js` (NEW)

**What to extract from nativewallet**:
- ✅ Google Wallet API authentication
- ✅ Simple pass object creation
- ✅ Save URL generation

**What to SKIP**:
- ❌ Complex template system
- ❌ Pass class management complexity
- ❌ Multiple template support

**Simplified Structure**:
```javascript
class GoogleWalletService {
  async generatePass(cardData, userId, cardIndex, saveContactUrl) {
    // Simple pass object
    const passObject = {
      id: `${userId}_${cardIndex}_${Date.now()}`,
      classId: process.env.GOOGLE_WALLET_CLASS_ID,
      cardTitle: { defaultValue: { value: `${cardData.name} ${cardData.surname}` } },
      subheader: { defaultValue: { value: cardData.occupation } },
      header: { defaultValue: { value: cardData.company } },
      barcode: { type: 'QR_CODE', value: saveContactUrl }
    };
    
    // Create via API
    const result = await this.walletObjects.genericobject.insert({ resource: passObject });
    
    // Return save URL
    return `https://pay.google.com/gp/v/save/${result.data.id}`;
  }
}
```

**Dependencies to add**:
- `googleapis` (if not already present)

---

### **1.4 Update Card Controller** ⭐ **ESSENTIAL**

**File**: `backend/controllers/cardController.js` (MODIFY)

**What to change**:
- ✅ Replace Passcreator API call with native service
- ✅ Keep existing endpoint structure
- ✅ Keep existing error handling
- ✅ Add platform detection (simple User-Agent check)
- ✅ Maintain backward compatibility with response format

**What to keep from current**:
- ✅ Card data fetching logic
- ✅ Error handling structure
- ✅ Response format (adapt to native)

**Simplified Changes**:
```javascript
exports.createWalletPass = async (req, res) => {
  const { userId, cardIndex = 0 } = req.params;
  
  // Get card data (KEEP existing logic)
  const card = /* existing card fetch logic */;
  
  // Detect platform (SIMPLE)
  const userAgent = req.get('User-Agent') || '';
  const platform = userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'ios' : 'android';
  
  // Generate pass (NEW - replace Passcreator)
  const WalletPassService = require('../services/walletPassService');
  const walletService = new WalletPassService();
  
  const saveContactUrl = `${req.protocol}://${req.get('host')}/saveContact?userId=${userId}&cardIndex=${cardIndex}`;
  
  const passResult = await walletService.generatePass(platform, card, userId, cardIndex, saveContactUrl);
  
  // Return response (ADAPT to match current format)
  if (platform === 'ios') {
    // Return .pkpass file
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="card_${cardIndex}.pkpass"`);
    res.send(passResult);
  } else {
    // Return URL (like Passcreator did)
    res.json({
      message: 'Wallet pass created successfully',
      passPageUrl: passResult, // Google Wallet save URL
      cardIndex: cardIndex
    });
  }
};
```

---

## 📋 **Phase 2: Frontend Updates (Minimal Changes)**

### **2.1 Update CardsScreen** ⭐ **ESSENTIAL**

**File**: `src/screens/cards/CardsScreen.tsx` (MODIFY)

**What to change**:
- ✅ Handle binary response for iOS (.pkpass file)
- ✅ Handle JSON response for Android (URL)
- ✅ Keep existing UI/UX flow
- ✅ Keep existing error handling

**What to keep**:
- ✅ `handleAddToWallet()` function structure
- ✅ Image checking logic
- ✅ Loading states
- ✅ Error alerts

**Simplified Changes**:
```typescript
const createWalletPass = async (skipImages: boolean) => {
  setIsWalletLoading(true);
  try {
    const userId = await getUserId();
    const endpoint = ENDPOINTS.ADD_TO_WALLET
      .replace(':userId', userId)
      .replace(':cardIndex', currentPage.toString());
    
    const response = await authenticatedFetchWithRefresh(endpoint, {
      method: 'POST'
    });
    
    // Handle iOS (.pkpass file)
    if (Platform.OS === 'ios') {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      await Linking.openURL(url);
    } else {
      // Handle Android (JSON with URL)
      const data = await response.json();
      if (data.passPageUrl) {
        await Linking.openURL(data.passPageUrl);
      }
    }
  } catch (error) {
    // Keep existing error handling
  } finally {
    setIsWalletLoading(false);
  }
};
```

**Dependencies to check**:
- Ensure `expo-file-system` available (for file handling if needed)

---

## 📋 **Phase 3: Dependencies & Configuration**

### **3.1 Backend Dependencies** ⭐ **ESSENTIAL**

**File**: `backend/package.json` (MODIFY)

**Add**:
```json
{
  "dependencies": {
    "passkit-generator": "^3.1.8",
    "googleapis": "^latest" // if not present
  }
}
```

**Install**:
```bash
cd backend
npm install passkit-generator googleapis
```

---

### **3.2 Environment Variables** ⭐ **ESSENTIAL**

**File**: `backend/.env` (MODIFY)

**Add** (for production):
```bash
# Apple Wallet (when certificates ready)
APPLE_PASS_TYPE_ID=pass.com.xscard.businesscard
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_PASS_CERT_PATH=./certificates/passcert.pem
APPLE_PASS_KEY_PATH=./certificates/passkey.pem
APPLE_WWDR_CERT_PATH=./certificates/wwdr.pem

# Google Wallet (when service account ready)
GOOGLE_WALLET_ISSUER_ID=YOUR_ISSUER_ID
GOOGLE_WALLET_SERVICE_ACCOUNT_PATH=./certificates/google-wallet-service-account.json
GOOGLE_WALLET_CLASS_ID=xscard_business_card_v1
```

**For now (development)**:
- Can work without certificates (will fail gracefully)
- Or use Passcreator as fallback initially

---

## 📋 **Phase 4: Migration Strategy**

### **4.1 Feature Flag Approach** ⭐ **RECOMMENDED**

**Strategy**: Add feature flag to switch between Passcreator and native

**Implementation**:
```javascript
// In cardController.js
exports.createWalletPass = async (req, res) => {
  const useNative = process.env.USE_NATIVE_WALLET === 'true';
  
  if (useNative) {
    // Use native implementation
    return await createNativeWalletPass(req, res);
  } else {
    // Use Passcreator (existing code)
    return await createPasscreatorWalletPass(req, res);
  }
};
```

**Benefits**:
- ✅ Can test native without breaking production
- ✅ Easy rollback if issues
- ✅ Gradual migration

---

### **4.2 Fallback Strategy** ⭐ **RECOMMENDED**

**Strategy**: Try native first, fallback to Passcreator on error

**Implementation**:
```javascript
exports.createWalletPass = async (req, res) => {
  try {
    // Try native first
    return await createNativeWalletPass(req, res);
  } catch (error) {
    if (error.message.includes('certificates not configured')) {
      // Fallback to Passcreator
      console.log('Native wallet not configured, using Passcreator');
      return await createPasscreatorWalletPass(req, res);
    }
    throw error;
  }
};
```

---

## 📋 **Phase 5: Testing & Validation**

### **5.1 Testing Checklist**

**Backend**:
- [ ] Service initializes without errors
- [ ] Platform detection works
- [ ] Apple Wallet generates .pkpass (with certificates)
- [ ] Google Wallet generates URL (with service account)
- [ ] Error handling works (missing certificates)
- [ ] Image downloading works
- [ ] QR code generation works

**Frontend**:
- [ ] iOS: .pkpass file opens in Wallet
- [ ] Android: URL opens Google Wallet
- [ ] Error messages display correctly
- [ ] Loading states work
- [ ] Image warnings still work

**Integration**:
- [ ] End-to-end flow works
- [ ] Backward compatibility maintained
- [ ] No breaking changes to API

---

## 📋 **Phase 6: What We're NOT Implementing (For Now)**

### **6.1 Skipped Features** ❌

- ❌ **Template System**: Keep it simple - one hardcoded template
- ❌ **RBAC Templates**: Not needed initially
- ❌ **Preview Feature**: Nice-to-have, skip for now
- ❌ **Mock Mode**: Too complex, skip for now
- ❌ **Multiple Templates**: One template is enough
- ❌ **Pass Updates**: Not needed initially
- ❌ **Push Notifications**: Not needed initially

**Rationale**: Keep it simple, get it working, add features later if needed.

---

## 🎯 **Implementation Order**

### **Step 1: Backend Core (Day 1)**
1. Create `walletPassService.js` (simplified)
2. Create `appleWalletService.js` (simplified)
3. Create `googleWalletService.js` (simplified)
4. Install dependencies

### **Step 2: Backend Integration (Day 1-2)**
5. Update `cardController.js` with feature flag
6. Test backend services independently
7. Test error handling

### **Step 3: Frontend Updates (Day 2)**
8. Update `CardsScreen.tsx` to handle binary/JSON responses
9. Test iOS flow
10. Test Android flow

### **Step 4: Integration Testing (Day 2-3)**
11. End-to-end testing
12. Error scenario testing
13. Backward compatibility testing

### **Step 5: Production Setup (When Ready)**
14. Configure Apple certificates
15. Configure Google service account
16. Enable feature flag
17. Monitor and validate

---

## 📊 **File Changes Summary**

### **New Files** (3)
- `backend/services/walletPassService.js`
- `backend/services/appleWalletService.js`
- `backend/services/googleWalletService.js`

### **Modified Files** (2)
- `backend/controllers/cardController.js`
- `src/screens/cards/CardsScreen.tsx`

### **Configuration** (2)
- `backend/package.json` (add dependencies)
- `backend/.env` (add environment variables)

---

## ✅ **Success Criteria**

1. ✅ Passcreator dependency removed (or optional)
2. ✅ Apple Wallet passes generate natively
3. ✅ Google Wallet passes generate natively
4. ✅ Existing frontend flow works
5. ✅ Error handling works
6. ✅ Backward compatibility maintained
7. ✅ Code is simple and maintainable

---

## 🚨 **Risks & Mitigations**

### **Risk 1: Certificate Setup Complexity**
- **Mitigation**: Feature flag allows gradual migration, Passcreator fallback

### **Risk 2: Breaking Changes**
- **Mitigation**: Maintain API response format, test thoroughly

### **Risk 3: Image Download Failures**
- **Mitigation**: Keep existing image handling logic, graceful fallback

### **Risk 4: Platform Detection Issues**
- **Mitigation**: Simple User-Agent check, can add query parameter override

---

## 📝 **Notes**

- **Principle**: Keep it simple, only essential features
- **Approach**: Minimal viable implementation
- **Strategy**: Feature flag for safe migration
- **Timeline**: 2-3 days for core implementation
- **Testing**: Critical before production enable

---

## 🎉 **Next Steps**

1. Review this plan
2. Start with Step 1 (Backend Core)
3. Test incrementally
4. Enable feature flag when ready
5. Monitor and iterate

**Remember**: We're keeping it simple. Only essential functions, no complexity.

