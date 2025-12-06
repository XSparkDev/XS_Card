# iOS Force Update / Nudge Update System

This guide explains how to use the iOS update system to force or nudge users to update when a new build is pushed to the App Store.

## Overview

The system consists of:
1. **Backend**: iOS version controller and routes to manage app versions
2. **Frontend**: Update check service and modal component
3. **Integration**: Automatic check on app launch and when app comes to foreground

## How It Works

1. When a new iOS build is published to App Store, register it in the backend
2. The app automatically checks for updates on launch and when coming to foreground
3. If an update is available, a modal is shown:
   - **Force Update**: User cannot dismiss, must update to continue
   - **Nudge Update**: User can dismiss and update later

## Backend Setup

### Register a New iOS Version

When you publish a new build to App Store, register it using the API:

```bash
POST /register-ios-version
Content-Type: application/json

{
  "version": "2.0.8",                    // Semantic version (e.g., "2.0.8")
  "buildNumber": "27",                    // Build number from app.json (expo.ios.buildNumber)
  "isMinimumRequired": false,            // Set to true to force update
  "updateMessage": "New features and bug fixes!",  // Custom message
  "updateUrl": "https://apps.apple.com/app/id6742452317",  // App Store URL
  "releaseNotes": "• Bug fixes\n• Performance improvements\n• New features"
}
```

### Force Update

To force users to update, set `isMinimumRequired: true`:

```bash
POST /register-ios-version
{
  "version": "2.0.8",
  "buildNumber": "27",
  "isMinimumRequired": true,  // This forces update
  "updateMessage": "This version is required for security updates. Please update now.",
  "releaseNotes": "Critical security update"
}
```

### Get All Versions

```bash
GET /ios-versions
```

Returns all registered iOS versions.

## Frontend Behavior

### Automatic Checks

- **On App Launch**: Checks for updates 2 seconds after app starts (iOS only)
- **On Foreground**: Checks when app comes to foreground from background (iOS only)
- **Throttling**: Maximum one check every 5 minutes to avoid excessive API calls

### Update Modal

The modal shows:
- Update message
- Release notes (if provided)
- Current vs latest version
- "Update Now" button (opens App Store)
- "Later" button (only for nudge updates, not force updates)

## API Endpoints

### Public Endpoints (No Auth Required)

- `GET /ios-version-info` - Get latest version info
- `POST /ios-version-check` - Check if current version needs update

### Admin Endpoints

- `POST /register-ios-version` - Register a new version
- `GET /ios-versions` - Get all versions

## Example Workflow

1. **Build and publish** new version to App Store (e.g., version 2.0.8, build 27)

2. **Register the version** (optional - for nudge update):
```bash
curl -X POST http://your-server/register-ios-version \
  -H "Content-Type: application/json" \
  -d '{
    "version": "2.0.8",
    "buildNumber": "27",
    "isMinimumRequired": false,
    "updateMessage": "A new version is available with exciting features!",
    "releaseNotes": "• New features\n• Bug fixes"
  }'
```

3. **Users with older versions** will see the update modal when they:
   - Launch the app
   - Bring the app to foreground

4. **For critical updates**, register with `isMinimumRequired: true`:
```bash
curl -X POST http://your-server/register-ios-version \
  -H "Content-Type: application/json" \
  -d '{
    "version": "2.0.8",
    "buildNumber": "27",
    "isMinimumRequired": true,
    "updateMessage": "Critical security update required",
    "releaseNotes": "This update fixes critical security vulnerabilities"
  }'
```

## Version Comparison

The system compares:
- **Semantic versions** (e.g., "2.0.8" vs "2.0.7")
- **Build numbers** (e.g., "27" vs "26")

If either the version or build number is lower than the latest, an update is available.

## Firebase Collections

The system uses Firebase Firestore:
- **Collection**: `ios_versions`
- **Fields**:
  - `version`: Semantic version string
  - `buildNumber`: Build number (integer)
  - `isLatest`: Boolean (only one should be true)
  - `isMinimumRequired`: Boolean (forces update if true)
  - `updateMessage`: Message shown to users
  - `updateUrl`: App Store URL
  - `releaseNotes`: Release notes text
  - `uploadDate`: Timestamp
  - `publishedAt`: Timestamp

## Testing

1. Register a test version with a higher version number
2. Launch the app (should see update modal)
3. Test force update by setting `isMinimumRequired: true`
4. Test nudge update by setting `isMinimumRequired: false`

## Notes

- Only works on iOS (Android has separate APK system)
- Update checks are throttled to avoid excessive API calls
- The modal automatically opens App Store when "Update Now" is tapped
- Force updates cannot be dismissed by users

