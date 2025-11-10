# OAuth Testing Guide - Phase 4

## Testing Strategy (Cement/Poop Principle)

This guide follows the cement/poop principle: each test must pass before proceeding. Any failure is "poop" and requires reverting to the last cement checkpoint.

## Pre-Implementation Baseline Tests

### 1. Run Baseline Auth Test

```bash
cd backend
node test-baseline-auth.js
```

**Expected Result:** All 5 tests pass ✅
- Sign-in
- Protected endpoint
- Token validation
- Token refresh
- Logout/blacklist

**If Failed:** Fix existing auth before adding OAuth 💩

### 2. Manual Baseline Tests

Test the existing email/password flow:

- [ ] Sign up with new email
- [ ] Verify email via link
- [ ] Sign in with email/password
- [ ] Access protected features (cards, events)
- [ ] Sign out
- [ ] Sign in again with "Keep me logged in"
- [ ] Cold start (close and reopen app) - should restore session
- [ ] Cold start without "Keep me logged in" - should show login

**All Must Pass Before Proceeding** 🏗️

## Phase 2: Google OAuth Frontend Tests

### Installation & Setup

1. **Install Dependencies**

```bash
npm install @react-native-google-signin/google-signin
cd ios && pod install && cd ..
```

2. **Configure OAuth Credentials**

Follow `OAUTH_CONFIGURATION_GUIDE.md`:
- Enable Google provider in Firebase Console
- Add Google OAuth credentials to `.env`
- Configure native projects (Android SHA-1, iOS URL scheme)

3. **Rebuild Apps**

```bash
# Android
npm run android

# iOS
npm run ios
```

### Manual Google Sign-In Tests

#### Test 1: New Google User (First Sign-In)

1. **Setup:**
   - Ensure test Google account has never signed into app
   - Clear app data/cache

2. **Steps:**
   - [ ] Open app
   - [ ] Navigate to Sign In screen
   - [ ] Verify "Continue with Google" button visible
   - [ ] Tap "Continue with Google"
   - [ ] Select Google account
   - [ ] Grant permissions
   - [ ] Verify navigation to Main App
   - [ ] Check user is signed in
   - [ ] Verify profile data populated (name, email)

3. **Expected Backend Logs:**
   ```
   [OAuth] User <uid> not found in Firestore, checking Firebase Auth...
   [OAuth] Found Firebase Auth user: <email>, providers: ['google.com']
   [OAuth] Created Firestore user document for google.com user: <email>
   ```

4. **Verify Firestore:**
   - Check `users/<uid>` document exists
   - Verify `authProvider: 'google.com'`
   - Verify `isEmailVerified: true`
   - Verify `plan: 'free'`

**Pass/Fail:** ___

#### Test 2: Existing Google User (Return Sign-In)

1. **Steps:**
   - [ ] Sign out from Test 1
   - [ ] Sign in with Google again (same account)
   - [ ] Verify instant sign-in (no account setup)
   - [ ] Verify previous profile data retained

2. **Expected Backend Logs:**
   ```
   SignIn: User data retrieved from backend (Google OAuth)
   ```
   (No auto-creation message - user already exists)

**Pass/Fail:** ___

#### Test 3: Google Sign-In with "Keep me logged in" OFF

1. **Steps:**
   - [ ] Sign out
   - [ ] Disable "Keep me logged in" toggle
   - [ ] Sign in with Google
   - [ ] Close app completely
   - [ ] Reopen app
   - [ ] Verify app shows login screen (not auto-restored)

**Pass/Fail:** ___

#### Test 4: Google Sign-In with "Keep me logged in" ON

1. **Steps:**
   - [ ] Sign out
   - [ ] Enable "Keep me logged in" toggle
   - [ ] Sign in with Google
   - [ ] Close app completely
   - [ ] Reopen app
   - [ ] Verify app auto-restores session (Main App shown)
   - [ ] Verify user still signed in

**Pass/Fail:** ___

#### Test 5: Google Sign-In Cancellation

1. **Steps:**
   - [ ] Tap "Continue with Google"
   - [ ] Cancel Google account selection
   - [ ] Verify app shows error message
   - [ ] Verify app stays on sign-in screen
   - [ ] Verify can retry or use email/password

**Pass/Fail:** ___

#### Test 6: Google Sign-In Network Error

1. **Steps:**
   - [ ] Enable airplane mode
   - [ ] Tap "Continue with Google"
   - [ ] Verify appropriate error message
   - [ ] Disable airplane mode
   - [ ] Retry - should work

**Pass/Fail:** ___

### Google + Email/Password Coexistence Tests

#### Test 7: Sign In with Email, Then Google (Different Accounts)

1. **Steps:**
   - [ ] Create account with email/password
   - [ ] Sign out
   - [ ] Sign in with Google (different email)
   - [ ] Verify separate user profiles
   - [ ] Verify can switch between accounts

**Pass/Fail:** ___

#### Test 8: Email User Remains Unaffected

1. **Steps:**
   - [ ] Sign in with existing email/password account
   - [ ] Verify all features work
   - [ ] Check backend - verify `authProvider: 'password'`
   - [ ] Sign out and sign in again
   - [ ] Verify no OAuth interference

**Pass/Fail:** ___

## Phase 3: Backend OAuth Tests

### Automated Backend Tests

```bash
cd backend
node test-oauth-user-creation.js
```

**Expected Result:** All tests pass ✅
- Create OAuth user in Firebase Auth
- Get ID token
- Auto-create Firestore document
- Verify authProvider field
- Subsequent calls consistent

**If Failed:** Backend auto-provisioning broken 💩

### Manual Backend Verification

#### Test 9: OAuth User Document Structure

1. **Check Firestore Console:**
   - Open Firebase Console → Firestore
   - Find user created via Google OAuth
   - Verify document structure:

```javascript
{
  uid: "<firebase-uid>",
  name: "FirstName",
  surname: "LastName",
  email: "user@gmail.com",
  status: "active",
  plan: "free",
  createdAt: Timestamp,
  isEmailVerified: true,
  authProvider: "google.com", // ← Key field
  profileImage: "https://...", // From Google profile
  termsAccepted: true,
  privacyAccepted: true,
  legalAcceptedAt: Timestamp
}
```

**Pass/Fail:** ___

#### Test 10: Email User Document Structure

1. **Check Firestore Console:**
   - Find user created via email/password
   - Verify document structure:

```javascript
{
  uid: "<firebase-uid>",
  name: "FirstName",
  surname: "LastName",
  email: "user@example.com",
  status: "active",
  plan: "free",
  createdAt: Timestamp,
  isEmailVerified: true, // After verification
  authProvider: "password", // ← Key field
  verificationToken: null, // Cleared after verification
  termsAccepted: true,
  privacyAccepted: true,
  legalAcceptedAt: Timestamp
}
```

**Pass/Fail:** ___

## Phase 4: Integration & Regression Tests

### Protected Endpoints with OAuth Token

#### Test 11: Google User Accesses Protected Endpoints

Use Google OAuth user account:

- [ ] View cards (`/Cards/:uid`)
- [ ] Create card (`/AddCard`)
- [ ] View contacts (`/Contacts`)
- [ ] Create event (`/events`)
- [ ] Update profile (`/UpdateUser/:id`)
- [ ] Change password (should work even for OAuth users)

**All Should Work Without Issues**

**Pass/Fail:** ___

#### Test 12: Token Validation with OAuth

```bash
# Get user's token from app logs or AsyncStorage
# Test with baseline script (should work for both auth methods)
cd backend
node test-baseline-auth.js
```

**Pass/Fail:** ___

### Logout & Session Management

#### Test 13: Google User Logout

1. **Steps:**
   - [ ] Sign in with Google
   - [ ] Sign out from app
   - [ ] Verify redirected to sign-in screen
   - [ ] Try to access protected endpoint with old token
   - [ ] Verify 401 Unauthorized (token blacklisted)

**Pass/Fail:** ___

#### Test 14: Google User Token Refresh

1. **Steps:**
   - [ ] Sign in with Google
   - [ ] Use app for >50 minutes (or manually trigger refresh)
   - [ ] Verify token auto-refreshes
   - [ ] Verify app continues working
   - [ ] Check logs for refresh messages

**Pass/Fail:** ___

### Cross-Platform Tests

#### Test 15: Android Google Sign-In

1. **Steps:**
   - [ ] Build Android app
   - [ ] Verify Google Sign-In button visible
   - [ ] Tap button - opens Google account selector
   - [ ] Complete sign-in
   - [ ] Verify successful authentication
   - [ ] Test all scenarios from above on Android

**Pass/Fail:** ___

#### Test 16: iOS Google Sign-In

1. **Steps:**
   - [ ] Build iOS app  
   - [ ] Verify Google Sign-In button visible
   - [ ] Tap button - opens Google account selector
   - [ ] Complete sign-in
   - [ ] Verify successful authentication
   - [ ] Test all scenarios from above on iOS

**Pass/Fail:** ___

## Regression Tests (Final Cement Check)

### Re-run All Baseline Tests

After all OAuth implementation:

1. **Automated Tests:**

```bash
cd backend

# Baseline auth (email/password)
node test-baseline-auth.js

# OAuth auto-creation
node test-oauth-user-creation.js
```

**Both Must Pass** ✅

2. **Manual Email/Password Tests:**

Repeat all email/password tests from baseline:
- [ ] Sign up
- [ ] Email verification
- [ ] Sign in
- [ ] Protected endpoints
- [ ] Token refresh
- [ ] Logout
- [ ] Cold start restore

**All Must Still Work** 🏗️

## Performance & Edge Cases

### Test 17: Multiple Rapid Sign-In Attempts

1. **Steps:**
   - [ ] Sign out
   - [ ] Tap "Continue with Google" multiple times rapidly
   - [ ] Verify no crashes or duplicate requests
   - [ ] Verify clean error handling

**Pass/Fail:** ___

### Test 18: Concurrent Email + Google Accounts

1. **Steps:**
   - [ ] Have same email in both Firebase Auth methods
   - [ ] Try to sign in with Google
   - [ ] Verify appropriate handling (should work - Firebase allows this)

**Pass/Fail:** ___

### Test 19: Expired OAuth Token Handling

1. **Steps:**
   - [ ] Sign in with Google
   - [ ] Manually revoke token in Firebase Console
   - [ ] Try to use app
   - [ ] Verify forced logout
   - [ ] Can sign in again successfully

**Pass/Fail:** ___

## Success Criteria

### All Tests Must Pass ✅

**Frontend:**
- [ ] Google sign-in button displays correctly
- [ ] Google OAuth flow completes successfully
- [ ] New OAuth users auto-provisioned
- [ ] Existing OAuth users sign in instantly
- [ ] Keep logged in works for OAuth users
- [ ] OAuth and email/password coexist

**Backend:**
- [ ] OAuth users auto-created in Firestore
- [ ] `authProvider` field correctly set
- [ ] Email users retain `authProvider: 'password'`
- [ ] Protected endpoints work for both auth methods
- [ ] Token validation works for both auth methods
- [ ] Logout blacklists OAuth tokens

**Regression:**
- [ ] All baseline tests still pass
- [ ] Email/password flow unaffected
- [ ] No existing features broken

**If Any Test Fails:** 💩 POOP DETECTED - Revert to last cement commit

## Cement Checkpoints

Document each stable state:

1. ✅ **Baseline Cement** - All existing auth tests pass
2. ✅ **Frontend Cement** - Google UI added, OAuth helper implemented
3. ✅ **Backend Cement** - Auto-provisioning works, provider tracking added
4. ✅ **Integration Cement** - All systems work together, regression tests pass

Each checkpoint should be a git commit that can be reverted to if "poop" is detected.

## Next Steps

After all tests pass:

1. **Tag Release:**
   ```bash
   git tag -a oauth-google-v1.0 -m "Google OAuth implementation complete"
   git push origin oauth-google-v1.0
   ```

2. **Update Documentation:**
   - User-facing: How to sign in with Google
   - Developer: OAuth architecture and future providers

3. **Prepare for LinkedIn:**
   - Review LinkedIn OAuth flow
   - Plan similar implementation using existing patterns
   - LinkedIn will reuse: authStorage, authContext, backend auto-provision

4. **Monitor Production:**
   - Track OAuth sign-in success rates
   - Monitor error logs
   - Gather user feedback


