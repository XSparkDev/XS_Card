# Firestore Indexes Migration Guide

Firestore indexes cannot be migrated using the Admin SDK. This guide explains how to export and import Firestore indexes using the Firebase CLI.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Exporting Indexes from Source Project](#exporting-indexes-from-source-project)
4. [Importing Indexes to Destination Project](#importing-indexes-to-destination-project)
5. [Manual Index Creation](#manual-index-creation)
6. [Composite Indexes](#composite-indexes)
7. [Troubleshooting](#troubleshooting)

## Overview

Firestore uses two types of indexes:

1. **Single-field indexes**: Automatically created for all fields (no migration needed)
2. **Composite indexes**: Required for complex queries (must be migrated)

**Important**: Only composite indexes need to be migrated. Single-field indexes are created automatically.

## Prerequisites

1. **Firebase CLI installed**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Authenticated with Firebase CLI**:
   ```bash
   firebase login
   ```

3. **Access to both source and destination projects**

## Exporting Indexes from Source Project

### Step 1: List Available Projects

```bash
firebase projects:list
```

Note the project IDs for both source (`xscard-addd4`) and destination (`xscard-dev`).

### Step 2: Initialize Firebase in a Temporary Directory (Optional)

If you don't have a Firebase project initialized:

```bash
mkdir firestore-index-export
cd firestore-index-export
firebase init firestore
```

When prompted:
- Select your **source project** (`xscard-addd4`)
- Use existing `firestore.rules` and `firestore.indexes.json` files (or create new ones)

### Step 3: Export Indexes from Source Project

**Method 1: Using Firebase Console (Easiest)**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **source project** (`xscard-addd4`)
3. Navigate to **Firestore Database** → **Indexes**
4. Click the **Export** button (if available)
5. Save the exported JSON file

**Method 2: Using Firebase CLI**

```bash
# Set the source project
firebase use xscard-addd4

# Pull the indexes configuration
firebase firestore:indexes

# This will show the indexes. To export, use:
firebase firestore:indexes > source-indexes.json
```

**Method 3: Download from Firebase Console**

1. Go to Firebase Console → Firestore → Indexes
2. Copy all the composite indexes listed
3. Create a `firestore.indexes.json` file manually (see format below)

### Step 4: Review Exported Indexes

The indexes file should look like this:

```json
{
  "indexes": [
    {
      "collectionGroup": "events",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "registrations",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "eventId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "registeredAt",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

## Importing Indexes to Destination Project

### Step 1: Switch to Destination Project

```bash
firebase use xscard-dev
```

Or if not using a project:

```bash
firebase firestore:indexes --project xscard-dev
```

### Step 2: Create firestore.indexes.json in Your Project

If you have a Firebase project initialized:

```bash
# In your project root (where firebase.json exists)
# Edit or create firestore.indexes.json
```

Or create a temporary directory:

```bash
mkdir firestore-index-import
cd firestore-index-import

# Initialize Firebase
firebase init firestore
# Select destination project: xscard-dev
```

### Step 3: Copy Indexes Configuration

Copy the indexes from your exported file to `firestore.indexes.json`:

```bash
# Copy the indexes array from source-indexes.json
# Paste into firestore.indexes.json
```

### Step 4: Deploy Indexes

```bash
# Make sure you're using the destination project
firebase use xscard-dev

# Deploy the indexes
firebase deploy --only firestore:indexes
```

**Expected Output:**
```
=== Deploying to 'xscard-dev'...

i  deploying firestore:indexes
i  firestore: checking firestore.indexes.json for compilation errors...
✔  firestore: compiled indexes successfully
i  firestore: uploading indexes...

✔  firestore: deployed indexes successfully

✔  Deploy complete!
```

### Step 5: Verify Indexes

1. Go to Firebase Console → Select destination project (`xscard-dev`)
2. Navigate to **Firestore Database** → **Indexes**
3. Verify all indexes are listed and building

**Note**: Indexes may take several minutes to build depending on collection size.

## Manual Index Creation

If you prefer to create indexes manually through the Firebase Console:

### Step 1: Identify Required Indexes

From your source project's Firestore Console:
1. Note all composite indexes listed
2. Document the collection and field combinations

### Step 2: Create Indexes in Destination

1. Go to destination Firebase Console (`xscard-dev`)
2. Navigate to **Firestore Database** → **Indexes**
3. Click **Create Index**
4. For each index:
   - Select the **Collection ID**
   - Add fields in the correct order
   - Set sort order (Ascending/Descending) for each field
   - Click **Create**

### Step 3: Wait for Index Build

Indexes will show as "Building" until ready. Large collections may take 10-30 minutes.

## Composite Indexes

### Understanding Composite Indexes

Composite indexes are required for queries that:
- Filter on multiple fields
- Combine filters with ordering
- Use range queries on multiple fields
- Use `!=` or `in` operators with other filters

### Example: When Index is Needed

**Query requiring composite index:**
```javascript
db.collection('events')
  .where('status', '==', 'published')
  .where('category', '==', 'tech')
  .orderBy('createdAt', 'desc')
  .get();
```

This needs an index on: `status (ASC)`, `category (ASC)`, `createdAt (DESC)`

### Common Index Patterns

**Users Collection:**
- `status + createdAt` (for active users sorted by date)
- `email + createdAt` (for search with date ordering)

**Events Collection:**
- `status + startDate` (for published events sorted by date)
- `organiserId + status + createdAt` (for organiser's events)

**Registrations Collection:**
- `eventId + userId` (for checking user registration)
- `userId + registeredAt` (for user's registrations)
- `eventId + status + registeredAt` (for event registrations with status)

## Troubleshooting

### Error: "Index already exists"

**Solution**: The index may already be created automatically or manually. Check Firebase Console to verify.

### Error: "Invalid index definition"

**Solution**: 
1. Verify JSON syntax is correct
2. Ensure all required fields are included
3. Check field paths match your Firestore schema

### Indexes Not Building

**Common Causes:**
1. **No data in collection**: Indexes build only when collection has documents
2. **Missing documents matching index**: If no documents match the index criteria, it won't build
3. **Firestore quotas**: Check if you've hit daily quotas

**Solution**: 
- Add test documents if collection is empty
- Wait a few minutes and refresh
- Check Firebase Console for quota limits

### Missing Index Error in Application

If your app throws "index not found" errors:

1. **Check Firebase Console**: Verify index exists and is built
2. **Check Query**: Ensure query matches index exactly (field order matters)
3. **Create Missing Index**: Use the error link provided, or manually create

### Export Shows No Indexes

**Possible Reasons:**
1. Only single-field indexes exist (these don't need migration)
2. Indexes are created automatically and not exported
3. No composite indexes are defined

**Solution**: Check Firebase Console manually for any composite indexes.

## Index Migration Checklist

- [ ] Export indexes from source project
- [ ] Review exported indexes JSON
- [ ] Switch to destination project in Firebase CLI
- [ ] Create/update `firestore.indexes.json`
- [ ] Deploy indexes to destination project
- [ ] Verify indexes appear in Firebase Console
- [ ] Wait for indexes to finish building
- [ ] Test queries in application to ensure indexes work

## Best Practices

1. **Export indexes before migration** to have a backup
2. **Review index definitions** to ensure they match your data structure
3. **Deploy indexes early** so they can build while you migrate data
4. **Test queries** after migration to verify indexes work correctly
5. **Monitor index build status** in Firebase Console
6. **Keep `firestore.indexes.json`** in version control for future reference

## Alternative: Using Firebase Console Directly

If CLI isn't available:

1. **Source Project**:
   - Open Firebase Console → Firestore → Indexes
   - Screenshot or document each composite index (collection, fields, order)

2. **Destination Project**:
   - Open Firebase Console → Firestore → Indexes
   - Click "Create Index" for each documented index
   - Recreate manually using the same field combinations and orders

This method is slower but doesn't require Firebase CLI.

## Additional Resources

- [Firestore Index Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Composite Index Best Practices](https://firebase.google.com/docs/firestore/query-data/indexing#best_practices)

