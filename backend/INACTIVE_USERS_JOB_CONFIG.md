# Inactive Users Job Configuration

## Overview
This job runs periodically to find and list inactive user accounts (where `active: false`). It's designed to help with Apple's data deletion requirements while maintaining company policy of data retention.

## Environment Variable
Add this to your `.env` file:

```bash
# Inactive users check interval (in minutes)
# Default: 6 months (259,200 minutes)
# For testing: Use small values like 5, 10, 30 minutes
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=259200
```

## Configuration Examples

### Production (6 months = ~259,200 minutes)
```bash
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=259200
```

### Testing (5 minutes)
```bash
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=5
```

### Testing (1 hour)
```bash
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=60
```

### Testing (1 day)
```bash
INACTIVE_USERS_CHECK_INTERVAL_MINUTES=1440
```

## Time Conversions
- 1 minute = 1
- 1 hour = 60
- 1 day = 1,440
- 1 week = 10,080
- 1 month (30 days) = 43,200
- 6 months = 259,200
- 1 year = 525,600

## What the Job Does
1. **Finds inactive users**: Queries users where `active: false`
2. **Lists user details**: Logs ID, email, name, last login, creation date
3. **Logs to console**: Outputs formatted list for review
4. **Ready for archiving**: Structure prepared for future archiving functionality

## Current Behavior
- **Lists only**: Currently just logs inactive users to console
- **No deletion**: Does not delete or modify user data
- **Review ready**: Output formatted for easy review
- **Archive ready**: Structure prepared for future archiving

## Future Enhancements
- Archive inactive users to separate collection
- Send notifications to admin
- Export inactive users list
- Automatic data anonymization

## Server Logs
The job will log:
- When it runs
- How many inactive users found
- Detailed list of each inactive user
- Any errors encountered
