# Deep Linking Test - Verify URL Scheme Works

## Quick Test (5 minutes)

This test will verify your URL scheme is configured correctly before implementing OAuth.

### Test on Physical Device (Recommended)

**iOS:**
1. Build and run your app on a physical iPhone
2. Open Safari on the iPhone
3. Type in address bar: `com.p.zzles.xscard://test`
4. Tap Go
5. **Expected:** App should open (or prompt to open)

**Android:**
1. Build and run your app on a physical Android device
2. Open Chrome on the device
3. Type in address bar: `com.p.zzles.xscard://test`
4. Tap Go
5. **Expected:** App should open (or prompt to open)

### Test via Terminal (Alternative)

**iOS:**
```bash
xcrun simctl openurl booted "com.p.zzles.xscard://test"
```

**Android:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "com.p.zzles.xscard://test" com.p.zzles.xscard
```

### What This Tests

✅ URL scheme is registered correctly
✅ App can receive deep links
✅ OAuth redirects will work

### If It Doesn't Work

- Check `app.json` has `"scheme": "com.p.zzles.xscard"`
- Check iOS `Info.plist` has the scheme
- Check Android `AndroidManifest.xml` has intent filter
- Rebuild the app after any changes

