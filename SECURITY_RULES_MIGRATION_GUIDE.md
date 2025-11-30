# Firestore Security Rules Migration Guide

This guide explains how to copy Firestore security rules from one Firebase project to another.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Method 1: Using Firebase Console (Easiest)](#method-1-using-firebase-console-easiest)
4. [Method 2: Using Firebase CLI (Recommended)](#method-2-using-firebase-cli-recommended)
5. [Method 3: Export/Import via Files](#method-3-exportimport-via-files)
6. [Verifying Rules](#verifying-rules)
7. [Testing Rules](#testing-rules)
8. [Troubleshooting](#troubleshooting)

## Overview

Firestore security rules control access to your database. They must be migrated separately from data and indexes.

**Important**: Security rules are critical for data protection. Always review and test rules after migration!

## Prerequisites

1. **Access to both Firebase projects**:
   - Source: `xscard-addd4`
   - Destination: `xscard-dev`

2. **Firebase CLI installed** (for Method 2):
   ```bash
   npm install -g firebase-tools
   ```

3. **Permissions**: Admin/Owner access to both projects

## Method 1: Using Firebase Console (Easiest)

### Step 1: Copy Rules from Source Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **source project** (`xscard-addd4`)
3. Navigate to **Firestore Database** → **Rules** tab
4. **Copy** all the rules text (select all and copy)

### Step 2: Paste Rules to Destination Project

1. Switch to **destination project** (`xscard-dev`)
2. Navigate to **Firestore Database** → **Rules** tab
3. **Paste** the copied rules
4. Click **Publish**

### Step 3: Verify Rules

1. Review the rules in the Rules Editor
2. Check for any project-specific references that need updating
3. Test rules using the Rules Simulator (see [Testing Rules](#testing-rules))

**Pros**: 
- No CLI required
- Visual editor available
- Immediate preview

**Cons**:
- Manual copy/paste
- No version control
- Easy to miss updates

## Method 2: Using Firebase CLI (Recommended)

### Step 1: Initialize Firebase Project (if not already done)

```bash
# Navigate to your project directory
cd /path/to/your/project

# Initialize Firebase (if not already initialized)
firebase init firestore
```

When prompted:
- Select your **source project** (`xscard-addd4`)
- Use existing `firestore.rules` or create new
- Don't overwrite existing files if you have custom setup

### Step 2: Pull Rules from Source Project

```bash
# Make sure you're using the source project
firebase use xscard-addd4

# Pull the current rules
firebase firestore:rules:get > firestore.rules
```

Or if you already have a project initialized:

```bash
# The rules should already be in firestore.rules
# If not, pull them:
firebase firestore:rules:get
```

### Step 3: Review Rules File

Open `firestore.rules` and review the rules. Look for:
- Project-specific references
- Hardcoded user IDs
- Environment-specific conditions

**Example firestore.rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // User's contacts subcollection
      match /contacts/{contactId} {
        allow read, write: if request.auth != null && 
          request.auth.uid == userId;
      }
    }
    
    // Events collection
    match /events/{eventId} {
      allow read: if resource.data.status == 'published';
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        request.auth.uid == resource.data.organiserId;
    }
    
    // Registrations collection
    match /registrations/{registrationId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

### Step 4: Update Project Reference (if needed)

If rules contain project-specific logic, update it:

```javascript
// Example: Update project ID reference
// Before:
functions.httpsCallable('xscard-addd4', 'someFunction')

// After:
functions.httpsCallable('xscard-dev', 'someFunction')
```

### Step 5: Deploy Rules to Destination Project

```bash
# Switch to destination project
firebase use xscard-dev

# Deploy the rules
firebase deploy --only firestore:rules
```

**Expected Output:**
```
=== Deploying to 'xscard-dev'...

i  deploying firestore:rules
i  firestore: checking firestore.rules for compilation errors...
✔  firestore: rules file compiled successfully
i  firestore: uploading rules...

✔  firestore: rules deployed successfully

✔  Deploy complete!
```

### Step 6: Verify Deployment

1. Go to Firebase Console → Destination project (`xscard-dev`)
2. Navigate to **Firestore Database** → **Rules**
3. Verify rules match what you deployed

## Method 3: Export/Import via Files

If you want to manually manage the rules file:

### Step 1: Export Rules from Source

**Using Firebase Console:**
1. Go to source project → Firestore → Rules
2. Click the download icon or copy rules text
3. Save to `firestore.rules` file

**Using Firebase CLI:**
```bash
firebase use xscard-addd4
firebase firestore:rules:get > firestore-source.rules
```

### Step 2: Review and Edit Rules

Open the rules file in a text editor:
- Review for any project-specific references
- Update any hardcoded values
- Ensure rules match your data structure

### Step 3: Import Rules to Destination

**Using Firebase Console:**
1. Open destination project → Firestore → Rules
2. Replace contents with rules from file
3. Click **Publish**

**Using Firebase CLI:**
```bash
firebase use xscard-dev
firebase deploy --only firestore:rules
```

## Verifying Rules

### 1. Visual Verification

In Firebase Console → Firestore → Rules:
- Rules should be visible and properly formatted
- No syntax errors highlighted
- Rules structure matches source project

### 2. Rules Simulator

Use the Rules Simulator in Firebase Console:

1. Go to **Firestore Database** → **Rules** tab
2. Click **Rules Simulator** (or find it in the rules editor)
3. Test various scenarios:
   - Authenticated reads
   - Unauthenticated reads
   - Writes by document owner
   - Writes by non-owners

**Example Test:**
- **Location**: `/users/user123`
- **Authenticated**: Yes (User ID: `user123`)
- **Operation**: Read
- **Expected**: Allowed ✓

### 3. Programmatic Testing

Test rules in your application:

```javascript
// Test read access
const userDoc = await db.collection('users').doc(userId).get();

// Test write access
await db.collection('users').doc(userId).update({ name: 'Test' });
```

## Testing Rules

### Common Rule Tests

**1. User Can Read Own Data:**
```
Location: /users/{userId}
Auth: userId = current user
Operation: Read
Expected: Allowed
```

**2. User Cannot Read Other Users' Data:**
```
Location: /users/{otherUserId}
Auth: userId ≠ current user
Operation: Read
Expected: Denied (if rules restrict)
```

**3. Public Read, Authenticated Write:**
```
Location: /events/{eventId}
Auth: null (public)
Operation: Read
Expected: Allowed (if event is published)

Auth: authenticated user
Operation: Write
Expected: Allowed (if user is organiser)
```

### Using Rules Simulator

1. Go to Firebase Console → Firestore → Rules
2. Click **Rules Simulator**
3. Configure test:
   - **Location**: Document path to test
   - **Authenticated**: Whether request is authenticated
   - **User ID**: If authenticated, the user ID
   - **Operation**: Read, Write, Delete, List
   - **Data**: Request data for write operations

4. Click **Run** to see if rule allows/denies

## Troubleshooting

### Error: "Rules compilation failed"

**Common Causes:**
1. Syntax errors (missing semicolons, brackets)
2. Invalid functions or operators
3. Type mismatches

**Solution:**
1. Check Firebase Console for specific error line
2. Validate syntax using Rules Simulator
3. Test rules incrementally (comment out sections)

### Error: "Permission denied" after migration

**Possible Causes:**
1. Rules are more restrictive than source
2. User authentication not set up correctly
3. Missing required fields in documents

**Solution:**
1. Compare rules side-by-side with source project
2. Check authentication setup
3. Verify document structure matches rule expectations
4. Use Rules Simulator to debug specific paths

### Rules Don't Match Source Project

**Solution:**
1. Re-export rules from source project
2. Compare line-by-line
3. Check for any manual edits that weren't saved

### Rules Not Taking Effect

**Possible Causes:**
1. Rules not published (only saved as draft)
2. Browser cache showing old rules
3. Wrong project selected

**Solution:**
1. Ensure you clicked **Publish** in Firebase Console
2. Clear browser cache
3. Verify correct project is selected
4. Wait a few seconds for rules to propagate

## Security Rules Best Practices

1. **Review Rules Before Deployment**
   - Never deploy untested rules
   - Use Rules Simulator first
   - Test with real authentication scenarios

2. **Version Control**
   - Keep `firestore.rules` in Git
   - Tag releases with rule versions
   - Document changes in commit messages

3. **Principle of Least Privilege**
   - Only grant minimum necessary permissions
   - Test denial scenarios as well as allow scenarios

4. **Regular Audits**
   - Review rules periodically
   - Test after schema changes
   - Verify rules match application behavior

## Common Rule Patterns

### Pattern 1: User-Owned Documents

```javascript
match /users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && 
    request.auth.uid == userId;
}
```

### Pattern 2: Public Read, Owner Write

```javascript
match /events/{eventId} {
  allow read: if resource.data.status == 'published';
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null && 
    request.auth.uid == resource.data.organiserId;
}
```

### Pattern 3: Authenticated Access Only

```javascript
match /contacts/{contactId} {
  allow read, write: if request.auth != null;
}
```

### Pattern 4: Admin-Only Access

```javascript
match /admin/{document=**} {
  allow read, write: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.admin == true;
}
```

## Migration Checklist

- [ ] Export rules from source project
- [ ] Review rules for project-specific references
- [ ] Update any hardcoded project IDs or references
- [ ] Test rules in Rules Simulator
- [ ] Deploy rules to destination project
- [ ] Verify rules are published (not just saved)
- [ ] Test authentication scenarios
- [ ] Test read/write operations in application
- [ ] Document any rule changes made during migration

## Additional Resources

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Rules Language Reference](https://firebase.google.com/docs/rules/rules-language)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Rules Testing Guide](https://firebase.google.com/docs/firestore/security/test-rules-emulator)



