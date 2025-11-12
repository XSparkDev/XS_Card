# Google OAuth Implementation Plan

## Overview

Implement Google OAuth authentication as a POC, using Expo AuthSession (no native dependencies) to avoid the crashes from the previous native SDK approach. Design a provider-agnostic architecture that can easily extend to LinkedIn and Microsoft in the future.

## Architecture Principles

1. **Provider-Agnostic Design**: Create a unified OAuth interface that works for Google, LinkedIn, and Microsoft
2. **Firebase Integration**: All OAuth providers return Firebase credentials, maintaining existing auth flow
3. **No Native Dependencies**: Use Expo AuthSession to avoid native module configuration issues
4. **Cement/Poop Principle**: Identify stable code (cement) - don't modify it. Build small testable OAuth pieces (poop) alongside it. Test each piece. If issues found, revert to cement and fix. Repeat until stable (becomes new cement). Reuse cement infrastructure without changing it.
5. **Incremental Testing**: Test each small piece before proceeding. Each phase must be testable with predictable results.
6. **Backward Compatibility**: Email/password auth continues to work unchanged

## Implementation Phases

### Phase 0: Identify Cement (Cement) 🏗️

**Goal:** Identify what IS cement (stable code we won't modify) and establish baseline

**Files to Create:**
- `OAUTH_BASELINE_ASSESSMENT.md` - Document what is cement

**Key Actions:**

1. **Identify Cement (What We DON'T Touch):**
   - `src/screens/auth/SignInScreen.tsx` - Email/password sign-in logic
   - `src/utils/authStorage.ts` - Token storage functions
   - `src/context/AuthContext.tsx` - Auth state management
   - `backend/middleware/auth.js` - Token verification
   - `backend/controllers/userController.js` - Existing user endpoints

2. **Test Cement Works:**
   - Sign in with email/password → works
   - Token storage → works
   - Backend verification → works
   - Token refresh → works
   - Logout → works

3. **Commit to Not Modifying Cement:**
   - OAuth will be ADDED alongside, not replacing
   - Email/password code remains untouched
   - OAuth reuses cement (storage, verification) without changing it

**Success Criteria:**
- ✅ Cement identified and documented
- ✅ Cement tested and verified working
- ✅ Clear commitment: don't modify cement

**Revert Point:** If cement doesn't work, fix it first before adding OAuth

### Phase 1: OAuth Config (Poop → Cement) 💩→🏗️

**Goal:** Create OAuth configuration with structure for future providers. Small, testable piece.

**Files to Create:**
- `src/config/oauthConfig.ts` - OAuth configuration (Google + placeholders for LinkedIn/Microsoft)

**Files to Modify:**
- `.env` - Add `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

**Key Actions:**
1. Add Web Client ID to `.env`
2. Create config file with structure:
   ```typescript
   {
     google: { webClientId: '...' },
     linkedin: { webClientId: undefined }, // Future
     microsoft: { webClientId: undefined } // Future
   }
   ```
3. Test: Config file can be imported without errors

**Test:**
```typescript
import { oauthConfig } from './src/config/oauthConfig';
console.log(oauthConfig.google.webClientId); // Should log the ID
console.log(oauthConfig.linkedin); // Should exist (undefined for now)
```

**Success Criteria:**
- ✅ Config file exists and imports without errors
- ✅ Can read Google Web Client ID from env
- ✅ Structure includes LinkedIn/Microsoft placeholders (groundwork)
- ✅ No changes to cement code

**If Issues (Poop):**
- Revert config file
- Fix env variable
- Test again
- Repeat until stable → becomes cement

**Revert Point:** Delete `oauthConfig.ts` if it breaks anything

### Phase 2: Google OAuth Provider (Poop → Cement) 💩→🏗️

**Goal:** Build Google OAuth provider with types that support future providers. Testable in isolation.

**Files to Create:**
- `src/services/oauth/googleProvider.ts` - Google OAuth implementation
- `src/services/oauth/types.ts` - Types with Google + LinkedIn/Microsoft placeholders

**Key Actions:**
1. Install `expo-auth-session`: `npm install expo-auth-session`
2. Create types file with:
   ```typescript
   export type OAuthProviderType = 'google.com' | 'linkedin.com' | 'microsoft.com';
   // Future: linkedin.com, microsoft.com
   ```
3. Create Google provider that uses Expo AuthSession
4. Implement `signInWithGoogle()` function
5. Add comment: `// TODO: Add signInWithLinkedIn() and signInWithMicrosoft() here`
6. Test: Can call function (don't need full flow yet)

**Test:**
```typescript
import { signInWithGoogle } from './src/services/oauth/googleProvider';
import type { OAuthProviderType } from './src/services/oauth/types';
// Just verify it imports and function exists
console.log(typeof signInWithGoogle); // Should be 'function'
console.log(typeof OAuthProviderType); // Type exists
```

**Success Criteria:**
- ✅ Provider file exists and imports
- ✅ Types include LinkedIn/Microsoft (groundwork)
- ✅ Function can be called (even if not fully implemented)
- ✅ Comments indicate where to add future providers
- ✅ No changes to cement code

**If Issues (Poop):**
- Revert provider file
- Fix implementation
- Test again
- Repeat until stable → becomes cement

**Revert Point:** Delete provider files if they break anything

### Phase 3: Google Sign-In Button (Poop → Cement) 💩→🏗️

**Goal:** Add Google button to UI. Testable visually.

**Files to Modify:**
- `src/screens/auth/SignInScreen.tsx` - ADD Google button only

**Key Actions:**
1. Add Google sign-in button (UI only, no functionality yet)
2. Add loading state
3. Test: Button appears, doesn't break existing UI

**Test:**
- Open SignInScreen
- Google button visible
- Email/password form still works
- No crashes

**Success Criteria:**
- ✅ Button appears in UI
- ✅ Email/password form unchanged
- ✅ No crashes
- ✅ No changes to email/password logic (cement)

**If Issues (Poop):**
- Revert button addition
- Fix UI
- Test again
- Repeat until stable → becomes cement

**Revert Point:** Remove button code if it breaks UI

### Phase 4: Connect Button to OAuth Flow (Poop → Cement) 💩→🏗️

**Goal:** Connect button to OAuth. Testable end-to-end.

**Files to Modify:**
- `src/screens/auth/SignInScreen.tsx` - Connect button to provider

**Key Actions:**
1. Import Google provider
2. Add `handleGoogleSignIn` function
3. Connect button to handler
4. Convert Google token → Firebase credential
5. Sign in to Firebase
6. Get Firebase token
7. Call backend (reuse existing flow - cement)
8. Store auth data (reuse existing - cement)

**Test:**
- Click Google button
- Browser opens
- Sign in with Google
- Redirects back to app
- User authenticated
- Email/password still works (cement)

**Success Criteria:**
- ✅ Google sign-in works end-to-end
- ✅ Email/password still works (cement unchanged)
- ✅ Uses existing `storeAuthData()` (cement)
- ✅ Uses existing backend flow (cement)

**If Issues (Poop):**
- Revert handler code
- Fix OAuth flow
- Test again
- Repeat until stable → becomes cement

**Revert Point:** Remove handler, button becomes UI-only again

### Phase 5: Backend Auto-Provisioning (Poop → Cement) 💩→🏗️

**Goal:** Auto-create OAuth users in backend. Support all OAuth providers (Google now, LinkedIn/Microsoft later). Small, testable change.

**Files to Modify:**
- `backend/controllers/userController.js` - ADD auto-provisioning check only

**Key Actions:**
1. In `getUserById`, check if user exists
2. If not exists AND provider is OAuth (google.com, linkedin.com, or microsoft.com) → auto-create
3. Store `authProvider: 'google.com' | 'linkedin.com' | 'microsoft.com'` (support all)
4. Reuse existing user creation logic (cement)
5. Add comment: `// Supports: google.com (implemented), linkedin.com (future), microsoft.com (future)`
6. Test: New Google user auto-provisioned

**Test:**
- Sign in with new Google account
- Backend auto-creates user document with `authProvider: 'google.com'`
- User data returned correctly
- Email/password users unaffected (cement)

**Success Criteria:**
- ✅ New Google OAuth users auto-provisioned
- ✅ Code structure supports LinkedIn/Microsoft (groundwork)
- ✅ Existing email/password flow unchanged (cement)
- ✅ Backend token verification unchanged (cement)

**If Issues (Poop):**
- Revert auto-provisioning code
- Fix logic
- Test again
- Repeat until stable → becomes cement

**Revert Point:** Remove auto-provisioning, users manually created

### Phase 6: Final Testing (Verify All Cement) 🏗️

**Goal:** Verify everything works together

**Test Scenarios:**
1. Email/password sign-in (cement) → works
2. Google OAuth sign-in (new cement) → works
3. Token refresh (cement) → works for both
4. Logout (cement) → works for both
5. Navigation (cement) → works for both

**Success:** All cement stable, OAuth integrated

## Current Authentication Architecture

### How Sign-In Works Today

The app uses a **Firebase-first authentication pattern**:

```
1. Frontend → Firebase Auth (Direct)
   └─ signInWithEmailAndPassword(auth, email, password)
   └─ Returns: Firebase user + ID token (JWT)

2. Frontend → Backend API (With Firebase Token)
   └─ GET /Users/{uid}
   └─ Headers: { Authorization: "Bearer {firebaseToken}" }

3. Backend → Firebase Admin SDK (Verify Token)
   └─ admin.auth().verifyIdToken(token)
   └─ Verifies token is valid and not expired

4. Backend → Firestore (Fetch User Data)
   └─ db.collection('users').doc(uid).get()
   └─ Returns user document

5. Backend → Frontend (Return User Data)
   └─ Frontend stores in AsyncStorage via storeAuthData()
```

### Key Points

- **Frontend authenticates directly with Firebase** (not backend)
- **Backend only verifies Firebase tokens** (doesn't handle passwords)
- **User data stored in Firestore**, not Firebase Auth
- **Token format**: `Bearer {firebaseToken}` stored in AsyncStorage
- **Email verification required** before sign-in completes
- **Firebase auth state listener** automatically refreshes tokens

### Backend Token Verification

```javascript
// backend/middleware/auth.js
const token = authHeader.split('Bearer ')[1];
decodedToken = await admin.auth().verifyIdToken(token);
// Attaches req.user with { uid, email, ... }
```

The backend doesn't need to know about OAuth providers - it only verifies Firebase tokens. This means **OAuth integration is transparent to the backend** once we convert OAuth tokens to Firebase credentials.

### Storage Structure

```typescript
// AsyncStorage keys:
- 'userToken': "Bearer {firebaseToken}"
- 'userData': JSON stringified user object
- 'userRole': "user" | "admin"
- 'keepLoggedIn': "true" | "false"
- 'lastLoginTime': timestamp string
```

## Technical Details

### Expo AuthSession Compatibility

**Yes, it works in your setup!** Your app uses:
- `use_expo_modules!` in Podfile (Expo modules enabled)
- `expo-dev-client` (development build workflow)
- `expo-web-browser` already installed (required dependency)
- Custom scheme "com.p.zzles.xscard" configured in `app.json` (✅ fixed and aligned)

**Deep Linking Setup Required:**
- iOS: Verify `Info.plist` has URL scheme configured (likely already done)
- Android: Verify `AndroidManifest.xml` has intent filters (likely already done)
- Use `AuthSession.makeRedirectUri({ scheme: 'com.p.zzles.xscard' })` for redirects

### OAuth Flow (Google)

```
User clicks "Sign in with Google"
→ Expo AuthSession opens browser (via expo-web-browser)
→ User authenticates with Google
→ Google returns ID token
→ Redirects back to app via custom scheme (com.p.zzles.xscard://)
→ Convert Google ID token to Firebase credential
   └─ GoogleAuthProvider.credential(idToken)
→ Sign in to Firebase with credential
   └─ signInWithCredential(auth, googleCredential)
→ Get Firebase ID token (same as email/password flow)
   └─ firebaseUser.getIdToken()
→ Fetch user data from backend (same as email/password)
   └─ GET /Users/{uid} with Authorization: Bearer {firebaseToken}
→ Backend verifies Firebase token (same middleware)
→ Store via existing authStorage (same structure)
   └─ storeAuthData({ userToken, userData, userRole, keepLoggedIn })
→ Navigate to MainApp (same navigation)
```

**Critical Integration Points:**
1. **Google OAuth → Firebase Credential**: Convert OAuth token to Firebase format
2. **Firebase Sign-In**: Use `signInWithCredential()` (same as email/password internally)
3. **Get Firebase Token**: `firebaseUser.getIdToken()` returns same token format
4. **Backend API Call**: Identical to email/password flow
5. **Storage**: Same `storeAuthData()` function
6. **Navigation**: Same `navigation.getParent()?.navigate('MainApp')`

**No changes needed in:**
- Backend middleware (already verifies Firebase tokens)
- Backend controllers (already handle Firebase-authenticated users)
- AuthContext (already listens to Firebase auth state)
- Token refresh (already works with any Firebase token)

### Provider-Agnostic Structure

```typescript
interface OAuthProvider {
  signIn(): Promise<OAuthResult>;
  signOut(): Promise<void>;
  getProviderId(): 'google.com' | 'linkedin.com' | 'microsoft.com';
}

// Future: LinkedInProvider, MicrosoftProvider implement same interface
```

### Integration Points

**Frontend Reuse:**
- `storeAuthData()` from `src/utils/authStorage.ts` - stores token and user data
- `authenticatedFetch()` from `src/utils/api.ts` - adds Authorization header
- Firebase auth listener in `src/context/AuthContext.tsx` - auto-refreshes tokens
- Token refresh logic - works with any Firebase token (OAuth or email/password)
- Navigation flow - same `MainApp` navigation

**Backend Reuse:**
- `authenticateUser` middleware - verifies Firebase tokens (no OAuth-specific code needed)
- `getUserById` controller - fetches user from Firestore (works for all auth types)
- Token blacklist - works for all Firebase tokens
- Rate limiting - applies to all authenticated requests

**New Backend Logic Needed:**
- Auto-provisioning: Detect first-time OAuth users and create Firestore document
- Provider detection: Check `firebaseUser.providerData` to identify OAuth users (google.com, linkedin.com, microsoft.com)
- Store `authProvider: 'google.com' | 'linkedin.com' | 'microsoft.com'` in user document for analytics

## Groundwork for Future Providers

**Simple Groundwork (No Over-Engineering):**

1. **Config Structure** (Phase 1): `oauthConfig.ts` includes LinkedIn/Microsoft placeholders
   - Just structure, not implementation
   - Easy to add configs later

2. **Type System** (Phase 2): `OAuthProviderType` includes all providers
   - `'google.com' | 'linkedin.com' | 'microsoft.com'`
   - Types ready, implementation comes later

3. **Provider Files** (Phase 2): Google provider file structure
   - Future: Create `linkedinProvider.ts` and `microsoftProvider.ts` following same pattern
   - Same structure, different OAuth endpoints

4. **Backend Support** (Phase 5): Auto-provisioning supports all provider types
   - Checks for `google.com`, `linkedin.com`, or `microsoft.com`
   - Same logic works for all

5. **Comments**: TODO comments indicate where to add future providers
   - No complex abstractions
   - Just clear markers for where to add code

**Adding LinkedIn/Microsoft Later:**
- Follow same phases (config → provider → button → connect → backend)
- Reuse same structure
- No need to refactor existing code

## Risk Mitigation

1. **Expo Modules Work**: Your app already uses Expo modules, so `expo-auth-session` will work
2. **Deep Linking**: Verify existing deep linking setup supports OAuth redirects
3. **Incremental Testing**: Test after each phase
4. **Feature Flag**: Add environment variable to enable/disable OAuth
5. **Fallback**: If OAuth fails, email/password still works
6. **Error Boundaries**: Comprehensive error handling at each step

## Dependencies to Add

```json
{
  "expo-auth-session": "~6.0.0",
  "expo-web-browser": "~14.0.2" // Already installed
}
```

## Success Criteria

- Google OAuth works on iOS and Android
- New Google users auto-provisioned in backend
- Returning Google users sign in seamlessly
- No crashes or native dependency issues
- Code structure ready for LinkedIn/Microsoft extension
- Existing email/password auth unaffected

## Confidence Assessment & Risk Analysis

### Platform Compatibility

**Android: 90% Confidence**
- ✅ Expo AuthSession works reliably on Android
- ✅ Deep linking configured in AndroidManifest.xml
- ✅ URL scheme aligned and tested
- ✅ expo-web-browser (frontend-only, test during Phase 3)

**iOS: 90% Confidence**
- ✅ Expo AuthSession works on iOS
- ✅ Deep linking configured in Info.plist
- ✅ URL scheme aligned and tested
- ✅ expo-web-browser (frontend-only, test during Phase 3)

**Web: N/A**
- Not applicable - this is React Native app only
- Separate Next.js app will handle web OAuth separately

### Testing Environment

**Physical Devices: 85% Confidence**
- ✅ OAuth flows work best on real devices
- ✅ Deep linking redirects work reliably
- ✅ Browser authentication works properly
- ✅ No simulator-specific issues

**Simulators: 60% Confidence**
- ⚠️ expo-web-browser has known issues on simulators
- ⚠️ Deep linking redirects may be unreliable
- ⚠️ Browser authentication may fail
- ✅ Can test code logic, but OAuth flow needs physical device

**Recommendation:** Test OAuth implementation on physical devices first, use simulators only for UI/UX testing.

### Bug Risk Assessment: 70% Confidence

**Low Risk Areas (90%+ confidence):**
- ✅ Firebase credential conversion (well-documented API)
- ✅ Token storage (reusing existing `storeAuthData()`)
- ✅ Backend token verification (no changes needed)
- ✅ Navigation flow (same as email/password)

**Medium Risk Areas (70-80% confidence):**
- ⚠️ Error handling edge cases (user cancellation, network failures)
- ⚠️ Auto-provisioning logic (first-time OAuth users)

**Lower Risk Areas (now resolved):**
- ✅ Deep linking redirect (URL scheme verified and tested)
- ✅ URL scheme configuration (all aligned)
- ✅ expo-web-browser (frontend-only, test during implementation)
- ✅ Token refresh (should work - same Firebase token format)

### Critical Issues to Resolve

#### 1. URL Scheme ✅ **RESOLVED**

**Current State:**
- ✅ `app.json`: `"scheme": "com.p.zzles.xscard"` (top-level)
- ✅ iOS `Info.plist`: `com.p.zzles.xscard`
- ✅ Android `AndroidManifest.xml`: `com.p.zzles.xscard`
- ✅ Deep linking tested and working on simulator

**Status:** All schemes aligned and tested. Ready for OAuth implementation.

#### 2. Web Client ID Explanation

**What is Web Client ID?**
- It's a Google OAuth credential from Firebase Console
- Used by Expo AuthSession to authenticate with Google
- Different from your Firebase API key

**How to Get It:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `xscard-dev`
3. Go to **Authentication** → **Sign-in method** → **Google**
4. Look for **Web SDK configuration** → **Web client ID**
5. Copy the value

**Your Web Client ID:**
```
21153373630-j62qhel9e6j7mfqvdibrhp463li614v0.apps.googleusercontent.com
```

**Where to Use It:**
- Add to `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- Use in OAuth configuration: `src/config/oauthConfig.ts`

**Note:** This is different from:
- Firebase API Key (already have)
- iOS Client ID (not needed for Expo AuthSession)
- Android Client ID (not needed for Expo AuthSession)

### Overall Confidence: 90%

**Why 90%? (10% Uncertainty Breakdown)**

**Fixable Uncertainties (Can Test Now):**
1. **Deep linking never tested (5% uncertainty)** ✅ **TESTED**
   - ✅ **FIXED:** Deep linking works on simulator
   - ✅ URL scheme is correctly configured
   - ✅ OAuth redirects will work
   - **Confidence impact: +5% (now 85%)**

2. **expo-web-browser behavior** ✅ **DISREGARDED**
   - Frontend-only concern (backend not involved)
   - Can test during Phase 3 implementation
   - Physical devices available for testing
   - Not a blocker for implementation

**Normal Implementation Risk (10% uncertainty):**
1. **First OAuth implementation (5% uncertainty)**
   - Normal learning curve for any new feature
   - Mitigated by incremental testing
   - Not really "fixable" - just part of development

2. **Auto-provisioning logic (3% uncertainty)**
   - Code we'll write - fully in our control
   - Can test thoroughly with test accounts
   - Not really "fixable" - just needs careful implementation

3. **Edge case error handling (2% uncertainty)**
   - Normal for any feature
   - Can be comprehensive from the start
   - Not really "fixable" - just needs good error handling

**What's Actually Uncertain:**
- ✅ Architecture is sound and well-integrated
- ✅ Using proven Expo modules (no native dependencies)
- ✅ Reusing existing, tested code paths
- ✅ URL scheme fixed and aligned
- ✅ Web Client ID obtained
- ✅ Deep linking tested and working (simulator)
- ✅ expo-web-browser (frontend-only, can test during implementation)
- ⚠️ First OAuth implementation (normal development risk - 10%)

**Current Confidence: 90%**

1. ✅ **Deep Linking Tested** - Works on simulator
   - ✅ URL scheme correctly configured
   - ✅ OAuth redirects will work

2. ✅ **expo-web-browser** - Frontend-only concern
   - ✅ Backend not involved (no backend changes for browser)
   - ✅ Can test during Phase 3 implementation
   - ✅ Physical devices available for testing

3. **Implement Incrementally with Testing**
   - Test each phase before proceeding
   - Catch issues early

**Current Status:**
- ✅ URL scheme fixed and aligned
- ✅ Web Client ID obtained
- ✅ Deep linking tested and working (simulator)
- ✅ expo-web-browser (frontend-only, test during Phase 3)

### Risk Mitigation Strategy (Cement/Poop Approach)

**Principle:** Each phase is small, testable, and revertible

1. **Phase 0:** Identify cement, test it works
2. **Phase 1:** Add config → test → if issues, revert → fix → repeat
3. **Phase 2:** Add provider → test → if issues, revert → fix → repeat
4. **Phase 3:** Add button → test → if issues, revert → fix → repeat
5. **Phase 4:** Connect flow → test → if issues, revert → fix → repeat
6. **Phase 5:** Add auto-provisioning → test → if issues, revert → fix → repeat
7. **Phase 6:** Final verification of all cement

**Key Rules:**
- Each phase must be testable with predictable results
- Each phase has clear revert point
- Don't proceed until current phase is stable (cement)
- Never modify cement code

**Success Metrics:**
- ✅ OAuth button appears and works
- ✅ Browser opens and Google login works
- ✅ Redirect back to app succeeds
- ✅ User is authenticated and navigated to MainApp
- ✅ Backend auto-provisions new users
- ✅ Token refresh works for OAuth users
- ✅ No crashes or native dependency errors