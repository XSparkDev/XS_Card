# OAuth Configuration Guide

## Google OAuth Setup

### 1. Firebase Console Configuration

#### Step 1: Enable Google Sign-In in Firebase
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `xscard-addd4`
3. Navigate to **Authentication** → **Sign-in method**
4. Click **Google** provider
5. Enable the toggle
6. Set support email
7. Click **Save**

#### Step 2: Get Web Client ID
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Find the **Web app** configuration
4. Copy the **Web Client ID** (looks like: `628567737496-xxxxx.apps.googleusercontent.com`)
5. This will be used in the app configuration

### 2. Google Cloud Console Configuration

#### For Android

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **APIs & Services** → **Credentials**
4. You should see an **Android client** auto-created by Firebase
5. If not, click **Create Credentials** → **OAuth 2.0 Client ID**
6. Application type: **Android**
7. Name: `XSCard Android`
8. Package name: `com.xscard.app` (from your android/app/build.gradle)
9. SHA-1 certificate fingerprint:
   - For debug: Run `cd android && ./gradlew signingReport`
   - For release: Use your release keystore SHA-1
10. Click **Create**

#### For iOS

1. In Google Cloud Console → **Credentials**
2. Create **OAuth 2.0 Client ID**
3. Application type: **iOS**
4. Name: `XSCard iOS`
5. Bundle ID: `com.xscard.app` (from your ios project)
6. App Store ID: (if published)
7. Click **Create**
8. Download the `.plist` file (optional)

### 3. App Configuration

#### Environment Variables

Add to your `.env` or environment configuration:

```bash
# Google OAuth - Web Client ID from Firebase Console
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=628567737496-YOUR_ACTUAL_WEB_CLIENT_ID.apps.googleusercontent.com

# Optional: iOS Client ID (if using separate iOS OAuth)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com

# Optional: Android Client ID (if using separate Android OAuth)
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com
```

#### Update app.config.js (if needed)

If your app.config.js needs Google configuration:

```javascript
export default {
  // ... existing config
  extra: {
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    // ... other config
  }
}
```

### 4. Native Configuration

#### Android Setup

1. **Ensure Google Play Services**

In `android/app/build.gradle`, verify you have:

```gradle
dependencies {
    // ... other dependencies
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
}
```

2. **No additional manifest changes needed** - the `@react-native-google-signin/google-signin` handles this automatically when using the ejected workflow.

#### iOS Setup

1. **Add URL Scheme to Info.plist**

The Google Sign-In library needs a URL scheme. Add to `ios/XSCard/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <!-- Replace with your REVERSED_CLIENT_ID from GoogleService-Info.plist -->
      <string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID</string>
    </array>
  </dict>
</array>
```

2. **Install CocoaPods**

```bash
cd ios
pod install
cd ..
```

### 5. Installation Steps

```bash
# Install the Google Sign-In package
npm install @react-native-google-signin/google-signin

# For iOS, install pods
cd ios && pod install && cd ..

# Rebuild the app
npm run android  # For Android
npm run ios      # For iOS
```

### 6. Testing Google OAuth

#### Test Accounts

Create test Google accounts for development:
- test+google@xscard.com (or use your personal Google account)

#### Test Flow

1. Launch app
2. Navigate to Sign In screen
3. Tap "Continue with Google"
4. Select Google account
5. Grant permissions
6. App should navigate to Main App
7. Check backend logs to verify user document creation

#### Debug Checklist

If Google Sign-In doesn't work:

**Android:**
- [ ] Verify SHA-1 certificate is added to Google Cloud Console
- [ ] Check package name matches exactly
- [ ] Ensure Google Play Services are installed on device/emulator
- [ ] Check web client ID in configuration
- [ ] Look at Logcat for errors: `adb logcat | grep Google`

**iOS:**
- [ ] Verify URL scheme in Info.plist
- [ ] Check bundle ID matches
- [ ] Ensure pods are installed
- [ ] Check web client ID in configuration
- [ ] Look at Xcode console for errors

**Both:**
- [ ] Verify Firebase Authentication has Google provider enabled
- [ ] Check network connectivity
- [ ] Verify API key permissions in Google Cloud Console
- [ ] Check app console logs for detailed errors

### 7. Backend Verification

The backend automatically handles Google OAuth users:

1. **Token Verification**: Firebase Admin SDK verifies the ID token
2. **User Lookup**: Backend checks if user document exists in Firestore
3. **Auto-Creation**: If no user document, backend creates one with provider tracking
4. **Provider Metadata**: `authProvider` field stores sign-in method

No backend code changes needed for Google OAuth - it works through existing Firebase token verification.

## LinkedIn OAuth (Future Phase)

### Preparation Checklist

- [ ] Register app on LinkedIn Developer Portal
- [ ] Get Client ID and Client Secret
- [ ] Configure redirect URIs
- [ ] Implement OAuth flow in `oauthProviders.ts`
- [ ] Add LinkedIn provider configuration
- [ ] Test with LinkedIn test accounts
- [ ] Update backend to support LinkedIn provider metadata

### LinkedIn Flow (Planned)

```
LinkedIn Button → expo-auth-session 
→ LinkedIn authorization code 
→ Exchange for access token (backend)
→ Get LinkedIn profile 
→ Create Firebase custom token (backend)
→ Sign in to Firebase 
→ Existing auth flow
```

## Security Notes

1. **Never commit** OAuth secrets to version control
2. **Use environment variables** for all sensitive credentials
3. **Different credentials** for development and production
4. **Rotate secrets** if compromised
5. **Monitor** OAuth usage in Firebase and Google Cloud consoles
6. **Test** token revocation and logout flows

## Support

If you encounter issues:
1. Check Firebase Console → Authentication → Users
2. Check Google Cloud Console → Logs Explorer
3. Review app logs for detailed error messages
4. Verify all configuration steps above
5. Test with multiple Google accounts


