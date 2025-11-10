# Google OAuth Deployment Checklist

Use this checklist to deploy the Google OAuth implementation following the cement/poop principle.

## Pre-Deployment: Baseline Cement Verification

### ✅ Verify Current System is Stable

- [ ] Run baseline auth test: `cd backend && node test-baseline-auth.js`
  - All 5 tests must pass
- [ ] Test email/password sign-in manually
- [ ] Test email/password sign-out manually  
- [ ] Test cold start with "Keep me logged in"
- [ ] Verify protected endpoints work
- [ ] **IF ANY FAIL:** Fix before proceeding 💩

## Phase 1: Install Dependencies

### Frontend

```bash
# Install Google Sign-In SDK
npm install @react-native-google-signin/google-signin

# Install iOS pods
cd ios && pod install && cd ..
```

- [ ] Dependencies installed successfully
- [ ] No installation errors
- [ ] package-lock.json updated

### Checkpoint: Dependencies Installed ✅

## Phase 2: Configure OAuth Credentials

### Firebase Console

1. **Enable Google Sign-In Provider:**
   - [ ] Go to Firebase Console → Authentication → Sign-in method
   - [ ] Enable Google provider
   - [ ] Set support email
   - [ ] Save

2. **Get Web Client ID:**
   - [ ] Go to Project Settings → General
   - [ ] Find Web app configuration
   - [ ] Copy Web Client ID
   - [ ] Save for next step

### Google Cloud Console

1. **Android Configuration:**
   - [ ] Go to Google Cloud Console → APIs & Services → Credentials
   - [ ] Find or create Android OAuth 2.0 Client ID
   - [ ] Package name: `com.xscard.app` (verify from android/app/build.gradle)
   - [ ] Get SHA-1: `cd android && ./gradlew signingReport`
   - [ ] Add SHA-1 to client
   - [ ] Save

2. **iOS Configuration:**
   - [ ] Create iOS OAuth 2.0 Client ID
   - [ ] Bundle ID: `com.xscard.app` (verify from Xcode)
   - [ ] Save
   - [ ] Note the iOS Client ID

### Environment Configuration

Create/update `.env` file:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID_HERE
```

- [ ] `.env` file updated
- [ ] Web Client ID added
- [ ] Verify no quotes or extra spaces

### Native Project Configuration

**Android** (should work automatically):
- [ ] Google Play Services dependency in build.gradle
- [ ] No additional changes needed

**iOS** - Update `ios/XSCard/Info.plist`:
- [ ] Add URL Scheme section (see OAUTH_CONFIGURATION_GUIDE.md)
- [ ] Use REVERSED_CLIENT_ID format
- [ ] Save and rebuild

- [ ] All configurations complete

### Checkpoint: OAuth Configured ✅

## Phase 3: Build and Install

### Android

```bash
npm run android
```

- [ ] Build successful
- [ ] App installs on device/emulator
- [ ] No build errors
- [ ] App launches successfully

### iOS

```bash
npm run ios
```

- [ ] Build successful
- [ ] App installs on device/simulator
- [ ] No build errors
- [ ] App launches successfully

### Checkpoint: Apps Built Successfully ✅

## Phase 4: Functional Testing

### Test 1: Baseline Still Works

- [ ] Email/password sign-in works
- [ ] Email/password sign-out works
- [ ] Protected endpoints accessible
- [ ] **IF FAILS:** 💩 Revert, fix, retry

### Test 2: Google Sign-In (New User)

- [ ] "Continue with Google" button visible
- [ ] Button press opens Google account selector
- [ ] Account selection works
- [ ] Permissions granted
- [ ] Navigates to Main App
- [ ] User profile populated
- [ ] **IF FAILS:** 💩 Check logs, troubleshoot

### Test 3: Backend Auto-Creation

```bash
cd backend
node test-oauth-user-creation.js
```

- [ ] All 5 tests pass
- [ ] User document created in Firestore
- [ ] `authProvider: 'google.com'` present
- [ ] **IF FAILS:** 💩 Check backend logs

### Test 4: Google Sign-In (Returning User)

- [ ] Sign out from Test 2
- [ ] Sign in with Google again
- [ ] Instant sign-in (no setup)
- [ ] Profile data retained
- [ ] **IF FAILS:** 💩 Check data persistence

### Test 5: OAuth Token Works

- [ ] Access cards feature
- [ ] Access events feature
- [ ] Access contacts feature
- [ ] All protected features work
- [ ] **IF FAILS:** 💩 Check token format

### Test 6: Keep Me Logged In

**With Toggle OFF:**
- [ ] Sign out
- [ ] Toggle OFF
- [ ] Sign in with Google
- [ ] Close app
- [ ] Reopen - shows login screen ✅

**With Toggle ON:**
- [ ] Sign out
- [ ] Toggle ON
- [ ] Sign in with Google
- [ ] Close app
- [ ] Reopen - auto-restores session ✅

### Test 7: Cross-Platform

**If Android:**
- [ ] Test on Android device
- [ ] Test on Android emulator
- [ ] Both work correctly

**If iOS:**
- [ ] Test on iOS device
- [ ] Test on iOS simulator
- [ ] Both work correctly

### Checkpoint: All Tests Pass ✅

## Phase 5: Regression Testing

### Re-run Baseline Tests

```bash
cd backend
node test-baseline-auth.js
```

- [ ] All 5 baseline tests still pass
- [ ] Email/password unaffected
- [ ] Token lifecycle works
- [ ] **IF FAILS:** 💩 Regression detected, investigate

### Manual Regression

- [ ] Create new email/password account
- [ ] Verify email
- [ ] Sign in with email/password
- [ ] All features work
- [ ] Sign out
- [ ] Sign in with Google (different account)
- [ ] Both accounts independent
- [ ] Can switch between accounts

### Checkpoint: No Regressions ✅

## Phase 6: Error Handling & Edge Cases

### Test Error Scenarios

- [ ] Cancel Google account selection → Shows appropriate message
- [ ] Network error during OAuth → Shows appropriate message
- [ ] Try with airplane mode → Shows appropriate message
- [ ] Revoke token in Firebase Console → Forces logout
- [ ] Multiple rapid sign-in attempts → No crashes

### Checkpoint: Error Handling Solid ✅

## Phase 7: Verification & Documentation

### Backend Verification

Check Firestore Console:
- [ ] OAuth users have `authProvider: 'google.com'`
- [ ] Email users have `authProvider: 'password'`
- [ ] All required fields present
- [ ] No data corruption

### Code Review

- [ ] Code follows project style
- [ ] Comments are clear
- [ ] No debug console.logs in production code
- [ ] Error messages user-friendly
- [ ] No hardcoded secrets

### Documentation

- [ ] Update user guide with Google sign-in instructions
- [ ] Update developer docs with OAuth architecture
- [ ] Add troubleshooting section
- [ ] Document environment variables

### Checkpoint: Verified & Documented ✅

## Phase 8: Pre-Production

### Performance Check

- [ ] Sign-in time reasonable (<3 seconds)
- [ ] No memory leaks
- [ ] No UI jank or freezes
- [ ] App remains responsive

### Security Check

- [ ] No credentials in code
- [ ] Environment variables used correctly
- [ ] Tokens stored securely (AsyncStorage)
- [ ] HTTPS only for API calls
- [ ] Token blacklist working

### Final Tests

- [ ] Clean install test (uninstall & reinstall)
- [ ] Fresh user test (new Google account)
- [ ] Existing user test (established account)
- [ ] Multi-device test (same account, different devices)

### Checkpoint: Production-Ready ✅

## Phase 9: Deployment

### Commit & Tag

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: Add Google OAuth authentication

- Implement Google Sign-In button in SignInScreen
- Add oauthProviders.ts helper with provider-agnostic design
- Backend auto-creates Firestore docs for OAuth users
- Track authProvider field for all users
- Maintain backward compatibility with email/password
- Add comprehensive tests and documentation
- Prepare for future LinkedIn/Apple OAuth

Refs: #XXX"

# Tag the release
git tag -a oauth-google-v1.0 -m "Google OAuth implementation complete"

# Push
git push origin main
git push origin oauth-google-v1.0
```

- [ ] Code committed
- [ ] Tagged appropriately
- [ ] Pushed to repository

### Build Production Apps

**Android:**
```bash
cd android
./gradlew assembleRelease
```
- [ ] Release APK built
- [ ] APK signed
- [ ] Ready for Play Store

**iOS:**
- [ ] Archive created in Xcode
- [ ] Signed with production certificate
- [ ] Ready for App Store

### Checkpoint: Deployed ✅

## Phase 10: Post-Deployment Monitoring

### First 24 Hours

- [ ] Monitor Firebase Console → Authentication
- [ ] Check Google Cloud Console → Logs
- [ ] Watch backend logs for errors
- [ ] Track OAuth sign-in success rate
- [ ] Monitor user feedback

### Week 1

- [ ] OAuth adoption rate > 30%
- [ ] OAuth error rate < 2%
- [ ] No spike in email/password errors
- [ ] User satisfaction maintained
- [ ] Performance metrics stable

### Success Criteria

- [ ] ✅ All automated tests pass
- [ ] ✅ All manual tests pass
- [ ] ✅ No regressions detected
- [ ] ✅ Error handling robust
- [ ] ✅ Documentation complete
- [ ] ✅ Production deployed
- [ ] ✅ Monitoring in place
- [ ] ✅ Users happy

## Rollback Plan (If Needed)

### If 💩 Detected in Production

1. **Immediate:**
   ```bash
   # Revert to previous tag
   git revert oauth-google-v1.0
   
   # Or reset to before OAuth
   git reset --hard <last-cement-commit>
   
   # Rebuild and redeploy
   npm run android
   npm run ios
   ```

2. **Investigate:**
   - Check logs for error patterns
   - Review failing test cases
   - Identify root cause

3. **Fix:**
   - Fix specific issue
   - Re-run all tests
   - Ensure cement checkpoint passes

4. **Redeploy:**
   - Follow this checklist again
   - Monitor closely

## Next Phase: LinkedIn OAuth

After Google OAuth is stable in production for 2+ weeks:

- [ ] Review LinkedIn OAuth documentation
- [ ] Set up LinkedIn Developer account
- [ ] Plan implementation using same pattern
- [ ] Follow same cement/poop principle
- [ ] Reuse infrastructure (oauthProviders, backend auto-provision)

## Notes

**Remember:** The cement/poop principle is your safety net. If anything fails:
1. Stop immediately
2. Mark as 💩 
3. Revert to last ✅ checkpoint
4. Investigate and fix
5. Re-run tests
6. Only proceed when tests pass

**Success = All checkpoints ✅, Zero 💩**

