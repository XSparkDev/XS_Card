# OAuth Integration - Baseline Assessment

## Phase 1: Baseline Cement ✅

This document captures the current state of authentication before Google OAuth implementation.

### Current Authentication Flow

#### 1. **Frontend Flow (Email/Password)**

**Entry Point:** `src/screens/auth/SignInScreen.tsx`

```
User Input → Firebase Auth (signInWithEmailAndPassword) 
→ Email Verification Check 
→ Backend User Data Fetch (/Users/:uid) 
→ Store Auth Data (AsyncStorage via authStorage.ts)
→ Navigate to MainApp
```

**Key Components:**
- `src/context/AuthContext.tsx` - Central auth state management with Firebase listener
- `src/utils/authStorage.ts` - Token and user data persistence
- `src/utils/api.ts` - Token refresh, validation, and authenticated requests
- `src/config/firebaseConfig.ts` - Firebase client initialization

#### 2. **Token Management**

**Token Type:** Firebase ID Token (Bearer)
**Storage:** AsyncStorage keys:
- `userToken` - Bearer token from Firebase
- `userData` - User profile data
- `keepLoggedIn` - Session persistence preference
- `lastLoginTime` - For token age tracking

**Token Lifecycle:**
1. **Issue**: Firebase Auth returns ID token after email/password sign-in
2. **Store**: Wrapped with "Bearer " prefix in AsyncStorage
3. **Refresh**: Auto-refresh when token is >50 minutes old (Firebase tokens expire in 1 hour)
4. **Validate**: Backend middleware verifies token with Firebase Admin SDK
5. **Revoke**: Logout adds token to Firestore `tokenBlacklist` collection

#### 3. **Backend Authentication**

**Middleware:** `backend/middleware/auth.js`

**Flow:**
```
Request → Extract Bearer Token 
→ Check tokenBlacklist (Firestore)
→ Verify with Firebase Admin (admin.auth().verifyIdToken)
→ Attach req.user (uid, email) 
→ Continue to controller
```

**User Data Storage:**
- Firebase Auth: Core auth identity
- Firestore `users` collection: User profile, preferences, metadata
- Firestore `cards` collection: Business card data

#### 4. **Auth State Restoration**

**On App Cold Start (`src/context/AuthContext.tsx`):**
```
Load AuthProvider 
→ Check AsyncStorage for auth data
→ Setup Firebase onAuthStateChanged listener
→ If Firebase user + stored data exist: Restore session
→ If Firebase user but no stored data: Fetch from backend
→ If no Firebase user but keepLoggedIn=true: Attempt restore
→ Otherwise: Show login screen
```

### Critical Integration Points for OAuth

#### ✅ **Safe to Extend:**

1. **Firebase Auth Listener** (`AuthContext.tsx` lines 180-380)
   - Already handles Firebase user state changes
   - Will automatically detect OAuth sign-ins
   - No changes needed - OAuth will flow through existing listener

2. **Token Storage** (`authStorage.ts`)
   - Provider-agnostic - stores any Firebase ID token
   - No changes needed - OAuth tokens stored identically

3. **Backend Token Verification** (`backend/middleware/auth.js`)
   - Firebase Admin SDK validates all Firebase ID tokens regardless of sign-in method
   - No changes needed - OAuth tokens verified identically

4. **API Requests** (`api.ts`)
   - Uses stored token from AsyncStorage
   - Provider-agnostic
   - No changes needed

#### ⚠️ **Requires Extension:**

1. **Sign-In Screen** (`SignInScreen.tsx`)
   - Currently only has email/password inputs
   - **Change Needed:** Add Google sign-in button + handler

2. **User Creation** (`backend/controllers/userController.js`)
   - `addUser` endpoint only handles email/password registration
   - **Change Needed:** Auto-create user doc when OAuth user signs in without profile

3. **Provider Tracking**
   - Currently no field to track sign-in method
   - **Change Needed:** Add `authProvider` field to user documents

### Baseline Test Strategy

#### Automated Tests

**Script:** `backend/test-baseline-auth.js`

Tests:
1. ✅ Email/password sign-in returns valid token
2. ✅ Token accesses protected endpoint
3. ✅ Token validation works
4. ✅ Token refresh works
5. ✅ Logout blacklists token properly

**Run Before Each Phase:**
```bash
cd backend
node test-baseline-auth.js
```

**Expected Output:** All 5 tests pass with exit code 0

#### Manual Regression Checklist

- [ ] Email/password sign-in
- [ ] Email/password sign-out
- [ ] Cold start with keepLoggedIn=true (app restore session)
- [ ] Cold start with keepLoggedIn=false (show login)
- [ ] Protected endpoint access (e.g., view cards)
- [ ] Token auto-refresh during long session
- [ ] Email verification flow for new users

### OAuth-Ready Architecture

#### Why Current Design is OAuth-Compatible:

1. **Firebase-First**: App already uses Firebase Auth, which natively supports OAuth providers
2. **Token-Agnostic**: All systems work with Firebase ID tokens, regardless of how they were issued
3. **Listener-Based**: Auth state changes detected automatically via onAuthStateChanged
4. **Separation of Concerns**: Sign-in method != token management != backend verification

#### OAuth Integration Path:

```
Google OAuth Button Click
→ Native Google Sign-In (@react-native-google-signin/google-signin)
→ Get Google ID Token
→ Exchange for Firebase Credential (GoogleAuthProvider.credential)
→ Firebase signInWithCredential
→ [EXISTING FLOW] onAuthStateChanged fires
→ [EXISTING FLOW] Store token via authStorage
→ [EXISTING FLOW] Navigate to MainApp
```

**Key Insight:** OAuth doesn't replace the flow, it plugs into it at the Firebase layer.

### Next Phase Prerequisites

Before implementing Google OAuth:

1. ✅ Baseline test passes
2. ✅ Assessment complete (this document)
3. ✅ Git commit with clean baseline
4. ⏳ Install OAuth dependencies
5. ⏳ Configure Google OAuth credentials

### Cement Checkpoint

**Commit Message:** "Phase 1: Baseline cement - auth assessment and tests"

**What's Stable:**
- Email/password authentication
- Token lifecycle (issue, store, refresh, validate, revoke)
- Auth state restoration on cold start
- Backend token verification
- Protected endpoint access

**Tests Passing:**
- All 5 baseline automated tests
- Manual regression checklist items

**Ready to Proceed:** Yes, to Phase 2 (Google OAuth implementation)

---

## Cement/Poop Principle Application

### Detection Strategy

**After Every Code Change:**
1. Run `node backend/test-baseline-auth.js`
2. Manually test existing sign-in flow
3. Check console for errors

**If Any Test Fails:**
- 💩 **POOP DETECTED**
- Stop coding immediately
- Revert to last cement commit: `git reset --hard <last-cement-commit>`
- Investigate failure
- Fix the specific issue
- Re-run tests
- Only continue when all tests pass

**If All Tests Pass:**
- 🏗️ **CEMENT SOLID**
- Commit with descriptive message
- Tag as cement checkpoint
- Proceed to next step

### Cement Commits

This approach maintains a chain of stable states:

```
Baseline Cement → Test Pass → Google UI Cement → Test Pass → 
Backend Cement → Test Pass → Final Integration Cement
```

Each cement commit is a known-good state we can revert to.


