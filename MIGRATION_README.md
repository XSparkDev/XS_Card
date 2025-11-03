# Firestore Database Migration Guide

This guide explains how to migrate Firestore data from one Firebase project to another using the migration script.

## ⚠️ Important: Source Database is Never Modified

**The migration script ONLY COPIES data - it never deletes or modifies the source database.**

- ✅ **Source database (`xscard-addd4`)**: Read-only, completely untouched
- ✅ **Destination database (`xscard-dev`)**: Receives copied data (duplicates)
- ❌ **Never deletes** from source
- ❌ **Never modifies** source data

Your source database remains exactly as it was. This is a safe, non-destructive copy operation.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup](#setup)
3. [Service Account Setup](#service-account-setup)
4. [Usage](#usage)
5. [Migration Modes](#migration-modes)
6. [Examples](#examples)
7. [Troubleshooting](#troubleshooting)
8. [Safety Features](#safety-features)

## Prerequisites

- Node.js (v14 or higher)
- Access to both source and destination Firebase projects
- Service account keys for both projects
- Firebase Admin SDK permissions for both projects

## Setup

### 1. Install Dependencies

Navigate to the `backend` directory and install the required dependencies:

```bash
cd backend
npm install
```

The migration script requires:
- `firebase-admin` (already in package.json)
- `commander` (CLI argument parsing)
- `chalk` (colored console output)

### 2. Service Account Setup

#### Get Service Account Keys

1. **Source Project** (`xscard-addd4`):
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select project: `xscard-addd4`
   - Go to **Project Settings** (gear icon) → **Service Accounts** tab
   - Click **"Generate New Private Key"**
   - Save the downloaded JSON file as `backend/source-serviceAccount.json`
   - ⚠️ **Important**: Place it directly in the `backend/` folder, NOT in `backend/scripts/`

2. **Destination Project** (`xscard-dev`):
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select project: `xscard-dev`
   - Go to **Project Settings** (gear icon) → **Service Accounts** tab
   - Click **"Generate New Private Key"**
   - Save the downloaded JSON file as `backend/dest-serviceAccount.json`
   - ⚠️ **Important**: Place it directly in the `backend/` folder, NOT in `backend/scripts/`

**Important Security Note**: 
- These files contain sensitive credentials. Never commit them to version control.
- Add them to `.gitignore`:
  ```
  backend/source-serviceAccount.json
  backend/dest-serviceAccount.json
  ```

### 3. Verify File Structure

Ensure your files are in the correct location:

```
backend/
├── scripts/
│   └── migrate-firestore.js
├── source-serviceAccount.json  ← Must be here
└── dest-serviceAccount.json    ← Must be here
```

**File Location Verification:**
- The script looks for files at: `backend/source-serviceAccount.json` and `backend/dest-serviceAccount.json`
- If you're running from `backend/scripts/`, the files should be in the parent directory (`backend/`)
- You can verify the paths by checking the error message if files are missing

## Usage

### Basic Command

```bash
# From the backend directory
node scripts/migrate-firestore.js [options]
```

Or use the npm script:

```bash
npm run migrate-firestore [options]
```

### Command-Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `-m, --mode <mode>` | Migration mode: `overwrite`, `merge`, or `clear-then-copy` | `merge` |
| `-c, --collections <list>` | Comma-separated list of collections to migrate | All collections |
| `-e, --exclude <list>` | Comma-separated list of collections to exclude | None |
| `-d, --dry-run` | Show what would be copied without actually copying | `false` |
| `-f, --force` | Skip confirmation prompt | `false` |
| `--max-documents <number>` | Maximum number of documents to copy (for testing) | No limit |
| `--batch-size <number>` | Batch size for Firestore operations | `500` |
| `--log-file <path>` | Path to save migration log JSON file | None |

## Migration Modes

⚠️ **Note**: All modes only COPY data from source to destination. Source database is never modified.

### 1. Merge Mode (Default)

Only copies documents that don't already exist in the destination. Safe for migrations where you want to avoid overwriting existing data.

**What it does:**
- Reads from source
- Checks if document exists in destination
- If not exists → copies to destination
- If exists → skips (keeps destination version)
- Source database: **unchanged**

**Use when:**
- Migrating to a new database
- Adding new data without affecting existing documents
- Incremental migrations

```bash
node scripts/migrate-firestore.js --mode merge
```

### 2. Overwrite Mode

Replaces documents in the destination if they exist. New documents are added, existing ones are updated.

**What it does:**
- Reads from source
- Writes/updates to destination (even if document already exists)
- Source database: **unchanged**
- Destination database: **overwritten** (only in destination, not source)

**Use when:**
- You want to sync data from source to destination
- You need to update existing documents in destination
- Source is the source of truth

```bash
node scripts/migrate-firestore.js --mode overwrite
```

### 3. Clear-Then-Copy Mode

Deletes all documents in the **destination** collection first, then copies from source. This ensures a clean copy.

**What it does:**
- Deletes documents in **destination only** (clears destination collection)
- Then copies fresh data from source to destination
- Source database: **unchanged** (never deleted from)
- Destination database: **cleared then repopulated**

**Use when:**
- You want an exact replica of the source
- You're doing a full reset in destination
- Testing scenarios

**⚠️ Warning**: This mode will delete all existing data in the **destination** collections only. Source is never touched!

```bash
node scripts/migrate-firestore.js --mode clear-then-copy
```

## Examples

### Example 1: Dry Run (Recommended First Step)

Always start with a dry-run to see what will be migrated:

```bash
node scripts/migrate-firestore.js --dry-run
```

This shows:
- Which collections will be migrated
- How many documents in each collection
- No data is actually copied

### Example 2: Migrate All Collections (New Database)

For a completely new database, use merge mode:

```bash
node scripts/migrate-firestore.js --mode merge
```

### Example 3: Migrate Specific Collections

Migrate only specific collections:

```bash
node scripts/migrate-firestore.js --collections users,contacts,cards
```

### Example 4: Test with Limited Documents

Test the migration with a small number of documents:

```bash
node scripts/migrate-firestore.js --mode merge --max-documents 100 --collections users
```

### Example 5: Exclude Certain Collections

Migrate all collections except some:

```bash
node scripts/migrate-firestore.js --exclude logs,analytics,backups
```

### Example 6: Full Reset Migration

Clear destination and copy everything (use with caution):

```bash
node scripts/migrate-firestore.js --mode clear-then-copy --force
```

### Example 7: Save Migration Log

Save detailed migration statistics to a JSON file:

```bash
node scripts/migrate-firestore.js --mode merge --log-file migration-log.json
```

### Example 8: Batch Migration (Migrate Collections Separately)

For very large databases, migrate collections in batches:

```bash
# Batch 1: User-related collections
node scripts/migrate-firestore.js --collections users,contacts

# Batch 2: Event-related collections
node scripts/migrate-firestore.js --collections events,registrations

# Batch 3: Card-related collections
node scripts/migrate-firestore.js --collections cards
```

## Safety Features

### 1. Confirmation Prompt

By default, the script asks for confirmation before starting:

```
⚠️  This will migrate data from xscard-addd4 to xscard-dev.
   Are you sure you want to continue? (y/N):
```

Skip with `--force` flag:
```bash
node scripts/migrate-firestore.js --force
```

### 2. Firebase Validation

The script validates both Firebase instances before starting:
- Checks that service account files can be loaded
- Verifies Firebase apps initialize successfully
- Tests connection by listing collections

### 3. Error Handling

- Individual document failures don't stop the migration
- All errors are tracked and reported in the summary
- Failed documents are logged with their paths and error messages

### 4. Progress Logging

Real-time progress updates show:
- Current collection being migrated
- Number of documents processed
- Batch commit confirmations

## Troubleshooting

### Error: "Failed to load service account file"

**Solution:**
1. Verify the service account files exist in `backend/` directory
2. Check file names are exactly: `source-serviceAccount.json` and `dest-serviceAccount.json`
3. Verify the JSON files are valid (not corrupted)

### Error: "Firebase initialization failed"

**Solution:**
1. Verify service account keys are correct and not expired
2. Check that the service account has Firestore Admin permissions
3. Ensure project IDs in the script match your Firebase projects

### Error: "Permission denied" or "Access denied"

**Solution:**
1. Verify service account has "Firestore Admin" role
2. Check IAM permissions in Google Cloud Console
3. Ensure the service account is enabled

### Migration is Slow

**Solutions:**
1. Reduce batch size: `--batch-size 250` (but this may be slower overall)
2. Migrate collections separately in batches
3. Check network connection
4. Ensure Firebase quotas aren't being hit

### Memory Issues with Large Collections

**Solutions:**
1. Use `--max-documents` to limit test migrations
2. Migrate collections individually
3. Increase Node.js memory: `node --max-old-space-size=4096 scripts/migrate-firestore.js`

### Documents Not Appearing in Destination

**Check:**
1. Verify you're looking at the correct Firebase project
2. Check migration mode - merge mode skips existing documents
3. Review error summary for failed documents
4. Verify destination project ID is correct

### Subcollections Not Copied

**Note:** Subcollections are copied recursively. If they're missing:
1. Check the error log for subcollection errors
2. Verify the source document was copied successfully (subcollections are copied after parent)
3. Check depth limits (max 10 levels)

## Migration Statistics

After migration, you'll see a summary:

```
📊 MIGRATION SUMMARY
============================================================

Collections:
  Processed: 15

Documents:
  Copied: 1,234
  Skipped: 56
  Failed: 0

Subcollections:
  Processed: 12

Time:
  Duration: 5m 32s
```

## Best Practices

1. **Always run a dry-run first** to verify what will be migrated
2. **Start with small test migrations** using `--max-documents`
3. **Migrate collections in batches** for large databases
4. **Use merge mode for new databases** to avoid overwriting
5. **Save migration logs** with `--log-file` for auditing
6. **Verify data after migration** in the destination project
7. **Keep service account files secure** and out of version control

## Next Steps

After migrating data:

1. **Migrate Firestore Indexes** - See [INDEXES_MIGRATION_GUIDE.md](./INDEXES_MIGRATION_GUIDE.md)
2. **Migrate Security Rules** - See [SECURITY_RULES_MIGRATION_GUIDE.md](./SECURITY_RULES_MIGRATION_GUIDE.md)
3. **Review Migration Checklist** - See [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)

## Support

If you encounter issues not covered in this guide:

1. Check the error messages and logs
2. Review the migration statistics for failed documents
3. Verify Firebase project configurations
4. Test with a small subset of data first

## Configuration

To customize defaults, edit the `CONFIG` object at the top of `backend/scripts/migrate-firestore.js`:

```javascript
const CONFIG = {
  SOURCE_SERVICE_ACCOUNT: 'path/to/source-serviceAccount.json',
  DEST_SERVICE_ACCOUNT: 'path/to/dest-serviceAccount.json',
  SOURCE_PROJECT_ID: 'xscard-addd4',
  DEST_PROJECT_ID: 'xscard-dev',
  BATCH_SIZE: 500,
  EXCLUDE_COLLECTIONS: [],
  DEFAULT_MODE: 'merge',
};
```

