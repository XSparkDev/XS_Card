# Unverified Accounts Cleanup Feature

## ⚠️ FEATURE CURRENTLY DISABLED
This feature is currently commented out and inactive. All imports and functions are disabled.

## Overview
This feature automatically cleans up accounts that have been created but never verified their email addresses.

## How It Works
1. **6 Month Grace Period**: Accounts are given 6 months to verify their email
2. **Warning System**: Users receive warning emails before deletion
   - **First Warning**: 2 weeks before deletion
   - **Final Warning**: 1 week before deletion
3. **Automatic Deletion**: Accounts are deleted after 6 months if still unverified

## Files Created
- `cleanupUnverifiedAccounts.js` - Main cleanup logic
- `cleanupController.js` - API endpoints for manual cleanup
- `cleanupRoutes.js` - Route definitions
- `cronCleanup.js` - Automated cron job script

## Usage

### Manual Cleanup
```bash
# Run cleanup directly
node backend/scripts/cleanupUnverifiedAccounts.js

# Or use the API endpoints (requires authentication)
GET /admin/cleanup/status  # Check what would be cleaned up
POST /admin/cleanup/run    # Run the cleanup
GET /admin/cleanup/test    # Dry run test
```

### Automated Cleanup (Cron Job)
```bash
# Add to crontab for monthly cleanup
0 0 1 * * /usr/bin/node /path/to/backend/scripts/cronCleanup.js

# Or use PM2 for process management
pm2 start backend/scripts/cronCleanup.js --cron "0 0 1 * *"
```

## Configuration
Edit the `CLEANUP_CONFIG` object in `cleanupUnverifiedAccounts.js`:
- `ACCOUNT_AGE_THRESHOLD`: How old accounts must be before cleanup (default: 6 months)
- `FIRST_WARNING_DAYS`: Days before deletion to send first warning (default: 14)
- `FINAL_WARNING_DAYS`: Days before deletion to send final warning (default: 7)
- `BATCH_SIZE`: Number of accounts to process at once (default: 50)

## Email Templates
The system sends HTML emails with:
- Clear warning about account deletion
- Verification link to keep account active
- Professional styling and messaging

## Safety Features
- **Batch Processing**: Processes accounts in small batches to avoid system overload
- **Error Handling**: Continues processing even if individual accounts fail
- **Logging**: Comprehensive logging for monitoring and debugging
- **Dry Run**: Test mode to see what would be cleaned up without actually doing it

## Database Impact
- **Reads**: Queries all unverified accounts
- **Writes**: Updates warning timestamps, deletes expired accounts
- **Performance**: Uses batch processing to minimize impact

## Security
- **Authentication Required**: All API endpoints require valid authentication
- **Admin Only**: Cleanup endpoints should be restricted to admin users
- **Audit Trail**: All cleanup actions are logged

## Monitoring
Check the logs for:
- Number of accounts found
- Warning emails sent
- Accounts deleted
- Any errors encountered

## Re-enabling the Feature
To re-enable this feature:
1. Uncomment all imports in the files
2. Uncomment all route registrations
3. Add the routes to your main server file
4. Test with the API endpoints
5. Set up cron jobs if needed

## Disabling the Feature
To disable this feature:
1. Comment out all imports in the files
2. Comment out the route registration in your main server file
3. Remove any cron jobs
4. The feature will be completely inactive

## Testing
Use the test endpoint to see what would be cleaned up:
```bash
GET /admin/cleanup/test
```

This shows a simulation without actually sending emails or deleting accounts.
