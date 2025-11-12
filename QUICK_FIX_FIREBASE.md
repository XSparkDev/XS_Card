# 🔥 Quick Fix: Firebase Project Migration

## The Problem
Your app is still using `xscard-addd4` tokens while the backend expects `xscard-dev`, causing 401 errors.

## The Solution

### Step 1: Verify Configuration ✅
Your `.env` file is already correct! Verified with:
```bash
node check-firebase-config.js
```

### Step 2: Restart Expo with Cleared Cache 🔄

**IMPORTANT:** Expo caches environment variables. You MUST restart with `--clear` for changes to take effect.

**Option A: Use the restart script (Recommended)**
```bash
./restart-with-new-config.sh
```

**Option B: Manual restart**
```bash
# Stop your current Expo server (Ctrl+C)

# Clear cache and restart
npx expo start --clear
```

### Step 3: Check the Logs 📋

When the app starts, look for these logs in your console:

```
🔥 [Firebase Config] Initializing with:
   Project ID: xscard-dev          ← Should say "xscard-dev"
   Auth Domain: xscard-dev.firebaseapp.com
   ...
✅ [Firebase Config] Firebase client initialized successfully
   Project: xscard-dev
```

**If you see `xscard-addd4` instead of `xscard-dev`:**
- The cache wasn't cleared properly
- Stop Expo completely
- Delete `.expo` folder: `rm -rf .expo`
- Restart: `npx expo start --clear`

### Step 4: Test Login 🔐

1. Try logging in with: `pule@xspark.co.za` / `Password.10`
2. Check the logs:
   - Frontend should show: `Firebase client initialized for project: xscard-dev`
   - Backend should NOT show the "aud" claim error
   - You should see: `[Auth Middleware] ID token verified successfully`

## Troubleshooting

### Still seeing "xscard-addd4" in errors?

1. **Force stop Expo completely**
   ```bash
   # Kill all node processes
   pkill -f expo
   ```

2. **Clear all caches**
   ```bash
   rm -rf .expo
   rm -rf node_modules/.cache
   rm -rf $TMPDIR/metro-*
   rm -rf $TMPDIR/haste-*
   ```

3. **Verify .env file**
   ```bash
   cat .env | grep EXPO_PUBLIC_FIREBASE_PROJECT_ID
   # Should output: EXPO_PUBLIC_FIREBASE_PROJECT_ID=xscard-dev
   ```

4. **Restart fresh**
   ```bash
   npx expo start --clear
   ```

### Still not working?

Check if environment variables are being loaded:
- The new logging will show exactly what config is being used
- Look for `🔥 [Firebase Config]` logs when the app starts
- If Project ID shows `undefined` or `xscard-addd4`, the .env file isn't being read

## What Changed

1. ✅ Added detailed Firebase initialization logging
2. ✅ Added validation to catch project ID mismatches
3. ✅ Created restart script to clear cache automatically
4. ✅ Configuration checker verifies all values

## Next Steps After Fix

Once authentication works:
1. Test all features that require backend authentication
2. Verify user data is being retrieved correctly
3. Check that Firestore operations use `xscard-dev` project

