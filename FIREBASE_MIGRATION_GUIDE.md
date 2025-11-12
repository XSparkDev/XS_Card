# Firebase Migration Guide: xscard-addd4 → xscard-dev

This guide will help you migrate your frontend configuration from the old Firebase project (`xscard-addd4`) to the new one (`xscard-dev`).

## Current Issue

The frontend is still using `xscard-addd4` while the backend expects `xscard-dev`, causing authentication errors:
```
Firebase ID token has incorrect "aud" (audience) claim. 
Expected "xscard-dev" but got "xscard-addd4"
```

## Step 1: Get Firebase Config for xscard-dev

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select the **xscard-dev** project
3. Click the gear icon ⚙️ → **Project settings**
4. Scroll down to **Your apps** section
5. If you don't have a web app, click **Add app** → **Web** (</> icon)
6. Copy the following values from the config object:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",                    // EXPO_PUBLIC_FIREBASE_API_KEY
  authDomain: "xscard-dev.firebaseapp.com",  // EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: "xscard-dev",              // EXPO_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: "xscard-dev.appspot.com",   // EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789",       // EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:123456789:web:abc123"       // EXPO_PUBLIC_FIREBASE_APP_ID
};
```

## Step 2: Set Environment Variables

You have two options:

### Option A: Create a `.env` file (Recommended for local development)

Create a `.env` file in the project root:

```bash
# Firebase Configuration for xscard-dev
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=xscard-dev.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xscard-dev
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=xscard-dev.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Important:** Add `.env` to `.gitignore` to keep your keys secure!

### Option B: Set as System Environment Variables

```bash
export EXPO_PUBLIC_FIREBASE_API_KEY="AIza..."
export EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="xscard-dev.firebaseapp.com"
export EXPO_PUBLIC_FIREBASE_PROJECT_ID="xscard-dev"
export EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="xscard-dev.appspot.com"
export EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
export EXPO_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abc123"
```

## Step 3: Verify Backend Configuration

Make sure your `backend/.env` file has:

```bash
FIREBASE_PROJECT_ID=xscard-dev
# ... other Firebase credentials for xscard-dev
```

## Step 4: Rebuild the App

After setting environment variables, you **must rebuild** the app for changes to take effect:

```bash
# Clear cache and rebuild
npx expo start --clear

# For production builds
npx expo prebuild --clean
npx expo run:ios    # or run:android
```

## Step 5: Verify Migration

1. Check the console logs when the app starts
2. You should see: `Firebase client initialized for project: xscard-dev`
3. Try logging in - authentication should work without the "aud" claim error

## Troubleshooting

### Still seeing "xscard-addd4" in errors?

1. **Clear Expo cache:**
   ```bash
   npx expo start --clear
   ```

2. **Check environment variables are loaded:**
   ```bash
   # In your terminal, before running expo
   echo $EXPO_PUBLIC_FIREBASE_PROJECT_ID
   # Should output: xscard-dev
   ```

3. **Verify app.config.js:**
   The config should read from `process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID`

4. **Rebuild native apps:**
   ```bash
   npx expo prebuild --clean
   ```

### Missing configuration error?

The app will now throw an error at startup if any Firebase config values are missing. Check the console for which variables need to be set.

## Next Steps

After successful migration:
- ✅ Users will authenticate against `xscard-dev`
- ✅ All data operations will use `xscard-dev` Firestore
- ✅ Backend and frontend will be in sync
- ✅ No more "aud" claim errors

## Notes

- The old project (`xscard-addd4`) still has the Blaze plan - you may want to downgrade it
- Make sure you've migrated all data from `xscard-addd4` to `xscard-dev` before switching
- Keep the old project credentials as backup until migration is fully verified

