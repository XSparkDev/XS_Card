# LinkedIn OAuth - Phase 5 Testing Plan

**Date**: November 13, 2025  
**Status**: Phase 5 Complete - Ready for End-to-End Testing  
**Implementation**: Phases 0-5 Complete ✅

---

## 📋 Implementation Summary

### Completed Phases:

- ✅ **Phase 0**: Baseline Verification - Google OAuth working
- ✅ **Phase 1**: Configuration - LinkedIn Client ID added
- ✅ **Phase 2**: LinkedIn Provider Class - Created `linkedinProvider.ts`
- ✅ **Phase 3**: LinkedIn Button UI - Added to SignInScreen
- ✅ **Phase 4**: Backend LinkedIn Handlers - OAuth routes & controller
- ✅ **Phase 5**: Auto-Provisioning - Already implemented (verified)

---

## 🔧 Component Checklist

### Frontend Components:

- [x] `src/services/oauth/linkedinProvider.ts` - LinkedIn OAuth provider
- [x] `src/config/oauthConfig.ts` - LinkedIn configuration
- [x] `src/types/env.d.ts` - LinkedIn env types
- [x] `src/screens/auth/SignInScreen.tsx` - LinkedIn button + handler
  - [x] `handleLinkedInSignIn()` function
  - [x] Deep link routing with `provider=linkedin` detection
  - [x] Loading state management
  - [x] Error handling

### Backend Components:

- [x] `backend/controllers/oauthController.js`
  - [x] `startLinkedInOAuth()` - Redirects to LinkedIn
  - [x] `handleLinkedInCallback()` - Exchanges code, creates Firebase token
- [x] `backend/routes/oauthRoutes.js`
  - [x] `GET /oauth/linkedin/start`
  - [x] `GET /oauth/linkedin/callback`
- [x] `backend/controllers/userController.js`
  - [x] Auto-provisioning for `linkedin.com` users (lines 71-117)

### Configuration:

- [x] Frontend `.env`: `EXPO_PUBLIC_LINKEDIN_CLIENT_ID=<your_linkedin_client_id>`
- [x] Backend `.env`: 
  - [x] `LINKEDIN_CLIENT_ID=<your_linkedin_client_id>`
  - [x] `LINKEDIN_CLIENT_SECRET=[REDACTED - stored securely]`
- [x] Backend running: ✅ (PID 76333)
- [x] Ngrok URL: `https://242e48878446.ngrok-free.app`

### LinkedIn Developer Portal:

- [x] App created: "XS Card LI OAuth Test"
- [x] Client ID: `<redacted>`
- [x] Scopes enabled: `openid`, `profile`, `email`
- [ ] **REQUIRED**: Add redirect URLs:
  ```
  Dev:     https://242e48878446.ngrok-free.app/oauth/linkedin/callback
  Staging: https://apistaging.xscard.co.za/oauth/linkedin/callback
  Prod:    https://baseurl.xscard.co.za/oauth/linkedin/callback
  ```

---

## 🧪 Test Cases

### Test 1: LinkedIn Button Visibility ✅
**Steps:**
1. Open app on device
2. Navigate to Sign In screen
3. Verify "Continue with LinkedIn" button appears below Google button
4. Verify button styling: White bg, LinkedIn blue border (#0A66C2)

**Expected Result:**
- Button visible with business icon
- Proper spacing between Google and LinkedIn buttons

---

### Test 2: LinkedIn OAuth Initiation
**Steps:**
1. Tap "Continue with LinkedIn" button
2. Observe button text changes to "Signing in with LinkedIn..."
3. Browser should open with LinkedIn OAuth page

**Expected Result:**
- Button disabled during loading
- Browser opens to `linkedin.com/oauth/v2/authorization`
- URL contains: `client_id=77tprijl6otowg`, `scope=openid profile email`

**Backend Logs to Check:**
```
[OAuth] startLinkedInOAuth called
[OAuth] Starting LinkedIn OAuth flow, state: <random-state>
[OAuth] Redirecting to LinkedIn: https://www.linkedin.com/oauth/v2/authorization?...
```

---

### Test 3: LinkedIn Sign-In (New User)
**Steps:**
1. Complete Test 2
2. Sign in with LinkedIn credentials on OAuth page
3. Grant permissions to the app
4. Wait for redirect

**Expected Flow:**
```
App → Backend /oauth/linkedin/start 
    → LinkedIn OAuth Page 
    → User signs in 
    → Backend /oauth/linkedin/callback 
    → Exchange code for token 
    → Fetch user info from /v2/userinfo 
    → Create Firebase user 
    → Create custom token 
    → Redirect to app with deep link
```

**Expected Result:**
- Browser closes automatically
- App receives deep link: `com.p.zzles.xscard://oauth-callback?token=...&state=...&provider=linkedin`
- Frontend processes callback
- User is signed in and navigated to MainApp
- Toast: "Welcome! Signed in as [email]"

**Backend Logs to Check:**
```
[OAuth] LinkedIn callback received, state: <state>
[OAuth] Exchanging code for tokens...
[OAuth] Tokens received, fetching LinkedIn user info...
[OAuth] LinkedIn user fetched: <email>
[OAuth] Creating new Firebase user for: <email>
[OAuth] New Firebase user created: <uid>
[OAuth] Firebase custom token created
[OAuth] Redirecting to app
```

**Frontend Logs to Check:**
```
[SignIn] Deep link received: com.p.zzles.xscard://oauth-callback?...
[SignIn] Processing LinkedIn callback
[LinkedIn OAuth] Handling callback URL: ...
[LinkedIn OAuth] Firebase custom token received, signing in...
[LinkedIn OAuth] Firebase sign-in successful
[SignIn] OAuth successful, fetching user data...
```

**Firestore Verification:**
- Check `users` collection for new document with:
  - `uid`: Firebase UID
  - `email`: LinkedIn email
  - `authProvider`: `"linkedin.com"`
  - `emailVerified`: `true`
  - `role`: `"user"`
  - `plan`: `"free"`

---

### Test 4: LinkedIn Sign-In (Existing User)
**Steps:**
1. Use a LinkedIn account that was used before
2. Complete OAuth flow

**Expected Result:**
- Existing Firebase user found
- No new user created
- Sign-in successful
- User data retrieved from Firestore

**Backend Logs to Check:**
```
[OAuth] LinkedIn user fetched: <email>
[OAuth] Existing Firebase user found: <uid>
[OAuth] Firebase custom token created
```

---

### Test 5: User Cancellation
**Steps:**
1. Tap "Continue with LinkedIn"
2. When LinkedIn OAuth page opens, tap "Cancel" or close browser

**Expected Result:**
- Browser closes
- Loading spinner stops
- Toast: "Cancelled - LinkedIn sign-in was cancelled"
- User remains on Sign In screen

**Frontend Logs:**
```
[LinkedIn OAuth] Browser result: cancel
[LinkedIn OAuth] State still exists - user cancelled before redirect
[SignIn] User cancelled LinkedIn sign-in
```

---

### Test 6: Stale Callback Handling
**Steps:**
1. Start LinkedIn OAuth
2. Force close browser before completing
3. Start LinkedIn OAuth again
4. Complete OAuth flow
5. Old callback might arrive

**Expected Result:**
- Old callback silently ignored
- No error toast shown
- Current OAuth flow completes successfully

**Frontend Logs:**
```
[LinkedIn OAuth] Ignoring stale callback. Received state: <old-state>, Current state: <new-state>
[SignIn] Ignoring stale OAuth callback from previous attempt
```

---

### Test 7: Google OAuth Still Works (Regression)
**Steps:**
1. Tap "Continue with Google" button
2. Complete Google OAuth flow

**Expected Result:**
- Google OAuth flow completes successfully
- No interference from LinkedIn code
- User signed in via Google

---

### Test 8: Error Handling - Invalid State
**Steps:**
1. Manually construct invalid callback URL
2. Trigger deep link with wrong state

**Expected Result:**
- Error handled gracefully
- Toast shows error message
- User can retry

---

### Test 9: Mutual Exclusion
**Steps:**
1. Tap "Continue with LinkedIn"
2. While loading, try to tap "Continue with Google"

**Expected Result:**
- Google button is disabled
- Only one OAuth flow can run at a time

---

### Test 10: Auto-Provisioning Verification
**Steps:**
1. Sign in with new LinkedIn account
2. Check backend user endpoint: `GET /Users/{uid}`
3. Verify Firestore document created

**Expected Backend Response:**
```json
{
  "id": "<firebase-uid>",
  "uid": "<firebase-uid>",
  "email": "user@example.com",
  "name": "John Doe",
  "surname": "",
  "authProvider": "linkedin.com",
  "role": "user",
  "plan": "free",
  "status": "active",
  "emailVerified": true,
  "createdAt": "2025-11-13T...",
  "updatedAt": "2025-11-13T..."
}
```

**Backend Logs:**
```
[Auto-Provision] Creating linkedin.com user: user@example.com
[Auto-Provision] linkedin.com user created successfully
```

---

## 🚨 Known Issues & Edge Cases

### Issue 1: LinkedIn Redirect URL Not Added
**Symptom**: OAuth fails with "redirect_uri_mismatch"  
**Fix**: Add redirect URL in LinkedIn Developer Portal (see Configuration section)

### Issue 2: Browser Doesn't Close After Success
**Symptom**: Browser stays open after successful auth  
**Status**: Handled - `WebBrowser.dismissBrowser()` called after callback processing (line 193)

### Issue 3: Concurrent OAuth Attempts
**Symptom**: Starting LinkedIn while Google is pending  
**Status**: Handled - buttons disabled when any OAuth is in progress

---

## 📊 Success Criteria

### Phase 5 is successful when:

- [ ] LinkedIn button appears correctly ✅
- [ ] LinkedIn OAuth flow initiates without errors
- [ ] User can sign in with LinkedIn credentials
- [ ] New users are auto-provisioned in Firestore with `authProvider: "linkedin.com"`
- [ ] Existing users can sign in without duplicate accounts
- [ ] Browser closes automatically after successful auth
- [ ] User is navigated to MainApp with valid session
- [ ] Google OAuth still works (no regression)
- [ ] Error handling works for cancellation and invalid states
- [ ] Stale callbacks are silently ignored

---

## 🔄 Testing Order

**Recommended test sequence:**

1. Test 1: Visual verification ✅
2. Test 7: Google OAuth regression (ensure CEMENT is stable)
3. Test 2: LinkedIn OAuth initiation
4. Test 3: LinkedIn sign-in (new user) + Test 10 (auto-provisioning)
5. Test 4: LinkedIn sign-in (existing user)
6. Test 5: User cancellation
7. Test 9: Mutual exclusion
8. Test 6: Stale callback handling (if time permits)

---

## 📝 Post-Testing Actions

### If all tests pass:
1. Mark Phase 5 as **CEMENT** ✅
2. Document any findings
3. Prepare for Phase 6: Final verification & production readiness

### If tests fail:
1. Document failure details
2. Revert to last known CEMENT (Phase 3 or 4)
3. Debug and fix issues
4. Re-test

---

## 🎯 Current Status

**Build**: Running in background  
**Backend**: ✅ Running (verified)  
**LinkedIn Endpoint**: ✅ Working  
**Next Step**: Complete iOS build and begin testing

**Ready to test when build completes!** 🚀

