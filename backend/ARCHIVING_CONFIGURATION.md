# User Archiving Configuration

## Overview
The inactive users job can now archive users and optionally delete them from Firebase Authentication. This helps with Apple's data deletion requirements while maintaining compliance.

## Environment Variables

Add these to your `.env` file:

```bash
# Inactive users check interval (in minutes)
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=259200  # 6 months

# Archiving configuration
ARCHIVE_INACTIVE_USERS=true                    # Enable/disable archiving
DELETE_FIREBASE_AUTH_USERS=true               # Delete from Firebase Auth
```

## Configuration Options

### 1. Basic Listing Only (Default)
```bash
ARCHIVE_INACTIVE_USERS=false
DELETE_FIREBASE_AUTH_USERS=false
```
**Result**: Only lists inactive users, no archiving or deletion

### 2. Archive to Firestore Only
```bash
ARCHIVE_INACTIVE_USERS=true
DELETE_FIREBASE_AUTH_USERS=false
```
**Result**: 
- Moves user data to `archived_users` collection
- Removes from active `users` collection
- Keeps Firebase Auth user intact

### 3. Full Archiving + Auth Deletion
```bash
ARCHIVE_INACTIVE_USERS=true
DELETE_FIREBASE_AUTH_USERS=true
```
**Result**:
- Archives user data to `archived_users` collection
- Deletes user from Firebase Authentication
- Removes from active `users` collection

## Archive Process Flow

### Step 1: Find Inactive Users
- Queries users where `active: false`
- Lists detailed information for review

### Step 2: Archive Process (if enabled)
1. **Create archive record** in `archived_users` collection
2. **Delete from Firebase Auth** (if enabled)
3. **Remove from active users** collection
4. **Log all actions** for audit trail

### Step 3: Summary Report
- Total users processed
- Successfully archived count
- Firebase Auth deletions count
- Any errors encountered

## Archive Data Structure

```javascript
// archived_users collection
{
  // Original user data
  id: "original_user_id",
  email: "user@example.com",
  name: "John Doe",
  // ... all original fields
  
  // Archive metadata
  originalId: "original_user_id",
  archivedAt: "2024-01-15T10:30:00Z",
  archivedBy: "system",
  archiveReason: "inactive_user",
  archiveVersion: "1.0"
}
```

## Firebase Auth Deletion

### What Gets Deleted
- User account from Firebase Authentication
- All associated auth tokens
- User's ability to sign in

### What Stays
- Archived user data in Firestore
- Audit trail of deletion
- Any related Firestore documents (cards, contacts, etc.)

## Safety Features

### Error Handling
- Individual user processing (one failure doesn't stop others)
- Detailed error logging
- Summary report of successes/failures

### Audit Trail
- All archive actions logged
- Original user ID preserved
- Timestamp of archiving
- Reason for archiving

### Rollback Capability
- Archive data can be restored if needed
- Original user ID maintained for reference
- Complete user data preserved

## Testing Configuration

### For Development/Testing
```bash
# Check every 2 minutes
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=2

# Enable archiving for testing
ARCHIVE_INACTIVE_USERS=true
DELETE_FIREBASE_AUTH_USERS=false  # Start with Firestore only
```

### For Production
```bash
# Check every 6 months
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=259200

# Full archiving enabled
ARCHIVE_INACTIVE_USERS=true
DELETE_FIREBASE_AUTH_USERS=true
```

## Manual Archiving

You can manually trigger archiving:

```javascript
const jobs = require('./jobs');

// Archive specific users
await jobs.archiveInactiveUsers(db, userDocs, shouldDeleteAuth);

// Check inactive users (lists only)
await jobs.checkInactiveUsers(db);
```

## Compliance Benefits

### Apple Requirements
- ✅ **Data deletion**: Users removed from auth system
- ✅ **Data minimization**: Only inactive users affected
- ✅ **Transparency**: Clear audit trail

### Legal Compliance
- ✅ **GDPR**: Right to be forgotten
- ✅ **CCPA**: Data deletion rights
- ✅ **Audit trail**: Complete record of actions

## Monitoring

### Log Output
```
=== INACTIVE USERS LIST ===
1. ID: user123
   Email: user@example.com
   Name: John Doe
   Last Login: Never
   Created: 2024-01-15
   Active: false
---
=== END INACTIVE USERS LIST (1 total) ===

Archiving inactive users...
Archiving user: user123 (user@example.com)
✅ Archived Firestore data for user: user123
✅ Deleted Firebase Auth user: user123
✅ Removed from active users: user123

=== ARCHIVE SUMMARY ===
Total users processed: 1
Successfully archived: 1
Firebase Auth deleted: 1
Errors encountered: 0
=== ARCHIVE COMPLETE ===
```

## Best Practices

1. **Start with listing only** - Verify inactive users before archiving
2. **Test with small intervals** - Use 2-5 minutes for testing
3. **Monitor logs** - Check for errors in archive process
4. **Backup before archiving** - Ensure you have data backups
5. **Gradual rollout** - Start with Firestore archiving, then add Auth deletion
