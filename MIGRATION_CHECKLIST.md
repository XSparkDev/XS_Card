# Complete Firestore Migration Checklist

Use this checklist to ensure you migrate all necessary components from your source Firebase project (`xscard-addd4`) to your destination project (`xscard-dev`).

## Pre-Migration Preparation

### Service Account Setup
- [ ] Created service account key for source project (`xscard-addd4`)
- [ ] Saved as `backend/source-serviceAccount.json`
- [ ] Created service account key for destination project (`xscard-dev`)
- [ ] Saved as `backend/dest-serviceAccount.json`
- [ ] Added both files to `.gitignore` (security)
- [ ] Verified service accounts have Firestore Admin permissions

### Project Verification
- [ ] Confirmed source project ID: `xscard-addd4`
- [ ] Confirmed destination project ID: `xscard-dev`
- [ ] Verified access to both Firebase Console projects
- [ ] Verified destination project is empty or ready for migration
- [ ] Backed up source project data (if needed)

### Environment Setup
- [ ] Installed Node.js (v14+)
- [ ] Installed Firebase CLI (`npm install -g firebase-tools`)
- [ ] Installed project dependencies (`npm install` in backend directory)
- [ ] Verified `firebase-admin`, `commander`, and `chalk` are installed

## Data Migration

### Pre-Migration Testing
- [ ] Ran dry-run to see what will be migrated:
  ```bash
  npm run migrate-firestore:dry
  ```
- [ ] Reviewed dry-run output for expected collections
- [ ] Identified collections to exclude (if any)
- [ ] Tested with limited documents:
  ```bash
  node scripts/migrate-firestore.js --max-documents 100 --collections users
  ```

### Migration Execution
- [ ] Decided on migration mode (merge/overwrite/clear-then-copy)
- [ ] Planned collection migration strategy (all at once or in batches)
- [ ] For large databases: Identified batch groups for migration
- [ ] Executed data migration:
  ```bash
  npm run migrate-firestore -- --mode merge
  ```
- [ ] Monitored migration progress
- [ ] Reviewed migration summary for errors

### Post-Migration Data Verification
- [ ] Verified collections exist in destination project
- [ ] Spot-checked document counts match source (for small collections)
- [ ] Verified sample documents contain expected data
- [ ] Checked subcollections were copied correctly
- [ ] Tested application reads from destination project
- [ ] Reviewed error log for any failed documents

## Firestore Indexes Migration

### Index Discovery
- [ ] Listed all composite indexes in source project
- [ ] Documented index requirements (collection, fields, order)
- [ ] Identified indexes needed for application queries

### Index Migration
- [ ] Exported indexes from source project (see [INDEXES_MIGRATION_GUIDE.md](./INDEXES_MIGRATION_GUIDE.md))
- [ ] Reviewed exported index definitions
- [ ] Created/updated `firestore.indexes.json` in destination project
- [ ] Deployed indexes to destination:
  ```bash
  firebase use xscard-dev
  firebase deploy --only firestore:indexes
  ```
- [ ] Verified indexes appear in Firebase Console
- [ ] Waited for indexes to finish building
- [ ] Verified index build status (no errors)

### Index Testing
- [ ] Tested queries that require composite indexes
- [ ] Verified no "index not found" errors in application
- [ ] Created any missing indexes discovered during testing

## Firestore Security Rules Migration

### Rules Export
- [ ] Exported security rules from source project
- [ ] Saved rules to `firestore.rules` file
- [ ] Reviewed rules for project-specific references
- [ ] Updated any hardcoded project IDs or references

### Rules Deployment
- [ ] Deployed rules to destination project:
  ```bash
  firebase use xscard-dev
  firebase deploy --only firestore:rules
  ```
- [ ] Verified rules are published (not just saved as draft)
- [ ] Confirmed rules syntax is valid (no compilation errors)

### Rules Testing
- [ ] Used Rules Simulator to test common scenarios
- [ ] Tested authenticated read/write operations
- [ ] Tested unauthenticated access (where applicable)
- [ ] Verified rules match source project behavior
- [ ] Tested application authentication flows

## Firebase Storage Migration (If Applicable)

### Storage Structure Review
- [ ] Identified buckets used in source project
- [ ] Documented folder/file structure
- [ ] Identified storage security rules

### Storage Data Migration
- [ ] Exported storage files from source (using `gsutil` or Firebase Console)
- [ ] Imported files to destination storage bucket
- [ ] Verified file counts and sizes match
- [ ] Tested file access from application

### Storage Rules Migration
- [ ] Exported storage security rules from source
- [ ] Deployed storage rules to destination
- [ ] Tested file upload/download permissions

## Authentication Migration (If Applicable)

### Authentication Setup
- [ ] Enabled same authentication providers in destination
- [ ] Configured OAuth providers (Google, Facebook, etc.)
- [ ] Set up email/password authentication
- [ ] Configured authentication domains

### User Migration (If Required)
- [ ] Exported user accounts from source (if needed)
- [ ] Imported users to destination (using Admin SDK or Console)
- [ ] Verified user authentication works
- [ ] Tested password reset flows

**Note**: User accounts are typically NOT migrated unless specifically required. Users usually re-register.

## Application Configuration

### Environment Variables
- [ ] Updated application `.env` files with destination project ID
- [ ] Updated Firebase configuration files:
  - `src/config/firebaseConfig.ts` (or similar)
  - Backend Firebase initialization
- [ ] Updated API endpoints if changed
- [ ] Verified `FIREBASE_PROJECT_ID` environment variable

### Firebase SDK Configuration
- [ ] Updated `firebase.json` (if used)
- [ ] Updated Firebase config in frontend code
- [ ] Updated Firebase config in backend code
- [ ] Verified API keys are correct for destination project

### Testing Application
- [ ] Tested user registration in destination project
- [ ] Tested user login/authentication
- [ ] Tested data reads from destination Firestore
- [ ] Tested data writes to destination Firestore
- [ ] Tested file uploads (if using Storage)
- [ ] Tested critical application workflows

## Documentation & Cleanup

### Documentation
- [ ] Documented migration date and method
- [ ] Saved migration log file (if used `--log-file` option)
- [ ] Documented any custom changes made during migration
- [ ] Updated project README with new project details

### Cleanup
- [ ] Removed temporary service account files from non-secure locations
- [ ] Verified sensitive files are in `.gitignore`
- [ ] Removed test data if created during migration
- [ ] Archived or deleted old project references if no longer needed

## Post-Migration Monitoring

### First 24 Hours
- [ ] Monitored application for errors
- [ ] Checked Firebase Console for quota usage
- [ ] Verified all critical features work
- [ ] Checked for any missing data or indexes

### First Week
- [ ] Reviewed error logs for Firestore-related issues
- [ ] Monitored query performance
- [ ] Verified no "index missing" errors
- [ ] Tested edge cases and error scenarios

## Rollback Plan (If Needed)

### Preparation
- [ ] Documented rollback procedure
- [ ] Verified source project is still accessible
- [ ] Created backup of source project (if needed)
- [ ] Documented how to revert to source project

### Rollback Execution (If Required)
- [ ] Revert application configuration to source project
- [ ] Notify users if necessary
- [ ] Investigate migration issues
- [ ] Fix issues before re-attempting migration

## Migration Summary

After completing migration, document:

- [ ] Migration date and time
- [ ] Collections migrated: _____
- [ ] Total documents migrated: _____
- [ ] Subcollections migrated: _____
- [ ] Errors encountered: _____
- [ ] Migration duration: _____
- [ ] Person who performed migration: _____
- [ ] Notes or issues: _____

---

## Quick Reference Commands

```bash
# Dry-run migration
npm run migrate-firestore:dry

# Migrate all collections (merge mode)
npm run migrate-firestore -- --mode merge

# Migrate specific collections
node scripts/migrate-firestore.js --collections users,contacts,cards

# Migrate with log file
node scripts/migrate-firestore.js --mode merge --log-file migration-log.json

# Deploy indexes
firebase use xscard-dev
firebase deploy --only firestore:indexes

# Deploy security rules
firebase use xscard-dev
firebase deploy --only firestore:rules
```

## Additional Resources

- [Migration README](./MIGRATION_README.md) - Main migration guide
- [Indexes Migration Guide](./INDEXES_MIGRATION_GUIDE.md) - Index migration steps
- [Security Rules Migration Guide](./SECURITY_RULES_MIGRATION_GUIDE.md) - Rules migration steps
- [Firebase Documentation](https://firebase.google.com/docs/firestore)

## Support

If you encounter issues:
1. Review the error messages and logs
2. Check migration statistics for failed documents
3. Verify Firebase project configurations
4. Test with a small subset of data first
5. Review Firebase Console for quota limits or errors

---

**Last Updated**: Use this checklist to track your migration progress. Check off items as you complete them.

