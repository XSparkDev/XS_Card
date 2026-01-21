# TestFlight Force Update Testing Plan

## Current Version Context

Based on `version-adjuster.js` and current app state:
- **Current iOS Version**: `207` (from `app.json`)
- **Current iOS Build Number**: `26` (from `app.json`)
- **Version Format**: The app uses numeric version (`207`) format
- **Version Adjuster**: Script can handle both numeric and semantic versions

✅ **UPDATED**: The version comparison function in `iosVersionController.js` now supports both:
- **Numeric versions**: `207`, `208` (no dots) - compared as integers
- **Semantic versions**: `2.0.7`, `2.0.8` (with dots) - compared semantically
- **Mixed comparisons**: Automatically handles comparing numeric vs semantic versions

## Pre-Testing Checklist

### 1. Verify Current App Version
```bash
node version-adjuster.js check
```

Expected output should show:
- package.json version
- Android build.gradle version
- iOS version and buildNumber

### 2. Ensure Backend is Running
- Backend server must be accessible
- iOS version routes must be registered
- Firebase `ios_versions` collection must be accessible

### 3. Prepare TestFlight Builds

You'll need **TWO** TestFlight builds:
- **Build A (Old Version)**: Current version that will be "outdated"
- **Build B (New Version)**: Newer version that will force update

## Testing Steps

### Phase 1: Prepare Test Builds

#### Step 1.1: Create Base Build (Build A - Old Version)
1. **Note current version**:
   ```bash
   node version-adjuster.js check
   ```
   Example: Version `207`, Build `26`

2. **Build and upload to TestFlight**:
   - Build iOS app with current version
   - Upload to TestFlight
   - **DO NOT** distribute yet
   - **Note the version and build number** (e.g., `207` / `26`)

#### Step 1.2: Create New Build (Build B - New Version)
1. **Bump version** using version-adjuster:
   ```bash
   # Using numeric format (recommended for your current setup):
   node version-adjuster.js 208 27
   
   # OR using semantic versioning (also supported):
   node version-adjuster.js 2.0.8 27
   
   # The backend now supports both formats!
   ```

2. **Build and upload to TestFlight**:
   - Build iOS app with new version
   - Upload to TestFlight
   - **DO NOT** distribute yet
   - **Note the version and build number** (e.g., `2.0.8` / `27` or `208` / `27`)

### Phase 2: Register Versions in Backend

#### Step 2.1: Register Base Version (Build A)
```bash
curl -X POST https://baseurl.xscard.co.za/register-ios-version \
  -H "Content-Type: application/json" \
  -d '{
    "version": "207",
    "buildNumber": "26",
    "isMinimumRequired": false,
    "isLatest": true,
    "updateMessage": "Base version for testing",
    "updateUrl": "https://apps.apple.com/app/id6742452317",
    "releaseNotes": "Base test version"
  }'
```

#### Step 2.2: Register New Version (Build B) as Latest
```bash
curl -X POST https://baseurl.xscard.co.za/register-ios-version \
  -H "Content-Type: application/json" \
  -d '{
    "version": "208",
    "buildNumber": "27",
    "isMinimumRequired": false,
    "isLatest": true,
    "updateMessage": "A new version is available with exciting features!",
    "updateUrl": "https://apps.apple.com/app/id6742452317",
    "releaseNotes": "• New features\n• Bug fixes\n• Performance improvements"
  }'
```

**Expected Result**: 
- Build B is now marked as `isLatest: true`
- Build A is automatically marked as `isLatest: false`
- Users with Build A should see a **nudge update** (can dismiss)

### Phase 3: Test Nudge Update (Optional Update)

#### Step 3.1: Install Build A on Test Device
1. Distribute Build A to TestFlight testers
2. Install Build A on test device
3. Launch the app

#### Step 3.2: Verify Nudge Update Appears
**Expected Behavior**:
- After ~2 seconds, update modal appears
- Shows "Update Available" (not "Update Required")
- Shows "Update Now" button
- Shows "Later" button (can dismiss)
- User can tap "Later" and continue using app

#### Step 3.3: Test Update Flow
1. Tap "Update Now"
2. Should open App Store/TestFlight
3. User can update from TestFlight

### Phase 4: Test Force Update

#### Step 4.1: Register Build B as Force Update
```bash
curl -X POST https://baseurl.xscard.co.za/register-ios-version \
  -H "Content-Type: application/json" \
  -d '{
    "version": "208",
    "buildNumber": "27",
    "isMinimumRequired": true,
    "isLatest": true,
    "updateMessage": "This version is required for security updates. Please update now.",
    "updateUrl": "https://apps.apple.com/app/id6742452317",
    "releaseNotes": "Critical security update - This update fixes critical security vulnerabilities and is required to continue using the app."
  }'
```

**Expected Result**: 
- Build B is marked as `isMinimumRequired: true`
- Any version older than Build B will be forced to update

#### Step 4.2: Test Force Update on Build A
1. **Keep Build A installed** on test device (don't update)
2. **Close and reopen the app**
3. **Or bring app to foreground** from background

**Expected Behavior**:
- Update modal appears immediately
- Shows "Update Required" (not "Update Available")
- Shows "Update Now" button
- **NO "Later" button** (cannot dismiss)
- User **cannot** dismiss the modal
- User **must** tap "Update Now" to continue
- Tapping "Update Now" opens TestFlight/App Store

#### Step 4.3: Verify Force Update Blocks App Usage
1. Try to dismiss modal (tap outside, swipe down, etc.)
2. **Expected**: Modal should NOT dismiss
3. Try to use app behind modal
4. **Expected**: App should be blocked until update

### Phase 5: Test After Update

#### Step 5.1: Update to Build B
1. Install Build B from TestFlight
2. Launch the app

#### Step 5.2: Verify No Update Modal
**Expected Behavior**:
- No update modal appears
- App launches normally
- User can use app without interruption

### Phase 6: Test Foreground Check

#### Step 6.1: Test App Foreground Trigger
1. Install Build A on device
2. Launch app (should see force update if configured)
3. **Dismiss/ignore** if nudge update (or update if force)
4. Put app in background
5. Bring app to foreground

**Expected Behavior**:
- Update check runs when app comes to foreground
- If update available, modal appears again
- Throttling: Only checks once every 5 minutes max

## Version Format Considerations

### ✅ Version Format Support
The backend now supports **both** numeric and semantic version formats:

- **Numeric format**: `207`, `208` (no dots) - works perfectly
- **Semantic format**: `2.0.7`, `2.0.8` (with dots) - also supported
- **Mixed comparisons**: Can compare numeric vs semantic versions automatically

### Recommended Approach
For TestFlight testing, you can use **either format**:
- **Numeric**: Current `207` (build 26) → New `208` (build 27)
- **Semantic**: Current `2.0.7` (build 26) → New `2.0.8` (build 27)

Both will work correctly with the updated backend comparison function!

## API Testing Commands

### Check Current Version Info
```bash
curl https://baseurl.xscard.co.za/ios-version-info
```

### Check Specific Version
```bash
curl -X POST https://baseurl.xscard.co.za/ios-version-check \
  -H "Content-Type: application/json" \
  -d '{
    "currentVersion": "207",
    "currentBuildNumber": "26"
  }'
```

### List All Registered Versions
```bash
curl https://baseurl.xscard.co.za/ios-versions
```

## Troubleshooting

### Issue: Update modal doesn't appear
**Check**:
1. Is backend accessible? Test with `curl` commands above
2. Is version registered correctly? Check Firebase `ios_versions` collection
3. Are version numbers correct? Use `node version-adjuster.js check`
4. Check app logs for `[UpdateCheck]` messages
5. Verify iOS platform check (only runs on iOS)

### Issue: Version comparison not working
**Check**:
1. Version format matches (semantic vs numeric)
2. Build numbers are integers
3. `isLatest` flag is set correctly
4. `isMinimumRequired` flag is set correctly

### Issue: Force update allows dismissal
**Check**:
1. `isMinimumRequired: true` is set in backend
2. `forceUpdate` prop is passed correctly to `UpdateModal`
3. Modal's `onRequestClose` is undefined for force updates

### Issue: Update check runs too frequently
**Expected**: Throttling limits checks to once per 5 minutes
**Check**: `UPDATE_CHECK_INTERVAL` in `App.tsx` (should be 5 minutes)

## Success Criteria

✅ **Nudge Update Test**:
- Modal appears on launch
- "Later" button works
- User can dismiss and continue

✅ **Force Update Test**:
- Modal appears on launch
- No "Later" button
- Modal cannot be dismissed
- User must update to continue

✅ **Foreground Check**:
- Update check runs when app comes to foreground
- Throttling works (max once per 5 minutes)

✅ **After Update**:
- No modal appears for latest version
- App works normally

## Next Steps After Testing

1. **Document results**: Note any issues or edge cases
2. **Adjust version format**: If needed, convert to semantic versioning
3. **Production readiness**: Once tested, system is ready for App Store production
4. **Monitor**: Watch Firebase logs for version check requests

## Notes

- TestFlight builds can take time to process (15-60 minutes)
- Version registration can be done before or after TestFlight upload
- You can test with multiple devices/builds simultaneously
- Backend must be accessible from test devices (use production URL for TestFlight)

